import stripe

from decimal import Decimal
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


# --------------------------- STRIPE HELPERS ---------------------------
def calculate_order_total(order):
    return sum(
        (
            item.subtotal
            if item.subtotal is not None
            else Decimal("0.00")
        )
        for item in order.order_items.all()
    ).quantize(
        Decimal("0.01")
    )


def calculate_stripe_expected_amount(order):
    total_price = calculate_order_total(order)

    return int(
        (
            total_price * Decimal("100")
        ).quantize(
            Decimal("1")
        )
    )


def clear_user_cart(user):
    CartItems.objects.filter(
        user=user
    ).delete()


def mark_order_as_paid(
    order_id,
    payment_reference=None,
):
    with transaction.atomic():

        order = (
            Orders.objects
            .select_for_update()
            .prefetch_related(
                "order_items"
            )
            .get(
                pk=order_id
            )
        )

        if order.paid:

            print(
                f"STRIPE PAYMENT: "
                f"Order {order_id} is already marked as paid"
            )

            return order

        total_price = (
            calculate_order_total(
                order
            )
        )

        if total_price <= Decimal("0.00"):

            raise ValueError(
                "Order total must be greater than zero"
            )

        order.total_price = total_price
        order.paid = True

        if payment_reference:
            order.payment_reference = (
                payment_reference
            )

        update_fields = [
            "total_price",
            "paid",
        ]

        if payment_reference:
            update_fields.append(
                "payment_reference"
            )

        order.save(
            update_fields=update_fields
        )

        clear_user_cart(
            order.user
        )

        customer_email = order.user.email
        order_id_value = str(order.id)
        payment_method = order.payment_method

        print(
            f"ORDER {order_id_value} MARKED AS PAID"
        )

        transaction.on_commit(
            lambda: send_order_confirmation_email_task.delay(
                customer_email,
                order_id_value,
                total_price,
                payment_method,
            )
        )

        return order


def refund_stripe_order(order):

    if not order.payment_reference:

        raise ValueError(
            "Stripe payment reference is missing."
        )

    refund_amount = (
        calculate_order_total(
            order
        )
    )

    if refund_amount <= Decimal("0.00"):

        raise ValueError(
            "Refund amount must be greater than zero."
        )

    stripe.api_key = settings.STRIPE_SECRET_KEY

    refund = stripe.Refund.create(
        payment_intent=order.payment_reference,
        amount=int(
            (
                refund_amount * Decimal("100")
            ).quantize(
                Decimal("1")
            )
        ),
        metadata={
            "order_id": str(order.id),
        },
        idempotency_key=f"order-cancellation-{order.id}",
    )

    refund_status = refund.status

    print(
        f"STRIPE REFUND: "
        f"Order {order.id} | "
        f"Refund {refund.id} | "
        f"Status {refund_status}"
    )

    return refund


