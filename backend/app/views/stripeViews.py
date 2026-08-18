import stripe

from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status

from app.models import (
    Orders,
    OrderItems,
    SpareParts,
)


# --------------------------- CREATES CHECKOUT SESSION ---------------------------
class CreateCheckoutSessionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data or {}

        current_user = request.user

        items = data.get("items", [])

        street = data.get("street")
        city = data.get("city")
        country = data.get("country")
        postal_code = data.get("postal_code")

        # --------------------------- VALIDATION ---------------------------
        if not items:
            return Response(
                {
                    "error": "Cart is empty"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not all([street, city, country]):
            return Response(
                {
                    "error": "Missing address fields"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(items, list):
            return Response(
                {
                    "error": "Items must be a list"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --------------------------- STRIPE ---------------------------
        stripe.api_key = settings.STRIPE_SECRET_KEY

        try:

            with transaction.atomic():

                # --------------------------- CREATE ORDER ---------------------------
                order = Orders.objects.create(
                    user_id=current_user.id,
                    paid=False,
                    street=street.strip(),
                    city=city.strip(),
                    postal_code=(
                        postal_code.strip()
                        if isinstance(postal_code, str)
                        else postal_code
                    ),
                    country=country.strip(),
                    status="pending",
                    total_price=0.0,
                )

                stripe_items = []

                # --------------------------- CREATE ORDER ITEMS ---------------------------
                for item in items:

                    sparepart_id = item.get(
                        "sparepart_id"
                    )

                    if not sparepart_id:
                        raise ValueError(
                            "Missing sparepart_id"
                        )

                    sparepart = get_object_or_404(
                        SpareParts,
                        pk=sparepart_id,
                    )

                    quantity = item.get(
                        "quantity",
                        1,
                    )

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

                   
                    # Calculate the actual selling price from the database, not from the client
                    sparepart.calculate_discount()

                    unit_price = round(
                        sparepart.marked_price
                        - sparepart.discount_amount,
                        2,
                    )

                    subtotal = round(
                        unit_price * quantity,
                        2,
                    )

                    order_item = OrderItems.objects.create(
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
                                    "name": (
                                        f"{sparepart.brand} "
                                        f"{sparepart.category}"
                                    )
                                },
                                "unit_amount": int(
                                    round(
                                        order_item.unit_price
                                        * 100
                                    )
                                ),
                            },
                            "quantity": quantity,
                        }
                    )

                # OrderItems.save() already recalculates
                # order.total_price.
                order.refresh_from_db()


                # --------------------------- STRIPE SESSION ---------------------------
                checkout_session = (
                    stripe.checkout.Session.create(
                        payment_method_types=["card"],
                        mode="payment",
                        line_items=stripe_items,
                        metadata={
                            "order_id": order.id,
                        },
                        success_url=(
                            settings.STRIPE_SUCCESS_URL
                        ),
                        cancel_url=(
                            settings.STRIPE_CANCEL_URL
                        ),
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

        except Exception:
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
                "checkout_url": checkout_session.url
            },
            status=status.HTTP_200_OK,
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

        endpoint_secret = (
            settings.STRIPE_WEBHOOK_SECRET
        )

        # --------------------------- VERIFY WEBHOOK ---------------------------
        try:

            event = stripe.Webhook.construct_event(
                payload,
                sig_header,
                endpoint_secret,
            )

        except ValueError:
            return Response(
                {
                    "error": "Invalid payload"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        except stripe.error.SignatureVerificationError:
            return Response(
                {
                    "error": "Invalid signature"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception:
            return Response(
                {
                    "error": "Invalid webhook"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --------------------------- CHECKOUT COMPLETED ---------------------------
        if event["type"] == "checkout.session.completed":

            session = event["data"]["object"]

            metadata = session.get(
                "metadata",
                {}
            )

            order_id = metadata.get(
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

                    order = Orders.objects.get(
                        pk=order_id
                    )

                    
                    if not order.paid:

                        # Recalculate total from order items.
                        total_price = sum(
                            float(item.subtotal or 0)
                            for item in order.order_items.all()
                        )

                        order.total_price = round(
                            total_price,
                            2
                        )

                        order.paid = True

                        order.save(
                            update_fields=[
                                "total_price",
                                "paid",
                            ]
                        )

                        print(
                            f"✔ ORDER {order_id} "
                            "MARKED AS PAID"
                        )

            except Orders.DoesNotExist:
                return Response(
                    {
                        "error": "Order not found"
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

        return Response(
            {
                "success": True
            },
            status=status.HTTP_200_OK,
        )