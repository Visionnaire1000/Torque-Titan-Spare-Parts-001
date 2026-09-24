import pytest

from django.conf import settings

from rest_framework.test import APIClient

from app.models import Users


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def user():
    user = Users(
        email="buyer@example.com",
        email_verified=True,
        auth_provider="local",
        role="buyer",
    )
    user.set_password("OldPassword123!")
    user.save()

    return user


@pytest.fixture
def unverified_user():
    user = Users(
        email="unverified@example.com",
        email_verified=False,
        auth_provider="local",
        role="buyer",
    )
    user.set_password("OldPassword123!")
    user.save()

    return user


# REGISTER


@pytest.mark.django_db
def test_register_requires_email_and_password(client):
    response = client.post(
        "/register/",
        {},
        format="json",
    )

    assert response.status_code == 400

    assert response.json()["error"] == (
        "Email and password required"
    )


@pytest.mark.django_db
def test_register_requires_password(client):
    response = client.post(
        "/register/",
        {
            "email": "user@example.com",
        },
        format="json",
    )

    assert response.status_code == 400


# LOGIN


@pytest.mark.django_db
def test_login_requires_email_and_password(client):
    response = client.post(
        "/login/",
        {},
        format="json",
    )

    assert response.status_code == 400

    assert response.json()["error"] == (
        "Email and password required"
    )


@pytest.mark.django_db
def test_login_invalid_credentials(client, user):
    response = client.post(
        "/login/",
        {
            "email": user.email,
            "password": "WrongPassword123!",
        },
        format="json",
    )

    assert response.status_code == 401

    assert response.json()["error"] == (
        "Invalid credentials"
    )


@pytest.mark.django_db
def test_login_unknown_user(client):
    response = client.post(
        "/login/",
        {
            "email": "missing@example.com",
            "password": "Password123!",
        },
        format="json",
    )

    assert response.status_code == 401


@pytest.mark.django_db
def test_unverified_user_cannot_login(
    client,
    unverified_user,
):
    response = client.post(
        "/login/",
        {
            "email": unverified_user.email,
            "password": "OldPassword123!",
        },
        format="json",
    )

    assert response.status_code == 403

    assert response.json()["error"] == (
        "Please verify your email first"
    )


# GOOGLE LOGIN


@pytest.mark.django_db
def test_google_login_requires_credential(client):
    response = client.post(
        "/auth/google/",
        {},
        format="json",
    )

    assert response.status_code == 400

    assert response.json()["error"] == (
        "Google credential required"
    )


# TOKEN REFRESH


@pytest.mark.django_db
def test_token_refresh_requires_cookie(client):
    response = client.post(
        "/token/refresh/",
        {},
        format="json",
    )

    assert response.status_code == 401

    assert response.json()["error"] == (
        "Refresh token required"
    )


@pytest.mark.django_db
def test_token_refresh_invalid_cookie(client):
    client.cookies[
        settings.REFRESH_COOKIE_NAME
    ] = "invalid-refresh-token"

    response = client.post(
        "/token/refresh/",
        {},
    )

    assert response.status_code == 401

    assert "Invalid or expired refresh token" in (
        response.json()["error"]
    )


# CHANGE PASSWORD


@pytest.mark.django_db
def test_change_password_requires_authentication(client):
    response = client.post(
        "/change-password/",
        {},
        format="json",
    )

    assert response.status_code == 401


@pytest.mark.django_db
def test_change_password_sends_otp(
    client,
    user,
):
    client.force_authenticate(user=user)

    response = client.post(
        "/change-password/",
        {
            "current_password": "OldPassword123!",
            "new_password": "NewPassword123!",
        },
        format="json",
    )

    assert response.status_code == 200

    data = response.json()

    assert data["status"] == "otp_sent"
    assert data["message"] == (
        "Password change OTP sent to your email"
    )


# DELETE ACCOUNT


@pytest.mark.django_db
def test_delete_account_requires_authentication(client):
    response = client.post(
        "/delete-account/",
        {},
        format="json",
    )

    assert response.status_code == 401