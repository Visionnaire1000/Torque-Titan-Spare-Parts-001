import base64
import json
import urllib.error
import urllib.parse
import urllib.request

from decimal import Decimal, ROUND_HALF_UP

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


# --------------- PAYPAL HELPERS ------------------
KES_QUANTIZER = Decimal("0.01")
PAYPAL_QUANTIZER = Decimal("0.01")


def calculate_order_total(order):
    return sum(
        (
            item.subtotal
            if item.subtotal is not None
            else Decimal("0.00")
        )
        for item in order.order_items.all()
    ).quantize(
        KES_QUANTIZER,
        rounding=ROUND_HALF_UP,
    )


def calculate_paypal_items(
    order,
    exchange_rate,
):
    paypal_items = []
    paypal_item_total = Decimal("0.00")

    currency = get_paypal_currency()

    for order_item in order.order_items.select_related(
        "sparepart"
    ).all():

        sparepart = order_item.sparepart

        paypal_unit_price = (
            convert_kes_to_paypal_currency(
                order_item.unit_price,
                exchange_rate,
            )
        )

        quantity = int(
            order_item.quantity
        )

        paypal_subtotal = (
            paypal_unit_price * quantity
        ).quantize(
            PAYPAL_QUANTIZER,
            rounding=ROUND_HALF_UP,
        )

        paypal_item_total += paypal_subtotal

        paypal_items.append(
            {
                "name": (
                    f"{sparepart.brand} "
                    f"{sparepart.vehicle_type} "
                    f"{sparepart.category}"
                ),
                "description": (
                    f"{sparepart.brand} "
                    f"{sparepart.category} "
                    f"for "
                    f"{sparepart.vehicle_type}"
                ),
                "quantity": str(
                    quantity
                ),
                "unit_amount": {
                    "currency_code": currency,
                    "value": (
                        decimal_to_paypal_value(
                            paypal_unit_price
                        )
                    ),
                },
            }
        )

    paypal_item_total = paypal_item_total.quantize(
        PAYPAL_QUANTIZER,
        rounding=ROUND_HALF_UP,
    )

    return (
        paypal_items,
        paypal_item_total,
    )


def get_paypal_base_url():
    environment = getattr(
        settings,
        "PAYPAL_ENVIRONMENT",
        "sandbox",
    ).lower()

    if environment == "live":
        return "https://api-m.paypal.com"

    return "https://api-m.sandbox.paypal.com"


def get_paypal_access_token():
    client_id = getattr(
        settings,
        "PAYPAL_CLIENT_ID",
        None,
    )

    client_secret = getattr(
        settings,
        "PAYPAL_CLIENT_SECRET",
        None,
    )

    if not client_id or not client_secret:
        raise ValueError(
            "PayPal credentials are not configured"
        )

    credentials = (
        f"{client_id}:{client_secret}"
    ).encode("utf-8")

    encoded_credentials = base64.b64encode(
        credentials
    ).decode("utf-8")

    token_url = (
        f"{get_paypal_base_url()}"
        "/v1/oauth2/token"
    )

    data = urllib.parse.urlencode(
        {
            "grant_type": "client_credentials",
        }
    ).encode("utf-8")

    request = urllib.request.Request(
        token_url,
        data=data,
        method="POST",
        headers={
            "Authorization": (
                f"Basic {encoded_credentials}"
            ),
            "Content-Type": (
                "application/x-www-form-urlencoded"
            ),
            "Accept": "application/json",
            "User-Agent": (
                "Torque-Titan-Spares/1.0"
            ),
        },
    )

    try:
        with urllib.request.urlopen(
            request,
            timeout=30,
        ) as response:

            response_data = json.loads(
                response.read().decode("utf-8")
            )

    except urllib.error.HTTPError as exc:

        error_body = exc.read().decode(
            "utf-8",
            errors="replace",
        )

        print(
            "PAYPAL TOKEN ERROR:",
            error_body,
        )

        raise ValueError(
            "Failed to authenticate with PayPal"
        )

    except urllib.error.URLError as exc:

        print(
            "PAYPAL TOKEN CONNECTION ERROR:",
            repr(exc),
        )

        raise ValueError(
            "Unable to connect to PayPal"
        )

    access_token = response_data.get(
        "access_token"
    )

    if not access_token:
        raise ValueError(
            "PayPal did not return an access token"
        )

    return access_token


