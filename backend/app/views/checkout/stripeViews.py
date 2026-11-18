import logging
import stripe

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from urllib.parse import urlencode

from django.conf import settings
from django.db import transaction
from django.http import HttpResponseRedirect

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status

from app.models import (
    Orders,
    OrderItems,
    SpareParts,
    Address,
    CartItems,
)

from utils.tasks import (
    send_order_confirmation_email_task,
)


logger = logging.getLogger(__name__)


# --------------------------- STRIPE LOCALE HELPERS ---------------------------
STRIPE_LOCALE_MAP = {
    "en": "en",
    "sw": "auto",
    "fr": "fr",
    "ar": "auto",
    "zh": "zh",
    "hi": "auto",
    "es": "es",
    "pt": "pt-BR",
    "de": "de",
    "it": "it",
    "ja": "ja",
    "ko": "ko",
    "ru": "ru",
    "tr": "tr",
    "nl": "nl",
}


def normalize_language_code(language):
    language = (language or "en").strip().lower()
    return language.replace("_", "-").split("-")[0]


def get_stripe_locale(language):
    language = normalize_language_code(language)
    return STRIPE_LOCALE_MAP.get(language, "auto")


# --------------------------- STRIPE PRODUCT NAME TRANSLATIONS ---------------------------
STRIPE_PRODUCT_TRANSLATIONS = {
    "fr": {
        "categories": {
            "tyre": "Pneu",
            "rim": "Jante",
            "battery": "Batterie",
            "filter": "Filtre à huile",
            "oil filter": "Filtre à huile",
        },
        "vehicle_types": {
            "sedan": "Berline",
            "suv": "SUV",
            "truck": "Camion",
            "bus": "Bus",
        },
    },
}


def normalize_product_attribute(value):
    return " ".join(
        str(value or "")
        .strip()
        .lower()
        .replace("_", " ")
        .replace("-", " ")
        .split()
    )


def get_stripe_product_name(sparepart, language):
    language = normalize_language_code(language)

    brand = str(sparepart.brand or "").strip()

    category = normalize_product_attribute(
        sparepart.category
    )

    vehicle_type = normalize_product_attribute(
        sparepart.vehicle_type
    )

    translations = STRIPE_PRODUCT_TRANSLATIONS.get(language)

    if not translations:
        return " ".join(
            value
            for value in (
                brand,
                vehicle_type,
                category,
            )
            if value
        )

    translated_category = translations["categories"].get(
        category,
        category.title(),
    )

    translated_vehicle_type = translations["vehicle_types"].get(
        vehicle_type,
        vehicle_type.upper()
        if vehicle_type == "suv"
        else vehicle_type.title(),
    )

    if language == "fr":
        return " ".join(
            value
            for value in (
                brand,
                translated_category,
                "pour",
                translated_vehicle_type,
            )
            if value
        )

    return " ".join(
        value
        for value in (
            brand,
            translated_vehicle_type,
            translated_category,
        )
        if value
    )


# --------------------------- STRIPE HELPERS ---------------------------
def to_decimal(value, field_name="Amount"):
    try:
        amount = Decimal(str(value))
    except (
        TypeError,
        ValueError,
        InvalidOperation,
    ):
        raise ValueError(f"{field_name} is invalid")

    if not amount.is_finite():
        raise ValueError(f"{field_name} is invalid")

    return amount


def to_stripe_amount(amount):
    amount = to_decimal(amount)

    return int(
        (amount * Decimal("100")).quantize(
            Decimal("1"),
            rounding=ROUND_HALF_UP,
        )
    )


def calculate_order_total(order):
    total = sum(
        (
            to_decimal(item.subtotal, "Order item subtotal")
            if item.subtotal is not None
            else Decimal("0.00")
            for item in order.order_items.all()
        ),
        Decimal("0.00"),
    )

    return total.quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )


def calculate_stripe_expected_amount(order):
    return to_stripe_amount(
        calculate_order_total(order)
    )


def clear_user_cart(user):
    CartItems.objects.filter(
        user=user
    ).delete()


def mark_order_as_failed(
    order_id,
    payment_reference=None,
):
    with transaction.atomic():
        order = (
            Orders.objects
            .select_for_update()
            .get(pk=order_id)
        )

        if order.paid:
            return order

        if payment_reference:
            if (
                order.payment_reference
                and order.payment_reference != payment_reference
            ):
                raise ValueError(
                    "Stripe payment reference mismatch"
                )

            order.payment_reference = payment_reference

        if order.status == "pending":
            order.status = "failed"

        update_fields = ["status"]

        if payment_reference:
            update_fields.append("payment_reference")

        order.save(
            update_fields=list(dict.fromkeys(update_fields))
        )

        return order


