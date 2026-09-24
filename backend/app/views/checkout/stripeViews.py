import stripe

from decimal import Decimal
from urllib.parse import urlencode

from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.http import HttpResponseRedirect

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status

from app.models import (
    Orders,
    OrderItems,
    SpareParts,
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
    ).quantize(Decimal("0.01"))


def calculate_stripe_expected_amount(order):
    total_price = calculate_order_total(order)
    return int(
        (total_price * Decimal("100")).quantize(Decimal("1"))
    )


# --------------------------- CREATE STRIPE CHECKOUT SESSION ---------------------------
class CreateStripeSessionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data or {}
        current_user = request.user

        items = data.get("items", [])
        street = data.get("street")
        city = data.get("city")
        country = data.get("country")
        postal_code = data.get("postal_code")

        if not items:
            return Response(
                {"error": "Cart is empty"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not all([street, city, country]):
            return Response(
                {"error": "Missing address fields"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(items, list):
            return Response(
                {"error": "Items must be a list"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        stripe.api_key = settings.STRIPE_SECRET_KEY

        try:
            with transaction.atomic():
                order = Orders.objects.create(
                    user_id=current_user.id,
                    paid=False,
                    payment_method="stripe",
                    street=street.strip(),
                    city=city.strip(),
                    postal_code=(
                        postal_code.strip()
                        if isinstance(postal_code, str)
                        else postal_code
                    ),
                    country=country.strip(),
                    status="pending",
                    total_price=Decimal("0.00"),
                )

                stripe_items = []

                for item in items:
                    sparepart_id = item.get("sparepart_id")

                    if not sparepart_id:
                        raise ValueError("Missing sparepart_id")

                    sparepart = get_object_or_404(
                        SpareParts,
                        pk=sparepart_id,
                    )

                    quantity = item.get("quantity", 1)

                    try:
                        quantity = int(quantity)
                    except (ValueError, TypeError):
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
                    ).quantize(Decimal("0.01"))

                    subtotal = (
                        unit_price * quantity
                    ).quantize(Decimal("0.01"))

                    order_item = OrderItems.objects.create(
                        order=order,
                        sparepart=sparepart,
                        quantity=quantity,
                        unit_price=unit_price,
                        subtotal=subtotal,
                    )

                    stripe_unit_amount = int(
                        (
                            order_item.unit_price
                            * Decimal("100")
                        ).quantize(Decimal("1"))
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
                                    )
                                },
                                "unit_amount": stripe_unit_amount,
                            },
                            "quantity": quantity,
                        }
                    )

                order.refresh_from_db()

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
                    success_url=settings.STRIPE_SUCCESS_URL,
                    cancel_url=cancel_url,
                )

        except ValueError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        except stripe.error.StripeError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        except Exception as exc:
            print(
                "STRIPE PAYMENT ERROR:",
                repr(exc),
            )

            return Response(
                {
                    "error": (
                        "Failed to create checkout session"
                    )
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "checkout_url": checkout_session.url,
            },
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

        try:
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
                {"error": "Order not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        except Exception as exc:
            print(
                "STRIPE CANCEL ERROR:",
                repr(exc),
            )

            return Response(
                {"error": "Failed to expire order"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return HttpResponseRedirect(
            settings.STRIPE_CANCEL_REDIRECT_URL
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
                {"error": "Invalid payload"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        except stripe.error.SignatureVerificationError as exc:
            print(
                "STRIPE WEBHOOK SIGNATURE ERROR:",
                exc,
            )

            return Response(
                {"error": "Invalid signature"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as exc:
            print(
                "STRIPE WEBHOOK ERROR:",
                repr(exc),
            )

            return Response(
                {"error": "Invalid webhook"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        event_type = event["type"]

        if event_type == "checkout.session.completed":
            session = event["data"]["object"]

            metadata = session.metadata

            if metadata and "order_id" in metadata:
                order_id = metadata["order_id"]
            else:
                order_id = None

            if not order_id:
                print(
                    "STRIPE WEBHOOK ERROR: "
                    "Missing order_id in session metadata"
                )

                return Response(
                    {"error": "Missing order ID"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            payment_status = session.payment_status

            if payment_status != "paid":
                print(
                    f"STRIPE PAYMENT NOT COMPLETED FOR ORDER "
                    f"{order_id}: {payment_status}"
                )

                return Response(
                    {"success": True},
                    status=status.HTTP_200_OK,
                )

            session_currency = session.currency

            if not session_currency:
                print(
                    f"STRIPE WEBHOOK ERROR: "
                    f"Missing currency for order {order_id}"
                )

                return Response(
                    {"error": "Missing currency"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if session_currency.upper() != "KES":
                print(
                    f"STRIPE WEBHOOK ERROR: "
                    f"Invalid currency {session_currency} "
                    f"for order {order_id}"
                )

                return Response(
                    {"error": "Invalid currency"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            stripe_amount_total = session.amount_total

            if stripe_amount_total is None:
                print(
                    f"STRIPE WEBHOOK ERROR: "
                    f"Missing amount_total for order {order_id}"
                )

                return Response(
                    {"error": "Missing amount"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            with transaction.atomic():
                try:
                    order = (
                        Orders.objects
                        .select_for_update()
                        .prefetch_related("order_items")
                        .get(pk=order_id)
                    )

                except Orders.DoesNotExist:
                    print(
                        f"STRIPE WEBHOOK ERROR: "
                        f"Order {order_id} not found"
                    )

                    return Response(
                        {"error": "Order not found"},
                        status=status.HTTP_404_NOT_FOUND,
                    )

                if order.paid:
                    print(
                        f"STRIPE WEBHOOK: Order {order_id} "
                        f"is already marked as paid"
                    )

                    return Response(
                        {"success": True},
                        status=status.HTTP_200_OK,
                    )

                expected_amount = (
                    calculate_stripe_expected_amount(order)
                )

                if stripe_amount_total != expected_amount:
                    print(
                        f"STRIPE WEBHOOK ERROR: "
                        f"Amount mismatch for order {order_id}. "
                        f"Stripe={stripe_amount_total}, "
                        f"Expected={expected_amount}"
                    )

                    return Response(
                        {"error": "Payment amount mismatch"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                total_price = calculate_order_total(order)

                order.total_price = total_price
                order.paid = True

                order.save(
                    update_fields=[
                        "total_price",
                        "paid",
                    ]
                )

                print(
                    f"ORDER {order_id} MARKED AS PAID"
                )

            return Response(
                {"success": True},
                status=status.HTTP_200_OK,
            )

        if event_type == "checkout.session.expired":
            session = event["data"]["object"]

            metadata = session.metadata

            if metadata and "order_id" in metadata:
                order_id = metadata["order_id"]
            else:
                order_id = None

            if not order_id:
                print(
                    "STRIPE WEBHOOK ERROR: "
                    "Missing order_id in expired session metadata"
                )

                return Response(
                    {"error": "Missing order ID"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
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
                    {"error": "Order not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            except Exception as exc:
                print(
                    "STRIPE EXPIRED WEBHOOK ERROR:",
                    repr(exc),
                )

                return Response(
                    {"error": "Failed to expire order"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        return Response(
            {"success": True},
            status=status.HTTP_200_OK,
        )
