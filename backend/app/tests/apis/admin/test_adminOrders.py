import pytest

from rest_framework.test import APIClient

from app.models import (
    Users,
    Orders,
    OrderItems,
    SpareParts,
)


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def admin():
    return Users.objects.create(
        email="admin@example.com",
        role="admin",
        email_verified=True,
        auth_provider="local",
        password_hash="test-password",
    )


@pytest.fixture
def super_admin():
    return Users.objects.create(
        email="superadmin@example.com",
        role="super_admin",
        email_verified=True,
        auth_provider="local",
        password_hash="test-password",
    )


@pytest.fixture
def buyer():
    return Users.objects.create(
        email="buyer@example.com",
        role="buyer",
        email_verified=True,
        auth_provider="local",
        password_hash="test-password",
    )


@pytest.fixture
def sparepart():
    return SpareParts.objects.create(
        category="tyre",
        vehicle_type="sedan",
        brand="Michelin",
        colour="Black",
        buying_price=20000,
        marked_price=25000,
        image="https://example.com/tyre.jpg",
        description="Premium tyre",
    )


@pytest.fixture
def order(buyer):
    return Orders.objects.create(
        user=buyer,
        status="pending",
        paid=True,
        street="Kenyatta Avenue",
        city="Nairobi",
        country="Kenya",
    )


@pytest.fixture
def order_with_items(order, sparepart):
    OrderItems.objects.create(
        order=order,
        sparepart=sparepart,
        quantity=2,
        unit_price=25000,
        subtotal=50000,
    )

    return order


# AUTHORIZATION
@pytest.mark.django_db
def test_admin_orders_requires_authentication(client):
    response = client.get("/admin/orders/")

    assert response.status_code == 401


@pytest.mark.django_db
def test_buyer_cannot_access_admin_orders(client, buyer):
    client.force_authenticate(user=buyer)

    response = client.get("/admin/orders/")

    assert response.status_code == 403
    assert response.json()["error"] == "Admins only"


@pytest.mark.django_db
def test_admin_can_access_orders(client, admin):
    client.force_authenticate(user=admin)

    response = client.get("/admin/orders/")

    assert response.status_code == 200


@pytest.mark.django_db
def test_super_admin_can_access_orders(client, super_admin):
    client.force_authenticate(user=super_admin)

    response = client.get("/admin/orders/")

    assert response.status_code == 200


# GET ORDERS
@pytest.mark.django_db
def test_admin_orders_returns_orders(
    client,
    admin,
    order,
):
    client.force_authenticate(user=admin)

    response = client.get("/admin/orders/")

    assert response.status_code == 200

    data = response.json()

    assert "orders" in data
    assert len(data["orders"]) == 1

    assert str(data["orders"][0]["id"]) == str(order.id)
    assert data["orders"][0]["status"] == "pending"
    assert data["orders"][0]["paid"] is True


@pytest.mark.django_db
def test_admin_orders_calculates_totals(
    client,
    admin,
    order_with_items,
):
    client.force_authenticate(user=admin)

    response = client.get("/admin/orders/")

    assert response.status_code == 200

    order_data = response.json()["orders"][0]

    assert order_data["total_items"] == 2
    assert order_data["total_price"] == 50000.0


@pytest.mark.django_db
def test_admin_orders_returns_address(
    client,
    admin,
    order,
):
    client.force_authenticate(user=admin)

    response = client.get("/admin/orders/")

    assert response.status_code == 200

    order_data = response.json()["orders"][0]

    assert order_data["address"] == (
        "Kenyatta Avenue, Nairobi, Kenya"
    )


@pytest.mark.django_db
def test_admin_orders_returns_order_items(
    client,
    admin,
    order_with_items,
    sparepart,
):
    client.force_authenticate(user=admin)

    response = client.get("/admin/orders/")

    assert response.status_code == 200

    items = response.json()["orders"][0]["order_items"]

    assert len(items) == 1

    item = items[0]

    assert item["quantity"] == 2
    assert item["price"] == 25000.0
    assert item["subtotal"] == 50000.0

    assert str(item["sparepart"]["id"]) == str(sparepart.id)
    assert item["sparepart"]["brand"] == "Michelin"
    assert item["sparepart"]["category"] == "tyre"


# PATCH ORDER STATUS
@pytest.mark.django_db
def test_buyer_cannot_update_admin_order(
    client,
    buyer,
    order,
):
    client.force_authenticate(user=buyer)

    response = client.patch(
        f"/admin/orders/{order.id}/",
        {"status": "shipped"},
        format="json",
    )

    assert response.status_code == 403
    assert response.json()["error"] == "Admins only"


@pytest.mark.django_db
def test_admin_can_update_order_to_shipped(
    client,
    admin,
    order,
):
    client.force_authenticate(user=admin)

    response = client.patch(
        f"/admin/orders/{order.id}/",
        {"status": "shipped"},
        format="json",
    )

    assert response.status_code == 200

    order.refresh_from_db()

    assert order.status == "shipped"
    assert order.shipped_at is not None

    data = response.json()

    assert data["status"] == "shipped"
    assert data["shipped_at"] is not None


@pytest.mark.django_db
def test_admin_can_update_order_to_delivered(
    client,
    admin,
    order,
):
    client.force_authenticate(user=admin)

    response = client.patch(
        f"/admin/orders/{order.id}/",
        {"status": "delivered"},
        format="json",
    )

    assert response.status_code == 200

    order.refresh_from_db()

    assert order.status == "delivered"
    assert order.delivered_at is not None

    data = response.json()

    assert data["status"] == "delivered"
    assert data["delivered_at"] is not None


@pytest.mark.django_db
def test_admin_can_cancel_order(
    client,
    admin,
    order,
):
    client.force_authenticate(user=admin)

    response = client.patch(
        f"/admin/orders/{order.id}/",
        {"status": "cancelled"},
        format="json",
    )

    assert response.status_code == 200

    order.refresh_from_db()

    assert order.status == "cancelled"


@pytest.mark.django_db
def test_admin_can_set_pending_status(
    client,
    admin,
    order,
):
    client.force_authenticate(user=admin)

    order.status = "shipped"
    order.save(update_fields=["status"])

    response = client.patch(
        f"/admin/orders/{order.id}/",
        {"status": "pending"},
        format="json",
    )

    assert response.status_code == 200

    order.refresh_from_db()

    assert order.status == "pending"


@pytest.mark.django_db
def test_update_order_requires_status(
    client,
    admin,
    order,
):
    client.force_authenticate(user=admin)

    response = client.patch(
        f"/admin/orders/{order.id}/",
        {},
        format="json",
    )

    assert response.status_code == 400

    assert response.json()["error"] == (
        "Missing status field"
    )


@pytest.mark.django_db
def test_update_order_rejects_invalid_status(
    client,
    admin,
    order,
):
    client.force_authenticate(user=admin)

    response = client.patch(
        f"/admin/orders/{order.id}/",
        {"status": "completed"},
        format="json",
    )

    assert response.status_code == 400

    assert "Invalid status" in response.json()["error"]


@pytest.mark.django_db
def test_update_nonexistent_order_returns_404(
    client,
    admin,
):
    client.force_authenticate(user=admin)

    response = client.patch(
        "/admin/orders/00000000-0000-0000-0000-000000000000/",
        {"status": "shipped"},
        format="json",
    )

    assert response.status_code == 404