def paypal_request(
    method,
    path,
    access_token,
    payload=None,
    request_id=None,
):
    url = (
        f"{get_paypal_base_url()}"
        f"{path}"
    )

    headers = {
        "Authorization": (
            f"Bearer {access_token}"
        ),
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": (
            "Torque-Titan-Spares/1.0"
        ),
    }

    if request_id:
        headers["PayPal-Request-Id"] = (
            request_id
        )

    body = None

    if payload is not None:
        body = json.dumps(
            payload
        ).encode("utf-8")

    request = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers=headers,
    )

    try:
        with urllib.request.urlopen(
            request,
            timeout=30,
        ) as response:

            response_body = (
                response.read()
                .decode("utf-8")
            )

            if not response_body:
                return {}

            return json.loads(
                response_body
            )

    except urllib.error.HTTPError as exc:

        error_body = exc.read().decode(
            "utf-8",
            errors="replace",
        )

        print(
            "PAYPAL API ERROR:",
            error_body,
        )

        try:
            error_data = json.loads(
                error_body
            )
        except json.JSONDecodeError:
            error_data = {}

        message = (
            error_data.get("message")
            or error_data.get("name")
            or "PayPal API request failed"
        )

        raise ValueError(message)

    except urllib.error.URLError as exc:

        print(
            "PAYPAL API CONNECTION ERROR:",
            repr(exc),
        )

        raise ValueError(
            "Unable to connect to PayPal"
        )


def verify_paypal_webhook(
    transmission_id,
    transmission_time,
    cert_url,
    auth_algo,
    transmission_sig,
    webhook_event,
):
    webhook_id = getattr(
        settings,
        "PAYPAL_WEBHOOK_ID",
        None,
    )

    if not webhook_id:
        raise ValueError(
            "PayPal webhook ID is not configured"
        )

    access_token = get_paypal_access_token()

    payload = {
        "auth_algo": auth_algo,
        "cert_url": cert_url,
        "transmission_id": transmission_id,
        "transmission_sig": transmission_sig,
        "transmission_time": transmission_time,
        "webhook_id": webhook_id,
        "webhook_event": webhook_event,
    }

    return paypal_request(
        method="POST",
        path="/v1/notifications/verify-webhook-signature",
        access_token=access_token,
        payload=payload,
    )


def get_paypal_currency():
    currency = getattr(
        settings,
        "PAYPAL_CURRENCY",
        "USD",
    ).upper()

    if currency != "USD":
        raise ValueError(
            "PAYPAL_CURRENCY must be USD"
        )

    return currency


def get_paypal_kes_to_usd_rate():
    rate_url = (
        "https://api.frankfurter.dev/v2/rate/usd/kes"
    )

    request = urllib.request.Request(
        rate_url,
        method="GET",
        headers={
            "Accept": "application/json",
            "User-Agent": (
                "Torque-Titan-Spares/1.0"
            ),
        },
    )

    try:
        with urllib.request.urlopen(
            request,
            timeout=15,
        ) as response:

            response_data = json.loads(
                response.read().decode("utf-8")
            )

    except urllib.error.HTTPError as exc:

        error_body = exc.read().decode(
            "utf-8",
            errors="replace",
        )

        print(
            "PAYPAL FX RATE ERROR:",
            error_body,
        )

        raise ValueError(
            "Failed to retrieve USD/KES exchange rate"
        )

    except urllib.error.URLError as exc:

        print(
            "PAYPAL FX RATE CONNECTION ERROR:",
            repr(exc),
        )

        raise ValueError(
            "Unable to retrieve USD/KES exchange rate"
        )

    raw_rate = response_data.get(
        "rate"
    )

    if raw_rate is None:
        raise ValueError(
            "USD/KES exchange rate was not returned"
        )

    try:
        rate = Decimal(
            str(raw_rate)
        )

    except (
        ValueError,
        TypeError,
    ):

        raise ValueError(
            "Invalid USD/KES exchange rate"
        )

    if rate <= Decimal("0"):
        raise ValueError(
            "USD/KES exchange rate must be greater than zero"
        )

    return rate


