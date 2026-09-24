import pytest

from rest_framework.test import APIClient

from app.models import (
    Users,
    Orders
)


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def admin():
    user = Users(
        email="admin@example.com",
        role="admin",
        email_verified=True,
        auth_provider="local",
    )
    user.set_password("test-password")
    user.save()
    return user


@pytest.fixture
def super_admin():
    user = Users(
        email="superadmin@example.com",
        role="super_admin",
        email_verified=True,
        auth_provider="local",
    )
    user.set_password("test-password")
    user.save()
    return user


@pytest.fixture
def buyer():
    user = Users(
        email="buyer@example.com",
        role="buyer",
        email_verified=True,
        auth_provider="local",
    )
    user.set_password("test-password")
    user.save()
    return user


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
def test_admin_orders_returns_orders(client, admin, order):
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
def test_admin_orders_returns_address(client, admin, order):
    client.force_authenticate(user=admin)

    response = client.get("/admin/orders/")

    assert response.status_code == 200

    order_data = response.json()["orders"][0]

    assert order_data["address"] == (
        "Kenyatta Avenue, Nairobi, Kenya"
    )


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
    assert response.json()["error"] == "Missing status field"


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
    assert response.json()["error"] == (
        "Cannot change order status from 'pending' to 'completed'"
    )


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