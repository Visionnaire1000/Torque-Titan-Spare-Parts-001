import uuid

import pytest
from rest_framework.test import APIClient


@pytest.fixture
def client():
    return APIClient()


# GET ALL SPARE PARTS

@pytest.mark.django_db
def test_get_spareparts_returns_200(client):
    response = client.get("/spareparts/")
    assert response.status_code == 200


# GET SINGLE SPARE PART

@pytest.mark.django_db
def test_get_nonexistent_sparepart(client):
    response = client.get(
        f"/spareparts/{uuid.uuid4()}/"
    )

    assert response.status_code == 404


# INVALID PAGINATION

@pytest.mark.django_db
def test_invalid_page_returns_200(client):
    response = client.get("/spareparts/?page=invalid")

    assert response.status_code == 200


@pytest.mark.django_db
def test_invalid_page_size_returns_200(client):
    response = client.get("/spareparts/?page_size=invalid")

    assert response.status_code == 200