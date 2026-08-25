import pytest

from django.conf import settings

from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

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
def test_register_user(client):
    response = client.post(
        "/register/",
        {
            "email": "NewUser@Example.com",
            "password": "Password123!",
        },
        format="json",
    )

    assert response.status_code == 201

    data = response.json()

    assert data["status"] == "success"
    assert "Verification code sent" in data["message"]

    user = Users.objects.get(
        email="newuser@example.com"
    )

    assert user.email_verified is False
    assert user.auth_provider == "local"


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


@pytest.mark.django_db
def test_register_duplicate_email(client, user):
    response = client.post(
        "/register/",
        {
            "email": user.email,
            "password": "Password123!",
        },
        format="json",
    )

    assert response.status_code == 409

    assert "Email already exists" in (
        response.json()["error"]
    )


# RESEND OTP
@pytest.mark.django_db
def test_resend_otp_user_not_found(client):
    response = client.post(
        "/resend-otp/",
        {
            "email": "missing@example.com",
        },
        format="json",
    )

    assert response.status_code == 404

    assert response.json()["message"] == (
        "User not found"
    )


@pytest.mark.django_db
def test_resend_otp_for_verified_user(client, user):
    response = client.post(
        "/resend-otp/",
        {
            "email": user.email,
        },
        format="json",
    )

    assert response.status_code == 200

    data = response.json()

    assert data["status"] == "info"
    assert data["message"] == (
        "Email already verified"
    )


@pytest.mark.django_db
def test_resend_otp_for_unverified_user(
    client,
    unverified_user,
):
    response = client.post(
        "/resend-otp/",
        {
            "email": unverified_user.email,
        },
        format="json",
    )

    assert response.status_code == 200

    data = response.json()

    assert data["status"] == "success"
    assert data["message"] == (
        "New OTP sent to your email"
    )


# VERIFY ACCOUNT
@pytest.mark.django_db
def test_verify_account_requires_email_and_otp(client):
    response = client.post(
        "/verify-account/",
        {},
        format="json",
    )

    assert response.status_code == 400

    assert response.json()["error"] == (
        "Email and OTP are required"
    )


@pytest.mark.django_db
def test_verify_account_user_not_found(client):
    response = client.post(
        "/verify-account/",
        {
            "email": "missing@example.com",
            "otp": "123456",
        },
        format="json",
    )

    assert response.status_code == 404

    assert response.json()["error"] == (
        "User not found"
    )


@pytest.mark.django_db
def test_verify_account_invalid_otp(
    client,
    unverified_user,
):
    response = client.post(
        "/verify-account/",
        {
            "email": unverified_user.email,
            "otp": "000000",
        },
        format="json",
    )

    assert response.status_code == 400

    assert response.json()["error"] == (
        "Invalid or expired code"
    )


# ---------------------------------------------------------------------------
# LOGIN
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_login_success(client, user):
    response = client.post(
        "/login/",
        {
            "email": user.email,
            "password": "OldPassword123!",
        },
        format="json",
    )

    assert response.status_code == 200

    data = response.json()

    assert "access_token" in data
    assert data["access_token"]

    assert settings.REFRESH_COOKIE_NAME in (
        response.cookies
    )

    cookie = response.cookies[
        settings.REFRESH_COOKIE_NAME
    ]

    assert cookie["httponly"] is True


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


@pytest.mark.django_db
def test_login_email_is_case_insensitive(client, user):
    response = client.post(
        "/login/",
        {
            "email": "BUYER@EXAMPLE.COM",
            "password": "OldPassword123!",
        },
        format="json",
    )

    assert response.status_code == 200

    assert "access_token" in response.json()


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


@pytest.mark.django_db
def test_google_login_invalid_credential(client, monkeypatch):
    def mock_verify(*args, **kwargs):
        raise ValueError()

    monkeypatch.setattr(
        "google.oauth2.id_token.verify_oauth2_token",
        mock_verify,
    )

    response = client.post(
        "/auth/google/",
        {
            "credential": "invalid-google-token",
        },
        format="json",
    )

    assert response.status_code == 401

    assert response.json()["error"] == (
        "Invalid or expired Google credential"
    )


@pytest.mark.django_db
def test_google_login_unverified_google_email(
    client,
    monkeypatch,
):
    def mock_verify(*args, **kwargs):
        return {
            "aud": settings.GOOGLE_CLIENT_ID,
            "sub": "google-user-123",
            "email": "google@example.com",
            "email_verified": False,
        }

    monkeypatch.setattr(
        "google.oauth2.id_token.verify_oauth2_token",
        mock_verify,
    )

    response = client.post(
        "/auth/google/",
        {
            "credential": "valid-google-token",
        },
        format="json",
    )

    assert response.status_code == 403

    assert response.json()["error"] == (
        "Google email is not verified"
    )


