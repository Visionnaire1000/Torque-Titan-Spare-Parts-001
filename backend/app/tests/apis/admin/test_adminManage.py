import pytest
from rest_framework.test import APIClient
from app.models import Users


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


# CREATE ADMIN

@pytest.mark.django_db
def test_create_admin_requires_authentication(client):
    response = client.post(
        "/admin/create-admin/",
        {
            "email": "newadmin@example.com",
            "password": "password123",
        },
        format="json",
    )
    assert response.status_code == 401


@pytest.mark.django_db
def test_admin_cannot_create_admin(client, admin):
    client.force_authenticate(user=admin)
    response = client.post(
        "/admin/create-admin/",
        {
            "email": "newadmin@example.com",
            "password": "password123",
        },
        format="json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_buyer_cannot_create_admin(client, buyer):
    client.force_authenticate(user=buyer)
    response = client.post(
        "/admin/create-admin/",
        {
            "email": "newadmin@example.com",
            "password": "password123",
        },
        format="json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_create_admin_requires_email_and_password(client, super_admin):
    client.force_authenticate(user=super_admin)
    response = client.post(
        "/admin/create-admin/",
        {},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_create_admin_requires_password(client, super_admin):
    client.force_authenticate(user=super_admin)
    response = client.post(
        "/admin/create-admin/",
        {
            "email": "newadmin@example.com",
        },
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_create_admin_requires_email(client, super_admin):
    client.force_authenticate(user=super_admin)
    response = client.post(
        "/admin/create-admin/",
        {
            "password": "password123",
        },
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_create_admin_rejects_duplicate_email(client, super_admin, admin):
    client.force_authenticate(user=super_admin)
    response = client.post(
        "/admin/create-admin/",
        {
            "email": admin.email,
            "password": "password123",
        },
        format="json",
    )
    assert response.status_code == 409


# LIST ADMINS

@pytest.mark.django_db
def test_list_admins_requires_authentication(client):
    response = client.get("/admin/admins/")
    assert response.status_code == 401


@pytest.mark.django_db
def test_admin_cannot_list_admins(client, admin):
    client.force_authenticate(user=admin)
    response = client.get("/admin/admins/")
    assert response.status_code == 403


@pytest.mark.django_db
def test_super_admin_can_list_admins(client, super_admin):
    client.force_authenticate(user=super_admin)
    response = client.get("/admin/admins/")
    assert response.status_code == 200


# DELETE ADMIN

@pytest.mark.django_db
def test_delete_admin_requires_authentication(client, admin):
    response = client.delete(
        f"/admin/delete-admin/{admin.id}/"
    )
    assert response.status_code == 401


@pytest.mark.django_db
def test_admin_cannot_delete_admin(client, admin):
    target_admin = Users(
        email="targetadmin@example.com",
        role="admin",
        email_verified=True,
        auth_provider="local",
    )
    target_admin.set_password("TestPassword123!")
    target_admin.save()

    client.force_authenticate(user=admin)

    response = client.delete(
        f"/admin/delete-admin/{target_admin.id}/"
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_super_admin_can_delete_admin(client, super_admin, admin):
    client.force_authenticate(user=super_admin)

    response = client.delete(
        f"/admin/delete-admin/{admin.id}/"
    )

    assert response.status_code == 200
    assert not Users.objects.filter(id=admin.id).exists()