def mark_order_as_expired(order_id):
    with transaction.atomic():
        order = (
            Orders.objects
            .select_for_update()
            .get(pk=order_id)
        )

        if not order.paid and order.status == "pending":
            order.status = "expired"

            order.save(
                update_fields=["status"]
            )

        return order


def mark_order_as_paid(
    order_id,
    payment_reference=None,
):
    with transaction.atomic():
        order = (
            Orders.objects
            .select_for_update()
            .prefetch_related("order_items")
            .get(pk=order_id)
        )

        if payment_reference:
            if (
                order.payment_reference
                and order.payment_reference != payment_reference
            ):
                raise ValueError(
                    "Stripe payment reference mismatch"
                )

        if order.paid:
            logger.info(
                "Stripe payment: order %s is already marked as paid",
                order_id,
            )
            return order

        total_price = calculate_order_total(order)

        if total_price <= Decimal("0.00"):
            raise ValueError(
                "Order total must be greater than zero"
            )

        order.total_price = total_price
        order.paid = True

        if order.status in ("failed", "expired"):
            order.status = "pending"

        if payment_reference:
            order.payment_reference = payment_reference

        update_fields = [
            "total_price",
            "paid",
            "status",
        ]

        if payment_reference:
            update_fields.append("payment_reference")

        order.save(
            update_fields=update_fields
        )

        clear_user_cart(order.user)

        customer_email = order.user.email
        order_id_value = str(order.id)
        payment_method = order.payment_method

        logger.info(
            "Order %s marked as paid",
            order_id_value,
        )

        def send_confirmation_email():
            try:
                send_order_confirmation_email_task.delay(
                    customer_email,
                    order_id_value,
                    total_price,
                    payment_method,
                )
            except Exception:
                logger.exception(
                    "Failed to queue order confirmation email "
                    "for order %s",
                    order_id_value,
                )

        transaction.on_commit(send_confirmation_email)

        return order


def refund_stripe_order(order):
    if not order.payment_reference:
        raise ValueError(
            "Stripe payment reference is missing."
        )

    refund_amount = calculate_order_total(order)

    if refund_amount <= Decimal("0.00"):
        raise ValueError(
            "Refund amount must be greater than zero."
        )

    stripe.api_key = settings.STRIPE_SECRET_KEY

    refund = stripe.Refund.create(
        payment_intent=order.payment_reference,
        amount=to_stripe_amount(refund_amount),
        metadata={
            "order_id": str(order.id),
        },
        idempotency_key=f"order-cancellation-{order.id}",
    )

    logger.info(
        "Stripe refund: order %s | refund %s | status %s",
        order.id,
        refund.id,
        refund.status,
    )

    return refund


def parse_quantity(value):
    if isinstance(value, bool):
        raise ValueError("Quantity must be a positive integer")

    try:
        quantity_decimal = Decimal(str(value))
    except (
        TypeError,
        ValueError,
        InvalidOperation,
    ):
        raise ValueError("Quantity must be a positive integer")

    if (
        not quantity_decimal.is_finite()
        or quantity_decimal != quantity_decimal.to_integral_value()
        or quantity_decimal <= 0
    ):
        raise ValueError("Quantity must be a positive integer")

    return int(quantity_decimal)


