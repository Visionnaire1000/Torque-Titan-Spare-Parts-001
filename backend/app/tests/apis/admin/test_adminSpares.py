import pytest

from rest_framework.test import APIClient

from app.models import Users, SpareParts


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

    user.set_password("TestPassword123!")
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

    user.set_password("TestPassword123!")
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

    user.set_password("TestPassword123!")
    user.save()

    return user


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


def valid_sparepart_data():
    return {
        "category": "brakes",
        "vehicle_type": "suv",
        "brand": "Brembo",
        "colour": "Red",
        "buying_price": "30000",
        "marked_price": "40000",
        "image": "https://example.com/brakes.jpg",
        "description": "Performance brake kit",
    }

# AUTHORIZATION
@pytest.mark.django_db
def test_create_spare_requires_authentication(client):
    response = client.post(
        "/admin/spareparts/",
        valid_sparepart_data(),
        format="json",
    )

    assert response.status_code == 401


@pytest.mark.django_db
def test_buyer_cannot_create_sparepart(
    client,
    buyer,
):
    client.force_authenticate(user=buyer)

    response = client.post(
        "/admin/spareparts/",
        valid_sparepart_data(),
        format="json",
    )

    assert response.status_code == 403
    assert response.json()["error"] == "Admins only"


@pytest.mark.django_db
def test_admin_can_create_sparepart(
    client,
    admin,
):
    client.force_authenticate(user=admin)

    response = client.post(
        "/admin/spareparts/",
        valid_sparepart_data(),
        format="json",
    )

    assert response.status_code == 201

    data = response.json()

    assert data["message"] == (
        "Spare part created successfully"
    )

    assert "sparepart" in data

    spare = SpareParts.objects.get(
        brand="Brembo"
    )

    assert spare.category == "brakes"
    assert spare.vehicle_type == "suv"
    assert spare.buying_price == 30000
    assert spare.marked_price == 40000


@pytest.mark.django_db
def test_super_admin_can_create_sparepart(
    client,
    super_admin,
):
    client.force_authenticate(user=super_admin)

    response = client.post(
        "/admin/spareparts/",
        valid_sparepart_data(),
        format="json",
    )

    assert response.status_code == 201


# CREATE VALIDATION
@pytest.mark.django_db
def test_create_spare_rejects_invalid_buying_price(
    client,
    admin,
):
    client.force_authenticate(user=admin)

    data = valid_sparepart_data()
    data["buying_price"] = "not-a-number"

    response = client.post(
        "/admin/spareparts/",
        data,
        format="json",
    )

    assert response.status_code == 400

    assert response.json()["error"] == (
        "Invalid price values"
    )


@pytest.mark.django_db
def test_create_spare_rejects_invalid_marked_price(
    client,
    admin,
):
    client.force_authenticate(user=admin)

    data = valid_sparepart_data()
    data["marked_price"] = "invalid"

    response = client.post(
        "/admin/spareparts/",
        data,
        format="json",
    )

    assert response.status_code == 400

    assert response.json()["error"] == (
        "Invalid price values"
    )


@pytest.mark.django_db
def test_create_spare_calculates_discount(
    client,
    admin,
):
    client.force_authenticate(user=admin)

    response = client.post(
        "/admin/spareparts/",
        valid_sparepart_data(),
        format="json",
    )

    assert response.status_code == 201

    spare = SpareParts.objects.get(
        brand="Brembo"
    )

    assert spare.discount_percentage == 25


# UPDATE
@pytest.mark.django_db
def test_buyer_cannot_update_sparepart(
    client,
    buyer,
    sparepart,
):
    client.force_authenticate(user=buyer)

    response = client.put(
        f"/admin/spareparts/{sparepart.id}/",
        {
            "brand": "Updated Brand",
        },
        format="json",
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_admin_can_update_sparepart(
    client,
    admin,
    sparepart,
):
    client.force_authenticate(user=admin)

    response = client.put(
        f"/admin/spareparts/{sparepart.id}/",
        {
            "brand": "Updated Michelin",
            "colour": "Blue",
        },
        format="json",
    )

    assert response.status_code == 200

    data = response.json()

    assert data["message"] == (
        "Spare part updated successfully"
    )

    sparepart.refresh_from_db()

    assert sparepart.brand == "Updated Michelin"
    assert sparepart.colour == "Blue"


@pytest.mark.django_db
def test_update_spare_recalculates_discount(
    client,
    admin,
    sparepart,
):
    client.force_authenticate(user=admin)

    response = client.put(
        f"/admin/spareparts/{sparepart.id}/",
        {
            "buying_price": "30000",
            "marked_price": "40000",
        },
        format="json",
    )

    assert response.status_code == 200

    sparepart.refresh_from_db()

    assert sparepart.buying_price == 30000
    assert sparepart.marked_price == 40000
    assert sparepart.discount_percentage == 25


@pytest.mark.django_db
def test_update_invalid_buying_price(
    client,
    admin,
    sparepart,
):
    client.force_authenticate(user=admin)

    response = client.put(
        f"/admin/spareparts/{sparepart.id}/",
        {
            "buying_price": "invalid",
        },
        format="json",
    )

    assert response.status_code == 400

    assert response.json()["error"] == (
        "Invalid value for buying_price"
    )


@pytest.mark.django_db
def test_update_invalid_marked_price(
    client,
    admin,
    sparepart,
):
    client.force_authenticate(user=admin)

    response = client.put(
        f"/admin/spareparts/{sparepart.id}/",
        {
            "marked_price": "invalid",
        },
        format="json",
    )

    assert response.status_code == 400

    assert response.json()["error"] == (
        "Invalid value for marked_price"
    )

# DELETE
@pytest.mark.django_db
def test_buyer_cannot_delete_sparepart(
    client,
    buyer,
    sparepart,
):
    client.force_authenticate(user=buyer)

    response = client.delete(
        f"/admin/spareparts/{sparepart.id}/"
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_admin_can_delete_sparepart(
    client,
    admin,
    sparepart,
):
    client.force_authenticate(user=admin)

    spare_id = sparepart.id

    response = client.delete(
        f"/admin/spareparts/{spare_id}/"
    )

    assert response.status_code == 200

    assert response.json()["message"] == (
        "Spare part deleted successfully"
    )

    assert not SpareParts.objects.filter(
        id=spare_id
    ).exists()