def convert_kes_to_paypal_currency(
    kes_amount,
    exchange_rate,
):
    return (
        Decimal(str(kes_amount))
        / exchange_rate
    ).quantize(
        PAYPAL_QUANTIZER,
        rounding=ROUND_HALF_UP,
    )


def decimal_to_paypal_value(value):
    return format(
        Decimal(str(value)).quantize(
            PAYPAL_QUANTIZER,
            rounding=ROUND_HALF_UP,
        ),
        ".2f",
    )


def extract_paypal_order_id(data):
    return (
        data.get("paypal_order_id")
        or data.get("orderID")
        or data.get("order_id")
    )


def get_paypal_approval_url(paypal_order):
    for link in paypal_order.get(
        "links",
        [],
    ):
        if link.get("rel") == "approve":
            return link.get("href")

    return None


def get_paypal_purchase_unit(
    paypal_order,
):
    purchase_units = paypal_order.get(
        "purchase_units",
        [],
    )

    if not purchase_units:
        return None

    return purchase_units[0]


def get_expected_paypal_total(order):
    if order.paypal_total is None:
        raise ValueError(
            "PayPal total is not stored for this order"
        )

    return Decimal(
        str(order.paypal_total)
    ).quantize(
        PAYPAL_QUANTIZER,
        rounding=ROUND_HALF_UP,
    )


def validate_paypal_amount(
    paypal_amount,
    expected_amount,
):
    paypal_currency = paypal_amount.get(
        "currency_code"
    )

    expected_currency = (
        get_paypal_currency()
    )

    if (
        not paypal_currency
        or paypal_currency.upper()
        != expected_currency
    ):
        return False

    paypal_total = paypal_amount.get(
        "value"
    )

    if paypal_total is None:
        return False

    try:
        paypal_total_decimal = (
            Decimal(
                str(paypal_total)
            ).quantize(
                PAYPAL_QUANTIZER,
                rounding=ROUND_HALF_UP,
            )
        )

    except (
        ValueError,
        TypeError,
    ):
        return False

    return (
        paypal_total_decimal
        == expected_amount
    )


