import hashlib
import hmac
import requests

from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.db import transaction

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status

from app.models import (
    Orders,
    OrderItems,
    SpareParts,
    Address,
    Profile,
    CartItems,
)

from utils.tasks import (
    send_order_confirmation_email_task,
)


# --------------------------- PAYSTACK HELPERS ---------------------------
def normalize_phone(phone):

    if not phone:
        raise ValueError(
            "Phone number is required"
        )

    phone = str(phone).strip()

    if phone.startswith("07"):
        phone = "+254" + phone[1:]

    elif phone.startswith("01"):
        phone = "+254" + phone[1:]

    elif phone.startswith("254"):
        phone = "+" + phone

    if not phone.startswith("+254"):
        raise ValueError(
            "Enter a valid Kenyan phone number"
        )

    if len(phone) != 13:
        raise ValueError(
            "Enter a valid Kenyan phone number"
        )

    return phone


def get_paystack_headers():

    secret_key = getattr(
        settings,
        "PAYSTACK_SECRET_KEY",
        None,
    )

    if not secret_key:
        raise ValueError(
            "Paystack secret key is not configured"
        )

    return {
        "Authorization": f"Bearer {secret_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def calculate_order_total(order):

    return sum(
        (
            item.subtotal
            if item.subtotal is not None
            else Decimal("0.00")
        )
        for item in order.order_items.all()
    ).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )


def calculate_paystack_expected_amount(order):

    total_price = calculate_order_total(
        order
    )

    if total_price <= Decimal("0.00"):
        return 0

    return int(
        (
            total_price * Decimal("100")
        ).quantize(
            Decimal("1"),
            rounding=ROUND_HALF_UP,
        )
    )


def clear_user_cart(user):

    deleted_count, _ = CartItems.objects.filter(
        user=user
    ).delete()

    print(
        f"PAYSTACK CART CLEAR: "
        f"user={user.id}, "
        f"deleted_cart_items={deleted_count}"
    )


def mark_order_as_paid(
    order_id,
    payment_reference=None,
):

    with transaction.atomic():

        order = (
            Orders.objects
            .select_for_update()
            .select_related(
                "user"
            )
            .prefetch_related(
                "order_items"
            )
            .get(
                pk=order_id
            )
        )

        if order.paid:

            if (
                not order.payment_reference
                and payment_reference
            ):

                order.payment_reference = (
                    payment_reference
                )

                order.save(
                    update_fields=[
                        "payment_reference",
                    ]
                )

            clear_user_cart(
                order.user
            )

            print(
                f"PAYSTACK PAYMENT: "
                f"Order {order_id} is already marked as paid"
            )

            return order

        total_price = calculate_order_total(
            order
        )

        if total_price <= Decimal("0.00"):

            raise ValueError(
                "Order total must be greater than zero"
            )

        order.total_price = total_price
        order.paid = True

        update_fields = [
            "total_price",
            "paid",
        ]

        if payment_reference:

            order.payment_reference = (
                payment_reference
            )

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

        transaction.on_commit(
            lambda: send_order_confirmation_email_task.delay(
                customer_email,
                order_id_value,
                total_price,
                payment_method,
            )
        )

        print(
            f"ORDER {order.id} "
            "MARKED AS PAID BY PAYSTACK"
        )

        return order


def mark_order_as_expired(order_id):

    with transaction.atomic():

        order = (
            Orders.objects
            .select_for_update()
            .get(
                pk=order_id
            )
        )

        if order.paid:
            return order

        if order.status != "pending":
            return order

        order.status = "expired"

        order.save(
            update_fields=[
                "status",
            ]
        )

        print(
            f"ORDER {order_id} "
            "MARKED AS EXPIRED BY PAYSTACK"
        )

        return order


