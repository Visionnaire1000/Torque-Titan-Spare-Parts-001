import pytest

from rest_framework.test import APIClient

from app.models import Users


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
def test_super_admin_can_create_admin(client, super_admin):
    client.force_authenticate(user=super_admin)

    response = client.post(
        "/admin/create-admin/",
        {
            "email": "newadmin@example.com",
            "password": "password123",
        },
        format="json",
    )

    assert response.status_code == 201

    assert Users.objects.filter(
        email="newadmin@example.com",
        role="admin",
    ).exists()


@pytest.mark.django_db
def test_create_admin_requires_email_and_password(
    client,
    super_admin,
):
    client.force_authenticate(user=super_admin)

    response = client.post(
        "/admin/create-admin/",
        {},
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_create_admin_requires_password(
    client,
    super_admin,
):
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
def test_create_admin_requires_email(
    client,
    super_admin,
):
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
def test_create_admin_rejects_duplicate_email(
    client,
    super_admin,
    admin,
):
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
def test_delete_admin_requires_authentication(
    client,
    admin,
):
    response = client.delete(
        f"/admin/delete-admin/{admin.id}/"
    )

    assert response.status_code == 401


@pytest.mark.django_db
def test_admin_cannot_delete_admin(
    client,
    admin,
):
    target_admin = Users.objects.create(
        email="targetadmin@example.com",
        role="admin",
        email_verified=True,
        auth_provider="local",
        password_hash="test-password",
    )

    client.force_authenticate(user=admin)

    response = client.delete(
        f"/admin/delete-admin/{target_admin.id}/"
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_super_admin_can_delete_admin(
    client,
    super_admin,
    admin,
):
    client.force_authenticate(user=super_admin)

    response = client.delete(
        f"/admin/delete-admin/{admin.id}/"
    )

    assert response.status_code == 200

    assert not Users.objects.filter(
        id=admin.id
    ).exists()