# --------------------------- CREATE STRIPE CHECKOUT SESSION ---------------------------
class CreateStripeSessionView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request):

        data = request.data or {}
        current_user = request.user

        items = data.get(
            "items",
            []
        )

        if not items:

            return Response(
                {
                    "error": "Cart is empty"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(
            items,
            list,
        ):

            return Response(
                {
                    "error": "Items must be a list"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        stripe.api_key = settings.STRIPE_SECRET_KEY

        try:

            try:

                address = (
                    Address.objects
                    .get(
                        user=current_user
                    )
                )

            except Address.DoesNotExist:

                return Response(
                    {
                        "error": "Customer address not found"
                    },
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

                    if not isinstance(
                        item,
                        dict,
                    ):

                        raise ValueError(
                            "Each item must be an object"
                        )

                    sparepart_id = item.get(
                        "sparepart_id"
                    )

                    if not sparepart_id:

                        raise ValueError(
                            "Missing sparepart_id"
                        )

                    try:

                        sparepart = (
                            SpareParts.objects
                            .get(
                                pk=sparepart_id
                            )
                        )

                    except SpareParts.DoesNotExist:

                        raise ValueError(
                            f"Spare part {sparepart_id} was not found"
                        )

                    quantity = item.get(
                        "quantity",
                        1,
                    )

                    try:

                        quantity = int(
                            quantity
                        )

                    except (
                        ValueError,
                        TypeError,
                    ):

                        raise ValueError(
                            "Quantity must be an integer"
                        )

                    if quantity <= 0:

                        raise ValueError(
                            "Quantity must be positive"
                        )

                    sparepart.calculate_discount()

                    unit_price = (
                        sparepart.marked_price
                        - sparepart.discount_amount
                    ).quantize(
                        Decimal("0.01")
                    )

                    subtotal = (
                        unit_price * quantity
                    ).quantize(
                        Decimal("0.01")
                    )

                    OrderItems.objects.create(
                        order=order,
                        sparepart=sparepart,
                        quantity=quantity,
                        unit_price=unit_price,
                        subtotal=subtotal,
                    )

                    stripe_unit_amount = int(
                        (
                            unit_price * Decimal("100")
                        ).quantize(
                            Decimal("1")
                        )
                    )

                    stripe_items.append(
                        {
                            "price_data": {
                                "currency": "kes",
                                "product_data": {
                                    "name": (
                                        f"{sparepart.brand} "
                                        f"{sparepart.vehicle_type} "
                                        f"{sparepart.category}"
                                    ),
                                },
                                "unit_amount": (
                                    stripe_unit_amount
                                ),
                            },
                            "quantity": quantity,
                        }
                    )

                order.total_price = (
                    calculate_order_total(
                        order
                    )
                )

                order.save(
                    update_fields=[
                        "total_price"
                    ]
                )

            cancel_url = (
                f"{settings.STRIPE_CANCEL_URL}?"
                f"{urlencode({'order_id': str(order.id)})}"
            )

            checkout_session = (
                stripe.checkout.Session.create(
                    payment_method_types=[
                        "card"
                    ],
                    mode="payment",
                    line_items=stripe_items,
                    metadata={
                        "order_id": str(order.id),
                    },
                    customer_email=current_user.email,
                    success_url=settings.STRIPE_SUCCESS_URL,
                    cancel_url=cancel_url,
                    idempotency_key=f"stripe-checkout-{order.id}",
                )
            )

        except ValueError as exc:

            return Response(
                {
                    "error": str(exc)
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        except stripe.error.StripeError as exc:

            return Response(
                {
                    "error": str(exc)
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        except Exception as exc:

            print(
                "STRIPE PAYMENT ERROR:",
                repr(exc),
            )

            return Response(
                {
                    "error": "Failed to create checkout session"
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "checkout_url": checkout_session.url
            },
            status=status.HTTP_200_OK,
        )


# --------------------------- CANCEL STRIPE SESSION ---------------------------
class CancelStripeSessionView(APIView):

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):

        order_id = request.query_params.get(
            "order_id"
        )

        if not order_id:

            return Response(
                {
                    "error": "Missing order ID"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:

            with transaction.atomic():

                order = (
                    Orders.objects
                    .select_for_update()
                    .get(
                        pk=order_id
                    )
                )

                if (
                    not order.paid
                    and order.status == "pending"
                ):

                    order.status = "expired"

                    order.save(
                        update_fields=[
                            "status"
                        ]
                    )

                    print(
                        f"ORDER {order_id} MARKED AS EXPIRED "
                        f"AFTER STRIPE CANCEL"
                    )

        except Orders.DoesNotExist:

            print(
                f"STRIPE CANCEL ERROR: "
                f"Order {order_id} not found"
            )

            return Response(
                {
                    "error": "Order not found"
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        except Exception as exc:

            print(
                "STRIPE CANCEL ERROR:",
                repr(exc),
            )

            return Response(
                {
                    "error": "Failed to expire order"
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return HttpResponseRedirect(
            settings.STRIPE_CANCEL_URL
        )


# --------------------------- STRIPE WEBHOOK ---------------------------
class StripeWebhookView(APIView):

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):

        payload = request.body

        sig_header = request.META.get(
            "HTTP_STRIPE_SIGNATURE"
        )

        endpoint_secret = settings.STRIPE_WEBHOOK_SECRET

        try:

            event = stripe.Webhook.construct_event(
                payload,
                sig_header,
                endpoint_secret,
            )

        except ValueError as exc:

            print(
                "STRIPE WEBHOOK PAYLOAD ERROR:",
                exc,
            )

            return Response(
                {
                    "error": "Invalid payload"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        except stripe.error.SignatureVerificationError as exc:

            print(
                "STRIPE WEBHOOK SIGNATURE ERROR:",
                exc,
            )

            return Response(
                {
                    "error": "Invalid signature"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as exc:

            print(
                "STRIPE WEBHOOK ERROR:",
                repr(exc),
            )

            return Response(
                {
                    "error": "Invalid webhook"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        event_type = event["type"]

        if event_type == "checkout.session.completed":

            session = event["data"]["object"]

            metadata = (
                session.metadata.to_dict()
                if session.metadata
                else {}
            )

            order_id = metadata.get(
                "order_id"
            )

            if not order_id:

                print(
                    "STRIPE WEBHOOK ERROR: "
                    "Missing order_id in session metadata"
                )

                return Response(
                    {
                        "error": "Missing order ID"
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            payment_status = session.payment_status

            if payment_status != "paid":

                print(
                    f"STRIPE PAYMENT NOT COMPLETED "
                    f"FOR ORDER {order_id}: "
                    f"{payment_status}"
                )

                return Response(
                    {
                        "success": True
                    },
                    status=status.HTTP_200_OK,
                )

            session_currency = session.currency

            if not session_currency:

                print(
                    f"STRIPE WEBHOOK ERROR: "
                    f"Missing currency for order {order_id}"
                )

                return Response(
                    {
                        "error": "Missing currency"
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if session_currency.upper() != "KES":

                print(
                    f"STRIPE WEBHOOK ERROR: "
                    f"Invalid currency {session_currency} "
                    f"for order {order_id}"
                )

                return Response(
                    {
                        "error": "Invalid currency"
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            stripe_amount_total = session.amount_total

            if stripe_amount_total is None:

                print(
                    f"STRIPE WEBHOOK ERROR: "
                    f"Missing amount_total for order {order_id}"
                )

                return Response(
                    {
                        "error": "Missing amount"
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:

                with transaction.atomic():

                    order = (
                        Orders.objects
                        .select_for_update()
                        .prefetch_related(
                            "order_items"
                        )
                        .get(
                            pk=order_id
                        )
                    )

                    if order.paid:

                        print(
                            f"STRIPE WEBHOOK: "
                            f"Order {order_id} "
                            f"is already marked as paid"
                        )

                        return Response(
                            {
                                "success": True
                            },
                            status=status.HTTP_200_OK,
                        )

                    expected_amount = (
                        calculate_stripe_expected_amount(
                            order
                        )
                    )

                    if stripe_amount_total != expected_amount:

                        print(
                            f"STRIPE WEBHOOK ERROR: "
                            f"Amount mismatch for order "
                            f"{order_id}. "
                            f"Stripe={stripe_amount_total}, "
                            f"Expected={expected_amount}"
                        )

                        return Response(
                            {
                                "error": "Payment amount mismatch"
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    payment_reference = (
                        session.payment_intent
                    )

                    if not payment_reference:

                        print(
                            f"STRIPE WEBHOOK ERROR: "
                            f"Missing payment_intent "
                            f"for order {order_id}"
                        )

                        return Response(
                            {
                                "error": "Missing payment reference"
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    mark_order_as_paid(
                        order.id,
                        payment_reference,
                    )

            except Orders.DoesNotExist:

                print(
                    f"STRIPE WEBHOOK ERROR: "
                    f"Order {order_id} not found"
                )

                return Response(
                    {
                        "error": "Order not found"
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            except ValueError as exc:

                print(
                    f"STRIPE WEBHOOK ERROR: "
                    f"{exc}"
                )

                return Response(
                    {
                        "error": str(exc)
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            except Exception as exc:

                print(
                    "STRIPE PAYMENT PROCESSING ERROR:",
                    repr(exc),
                )

                return Response(
                    {
                        "error": "Failed to process payment"
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            return Response(
                {
                    "success": True
                },
                status=status.HTTP_200_OK,
            )

        if event_type == "checkout.session.expired":

            session = event["data"]["object"]

            metadata = (
                session.metadata.to_dict()
                if session.metadata
                else {}
            )

            order_id = metadata.get(
                "order_id"
            )

            if not order_id:

                print(
                    "STRIPE WEBHOOK ERROR: "
                    "Missing order_id in expired session metadata"
                )

                return Response(
                    {
                        "error": "Missing order ID"
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:

                with transaction.atomic():

                    order = (
                        Orders.objects
                        .select_for_update()
                        .get(
                            pk=order_id
                        )
                    )

                    if (
                        not order.paid
                        and order.status == "pending"
                    ):

                        order.status = "expired"

                        order.save(
                            update_fields=[
                                "status"
                            ]
                        )

                        print(
                            f"ORDER {order_id} MARKED AS EXPIRED "
                            f"AFTER STRIPE SESSION EXPIRED"
                        )

            except Orders.DoesNotExist:

                print(
                    f"STRIPE WEBHOOK ERROR: "
                    f"Order {order_id} not found"
                )

                return Response(
                    {
                        "error": "Order not found"
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            except Exception as exc:

                print(
                    "STRIPE EXPIRED WEBHOOK ERROR:",
                    repr(exc),
                )

                return Response(
                    {
                        "error": "Failed to expire order"
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        return Response(
            {
                "success": True
            },
            status=status.HTTP_200_OK,
        )