def get_existing_paystack_refund(
    payment_reference,
):

    try:

        response = requests.get(
            "https://api.paystack.co/refund",
            params={
                "transaction": payment_reference,
            },
            headers=get_paystack_headers(),
            timeout=30,
        )

    except requests.RequestException as exc:

        print(
            "PAYSTACK REFUND CHECK ERROR:",
            repr(exc),
        )

        raise ValueError(
            "Unable to check existing Paystack refunds."
        )

    try:

        response_data = response.json()

    except ValueError:

        response_data = {}

    if not response.ok:

        raise ValueError(
            response_data.get(
                "message"
            )
            or "Unable to check existing Paystack refunds."
        )

    if not response_data.get(
        "status"
    ):

        raise ValueError(
            response_data.get(
                "message"
            )
            or "Unable to check existing Paystack refunds."
        )

    refunds = response_data.get(
        "data",
        []
    )

    if not isinstance(
        refunds,
        list,
    ):

        return None

    for refund in refunds:

        refund_status = (
            refund.get("status")
        )

        if refund_status in [
            "pending",
            "processing",
            "processed",
            "needs-attention",
        ]:

            return refund

    return None


def refund_paystack_order(order):

    if not order.payment_reference:

        raise ValueError(
            "Paystack payment reference is missing."
        )

    refund_amount = calculate_order_total(
        order
    )

    if refund_amount <= Decimal("0.00"):

        raise ValueError(
            "Refund amount must be greater than zero."
        )

    amount_subunit = int(
        (
            refund_amount * Decimal("100")
        ).quantize(
            Decimal("1"),
            rounding=ROUND_HALF_UP,
        )
    )

    with transaction.atomic():

        locked_order = (
            Orders.objects
            .select_for_update()
            .prefetch_related(
                "order_items"
            )
            .get(
                pk=order.id
            )
        )

        if not locked_order.payment_reference:

            raise ValueError(
                "Paystack payment reference is missing."
            )

        existing_refund = (
            get_existing_paystack_refund(
                locked_order.payment_reference
            )
        )

        if existing_refund:

            print(
                "PAYSTACK REFUND: "
                f"Existing refund found for order "
                f"{locked_order.id}. "
                f"refund_id={existing_refund.get('id')}, "
                f"status={existing_refund.get('status')}"
            )

            return {
                "status": True,
                "message": (
                    "Existing Paystack refund found."
                ),
                "data": existing_refund,
                "already_refunded": True,
            }

        payload = {
            "transaction": (
                locked_order.payment_reference
            ),
            "amount": amount_subunit,
            "currency": "KES",
            "merchant_note": (
                f"Refund for order {locked_order.id}"
            ),
            "customer_note": (
                "Refund for cancelled order"
            ),
        }

        try:

            response = requests.post(
                "https://api.paystack.co/refund",
                json=payload,
                headers=get_paystack_headers(),
                timeout=30,
            )

        except requests.RequestException as exc:

            print(
                "PAYSTACK REFUND REQUEST ERROR:",
                repr(exc),
            )

            raise ValueError(
                "Unable to connect to Paystack for refund."
            )

        try:

            response_data = response.json()

        except ValueError:

            response_data = {}

        if not response.ok:

            raise ValueError(
                response_data.get(
                    "message"
                )
                or "Paystack refund failed."
            )

        if not response_data.get(
            "status"
        ):

            raise ValueError(
                response_data.get(
                    "message"
                )
                or "Paystack refund failed."
            )

        return response_data