# --------------------------- CREATE STRIPE CHECKOUT SESSION ---------------------------
class CreateStripeSessionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data or {}
        current_user = request.user

        language = data.get("language", "en")
        stripe_locale = get_stripe_locale(language)

        items = data.get("items", [])

        if not isinstance(items, list):
            return Response(
                {"error": "Items must be a list"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not items:
            return Response(
                {"error": "Cart is empty"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        stripe.api_key = settings.STRIPE_SECRET_KEY
        order = None

        try:
            try:
                address = Address.objects.get(
                    user=current_user
                )
            except Address.DoesNotExist:
                return Response(
                    {"error": "Customer address not found"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            with transaction.atomic():
                order = Orders.objects.create(
                    user=current_user,
                    address=address,
                    paid=False,
                    payment_method="stripe",
                    status="pending",
                    total_price=Decimal("0.00"),
                )

                stripe_items = []

                for item in items:
                    if not isinstance(item, dict):
                        raise ValueError(
                            "Each item must be an object"
                        )

                    sparepart_id = item.get("sparepart_id")

                    if not sparepart_id:
                        raise ValueError(
                            "Missing sparepart_id"
                        )

                    try:
                        sparepart = (
                            SpareParts.objects
                            .select_for_update()
                            .get(pk=sparepart_id)
                        )
                    except SpareParts.DoesNotExist:
                        raise ValueError(
                            f"Spare part {sparepart_id} was not found"
                        )

                    quantity = parse_quantity(
                        item.get("quantity", 1)
                    )

                    sparepart.calculate_discount()

                    unit_price = to_decimal(
                        sparepart.marked_price,
                        "Spare part price",
                    ) - to_decimal(
                        sparepart.discount_amount,
                        "Discount amount",
                    )

                    unit_price = unit_price.quantize(
                        Decimal("0.01"),
                        rounding=ROUND_HALF_UP,
                    )

                    if unit_price <= Decimal("0.00"):
                        raise ValueError(
                            f"Invalid price for spare part {sparepart_id}"
                        )

                    subtotal = (
                        unit_price * quantity
                    ).quantize(
                        Decimal("0.01"),
                        rounding=ROUND_HALF_UP,
                    )

                    OrderItems.objects.create(
                        order=order,
                        sparepart=sparepart,
                        quantity=quantity,
                        unit_price=unit_price,
                        subtotal=subtotal,
                    )

                    stripe_items.append(
                        {
                            "price_data": {
                                "currency": "kes",
                                "product_data": {
                                    "name": get_stripe_product_name(
                                        sparepart,
                                        language,
                                    ),
                                },
                                "unit_amount": to_stripe_amount(
                                    unit_price
                                ),
                            },
                            "quantity": quantity,
                        }
                    )

                order.total_price = calculate_order_total(
                    order
                )

                if order.total_price <= Decimal("0.00"):
                    raise ValueError(
                        "Order total must be greater than zero"
                    )

                order.save(
                    update_fields=["total_price"]
                )

            cancel_url = (
                f"{settings.STRIPE_CANCEL_URL}?"
                f"{urlencode({'order_id': str(order.id)})}"
            )

            checkout_session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                mode="payment",
                line_items=stripe_items,
                metadata={
                    "order_id": str(order.id),
                },
                payment_intent_data={
                    "metadata": {
                        "order_id": str(order.id),
                    },
                },
                customer_email=current_user.email,
                success_url=settings.STRIPE_SUCCESS_URL,
                cancel_url=cancel_url,
                locale=stripe_locale,
                idempotency_key=f"stripe-checkout-{order.id}",
            )

        except ValueError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        except stripe.error.StripeError as exc:
            if order is not None:
                try:
                    mark_order_as_failed(order.id)
                except Exception:
                    logger.exception(
                        "Failed to mark order %s as failed "
                        "after Stripe session error",
                        order.id,
                    )

            logger.exception(
                "Stripe Checkout session creation failed"
            )

            return Response(
                {"error": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        except Exception:
            logger.exception(
                "Unexpected Stripe Checkout session creation error"
            )

            if order is not None:
                try:
                    mark_order_as_failed(order.id)
                except Exception:
                    logger.exception(
                        "Failed to mark order %s as failed",
                        order.id,
                    )

            return Response(
                {"error": "Failed to create checkout session"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {"checkout_url": checkout_session.url},
            status=status.HTTP_200_OK,
        )


# --------------------------- CANCEL STRIPE SESSION ---------------------------
class CancelStripeSessionView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        order_id = request.query_params.get("order_id")

        if not order_id:
            return Response(
                {"error": "Missing order ID"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Do not mark the order as cancelled here.
        # A return to the Checkout cancel URL does not guarantee
        # that the Checkout session can no longer complete.
        # The checkout.session.expired webhook handles expiration.

        return HttpResponseRedirect(
            settings.STRIPE_CANCEL_URL
        )


# --------------------------- STRIPE WEBHOOK ---------------------------
class StripeWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        payload = request.body
        sig_header = request.META.get("HTTP_STRIPE_SIGNATURE")
        endpoint_secret = settings.STRIPE_WEBHOOK_SECRET

        try:
            event = stripe.Webhook.construct_event(
                payload,
                sig_header,
                endpoint_secret,
            )

        except ValueError:
            logger.warning(
                "Stripe webhook received an invalid payload"
            )

            return Response(
                {"error": "Invalid payload"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        except stripe.error.SignatureVerificationError:
            logger.warning(
                "Stripe webhook signature verification failed"
            )

            return Response(
                {"error": "Invalid signature"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception:
            logger.exception(
                "Unexpected Stripe webhook validation error"
            )

            return Response(
                {"error": "Invalid webhook"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        event_type = event["type"]
        payment_object = event["data"]["object"]

        if event_type == "checkout.session.completed":
            session = payment_object

            metadata = (
                session.metadata.to_dict()
                if session.metadata
                else {}
            )

            order_id = metadata.get("order_id")

            if not order_id:
                return Response(
                    {"error": "Missing order ID"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if session.mode != "payment":
                return Response(
                    {"error": "Invalid Checkout session mode"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if session.payment_status != "paid":
                logger.info(
                    "Stripe Checkout session for order %s "
                    "is not paid: %s",
                    order_id,
                    session.payment_status,
                )

                return Response(
                    {"success": True},
                    status=status.HTTP_200_OK,
                )

            if (
                not session.currency
                or session.currency.upper() != "KES"
            ):
                return Response(
                    {"error": "Invalid or missing currency"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if session.amount_total is None:
                return Response(
                    {"error": "Missing amount"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            payment_reference = session.payment_intent

            if not payment_reference:
                return Response(
                    {"error": "Missing payment reference"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not isinstance(payment_reference, str):
                payment_reference = payment_reference.id

            try:
                with transaction.atomic():
                    order = (
                        Orders.objects
                        .select_for_update()
                        .prefetch_related("order_items")
                        .get(pk=order_id)
                    )

                    if order.payment_method != "stripe":
                        return Response(
                            {"error": "Invalid payment method"},
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    expected_amount = calculate_stripe_expected_amount(
                        order
                    )

                    if session.amount_total != expected_amount:
                        logger.error(
                            "Stripe amount mismatch for order %s: "
                            "Stripe=%s, expected=%s",
                            order_id,
                            session.amount_total,
                            expected_amount,
                        )

                        return Response(
                            {"error": "Payment amount mismatch"},
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    mark_order_as_paid(
                        order.id,
                        payment_reference,
                    )

            except Orders.DoesNotExist:
                return Response(
                    {"error": "Order not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            except ValueError as exc:
                logger.error(
                    "Stripe payment validation error: %s",
                    str(exc),
                )

                return Response(
                    {"error": str(exc)},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            except Exception:
                logger.exception(
                    "Stripe payment processing failed for order %s",
                    order_id,
                )

                return Response(
                    {"error": "Failed to process payment"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            return Response(
                {"success": True},
                status=status.HTTP_200_OK,
            )

        if event_type in (
            "checkout.session.async_payment_failed",
            "payment_intent.payment_failed",
        ):
            metadata = (
                payment_object.metadata.to_dict()
                if payment_object.metadata
                else {}
            )

            order_id = metadata.get("order_id")

            if not order_id:
                logger.warning(
                    "Stripe failure event %s has no order_id metadata",
                    event_type,
                )

                return Response(
                    {"error": "Missing order ID"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if event_type == "payment_intent.payment_failed":
                payment_reference = payment_object.id
            else:
                payment_reference = payment_object.payment_intent

                if not isinstance(payment_reference, str):
                    payment_reference = (
                        payment_reference.id
                        if payment_reference
                        else None
                    )

            try:
                order = Orders.objects.get(pk=order_id)

                if order.payment_method != "stripe":
                    return Response(
                        {"error": "Invalid payment method"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                mark_order_as_failed(
                    order.id,
                    payment_reference,
                )

            except Orders.DoesNotExist:
                return Response(
                    {"error": "Order not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            except ValueError as exc:
                return Response(
                    {"error": str(exc)},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            except Exception:
                logger.exception(
                    "Stripe failure webhook processing failed "
                    "for order %s",
                    order_id,
                )

                return Response(
                    {"error": "Failed to update order"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            return Response(
                {"success": True},
                status=status.HTTP_200_OK,
            )

        if event_type == "checkout.session.expired":
            metadata = (
                payment_object.metadata.to_dict()
                if payment_object.metadata
                else {}
            )

            order_id = metadata.get("order_id")

            if not order_id:
                return Response(
                    {"error": "Missing order ID"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                order = Orders.objects.get(pk=order_id)

                if order.payment_method != "stripe":
                    return Response(
                        {"error": "Invalid payment method"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                mark_order_as_expired(order.id)

            except Orders.DoesNotExist:
                return Response(
                    {"error": "Order not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            except Exception:
                logger.exception(
                    "Stripe expiration webhook processing failed "
                    "for order %s",
                    order_id,
                )

                return Response(
                    {"error": "Failed to expire order"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        return Response(
            {"success": True},
            status=status.HTTP_200_OK,
        )