# ---------------- CREATE PAYPAL CHECKOUT SESSION ----------------
class CreatePayPalSessionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data or {}

        current_user = request.user

        items = data.get(
            "items",
            [],
        )

        street = data.get("street")
        city = data.get("city")
        country = data.get("country")
        postal_code = data.get("postal_code")

        if not items:
            return Response(
                {
                    "error": "Cart is empty"
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

        if not all(
            [
                street,
                city,
                country,
            ]
        ):
            return Response(
                {
                    "error": "Missing address fields"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():

                order = Orders.objects.create(
                    user_id=current_user.id,
                    paid=False,
                    payment_method="paypal",
                    street=street.strip(),
                    city=city.strip(),
                    postal_code=(
                        postal_code.strip()
                        if isinstance(
                            postal_code,
                            str,
                        )
                        else postal_code
                    ),
                    country=country.strip(),
                    status="pending",
                    total_price=Decimal("0.00"),
                )

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
                        KES_QUANTIZER,
                        rounding=ROUND_HALF_UP,
                    )

                    subtotal = (
                        unit_price
                        * quantity
                    ).quantize(
                        KES_QUANTIZER,
                        rounding=ROUND_HALF_UP,
                    )

                    OrderItems.objects.create(
                        order=order,
                        sparepart=sparepart,
                        quantity=quantity,
                        unit_price=unit_price,
                        subtotal=subtotal,
                    )

                order.refresh_from_db()

                total_price_kes = (
                    calculate_order_total(
                        order
                    )
                )

                paypal_exchange_rate = (
                    get_paypal_kes_to_usd_rate()
                )

                paypal_items, paypal_item_total = (
                    calculate_paypal_items(
                        order,
                        paypal_exchange_rate,
                    )
                )

                order.total_price = (
                    total_price_kes
                )

                order.paypal_exchange_rate = (
                    paypal_exchange_rate
                )

                order.paypal_total = (
                    paypal_item_total
                )

                order.save(
                    update_fields=[
                        "total_price",
                        "paypal_exchange_rate",
                        "paypal_total",
                    ]
                )

                access_token = (
                    get_paypal_access_token()
                )

                currency = (
                    get_paypal_currency()
                )

                paypal_payload = {
                    "intent": "CAPTURE",
                    "purchase_units": [
                        {
                            "reference_id": str(
                                order.id
                            ),
                            "custom_id": str(
                                order.id
                            ),
                            "description": (
                                "Torque Titan "
                                "Spare Parts Order"
                            ),
                            "amount": {
                                "currency_code": currency,
                                "value": (
                                    decimal_to_paypal_value(
                                        paypal_item_total
                                    )
                                ),
                                "breakdown": {
                                    "item_total": {
                                        "currency_code": currency,
                                        "value": (
                                            decimal_to_paypal_value(
                                                paypal_item_total
                                            )
                                        ),
                                    }
                                },
                            },
                            "items": paypal_items,
                        }
                    ],
                    "application_context": {
                        "shipping_preference": (
                            "NO_SHIPPING"
                        ),
                        "user_action": (
                            "PAY_NOW"
                        ),
                        "return_url": (
                            getattr(
                                settings,
                                "PAYPAL_SUCCESS_URL",
                                "http://localhost:5173/payment-success",
                            )
                        ),
                        "cancel_url": (
                            getattr(
                                settings,
                                "PAYPAL_CANCEL_URL",
                                "http://localhost:5173/payment-cancel",
                            )
                        ),
                    },
                }

                paypal_order = paypal_request(
                    method="POST",
                    path="/v2/checkout/orders",
                    access_token=access_token,
                    payload=paypal_payload,
                    request_id=str(
                        order.id
                    ),
                )

                paypal_order_id = (
                    paypal_order.get("id")
                )

                if not paypal_order_id:
                    raise ValueError(
                        "PayPal did not return an order ID"
                    )

                approval_url = (
                    get_paypal_approval_url(
                        paypal_order
                    )
                )

                if not approval_url:
                    raise ValueError(
                        "PayPal did not return an approval URL"
                    )

        except ValueError as exc:

            return Response(
                {
                    "error": str(exc)
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as exc:

            print(
                "PAYPAL CREATE ORDER ERROR:",
                repr(exc),
            )

            return Response(
                {
                    "error": (
                        "Failed to create "
                        "PayPal order"
                    )
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "id": paypal_order_id,
                "order_id": str(
                    order.id
                ),
                "approval_url": approval_url,
                "status": paypal_order.get(
                    "status"
                ),
                "currency": get_paypal_currency(),
                "kes_total": format(
                    total_price_kes,
                    ".2f",
                ),
                "paypal_exchange_rate": format(
                    paypal_exchange_rate,
                    ".6f",
                ),
                "paypal_total": (
                    decimal_to_paypal_value(
                        paypal_item_total
                    )
                ),
            },
            status=status.HTTP_200_OK,
        )


# ---------------- CAPTURE PAYPAL ORDER ----------------
class CapturePayPalSessionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data or {}

        paypal_order_id = (
            extract_paypal_order_id(
                data
            )
        )

        if not paypal_order_id:
            return Response(
                {
                    "error": (
                        "Missing PayPal order ID"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            access_token = (
                get_paypal_access_token()
            )

            paypal_order = paypal_request(
                method="GET",
                path=(
                    "/v2/checkout/orders/"
                    f"{paypal_order_id}"
                ),
                access_token=access_token,
            )

            paypal_status = (
                paypal_order.get("status")
            )

            if paypal_status not in [
                "APPROVED",
                "COMPLETED",
            ]:
                return Response(
                    {
                        "error": (
                            "PayPal order has "
                            "not been approved"
                        ),
                        "paypal_status": (
                            paypal_status
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            purchase_unit = (
                get_paypal_purchase_unit(
                    paypal_order
                )
            )

            if not purchase_unit:
                return Response(
                    {
                        "error": (
                            "PayPal order has "
                            "no purchase units"
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            order_id = (
                purchase_unit.get(
                    "custom_id"
                )
                or purchase_unit.get(
                    "reference_id"
                )
            )

            if not order_id:
                return Response(
                    {
                        "error": (
                            "Missing local order ID "
                            "from PayPal order"
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

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

                if str(
                    order.user_id
                ) != str(
                    request.user.id
                ):
                    return Response(
                        {
                            "error": (
                                "You do not own "
                                "this order"
                            )
                        },
                        status=status.HTTP_403_FORBIDDEN,
                    )

                if order.paid:
                    return Response(
                        {
                            "success": True,
                            "already_paid": True,
                            "order_id": str(
                                order.id
                            ),
                        },
                        status=status.HTTP_200_OK,
                    )

                expected_total_usd = (
                    get_expected_paypal_total(
                        order
                    )
                )

                paypal_amount = (
                    purchase_unit.get(
                        "amount",
                        {},
                    )
                )

                if not validate_paypal_amount(
                    paypal_amount,
                    expected_total_usd,
                ):
                    print(
                        "PAYPAL AMOUNT MISMATCH:",
                        "order=",
                        order.id,
                        "expected_usd=",
                        expected_total_usd,
                        "received=",
                        paypal_amount.get(
                            "value"
                        ),
                    )

                    return Response(
                        {
                            "error": (
                                "Payment amount "
                                "does not match "
                                "order total"
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                capture_response = (
                    paypal_request(
                        method="POST",
                        path=(
                            "/v2/checkout/orders/"
                            f"{paypal_order_id}"
                            "/capture"
                        ),
                        access_token=access_token,
                        payload={},
                        request_id=(
                            f"capture-{order.id}"
                        ),
                    )
                )

                capture_status = (
                    capture_response.get(
                        "status"
                    )
                )

                if capture_status != "COMPLETED":
                    return Response(
                        {
                            "error": (
                                "PayPal payment "
                                "was not completed"
                            ),
                            "paypal_status": (
                                capture_status
                            ),
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                captured_units = (
                    capture_response.get(
                        "purchase_units",
                        [],
                    )
                )

                if not captured_units:
                    return Response(
                        {
                            "error": (
                                "PayPal capture "
                                "contains no "
                                "purchase units"
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                captured_payments = (
                    captured_units[0]
                    .get("payments", {})
                )

                captures = (
                    captured_payments
                    .get("captures", [])
                )

                if not captures:
                    return Response(
                        {
                            "error": (
                                "PayPal capture "
                                "contains no "
                                "capture record"
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                capture = captures[0]

                if capture.get("status") != "COMPLETED":
                    return Response(
                        {
                            "error": (
                                "PayPal capture "
                                "was not completed"
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                captured_amount = (
                    capture.get(
                        "amount",
                        {},
                    )
                )

                if not validate_paypal_amount(
                    captured_amount,
                    expected_total_usd,
                ):
                    print(
                        "PAYPAL CAPTURE AMOUNT MISMATCH:",
                        "order=",
                        order.id,
                        "expected_usd=",
                        expected_total_usd,
                        "captured=",
                        captured_amount.get(
                            "value"
                        ),
                    )

                    return Response(
                        {
                            "error": (
                                "Captured payment "
                                "does not match "
                                "order total"
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                expected_total_kes = (
                    calculate_order_total(
                        order
                    )
                )

                order.total_price = (
                    expected_total_kes
                )

                order.paid = True

                order.save(
                    update_fields=[
                        "total_price",
                        "paid",
                    ]
                )

        except Orders.DoesNotExist:

            return Response(
                {
                    "error": "Order not found"
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        except ValueError as exc:

            return Response(
                {
                    "error": str(exc)
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as exc:

            print(
                "PAYPAL CAPTURE ERROR:",
                repr(exc),
            )

            return Response(
                {
                    "error": (
                        "Failed to capture "
                        "PayPal payment"
                    )
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "success": True,
                "order_id": str(
                    order.id
                ),
                "paypal_order_id": (
                    paypal_order_id
                ),
            },
            status=status.HTTP_200_OK,
        )


# ---------------- PAYPAL CANCEL ----------------
class CancelPaypalSessionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data or {}

        paypal_order_id = (
            extract_paypal_order_id(
                data
            )
        )

        if not paypal_order_id:
            return Response(
                {
                    "error": (
                        "Missing PayPal order ID"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            access_token = (
                get_paypal_access_token()
            )

            paypal_order = paypal_request(
                method="GET",
                path=(
                    "/v2/checkout/orders/"
                    f"{paypal_order_id}"
                ),
                access_token=access_token,
            )

            purchase_unit = (
                get_paypal_purchase_unit(
                    paypal_order
                )
            )

            if not purchase_unit:
                return Response(
                    {
                        "error": (
                            "PayPal order has "
                            "no purchase units"
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            order_id = (
                purchase_unit.get(
                    "custom_id"
                )
                or purchase_unit.get(
                    "reference_id"
                )
            )

            if not order_id:
                return Response(
                    {
                        "error": (
                            "Missing local order ID"
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            with transaction.atomic():

                order = (
                    Orders.objects
                    .select_for_update()
                    .get(
                        pk=order_id
                    )
                )

                if str(
                    order.user_id
                ) != str(
                    request.user.id
                ):
                    return Response(
                        {
                            "error": (
                                "You do not own "
                                "this order"
                            )
                        },
                        status=status.HTTP_403_FORBIDDEN,
                    )

                if (
                    not order.paid
                    and order.status == "pending"
                ):
                    order.status = "expired"

                    order.save(
                        update_fields=[
                            "status",
                        ]
                    )

        except Orders.DoesNotExist:

            return Response(
                {
                    "error": "Order not found"
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        except ValueError as exc:

            return Response(
                {
                    "error": str(exc)
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as exc:

            print(
                "PAYPAL CANCEL ERROR:",
                repr(exc),
            )

            return Response(
                {
                    "error": (
                        "Failed to cancel "
                        "PayPal order"
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


# ---------------- PAYPAL WEBHOOK ----------------
class PayPalWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        payload = request.body

        try:
            webhook_event = json.loads(
                payload.decode("utf-8")
            )

        except (
            ValueError,
            UnicodeDecodeError,
        ) as exc:

            print(
                "PAYPAL WEBHOOK PAYLOAD ERROR:",
                repr(exc),
            )

            return Response(
                {
                    "error": "Invalid payload"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        transmission_id = request.META.get(
            "HTTP_PAYPAL_TRANSMISSION_ID"
        )

        transmission_time = request.META.get(
            "HTTP_PAYPAL_TRANSMISSION_TIME"
        )

        cert_url = request.META.get(
            "HTTP_PAYPAL_CERT_URL"
        )

        auth_algo = request.META.get(
            "HTTP_PAYPAL_AUTH_ALGO"
        )

        transmission_sig = request.META.get(
            "HTTP_PAYPAL_TRANSMISSION_SIG"
        )

        if not all(
            [
                transmission_id,
                transmission_time,
                cert_url,
                auth_algo,
                transmission_sig,
            ]
        ):
            return Response(
                {
                    "error": (
                        "Missing PayPal "
                        "verification headers"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            verification = (
                verify_paypal_webhook(
                    transmission_id=transmission_id,
                    transmission_time=transmission_time,
                    cert_url=cert_url,
                    auth_algo=auth_algo,
                    transmission_sig=transmission_sig,
                    webhook_event=webhook_event,
                )
            )

        except ValueError as exc:

            print(
                "PAYPAL WEBHOOK VERIFICATION ERROR:",
                repr(exc),
            )

            return Response(
                {
                    "error": (
                        "Webhook verification failed"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as exc:

            print(
                "PAYPAL WEBHOOK VERIFICATION ERROR:",
                repr(exc),
            )

            return Response(
                {
                    "error": (
                        "Failed to verify "
                        "PayPal webhook"
                    )
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if verification.get(
            "verification_status"
        ) != "SUCCESS":

            return Response(
                {
                    "error": "Invalid webhook signature"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        event_type = webhook_event.get(
            "event_type"
        )

        resource = webhook_event.get(
            "resource",
            {},
        )

        print(
            "PAYPAL WEBHOOK RECEIVED:",
            event_type,
        )

        if event_type == (
            "PAYMENT.CAPTURE.COMPLETED"
        ):

            order_id = None

            try:
                related_ids = (
                    resource
                    .get(
                        "supplementary_data",
                        {},
                    )
                    .get(
                        "related_ids",
                        {},
                    )
                )

                paypal_order_id = (
                    related_ids.get(
                        "order_id"
                    )
                )

                if not paypal_order_id:
                    return Response(
                        {
                            "error": (
                                "Missing PayPal "
                                "order ID"
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                access_token = (
                    get_paypal_access_token()
                )

                paypal_order = paypal_request(
                    method="GET",
                    path=(
                        "/v2/checkout/orders/"
                        f"{paypal_order_id}"
                    ),
                    access_token=access_token,
                )

                purchase_unit = (
                    get_paypal_purchase_unit(
                        paypal_order
                    )
                )

                if not purchase_unit:
                    return Response(
                        {
                            "error": (
                                "PayPal order has "
                                "no purchase units"
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                order_id = (
                    purchase_unit.get(
                        "custom_id"
                    )
                    or purchase_unit.get(
                        "reference_id"
                    )
                )

                if not order_id:
                    return Response(
                        {
                            "error": (
                                "Missing local "
                                "order ID"
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

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
                        return Response(
                            {
                                "success": True
                            },
                            status=status.HTTP_200_OK,
                        )

                    expected_total_usd = (
                        get_expected_paypal_total(
                            order
                        )
                    )

                    paypal_amount = (
                        purchase_unit.get(
                            "amount",
                            {},
                        )
                    )

                    if not validate_paypal_amount(
                        paypal_amount,
                        expected_total_usd,
                    ):

                        print(
                            "PAYPAL WEBHOOK "
                            "AMOUNT MISMATCH:",
                            "order=",
                            order.id,
                            "expected_usd=",
                            expected_total_usd,
                            "received=",
                            paypal_amount.get(
                                "value"
                            ),
                        )

                        return Response(
                            {
                                "error": (
                                    "Payment amount "
                                    "does not match "
                                    "order total"
                                )
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    capture_status = (
                        resource.get(
                            "status"
                        )
                    )

                    if (
                        capture_status
                        != "COMPLETED"
                    ):
                        return Response(
                            {
                                "error": (
                                    "Payment capture "
                                    "is not completed"
                                )
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    expected_total_kes = (
                        calculate_order_total(
                            order
                        )
                    )

                    order.total_price = (
                        expected_total_kes
                    )

                    order.paid = True

                    order.save(
                        update_fields=[
                            "total_price",
                            "paid",
                        ]
                    )

                    print(
                        f"ORDER {order.id} "
                        "MARKED AS PAID BY "
                        "PAYPAL WEBHOOK"
                    )

            except Orders.DoesNotExist:

                print(
                    "PAYPAL WEBHOOK ERROR: "
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
                    "PAYPAL WEBHOOK "
                    "ORDER PROCESSING ERROR:",
                    repr(exc),
                )

                return Response(
                    {
                        "error": str(exc)
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            except Exception as exc:

                print(
                    "PAYPAL WEBHOOK "
                    "ORDER PROCESSING ERROR:",
                    repr(exc),
                )

                return Response(
                    {
                        "error": (
                            "Failed to process "
                            "PayPal webhook"
                        )
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        elif event_type == (
            "PAYMENT.CAPTURE.DENIED"
        ):

            print(
                "PAYPAL PAYMENT CAPTURE DENIED:",
                resource.get("id"),
            )

        elif event_type == (
            "PAYMENT.CAPTURE.REFUNDED"
        ):

            print(
                "PAYPAL PAYMENT CAPTURE REFUNDED:",
                resource.get("id"),
            )

        elif event_type == (
            "PAYMENT.CAPTURE.REVERSED"
        ):

            print(
                "PAYPAL PAYMENT CAPTURE REVERSED:",
                resource.get("id"),
            )

        return Response(
            {
                "success": True
            },
            status=status.HTTP_200_OK,
        )