# --------------------------- CREATE PAYSTACK CHECKOUT SESSION ---------------------------
class CreatePaystackSessionView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request):

        data = request.data or {}

        current_user = request.user

        items = data.get(
            "items",
            []
        )

        payment_method = data.get(
            "payment_method"
        )

        mobile_money_phone = data.get(
            "phone_number"
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

        if payment_method not in [
            "mpesa",
            "airtel",
        ]:

            return Response(
                {
                    "error": (
                        "Payment method must be "
                        "mpesa or airtel"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:

            Profile.objects.get(
                user=current_user
            )

        except Profile.DoesNotExist:

            return Response(
                {
                    "error": (
                        "Customer profile not found"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

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
                    "error": (
                        "Customer address not found"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:

            phone = normalize_phone(
                mobile_money_phone
            )

        except ValueError as exc:

            return Response(
                {
                    "error": str(exc)
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        provider = (
            "mpesa"
            if payment_method == "mpesa"
            else "atl"
        )

        try:

            with transaction.atomic():

                order = Orders.objects.create(
                    user=current_user,
                    address=address,
                    paid=False,
                    payment_method=payment_method,
                    status="pending",
                    total_price=Decimal(
                        "0.00"
                    ),
                )

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
                        1
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
                        Decimal("0.01"),
                        rounding=ROUND_HALF_UP,
                    )

                    if unit_price < Decimal("0.00"):

                        raise ValueError(
                            "Invalid spare part price"
                        )

                    subtotal = (
                        unit_price
                        * quantity
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

                order.total_price = (
                    calculate_order_total(
                        order
                    )
                )

                if order.total_price <= Decimal("0.00"):

                    raise ValueError(
                        "Order total must be greater than zero"
                    )

                order.save(
                    update_fields=[
                        "total_price"
                    ]
                )

                amount_subunit = (
                    calculate_paystack_expected_amount(
                        order
                    )
                )

                if amount_subunit <= 0:

                    raise ValueError(
                        "Order total must be greater than zero"
                    )

                paystack_reference = (
                    f"TT-{order.id}"
                )

                payload = {
                    "email": current_user.email,
                    "amount": amount_subunit,
                    "currency": "KES",
                    "reference": paystack_reference,
                    "mobile_money": {
                        "phone": phone,
                        "provider": provider,
                    },
                    "metadata": {
                        "order_id": str(
                            order.id
                        ),
                        "payment_method": (
                            payment_method
                        ),
                    },
                }

                try:

                    response = requests.post(
                        "https://api.paystack.co/charge",
                        json=payload,
                        headers=get_paystack_headers(),
                        timeout=30,
                    )

                except requests.RequestException as exc:

                    print(
                        "PAYSTACK REQUEST ERROR:",
                        repr(exc),
                    )

                    raise

                try:

                    response_data = (
                        response.json()
                    )

                except ValueError:

                    response_data = {}

                if not response.ok:

                    error_message = (
                        response_data.get(
                            "message"
                        )
                        or "Paystack request failed"
                    )

                    raise ValueError(
                        error_message
                    )

                if not response_data.get(
                    "status"
                ):

                    raise ValueError(
                        response_data.get(
                            "message",
                            "Paystack payment failed",
                        )
                    )

                payment_data = (
                    response_data.get(
                        "data",
                        {}
                    )
                )

                reference = (
                    payment_data.get(
                        "reference"
                    )
                    or paystack_reference
                )

                if not reference:

                    raise ValueError(
                        "Paystack did not return a payment reference"
                    )

                payment_status = (
                    payment_data.get(
                        "status"
                    )
                )

                display_text = (
                    payment_data.get(
                        "display_text"
                    )
                )

        except ValueError as exc:

            return Response(
                {
                    "error": str(exc)
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        except requests.RequestException as exc:

            print(
                "PAYSTACK REQUEST ERROR:",
                repr(exc),
            )

            return Response(
                {
                    "error": (
                        "Unable to connect to Paystack"
                    )
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        except Exception as exc:

            print(
                "PAYSTACK PAYMENT ERROR:",
                repr(exc),
            )

            return Response(
                {
                    "error": (
                        "Failed to create Paystack payment"
                    )
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if payment_status in [
            "failed",
            "timeout",
        ]:

            try:

                mark_order_as_expired(
                    order.id
                )

            except Exception as exc:

                print(
                    "PAYSTACK EXPIRATION ERROR:",
                    repr(exc),
                )

            return Response(
                {
                    "success": False,
                    "order_id": str(
                        order.id
                    ),
                    "reference": reference,
                    "status": payment_status,
                    "display_text": display_text,
                    "payment_method": (
                        payment_method
                    ),
                    "error": (
                        display_text
                        or "Paystack payment failed"
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "success": True,
                "order_id": str(
                    order.id
                ),
                "reference": reference,
                "status": payment_status,
                "display_text": display_text,
                "payment_method": (
                    payment_method
                ),
            },
            status=status.HTTP_200_OK,
        )


# --------------------------- VERIFY PAYSTACK PAYMENT ---------------------------
class VerifyPaystackSessionView(APIView):

    permission_classes = [IsAuthenticated]

    def get(
        self,
        request,
        reference,
    ):

        if not reference:

            return Response(
                {
                    "error": "Missing payment reference"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:

            response = requests.get(
                (
                    "https://api.paystack.co/"
                    f"transaction/verify/{reference}"
                ),
                headers=get_paystack_headers(),
                timeout=30,
            )

            try:

                response_data = (
                    response.json()
                )

            except ValueError:

                response_data = {}

            if not response.ok:

                return Response(
                    {
                        "error": (
                            response_data.get(
                                "message"
                            )
                            or (
                                "Unable to verify "
                                "Paystack payment"
                            )
                        )
                    },
                    status=status.HTTP_502_BAD_GATEWAY,
                )

            if not response_data.get(
                "status"
            ):

                return Response(
                    {
                        "error": (
                            response_data.get(
                                "message"
                            )
                            or (
                                "Paystack verification "
                                "failed"
                            )
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            payment_data = (
                response_data.get(
                    "data",
                    {}
                )
            )

            verified_reference = (
                payment_data.get(
                    "reference"
                )
            )

            if (
                not verified_reference
                or verified_reference != reference
            ):

                return Response(
                    {
                        "error": (
                            "Paystack payment reference "
                            "does not match"
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            payment_status = (
                payment_data.get(
                    "status"
                )
            )

            metadata = (
                payment_data.get(
                    "metadata",
                    {}
                )
            )

            order_id = metadata.get(
                "order_id"
            )

            if not order_id:

                return Response(
                    {
                        "error": (
                            "Paystack payment is missing "
                            "order information"
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:

                order = (
                    Orders.objects
                    .prefetch_related(
                        "order_items"
                    )
                    .get(
                        pk=order_id,
                        user_id=request.user.id,
                    )
                )

            except Orders.DoesNotExist:

                return Response(
                    {
                        "error": (
                            "Payment order not found"
                        )
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            if order.paid:

                if (
                    order.payment_reference
                    and order.payment_reference
                    != reference
                ):

                    return Response(
                        {
                            "error": (
                                "Payment reference does "
                                "not match the paid order"
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                clear_user_cart(
                    order.user
                )

                return Response(
                    {
                        "success": True,
                        "paid": True,
                        "status": order.status,
                        "order_id": str(
                            order.id
                        ),
                        "reference": reference,
                        "payment_method": (
                            order.payment_method
                        ),
                    },
                    status=status.HTTP_200_OK,
                )

            metadata_payment_method = (
                metadata.get(
                    "payment_method"
                )
            )

            if (
                not metadata_payment_method
                or metadata_payment_method
                != order.payment_method
            ):

                return Response(
                    {
                        "error": (
                            "Payment method does not "
                            "match the order"
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if payment_status == "success":

                payment_amount = (
                    payment_data.get(
                        "amount"
                    )
                )

                if payment_amount is None:

                    return Response(
                        {
                            "error": (
                                "Paystack payment is missing "
                                "the payment amount"
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                try:

                    payment_amount = int(
                        payment_amount
                    )

                except (
                    ValueError,
                    TypeError,
                ):

                    return Response(
                        {
                            "error": (
                                "Invalid Paystack payment amount"
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                expected_amount = (
                    calculate_paystack_expected_amount(
                        order
                    )
                )

                if (
                    payment_amount
                    != expected_amount
                ):

                    return Response(
                        {
                            "error": (
                                "Paystack payment amount "
                                "does not match order total"
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                payment_currency = (
                    payment_data.get(
                        "currency"
                    )
                )

                if (
                    not payment_currency
                    or payment_currency.upper()
                    != "KES"
                ):

                    return Response(
                        {
                            "error": (
                                "Invalid payment currency"
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                order = mark_order_as_paid(
                    order.id,
                    payment_reference=reference,
                )

                return Response(
                    {
                        "success": True,
                        "paid": True,
                        "status": order.status,
                        "order_id": str(
                            order.id
                        ),
                        "reference": reference,
                        "payment_method": (
                            order.payment_method
                        ),
                    },
                    status=status.HTTP_200_OK,
                )

            if payment_status in [
                "failed",
                "timeout",
            ]:

                order = mark_order_as_expired(
                    order.id
                )

                return Response(
                    {
                        "success": False,
                        "paid": False,
                        "expired": True,
                        "status": order.status,
                        "order_id": str(
                            order.id
                        ),
                        "reference": reference,
                        "payment_method": (
                            order.payment_method
                        ),
                        "message": (
                            payment_data.get(
                                "message"
                            )
                            or (
                                "Paystack payment "
                                "expired"
                            )
                        ),
                    },
                    status=status.HTTP_200_OK,
                )

            return Response(
                {
                    "success": True,
                    "paid": False,
                    "expired": False,
                    "status": order.status,
                    "payment_status": (
                        payment_status
                    ),
                    "order_id": str(
                        order.id
                    ),
                    "reference": reference,
                    "payment_method": (
                        order.payment_method
                    ),
                    "message": (
                        payment_data.get(
                            "message"
                        )
                        or (
                            "Payment is still "
                            "processing"
                        )
                    ),
                },
                status=status.HTTP_200_OK,
            )

        except requests.RequestException as exc:

            print(
                "PAYSTACK VERIFY REQUEST ERROR:",
                repr(exc),
            )

            return Response(
                {
                    "error": (
                        "Unable to connect to Paystack"
                    )
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        except Exception as exc:

            print(
                "PAYSTACK VERIFY ERROR:",
                repr(exc),
            )

            return Response(
                {
                    "error": (
                        "Failed to verify Paystack payment"
                    )
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# --------------------------- PAYSTACK WEBHOOK ---------------------------
class PaystackWebhookView(APIView):

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):

        payload = request.body

        signature = request.META.get(
            "HTTP_X_PAYSTACK_SIGNATURE"
        )

        if not signature:

            return Response(
                {
                    "error": "Missing Paystack signature"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        secret_key = getattr(
            settings,
            "PAYSTACK_SECRET_KEY",
            None,
        )

        if not secret_key:

            return Response(
                {
                    "error": (
                        "Paystack secret key is not configured"
                    )
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        expected_signature = hmac.new(
            secret_key.encode(
                "utf-8"
            ),
            payload,
            hashlib.sha512,
        ).hexdigest()

        if not hmac.compare_digest(
            expected_signature,
            signature,
        ):

            print(
                "PAYSTACK WEBHOOK SIGNATURE ERROR"
            )

            return Response(
                {
                    "error": "Invalid signature"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:

            event = request.data

        except Exception as exc:

            print(
                "PAYSTACK WEBHOOK PARSE ERROR:",
                repr(exc),
            )

            return Response(
                {
                    "error": "Invalid webhook"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        event_type = event.get(
            "event"
        )

        payment_data = event.get(
            "data",
            {}
        )

        metadata = payment_data.get(
            "metadata",
            {}
        )

        order_id = metadata.get(
            "order_id"
        )

        reference = payment_data.get(
            "reference"
        )

        payment_status = payment_data.get(
            "status"
        )

        payment_amount = payment_data.get(
            "amount"
        )

        payment_currency = payment_data.get(
            "currency"
        )

        payment_method = metadata.get(
            "payment_method"
        )

        if event_type not in [
            "charge.success",
            "charge.failed",
        ]:

            return Response(
                {
                    "success": True
                },
                status=status.HTTP_200_OK,
            )

        if not order_id:

            print(
                "PAYSTACK WEBHOOK ERROR: "
                "Missing order_id in metadata"
            )

            return Response(
                {
                    "error": "Missing order ID"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not reference:

            print(
                "PAYSTACK WEBHOOK ERROR: "
                "Missing payment reference"
            )

            return Response(
                {
                    "error": "Missing payment reference"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:

            order = (
                Orders.objects
                .prefetch_related(
                    "order_items"
                )
                .get(
                    pk=order_id
                )
            )

            if (
                not payment_method
                or payment_method
                != order.payment_method
            ):

                print(
                    "PAYSTACK WEBHOOK ERROR: "
                    "Payment method mismatch"
                )

                return Response(
                    {
                        "error": (
                            "Payment method does not "
                            "match order"
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if order.paid:

                if (
                    order.payment_reference
                    and order.payment_reference
                    != reference
                ):

                    print(
                        "PAYSTACK WEBHOOK ERROR: "
                        "Payment reference mismatch "
                        f"for order {order.id}"
                    )

                    return Response(
                        {
                            "error": (
                                "Payment reference does "
                                "not match paid order"
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                clear_user_cart(
                    order.user
                )

                return Response(
                    {
                        "success": True
                    },
                    status=status.HTTP_200_OK,
                )

            if event_type == "charge.failed":

                if order.status == "pending":

                    order = mark_order_as_expired(
                        order.id
                    )

                    print(
                        f"PAYSTACK PAYMENT {reference} "
                        f"FAILED FOR ORDER {order.id}. "
                        "ORDER MARKED AS EXPIRED."
                    )

                return Response(
                    {
                        "success": True
                    },
                    status=status.HTTP_200_OK,
                )

            if payment_status != "success":

                if payment_status in [
                    "failed",
                    "timeout",
                ]:

                    if order.status == "pending":

                        order = mark_order_as_expired(
                            order.id
                        )

                        print(
                            f"PAYSTACK PAYMENT {reference} "
                            f"STATUS={payment_status} "
                            f"FOR ORDER {order.id}. "
                            "ORDER MARKED AS EXPIRED."
                        )

                return Response(
                    {
                        "success": True
                    },
                    status=status.HTTP_200_OK,
                )

            if (
                not payment_currency
                or payment_currency.upper()
                != "KES"
            ):

                print(
                    "PAYSTACK WEBHOOK ERROR: "
                    "Invalid payment currency"
                )

                return Response(
                    {
                        "error": (
                            "Invalid payment currency"
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if payment_amount is None:

                print(
                    "PAYSTACK WEBHOOK ERROR: "
                    "Missing payment amount"
                )

                return Response(
                    {
                        "error": (
                            "Payment amount is missing"
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:

                payment_amount = int(
                    payment_amount
                )

            except (
                ValueError,
                TypeError,
            ):

                print(
                    "PAYSTACK WEBHOOK ERROR: "
                    "Invalid payment amount"
                )

                return Response(
                    {
                        "error": (
                            "Invalid payment amount"
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            expected_amount = (
                calculate_paystack_expected_amount(
                    order
                )
            )

            if (
                payment_amount
                != expected_amount
            ):

                print(
                    "PAYSTACK WEBHOOK ERROR: "
                    f"Amount mismatch for order "
                    f"{order.id}. "
                    f"Expected {expected_amount}, "
                    f"received {payment_amount}"
                )

                return Response(
                    {
                        "error": (
                            "Payment amount does not "
                            "match order total"
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            order = mark_order_as_paid(
                order.id,
                payment_reference=reference,
            )

            print(
                f"PAYSTACK PAYMENT {reference} "
                f"CONFIRMED FOR ORDER {order.id}"
            )

        except Orders.DoesNotExist:

            print(
                "PAYSTACK WEBHOOK ERROR: "
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
                "PAYSTACK ORDER PROCESSING ERROR:",
                repr(exc),
            )

            return Response(
                {
                    "error": (
                        "Failed to process order"
                    )
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "success": True
            },
            status=status.HTTP_200_OK,
        )