@pytest.mark.django_db
def test_google_login_creates_new_user(
    client,
    monkeypatch,
):
    def mock_verify(*args, **kwargs):
        return {
            "aud": settings.GOOGLE_CLIENT_ID,
            "sub": "google-user-123",
            "email": "google@example.com",
            "email_verified": True,
        }

    monkeypatch.setattr(
        "google.oauth2.id_token.verify_oauth2_token",
        mock_verify,
    )

    response = client.post(
        "/auth/google/",
        {
            "credential": "valid-google-token",
        },
        format="json",
    )

    assert response.status_code == 200

    data = response.json()

    assert "access_token" in data

    user = Users.objects.get(
        email="google@example.com"
    )

    assert user.google_id == "google-user-123"
    assert user.email_verified is True
    assert user.auth_provider == "google"

    assert settings.REFRESH_COOKIE_NAME in (
        response.cookies
    )


@pytest.mark.django_db
def test_google_login_links_existing_local_user(
    client,
    user,
    monkeypatch,
):
    def mock_verify(*args, **kwargs):
        return {
            "aud": settings.GOOGLE_CLIENT_ID,
            "sub": "google-user-456",
            "email": user.email,
            "email_verified": True,
        }

    monkeypatch.setattr(
        "google.oauth2.id_token.verify_oauth2_token",
        mock_verify,
    )

    response = client.post(
        "/auth/google/",
        {
            "credential": "valid-google-token",
        },
        format="json",
    )

    assert response.status_code == 200

    user.refresh_from_db()

    assert user.google_id == "google-user-456"
    assert user.email_verified is True
    assert user.auth_provider == "local"


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
def test_token_refresh(client, user):
    refresh = RefreshToken.for_user(user)

    refresh["user_id"] = str(user.id)
    refresh["email"] = user.email
    refresh["role"] = user.role
    refresh["display_name"] = user.display_name
    refresh["auth_provider"] = user.auth_provider

    client.cookies[
        settings.REFRESH_COOKIE_NAME
    ] = str(refresh)

    response = client.post(
        "/token/refresh/",
        {},
    )

    assert response.status_code == 200

    data = response.json()

    assert "access_token" in data
    assert data["access_token"]


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


# LOGOUT
@pytest.mark.django_db
def test_logout(client):
    client.cookies[
        settings.REFRESH_COOKIE_NAME
    ] = "some-refresh-token"

    response = client.post(
        "/logout/",
        {},
    )

    assert response.status_code == 200

    data = response.json()

    assert data["status"] == "success"
    assert data["message"] == (
        "Logged out successfully"
    )

    assert settings.REFRESH_COOKIE_NAME in (
        response.cookies
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
def test_change_password_requires_current_password(
    client,
    user,
):
    client.force_authenticate(user=user)

    response = client.post(
        "/change-password/",
        {},
        format="json",
    )

    assert response.status_code == 400

    assert response.json()["error"] == (
        "Current password is required"
    )


@pytest.mark.django_db
def test_change_password_rejects_wrong_current_password(
    client,
    user,
):
    client.force_authenticate(user=user)

    response = client.post(
        "/change-password/",
        {
            "current_password": "WrongPassword123!",
        },
        format="json",
    )

    assert response.status_code == 401

    assert response.json()["error"] == (
        "Invalid credentials"
    )


@pytest.mark.django_db
def test_change_password_sends_otp(client, user):
    client.force_authenticate(user=user)

    response = client.post(
        "/change-password/",
        {
            "current_password": "OldPassword123!",
        },
        format="json",
    )

    assert response.status_code == 200

    data = response.json()

    assert data["status"] == "otp_sent"
    assert data["message"] == (
        "OTP sent to your email"
    )


@pytest.mark.django_db
def test_change_password_requires_otp_and_new_password(
    client,
    user,
):
    client.force_authenticate(user=user)

    response = client.post(
        "/change-password/",
        {
            "current_password": "OldPassword123!",
        },
        format="json",
    )

    assert response.status_code == 200

    data = response.json()

    assert data["status"] == "otp_sent"


@pytest.mark.django_db
def test_change_password_invalid_otp(client, user):
    client.force_authenticate(user=user)

    response = client.post(
        "/change-password/",
        {
            "current_password": "OldPassword123!",
            "otp": "000000",
            "new_password": "NewPassword123!",
        },
        format="json",
    )

    assert response.status_code == 401

    assert response.json()["error"] == (
        "Invalid or expired OTP"
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


@pytest.mark.django_db
def test_delete_account_sends_otp(client, user):
    client.force_authenticate(user=user)

    response = client.post(
        "/delete-account/",
        {},
        format="json",
    )

    assert response.status_code == 200

    data = response.json()

    assert data["status"] == "otp_sent"
    assert data["message"] == (
        "OTP sent to your email"
    )


@pytest.mark.django_db
def test_delete_account_requires_otp(client, user):
    client.force_authenticate(user=user)

    response = client.delete(
        "/delete-account/",
        {},
        format="json",
    )

    assert response.status_code == 400

    assert response.json()["error"] == (
        "OTP is required"
    )


@pytest.mark.django_db
def test_delete_account_invalid_otp(client, user):
    client.force_authenticate(user=user)

    response = client.delete(
        "/delete-account/",
        {
            "otp": "000000",
        },
        format="json",
    )

    assert response.status_code == 401

    assert response.json()["error"] == (
        "Invalid or expired OTP"
    )