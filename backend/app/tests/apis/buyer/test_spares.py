import uuid

import pytest
from rest_framework.test import APIClient

from app.models import SpareParts


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def sparepart():
    return SpareParts.objects.create(
        brand="Michelin",
        category="tyre",
        vehicle_type="sedan",
        colour="Black",
        buying_price=20000,
        marked_price=20000,
        discount_percentage=0,
        image="https://example.com/tyre.jpg",
    )


@pytest.fixture
def spareparts():
    return [
        SpareParts.objects.create(
            brand="Michelin",
            category="tyre",
            vehicle_type="sedan",
            colour="Black",
            buying_price=20000,
            marked_price=20000,
            discount_percentage=0,
            image="https://example.com/michelin.jpg",
        ),
        SpareParts.objects.create(
            brand="Bridgestone",
            category="tyre",
            vehicle_type="suv",
            colour="Black",
            buying_price=35000,
            marked_price=35000,
            discount_percentage=10,
            image="https://example.com/bridgestone.jpg",
        ),
        SpareParts.objects.create(
            brand="Bosch",
            category="battery",
            vehicle_type="sedan",
            colour="Black",
            buying_price=25000,
            marked_price=25000,
            discount_percentage=5,
            image="https://example.com/bosch.jpg",
        ),
    ]


@pytest.mark.django_db
def test_get_spareparts_returns_paginated_response(
    client,
    spareparts,
):
    response = client.get("/spareparts/")

    assert response.status_code == 200

    data = response.json()

    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "pages" in data

    assert data["total"] == 3
    assert data["page"] == 1
    assert len(data["items"]) == 3


@pytest.mark.django_db
def test_get_single_sparepart(
    client,
    sparepart,
):
    response = client.get(
        f"/spareparts/{sparepart.id}/"
    )

    assert response.status_code == 200

    data = response.json()

    assert str(data["id"]) == str(sparepart.id)
    assert data["brand"] == "Michelin"
    assert data["category"] == "tyre"


@pytest.mark.django_db
def test_get_nonexistent_sparepart_returns_404(
    client,
):
    nonexistent_id = uuid.uuid4()

    response = client.get(
        f"/spareparts/{nonexistent_id}/"
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_filter_spareparts_by_category(
    client,
    spareparts,
):
    response = client.get(
        "/spareparts/?category=tyre"
    )

    assert response.status_code == 200

    data = response.json()

    assert data["total"] == 2

    for item in data["items"]:
        assert "tyre" in item["category"].lower()


@pytest.mark.django_db
def test_filter_spareparts_by_brand(
    client,
    spareparts,
):
    response = client.get(
        "/spareparts/?brand=Michelin"
    )

    assert response.status_code == 200

    data = response.json()

    assert data["total"] == 1
    assert data["items"][0]["brand"] == "Michelin"


@pytest.mark.django_db
def test_filter_spareparts_by_vehicle_type(
    client,
    spareparts,
):
    response = client.get(
        "/spareparts/?vehicle_type=suv"
    )

    assert response.status_code == 200

    data = response.json()

    assert data["total"] == 1
    assert data["items"][0]["vehicle_type"] == "suv"


@pytest.mark.django_db
def test_filter_spareparts_by_colour(
    client,
    spareparts,
):
    response = client.get(
        "/spareparts/?colour=black"
    )

    assert response.status_code == 200

    data = response.json()

    assert data["total"] == 3


@pytest.mark.django_db
def test_low_price_filter(
    client,
    spareparts,
):
    response = client.get(
        "/spareparts/?category=tyre"
        "&vehicle_type=sedan"
        "&price=low"
    )

    assert response.status_code == 200

    data = response.json()

    assert data["total"] == 0


@pytest.mark.django_db
def test_medium_price_filter(
    client,
    spareparts,
):
    response = client.get(
        "/spareparts/?category=tyre"
        "&vehicle_type=sedan"
        "&price=medium"
    )

    assert response.status_code == 200

    data = response.json()

    assert data["total"] == 1
    assert data["items"][0]["brand"] == "Michelin"


@pytest.mark.django_db
def test_high_price_filter(
    client,
    spareparts,
):
    response = client.get(
        "/spareparts/?category=tyre"
        "&vehicle_type=suv"
        "&price=high"
    )

    assert response.status_code == 200

    data = response.json()

    assert data["total"] == 0


@pytest.mark.django_db
def test_spareparts_pagination(
    client,
    spareparts,
):
    response = client.get(
        "/spareparts/?page=1&per_page=2"
    )

    assert response.status_code == 200

    data = response.json()

    assert data["total"] == 3
    assert data["page"] == 1
    assert data["pages"] == 2
    assert len(data["items"]) == 2


@pytest.mark.django_db
def test_invalid_pagination_defaults_to_page_one(
    client,
    spareparts,
):
    response = client.get(
        "/spareparts/?page=invalid&per_page=invalid"
    )

    assert response.status_code == 200

    data = response.json()

    assert data["page"] == 1