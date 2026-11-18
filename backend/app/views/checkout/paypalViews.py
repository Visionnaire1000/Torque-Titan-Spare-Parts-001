import base64
import hashlib
import json
import urllib.error
import urllib.parse
import urllib.request

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

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


KES_QUANTIZER = Decimal("0.01")
PAYPAL_QUANTIZER = Decimal("0.01")


# --------------------------- PAYPAL PRODUCT NAME TRANSLATIONS ---------------------------
PAYPAL_PRODUCT_TRANSLATIONS = {
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


# --------------------------- VALIDATION HELPERS ---------------------------
def normalize_language_code(language):
    language = str(language or "en").strip().lower()

    return language.replace("_", "-").split("-")[0]


def normalize_paypal_product_attribute(value):
    return " ".join(
        str(value or "")
        .strip()
        .lower()
        .replace("_", " ")
        .replace("-", " ")
        .split()
    )


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


def parse_paypal_quantity(value):
    if isinstance(value, bool):
        raise ValueError(
            "Quantity must be a positive integer"
        )

    try:
        quantity = Decimal(str(value))
    except (
        TypeError,
        ValueError,
        InvalidOperation,
    ):
        raise ValueError(
            "Quantity must be a positive integer"
        )

    if (
        not quantity.is_finite()
        or quantity != quantity.to_integral_value()
        or quantity <= 0
    ):
        raise ValueError(
            "Quantity must be a positive integer"
        )

    return int(quantity)


def get_paypal_request_id(prefix, order_id):
    request_hash = hashlib.sha256(
        f"{prefix}-{order_id}".encode("utf-8")
    ).hexdigest()

    return request_hash[:32]


# --------------------------- PAYPAL PRODUCT NAME ---------------------------
def get_paypal_product_name(sparepart, language="en"):
    language = normalize_language_code(language)

    brand = str(sparepart.brand or "").strip()

    category = normalize_paypal_product_attribute(
        sparepart.category
    )

    vehicle_type = normalize_paypal_product_attribute(
        sparepart.vehicle_type
    )

    translations = PAYPAL_PRODUCT_TRANSLATIONS.get(language)

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


# --------------------------- ORDER HELPERS ---------------------------
def calculate_order_total(order):
    total = sum(
        (
            to_decimal(
                item.subtotal,
                "Order item subtotal",
            )
            if item.subtotal is not None
            else Decimal("0.00")
            for item in order.order_items.all()
        ),
        Decimal("0.00"),
    )

    return total.quantize(
        KES_QUANTIZER,
        rounding=ROUND_HALF_UP,
    )


def clear_user_cart(user):
    deleted_count, _ = CartItems.objects.filter(
        user=user
    ).delete()

    print(
        f"PAYPAL CART CLEAR: "
        f"user={user.id}, "
        f"deleted_cart_items={deleted_count}"
    )


def mark_order_as_failed(order_id):
    with transaction.atomic():
        order = (
            Orders.objects
            .select_for_update()
            .get(pk=order_id)
        )

        if order.paid:
            return order

        if order.status != "pending":
            return order

        order.status = "failed"
        order.save(update_fields=["status"])

        print(
            f"PAYPAL ORDER {order_id} MARKED AS FAILED"
        )

        return order


def mark_order_as_paid(order_id, payment_reference=None):
    with transaction.atomic():
        order = (
            Orders.objects
            .select_for_update()
            .select_related("user")
            .prefetch_related("order_items")
            .get(pk=order_id)
        )

        if order.payment_method != "paypal":
            raise ValueError(
                "Order payment method is not PayPal"
            )

        if (
            payment_reference
            and order.payment_reference
            and order.payment_reference != payment_reference
        ):
            raise ValueError(
                "PayPal capture reference does not match order"
            )

        if order.paid:
            if payment_reference and not order.payment_reference:
                order.payment_reference = payment_reference
                order.save(
                    update_fields=["payment_reference"]
                )

            print(
                f"PAYPAL PAYMENT: "
                f"Order {order_id} is already marked as paid"
            )

            return order

        total_price = calculate_order_total(order)

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

        if order.status in {
            "failed",
            "expired",
            "cancelled",
        }:
            order.status = "pending"
            update_fields.append("status")

        if payment_reference:
            order.payment_reference = payment_reference
            update_fields.append("payment_reference")

        order.save(update_fields=update_fields)

        clear_user_cart(order.user)

        customer_email = order.user.email
        order_id_value = str(order.id)
        payment_method = order.payment_method

        def send_confirmation_email():
            try:
                send_order_confirmation_email_task.delay(
                    customer_email,
                    order_id_value,
                    total_price,
                    payment_method,
                )
            except Exception as exc:
                print(
                    "PAYPAL EMAIL TASK ERROR:",
                    repr(exc),
                )

        transaction.on_commit(send_confirmation_email)

        print(
            f"ORDER {order.id} MARKED AS PAID BY PAYPAL"
        )

        return order


def mark_order_creation_failed(order):
    if order is None:
        return

    try:
        mark_order_as_failed(order.id)
    except Exception as exc:
        print(
            "PAYPAL MARK FAILED ERROR:",
            repr(exc),
        )


def refund_paypal_order(order):
    if not order.payment_reference:
        raise ValueError(
            "PayPal capture ID is missing."
        )

    access_token = get_paypal_access_token()

    refund_response = paypal_request(
        method="POST",
        path=(
            "/v2/payments/captures/"
            f"{order.payment_reference}/refund"
        ),
        access_token=access_token,
        payload={},
        request_id=get_paypal_request_id(
            "refund",
            order.id,
        ),
    )

    print(
        f"PAYPAL REFUND: "
        f"Order {order.id} | "
        f"Refund {refund_response.get('id', 'N/A')} | "
        f"Status {refund_response.get('status', 'UNKNOWN')}"
    )

    return refund_response


# --------------------------- PAYPAL AMOUNT HELPERS ---------------------------
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


def convert_kes_to_paypal_currency(
    kes_amount,
    exchange_rate,
):
    kes_amount = to_decimal(
        kes_amount,
        "KES amount",
    )

    exchange_rate = to_decimal(
        exchange_rate,
        "Exchange rate",
    )

    if exchange_rate <= Decimal("0"):
        raise ValueError(
            "Exchange rate must be greater than zero"
        )

    return (
        kes_amount / exchange_rate
    ).quantize(
        PAYPAL_QUANTIZER,
        rounding=ROUND_HALF_UP,
    )


def decimal_to_paypal_value(value):
    return format(
        to_decimal(value).quantize(
            PAYPAL_QUANTIZER,
            rounding=ROUND_HALF_UP,
        ),
        ".2f",
    )


def calculate_paypal_items(
    order,
    exchange_rate,
    language="en",
):
    paypal_items = []
    paypal_item_total = Decimal("0.00")
    currency = get_paypal_currency()

    for order_item in order.order_items.select_related(
        "sparepart"
    ).all():
        sparepart = order_item.sparepart

        paypal_unit_price = convert_kes_to_paypal_currency(
            order_item.unit_price,
            exchange_rate,
        )

        quantity = parse_paypal_quantity(
            order_item.quantity
        )

        if paypal_unit_price <= Decimal("0.00"):
            raise ValueError(
                "PayPal item price must be greater than zero"
            )

        paypal_subtotal = (
            paypal_unit_price * quantity
        ).quantize(
            PAYPAL_QUANTIZER,
            rounding=ROUND_HALF_UP,
        )

        paypal_item_total += paypal_subtotal

        product_name = get_paypal_product_name(
            sparepart,
            language,
        )

        paypal_items.append({
            "name": product_name[:127],
            "description": product_name[:127],
            "quantity": str(quantity),
            "unit_amount": {
                "currency_code": currency,
                "value": decimal_to_paypal_value(
                    paypal_unit_price
                ),
            },
        })

    paypal_item_total = paypal_item_total.quantize(
        PAYPAL_QUANTIZER,
        rounding=ROUND_HALF_UP,
    )

    return paypal_items, paypal_item_total


def get_expected_paypal_total(order):
    if order.paypal_total is None:
        raise ValueError(
            "PayPal total is not stored for this order"
        )

    return to_decimal(
        order.paypal_total,
        "Stored PayPal total",
    ).quantize(
        PAYPAL_QUANTIZER,
        rounding=ROUND_HALF_UP,
    )


def validate_paypal_amount(
    paypal_amount,
    expected_amount,
):
    if not isinstance(paypal_amount, dict):
        return False

    paypal_currency = paypal_amount.get(
        "currency_code"
    )

    expected_currency = get_paypal_currency()

    if (
        not paypal_currency
        or paypal_currency.upper() != expected_currency
    ):
        return False

    paypal_total = paypal_amount.get("value")

    if paypal_total is None:
        return False

    try:
        paypal_total_decimal = Decimal(
            str(paypal_total)
        )

        if not paypal_total_decimal.is_finite():
            return False

        paypal_total_decimal = paypal_total_decimal.quantize(
            PAYPAL_QUANTIZER,
            rounding=ROUND_HALF_UP,
        )

    except (
        ValueError,
        TypeError,
        InvalidOperation,
    ):
        return False

    return paypal_total_decimal == expected_amount


# --------------------------- PAYPAL API HELPERS ---------------------------
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
        f"{get_paypal_base_url()}/v1/oauth2/token"
    )

    data = urllib.parse.urlencode({
        "grant_type": "client_credentials",
    }).encode("utf-8")

    request = urllib.request.Request(
        token_url,
        data=data,
        method="POST",
        headers={
            "Authorization": f"Basic {encoded_credentials}",
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "User-Agent": "Torque-Titan-Spares/1.0",
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

    access_token = response_data.get("access_token")

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
    url = f"{get_paypal_base_url()}{path}"

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Torque-Titan-Spares/1.0",
    }

    if request_id:
        headers["PayPal-Request-Id"] = request_id

    body = None

    if payload is not None:
        body = json.dumps(payload).encode("utf-8")

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
            response_body = response.read().decode("utf-8")

            if not response_body:
                return {}

            return json.loads(response_body)

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
            error_data = json.loads(error_body)
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


def get_paypal_kes_to_usd_rate():
    rate_url = (
        "https://api.frankfurter.dev/v2/rate/usd/kes"
    )

    request = urllib.request.Request(
        rate_url,
        method="GET",
        headers={
            "Accept": "application/json",
            "User-Agent": "Torque-Titan-Spares/1.0",
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

    raw_rate = response_data.get("rate")

    if raw_rate is None:
        raise ValueError(
            "USD/KES exchange rate was not returned"
        )

    rate = to_decimal(
        raw_rate,
        "USD/KES exchange rate",
    )

    if rate <= Decimal("0"):
        raise ValueError(
            "USD/KES exchange rate must be greater than zero"
        )

    return rate


def extract_paypal_order_id(data):
    if not isinstance(data, dict):
        return None

    return (
        data.get("paypal_order_id")
        or data.get("orderID")
        or data.get("order_id")
    )


def get_paypal_approval_url(paypal_order):
    links = paypal_order.get("links", [])

    for relation in ("payer-action", "approve"):
        for link in links:
            if link.get("rel") == relation:
                return link.get("href")

    return None


def get_paypal_purchase_unit(paypal_order):
    purchase_units = paypal_order.get(
        "purchase_units",
        [],
    )

    if not purchase_units:
        return None

    return purchase_units[0]


def get_local_order_from_paypal_order(
    paypal_order,
    user=None,
):
    purchase_unit = get_paypal_purchase_unit(
        paypal_order
    )

    if not purchase_unit:
        raise ValueError(
            "PayPal order has no purchase units"
        )

    local_order_id = (
        purchase_unit.get("custom_id")
        or purchase_unit.get("reference_id")
    )

    if not local_order_id:
        raise ValueError(
            "Missing local order ID from PayPal order"
        )

    queryset = Orders.objects.all()

    if user is not None:
        queryset = queryset.filter(user=user)

    try:
        order = queryset.get(pk=local_order_id)
    except Orders.DoesNotExist:
        raise ValueError("Order not found")

    if order.payment_method != "paypal":
        raise ValueError(
            "Order payment method is not PayPal"
        )

    return order, purchase_unit


def get_paypal_capture(capture_response):
    purchase_units = capture_response.get(
        "purchase_units",
        [],
    )

    if not purchase_units:
        return None

    captured_payments = purchase_units[0].get(
        "payments",
        {},
    )

    captures = captured_payments.get(
        "captures",
        [],
    )

    if not captures:
        return None

    return captures[0]


# --------------------------- CREATE PAYPAL CHECKOUT SESSION ---------------------------
class CreatePayPalSessionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data or {}
        current_user = request.user

        language = normalize_language_code(
            data.get("language", "en")
        )

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

        order = None
        order_persisted = False

        try:
            try:
                Profile.objects.get(user=current_user)
            except Profile.DoesNotExist:
                return Response(
                    {"error": "Customer profile not found"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

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
                    payment_method="paypal",
                    status="pending",
                    total_price=Decimal("0.00"),
                )

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
                            "Spare part not found"
                        )

                    quantity = parse_paypal_quantity(
                        item.get("quantity", 1)
                    )

                    sparepart.calculate_discount()

                    marked_price = to_decimal(
                        sparepart.marked_price,
                        "Spare part marked price",
                    )

                    discount_amount = to_decimal(
                        sparepart.discount_amount,
                        "Spare part discount",
                    )

                    unit_price = (
                        marked_price - discount_amount
                    ).quantize(
                        KES_QUANTIZER,
                        rounding=ROUND_HALF_UP,
                    )

                    if unit_price <= Decimal("0.00"):
                        raise ValueError(
                            "Spare part price must be greater than zero"
                        )

                    subtotal = (
                        unit_price * quantity
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

                total_price_kes = calculate_order_total(
                    order
                )

                if total_price_kes <= Decimal("0.00"):
                    raise ValueError(
                        "Order total must be greater than zero"
                    )

                order.total_price = total_price_kes

                order.save(
                    update_fields=["total_price"]
                )

            order_persisted = True

            paypal_exchange_rate = get_paypal_kes_to_usd_rate()

            paypal_items, paypal_item_total = calculate_paypal_items(
                order,
                paypal_exchange_rate,
                language,
            )

            if paypal_item_total <= Decimal("0.00"):
                raise ValueError(
                    "PayPal total must be greater than zero"
                )

            with transaction.atomic():
                locked_order = (
                    Orders.objects
                    .select_for_update()
                    .get(
                        pk=order.id,
                        user=current_user,
                    )
                )

                locked_order.paypal_exchange_rate = (
                    paypal_exchange_rate
                )

                locked_order.paypal_total = paypal_item_total

                locked_order.save(
                    update_fields=[
                        "paypal_exchange_rate",
                        "paypal_total",
                    ]
                )

            access_token = get_paypal_access_token()
            currency = get_paypal_currency()

            paypal_payload = {
                "intent": "CAPTURE",
                "payment_source": {
                    "paypal": {
                        "experience_context": {
                            "shipping_preference": "NO_SHIPPING",
                            "user_action": "PAY_NOW",
                            "return_url": settings.PAYPAL_SUCCESS_URL,
                            "cancel_url": settings.PAYPAL_CANCEL_URL,
                        }
                    }
                },
                "purchase_units": [
                    {
                        "reference_id": str(order.id),
                        "custom_id": str(order.id),
                        "description": "Torque Titan Spare Parts Order",
                        "amount": {
                            "currency_code": currency,
                            "value": decimal_to_paypal_value(
                                paypal_item_total
                            ),
                            "breakdown": {
                                "item_total": {
                                    "currency_code": currency,
                                    "value": decimal_to_paypal_value(
                                        paypal_item_total
                                    ),
                                }
                            },
                        },
                        "items": paypal_items,
                    }
                ],
            }

            paypal_order = paypal_request(
                method="POST",
                path="/v2/checkout/orders",
                access_token=access_token,
                payload=paypal_payload,
                request_id=get_paypal_request_id(
                    "create",
                    order.id,
                ),
            )

            paypal_order_id = paypal_order.get("id")

            if not paypal_order_id:
                raise ValueError(
                    "PayPal did not return an order ID"
                )

            approval_url = get_paypal_approval_url(
                paypal_order
            )

            if not approval_url:
                raise ValueError(
                    "PayPal did not return an approval URL"
                )

        except ValueError as exc:
            if order_persisted:
                mark_order_creation_failed(order)

            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as exc:
            print(
                "PAYPAL CREATE ORDER ERROR:",
                repr(exc),
            )

            if order_persisted:
                mark_order_creation_failed(order)

            return Response(
                {"error": "Failed to create PayPal order"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(
            {
                "id": paypal_order_id,
                "order_id": str(order.id),
                "approval_url": approval_url,
                "status": paypal_order.get("status"),
                "currency": currency,
                "kes_total": format(
                    total_price_kes,
                    ".2f",
                ),
                "paypal_exchange_rate": format(
                    paypal_exchange_rate,
                    ".6f",
                ),
                "paypal_total": decimal_to_paypal_value(
                    paypal_item_total
                ),
            },
            status=status.HTTP_200_OK,
        )


# --------------------------- CAPTURE PAYPAL ORDER ---------------------------
class CapturePayPalSessionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data or {}

        paypal_order_id = extract_paypal_order_id(data)

        if not paypal_order_id:
            return Response(
                {"error": "Missing PayPal order ID"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            access_token = get_paypal_access_token()

            paypal_order = paypal_request(
                method="GET",
                path=f"/v2/checkout/orders/{paypal_order_id}",
                access_token=access_token,
            )

            paypal_status = paypal_order.get("status")

            if paypal_status not in {
                "APPROVED",
                "COMPLETED",
            }:
                return Response(
                    {
                        "error": "PayPal order has not been approved",
                        "paypal_status": paypal_status,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            order, purchase_unit = get_local_order_from_paypal_order(
                paypal_order,
                user=request.user,
            )

            if order.payment_method != "paypal":
                return Response(
                    {"error": "Order payment method is not PayPal"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if order.paid:
                return Response(
                    {
                        "success": True,
                        "already_paid": True,
                        "order_id": str(order.id),
                        "paypal_order_id": paypal_order_id,
                    },
                    status=status.HTTP_200_OK,
                )

            expected_total_usd = get_expected_paypal_total(
                order
            )

            paypal_amount = purchase_unit.get(
                "amount",
                {},
            )

            if not validate_paypal_amount(
                paypal_amount,
                expected_total_usd,
            ):
                print(
                    "PAYPAL AMOUNT MISMATCH:",
                    "order=", order.id,
                    "expected_usd=", expected_total_usd,
                    "received=", paypal_amount.get("value"),
                )

                return Response(
                    {
                        "error": "Payment amount does not match order total"
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if paypal_status == "APPROVED":
                capture_response = paypal_request(
                    method="POST",
                    path=(
                        f"/v2/checkout/orders/"
                        f"{paypal_order_id}/capture"
                    ),
                    access_token=access_token,
                    payload={},
                    request_id=get_paypal_request_id(
                        "capture",
                        order.id,
                    ),
                )
            else:
                capture_response = paypal_order

            capture_status = capture_response.get("status")

            if capture_status != "COMPLETED":
                if capture_status in {
                    "DENIED",
                    "DECLINED",
                    "FAILED",
                }:
                    mark_order_as_failed(order.id)

                return Response(
                    {
                        "error": "PayPal payment was not completed",
                        "paypal_status": capture_status,
                        "failed": capture_status in {
                            "DENIED",
                            "DECLINED",
                            "FAILED",
                        },
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            capture = get_paypal_capture(
                capture_response
            )

            if not capture:
                return Response(
                    {
                        "error": (
                            "PayPal capture contains no capture record"
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if capture.get("status") != "COMPLETED":
                if capture.get("status") in {
                    "DENIED",
                    "DECLINED",
                    "FAILED",
                }:
                    mark_order_as_failed(order.id)

                return Response(
                    {
                        "error": "PayPal capture was not completed",
                        "capture_status": capture.get("status"),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            captured_amount = capture.get(
                "amount",
                {},
            )

            if not validate_paypal_amount(
                captured_amount,
                expected_total_usd,
            ):
                print(
                    "PAYPAL CAPTURE AMOUNT MISMATCH:",
                    "order=", order.id,
                    "expected_usd=", expected_total_usd,
                    "captured=", captured_amount.get("value"),
                )

                return Response(
                    {
                        "error": (
                            "Captured payment does not match order total"
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            capture_id = capture.get("id")

            if not capture_id:
                return Response(
                    {"error": "PayPal capture ID is missing"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            order = mark_order_as_paid(
                order.id,
                payment_reference=capture_id,
            )

        except ValueError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as exc:
            print(
                "PAYPAL CAPTURE ERROR:",
                repr(exc),
            )

            return Response(
                {"error": "Failed to capture PayPal payment"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "success": True,
                "order_id": str(order.id),
                "paypal_order_id": paypal_order_id,
                "paid": True,
            },
            status=status.HTTP_200_OK,
        )


# --------------------------- PAYPAL CANCEL ---------------------------
class CancelPaypalSessionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data or {}

        paypal_order_id = extract_paypal_order_id(data)

        if not paypal_order_id:
            return Response(
                {"error": "Missing PayPal order ID"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            access_token = get_paypal_access_token()

            paypal_order = paypal_request(
                method="GET",
                path=f"/v2/checkout/orders/{paypal_order_id}",
                access_token=access_token,
            )

            order, purchase_unit = get_local_order_from_paypal_order(
                paypal_order,
                user=request.user,
            )

            if order.payment_method != "paypal":
                return Response(
                    {"error": "Order payment method is not PayPal"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if order.paid:
                return Response(
                    {
                        "success": True,
                        "already_paid": True,
                    },
                    status=status.HTTP_200_OK,
                )

            # Returning from the PayPal cancel URL does not prove
            # that the PayPal order can no longer be captured.
            # Keep the local order pending until its payment state
            # is verified or it expires.

        except ValueError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as exc:
            print(
                "PAYPAL CANCEL ERROR:",
                repr(exc),
            )

            return Response(
                {"error": "Failed to process PayPal cancellation"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {"success": True},
            status=status.HTTP_200_OK,
        )


# --------------------------- PAYPAL WEBHOOK ---------------------------
class PayPalWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        try:
            webhook_event = json.loads(
                request.body.decode("utf-8")
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
                {"error": "Invalid payload"},
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

        if not all([
            transmission_id,
            transmission_time,
            cert_url,
            auth_algo,
            transmission_sig,
        ]):
            return Response(
                {"error": "Missing PayPal verification headers"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            verification = verify_paypal_webhook(
                transmission_id=transmission_id,
                transmission_time=transmission_time,
                cert_url=cert_url,
                auth_algo=auth_algo,
                transmission_sig=transmission_sig,
                webhook_event=webhook_event,
            )

        except ValueError as exc:
            print(
                "PAYPAL WEBHOOK VERIFICATION ERROR:",
                repr(exc),
            )

            return Response(
                {"error": "Webhook verification failed"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as exc:
            print(
                "PAYPAL WEBHOOK VERIFICATION ERROR:",
                repr(exc),
            )

            return Response(
                {"error": "Failed to verify PayPal webhook"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if verification.get("verification_status") != "SUCCESS":
            return Response(
                {"error": "Invalid webhook signature"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        event_type = webhook_event.get("event_type")
        resource = webhook_event.get("resource", {})

        print(
            "PAYPAL WEBHOOK RECEIVED:",
            event_type,
        )

        # --------------------------- PAYMENT COMPLETED ---------------------------
        if event_type == "PAYMENT.CAPTURE.COMPLETED":
            order_id = None

            try:
                related_ids = (
                    resource
                    .get("supplementary_data", {})
                    .get("related_ids", {})
                )

                paypal_order_id = related_ids.get(
                    "order_id"
                )

                if not paypal_order_id:
                    return Response(
                        {"error": "Missing PayPal order ID"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                access_token = get_paypal_access_token()

                paypal_order = paypal_request(
                    method="GET",
                    path=f"/v2/checkout/orders/{paypal_order_id}",
                    access_token=access_token,
                )

                order, purchase_unit = get_local_order_from_paypal_order(
                    paypal_order
                )

                order_id = order.id

                if order.payment_method != "paypal":
                    return Response(
                        {
                            "error": (
                                "Order payment method is not PayPal"
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                capture_id = resource.get("id")

                if not capture_id:
                    return Response(
                        {"error": "PayPal capture ID is missing"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if order.paid:
                    if (
                        order.payment_reference
                        and order.payment_reference != capture_id
                    ):
                        return Response(
                            {
                                "error": (
                                    "A different PayPal capture is "
                                    "already recorded"
                                )
                            },
                            status=status.HTTP_409_CONFLICT,
                        )

                    return Response(
                        {
                            "success": True,
                            "already_paid": True,
                        },
                        status=status.HTTP_200_OK,
                    )

                expected_total_usd = get_expected_paypal_total(
                    order
                )

                paypal_amount = purchase_unit.get(
                    "amount",
                    {},
                )

                if not validate_paypal_amount(
                    paypal_amount,
                    expected_total_usd,
                ):
                    print(
                        "PAYPAL WEBHOOK AMOUNT MISMATCH:",
                        "order=", order.id,
                        "expected_usd=", expected_total_usd,
                        "received=", paypal_amount.get("value"),
                    )

                    return Response(
                        {
                            "error": (
                                "Payment amount does not match order total"
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if resource.get("status") != "COMPLETED":
                    return Response(
                        {
                            "error": (
                                "Payment capture is not completed"
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                captured_amount = resource.get(
                    "amount",
                    {},
                )

                if not validate_paypal_amount(
                    captured_amount,
                    expected_total_usd,
                ):
                    print(
                        "PAYPAL WEBHOOK CAPTURE AMOUNT MISMATCH:",
                        "order=", order.id,
                        "expected_usd=", expected_total_usd,
                        "captured=", captured_amount.get("value"),
                    )

                    return Response(
                        {
                            "error": (
                                "Captured payment does not match order total"
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                mark_order_as_paid(
                    order.id,
                    payment_reference=capture_id,
                )

            except Orders.DoesNotExist:
                print(
                    f"PAYPAL WEBHOOK ERROR: "
                    f"Order {order_id} not found"
                )

                return Response(
                    {"error": "Order not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            except ValueError as exc:
                print(
                    "PAYPAL WEBHOOK ORDER PROCESSING ERROR:",
                    repr(exc),
                )

                return Response(
                    {"error": str(exc)},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            except Exception as exc:
                print(
                    "PAYPAL WEBHOOK ORDER PROCESSING ERROR:",
                    repr(exc),
                )

                return Response(
                    {"error": "Failed to process PayPal webhook"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        # --------------------------- PAYMENT DENIED ---------------------------
        elif event_type == "PAYMENT.CAPTURE.DENIED":
            try:
                related_ids = (
                    resource
                    .get("supplementary_data", {})
                    .get("related_ids", {})
                )

                paypal_order_id = related_ids.get(
                    "order_id"
                )

                if paypal_order_id:
                    access_token = get_paypal_access_token()

                    paypal_order = paypal_request(
                        method="GET",
                        path=(
                            f"/v2/checkout/orders/"
                            f"{paypal_order_id}"
                        ),
                        access_token=access_token,
                    )

                    order, purchase_unit = get_local_order_from_paypal_order(
                        paypal_order
                    )

                    if not order.paid:
                        mark_order_as_failed(order.id)

                print(
                    "PAYPAL PAYMENT CAPTURE DENIED:",
                    resource.get("id"),
                )

            except ValueError as exc:
                print(
                    "PAYPAL DENIED WEBHOOK ERROR:",
                    repr(exc),
                )

                return Response(
                    {"error": str(exc)},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            except Exception as exc:
                print(
                    "PAYPAL DENIED WEBHOOK ERROR:",
                    repr(exc),
                )

                return Response(
                    {"error": "Failed to process denied payment"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        # --------------------------- REFUND COMPLETED ---------------------------
        elif event_type == "PAYMENT.CAPTURE.REFUNDED":
            print(
                "PAYPAL PAYMENT CAPTURE REFUNDED:",
                resource.get("id"),
            )

        # --------------------------- PAYMENT REVERSED ---------------------------
        elif event_type == "PAYMENT.CAPTURE.REVERSED":
            print(
                "PAYPAL PAYMENT CAPTURE REVERSED:",
                resource.get("id"),
            )

        return Response(
            {"success": True},
            status=status.HTTP_200_OK,
        )
