import re

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction, IntegrityError
from django.utils import timezone

from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.models import (
    Users,
    LoginDevice,
    LoginRecord,
    Profile,
)

from utils.tasks import (
    send_email_task,
    send_new_login_email_task,
)


# ------------------------------ API RESPONSE --------------------------------
def api_response(data, status=status.HTTP_200_OK, **kwargs):
    if isinstance(data, dict):
        data = dict(data)

        if "wait_seconds" in data:
            data.setdefault(
                "params",
                {"seconds": data["wait_seconds"]},
            )

        if "attempts_remaining" in data:
            params = dict(data.get("params") or {})
            params.setdefault(
                "attempts",
                data["attempts_remaining"],
            )
            data["params"] = params

    return Response(data, status=status, **kwargs)


# ------------------------------ PASSWORD VALIDATION --------------------------------
PASSWORD_PATTERN = (
    r"^(?=.*[A-Z])"
    r"(?=.*\d)"
    r"(?=.*[@$!%*?&])"
    r"[A-Za-z\d@$!%*?&]{8,}$"
)


def validate_password(password):
    if not re.fullmatch(PASSWORD_PATTERN, password):
        return (
            "Password must be at least "
            "8 characters and include "
            "one uppercase letter, one "
            "number, and one special "
            "character."
        )

    return None


# ------------------------------ DISPLAY NAME --------------------------------
def get_user_display_name(user):
    if not user:
        return "User"

    if user.role in ["admin", "super_admin"]:
        return user.display_name

    profile = getattr(user, "profile", None)

    if profile:
        full_name = (
            f"{profile.first_name} "
            f"{profile.last_name}"
        ).strip()

        if full_name:
            return full_name

    return "User"


# ------------------------------ OTP HELPERS --------------------------------
def get_remaining_lock_seconds(locked_until):
    if not locked_until:
        return 0

    remaining = int(
        (locked_until - timezone.now()).total_seconds()
    )

    return max(remaining, 0)


def otp_locked_response(locked_until):
    remaining = get_remaining_lock_seconds(locked_until)

    return api_response(
        {
            "code": "auth.otp_locked",
            "error": (
                "Too many failed attempts. "
                "OTP locked for 15 minutes"
            ),
            "wait_seconds": remaining,
        },
        status=423,
    )


def is_initial_otp(user, last_sent_field, resend_count_field):
    return (
        getattr(user, last_sent_field) is None
        and getattr(user, resend_count_field) == 0
    )


# ------------------------------ OTP RESEND RESPONSE --------------------------------
def otp_resend_response(
    user,
    message="OTP sent to your email",
    code="auth.otp_sent",
):
    return api_response(
        {
            "code": code,
            "message": message,
            "wait_seconds": user.OTP_RESEND_COOLDOWN_SECONDS,
        },
        status=status.HTTP_200_OK,
    )


def otp_resend_limit_response(wait_seconds):
    if wait_seconds > 0:
        return api_response(
            {
                "code": "auth.otp_resend_wait",
                "error": (
                    "Please wait before "
                    "requesting another OTP"
                ),
                "wait_seconds": wait_seconds,
            },
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    return api_response(
        {
            "code": "auth.maximum_otp_resends",
            "error": "Maximum OTP resends reached",
        },
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )


# ------------------------------ OTP VERIFICATION RESPONSE --------------------------
def otp_verification_failure(
    user,
    result,
    hash_field,
    expires_field,
    attempts_field,
):
    locked_until_field = hash_field.replace(
        "_hash",
        "_locked_until",
    )

    locked_until = getattr(user, locked_until_field)

    if result == "locked":
        return otp_locked_response(locked_until)

    if locked_until and locked_until > timezone.now():
        return otp_locked_response(locked_until)

    otp_hash = getattr(user, hash_field)
    otp_expires = getattr(user, expires_field)

    if (
        not otp_hash
        or not otp_expires
        or timezone.now() >= otp_expires
    ):
        return api_response(
            {
                "code": "auth.otp_expired",
                "error": "OTP has expired",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    attempts = getattr(user, attempts_field)

    return api_response(
        {
            "code": "auth.invalid_otp",
            "error": "Invalid OTP",
            "attempts_remaining": max(
                user.MAX_OTP_ATTEMPTS - attempts,
                0,
            ),
        },
        status=status.HTTP_400_BAD_REQUEST,
    )


# ------------------------------ LOGIN SECURITY --------------------------------
def get_client_ip(request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")

    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    return request.META.get("REMOTE_ADDR")


def register_successful_login(request, user):
    device_id = (
        request.data.get("device_id") or ""
    ).strip()

    if not device_id:
        return

    user_agent = (
        request.META.get("HTTP_USER_AGENT") or ""
    )

    ip_address = get_client_ip(request)

    if not ip_address:
        return

    with transaction.atomic():
        user_locked = (
            Users.objects.select_for_update()
            .get(id=user.id)
        )

        has_previous_login = (
            LoginRecord.objects.filter(
                user=user_locked
            ).exists()
        )

        device = (
            LoginDevice.objects.select_for_update()
            .filter(
                user=user_locked,
                device_identifier=device_id,
            )
            .first()
        )

        is_new_device = device is None

        if device:
            device.last_ip_address = ip_address
            device.user_agent = user_agent

            device.save(
                update_fields=[
                    "last_ip_address",
                    "user_agent",
                    "last_seen_at",
                ]
            )

        else:
            device = LoginDevice.objects.create(
                user=user_locked,
                device_identifier=device_id,
                user_agent=user_agent,
                last_ip_address=ip_address,
            )

        LoginRecord.objects.create(
            user=user_locked,
            device=device,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        if is_new_device and has_previous_login:
            transaction.on_commit(
                lambda: send_new_login_email_task.delay(
                    user_locked.email,
                    ip_address,
                    user_agent,
                )
            )


# ------------------------------ AUTH RESPONSE --------------------------------
def create_auth_response(user, message):
    refresh = RefreshToken.for_user(user)

    refresh["user_id"] = str(user.id)
    refresh["email"] = user.email
    refresh["role"] = user.role
    refresh["auth_provider"] = user.auth_provider

    access = refresh.access_token

    response = api_response(
        {
            "access": str(access),
            "code": (
                "auth.google_login_successful"
                if message == "Google login successful"
                else "auth.login_successful"
            ),
            "message": message,
        }
    )

    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=str(refresh),
        httponly=settings.REFRESH_COOKIE_HTTP_ONLY,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        max_age=settings.REFRESH_COOKIE_MAX_AGE,
        path="/token/refresh/",
    )

    return response


# ------------------------------ REGISTER --------------------------------
class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = (
            request.data.get("email") or ""
        ).strip().lower()

        password = request.data.get("password") or ""

        if not email or not password:
            return api_response(
                {
                    "code": "auth.email_and_password_required",
                    "error": "Email and password are required",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        password_error = validate_password(password)

        if password_error:
            return api_response(
                {
                    "code": "auth.password_policy_invalid",
                    "error": password_error,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():
                user = (
                    Users.objects.select_for_update()
                    .filter(email=email)
                    .first()
                )

                if user:
                    if user.role != "buyer":
                        return api_response(
                            {
                                "code": "auth.different_auth_method",
                                "error": (
                                    "This email belongs to an "
                                    "administrative account."
                                ),
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    if user.email_verified:
                        return api_response(
                            {
                                "code": "auth.email_already_registered",
                                "error": (
                                    "An account with this "
                                    "email already exists"
                                ),
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    if user.auth_provider != "local":
                        return api_response(
                            {
                                "code": "auth.different_auth_method",
                                "error": (
                                    "This account uses a different "
                                    "authentication method."
                                ),
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    if not user.check_password(password):
                        return api_response(
                            {
                                "code": "auth.invalid_email_or_password",
                                "error": "Invalid email or password",
                            },
                            status=status.HTTP_401_UNAUTHORIZED,
                        )

                    if not user.is_active:
                        return api_response(
                            {
                                "code": "auth.account_inactive",
                                "error": (
                                    "This account is locked or inactive. "
                                    "Please contact a super_admin "
                                    "to unlock your account."
                                ),
                                "account_locked": True,
                            },
                            status=status.HTTP_403_FORBIDDEN,
                        )

                    if (
                        user.email_otp_locked_until
                        and user.email_otp_locked_until > timezone.now()
                    ):
                        return otp_locked_response(
                            user.email_otp_locked_until
                        )

                    can_resend, wait_seconds = (
                        user.can_resend_email_otp()
                    )

                    if not can_resend:
                        return otp_resend_limit_response(wait_seconds)

                    initial = is_initial_otp(
                        user,
                        "email_otp_last_sent",
                        "email_otp_resend_count",
                    )

                    otp = user.generate_email_otp(
                        is_initial=initial
                    )

                    transaction.on_commit(
                        lambda: send_email_task.delay(
                            email,
                            otp,
                            "verify_account",
                        )
                    )

                    return otp_resend_response(
                        user,
                        "OTP resent successfully",
                        "auth.otp_resent",
                    )

                user = Users.objects.create_user(
                    email=email,
                    password=password,
                    auth_provider="local",
                    role="buyer",
                    email_verified=False,
                    is_active=True,
                )

                otp = user.generate_email_otp(
                    is_initial=True
                )

                transaction.on_commit(
                    lambda: send_email_task.delay(
                        email,
                        otp,
                        "verify_account",
                    )
                )

        except IntegrityError:
            return api_response(
                {
                    "code": "auth.email_already_registered",
                    "error": (
                        "An account with this email already exists"
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return api_response(
            {
                "code": "auth.registration_successful",
                "message": "OTP sent to your email.",
                "wait_seconds": user.OTP_RESEND_COOLDOWN_SECONDS,
            },
            status=status.HTTP_201_CREATED,
        )


# ------------------------------ RESEND OTP --------------------------------
class ResendOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        otp_type = request.data.get("otp_type") or "email"

        supported_types = [
            "email",
            "forgot_password",
            "change_password",
            "delete_account",
        ]

        if otp_type not in supported_types:
            return api_response(
                {
                    "code": "auth.invalid_otp_type",
                    "error": "Invalid OTP type",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        authenticated_types = [
            "change_password",
            "delete_account",
        ]

        if otp_type in authenticated_types:
            if not request.user.is_authenticated:
                return api_response(
                    {
                        "code": "auth.authentication_required",
                        "error": "Authentication is required",
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            user_id = request.user.id

        else:
            email = (
                request.data.get("email") or ""
            ).strip().lower()

            if not email:
                return api_response(
                    {
                        "code": "auth.email_required",
                        "error": "Email is required",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            user_id = (
                Users.objects.filter(email=email)
                .values_list("id", flat=True)
                .first()
            )

            if not user_id:
                return api_response(
                    {
                        "code": "auth.account_not_found",
                        "error": "Account not found",
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

        with transaction.atomic():
            user = (
                Users.objects.select_for_update()
                .filter(id=user_id)
                .first()
            )

            if not user:
                return api_response(
                    {
                        "code": "auth.account_not_found",
                        "error": "Account not found",
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            if not user.is_active:
                return api_response(
                    {
                        "code": "auth.account_inactive",
                        "error": "This account is inactive.",
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            if otp_type == "email":
                if user.email_verified:
                    return api_response(
                        {
                            "code": "auth.account_already_verified",
                            "error": "Account is already verified",
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if (
                    user.email_otp_locked_until
                    and user.email_otp_locked_until > timezone.now()
                ):
                    return otp_locked_response(
                        user.email_otp_locked_until
                    )

                can_resend, wait_seconds = (
                    user.can_resend_email_otp()
                )

                if not can_resend:
                    return otp_resend_limit_response(wait_seconds)

                initial = is_initial_otp(
                    user,
                    "email_otp_last_sent",
                    "email_otp_resend_count",
                )

                otp = user.generate_email_otp(
                    is_initial=initial
                )
                task_type = "verify_account"

            elif otp_type == "forgot_password":
                if user.auth_provider != "local":
                    return api_response(
                        {
                            "code": "auth.google_password_reset_unavailable",
                            "error": (
                                "Password reset is not available "
                                "for Google accounts"
                            ),
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if not user.email_verified:
                    return api_response(
                        {
                            "code": "auth.email_not_verified",
                            "error": "Please verify your email first",
                        },
                        status=status.HTTP_403_FORBIDDEN,
                    )

                if (
                    user.forgot_password_otp_locked_until
                    and user.forgot_password_otp_locked_until > timezone.now()
                ):
                    return otp_locked_response(
                        user.forgot_password_otp_locked_until
                    )

                can_resend, wait_seconds = (
                    user.can_resend_forgot_password_otp()
                )

                if not can_resend:
                    return otp_resend_limit_response(wait_seconds)

                initial = is_initial_otp(
                    user,
                    "forgot_password_otp_last_sent",
                    "forgot_password_otp_resend_count",
                )

                otp = user.generate_forgot_password_otp(
                    is_initial=initial
                )
                task_type = "forgot_password"

            elif otp_type == "change_password":
                if user.auth_provider != "local":
                    return api_response(
                        {
                            "code": "auth.google_password_reset_unavailable",
                            "error": (
                                "Password changes are not available "
                                "for Google accounts."
                            ),
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if (
                    user.change_password_otp_locked_until
                    and user.change_password_otp_locked_until > timezone.now()
                ):
                    return otp_locked_response(
                        user.change_password_otp_locked_until
                    )

                can_resend, wait_seconds = (
                    user.can_resend_change_password_otp()
                )

                if not can_resend:
                    return otp_resend_limit_response(wait_seconds)

                initial = is_initial_otp(
                    user,
                    "change_password_otp_last_sent",
                    "change_password_otp_resend_count",
                )

                otp = user.generate_change_password_otp(
                    is_initial=initial
                )
                task_type = "change_password"

            else:
                if (
                    user.delete_account_otp_locked_until
                    and user.delete_account_otp_locked_until > timezone.now()
                ):
                    return otp_locked_response(
                        user.delete_account_otp_locked_until
                    )

                can_resend, wait_seconds = (
                    user.can_resend_delete_account_otp()
                )

                if not can_resend:
                    return otp_resend_limit_response(wait_seconds)

                initial = is_initial_otp(
                    user,
                    "delete_account_otp_last_sent",
                    "delete_account_otp_resend_count",
                )

                otp = user.generate_delete_account_otp(
                    is_initial=initial
                )
                task_type = "delete_account"

            transaction.on_commit(
                lambda: send_email_task.delay(
                    user.email,
                    otp,
                    task_type,
                )
            )

        return otp_resend_response(
            user,
            "OTP resent successfully",
            "auth.otp_resent",
        )


# ------------------------------ VERIFY ACCOUNT --------------------------------
class VerifyAccountView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = (
            request.data.get("email") or ""
        ).strip().lower()

        otp = (
            request.data.get("otp") or ""
        ).strip()

        if not email or not otp:
            return api_response(
                {
                    "code": "auth.email_and_otp_required",
                    "error": "Email and OTP are required",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            user = (
                Users.objects.select_for_update()
                .filter(email=email)
                .first()
            )

            if not user:
                return api_response(
                    {
                        "code": "auth.account_not_found",
                        "error": "Account not found",
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            if user.email_verified:
                return api_response(
                    {
                        "code": "auth.account_verified",
                        "message": "Account is already verified",
                    },
                    status=status.HTTP_200_OK,
                )

            verification = user.verify_email_otp(otp)

            if verification is not True:
                return otp_verification_failure(
                    user,
                    verification,
                    "email_otp_hash",
                    "email_otp_expires",
                    "email_otp_attempts",
                )

        return api_response(
            {
                "code": "auth.account_verified",
                "message": "Account verified successfully",
            },
            status=status.HTTP_200_OK,
        )


# ------------------------------ LOGIN --------------------------------
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = (
            request.data.get("email") or ""
        ).strip().lower()

        password = request.data.get("password") or ""

        if not email or not password:
            return api_response(
                {
                    "code": "auth.email_and_password_required",
                    "error": "Email and password are required",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = Users.objects.filter(email=email).first()

        if not user or not user.check_password(password):
            return api_response(
                {
                    "code": "auth.invalid_email_or_password",
                    "error": "Invalid email or password",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if user.has_expired_initial_password():
            return api_response(
                {
                    "code": "auth.initial_password_expired",
                    "error": (
                        "Your initial password has expired. "
                        "Please use the forgot password process "
                        "to set a new password."
                    ),
                    "initial_password_expired": True,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if not user.is_active:
            return api_response(
                {
                    "code": "auth.account_inactive",
                    "error": (
                        "This account is locked or inactive. "
                        "Please contact a super_admin "
                        "to unlock your account."
                    ),
                    "account_locked": True,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if (
            user.auth_provider == "local"
            and not user.email_verified
        ):
            return api_response(
                {
                    "code": "auth.email_not_verified",
                    "error": (
                        "Please verify your email before logging in"
                    ),
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        register_successful_login(request, user)

        return create_auth_response(user, "Login successful")


# ------------------------------ GOOGLE LOGIN ---------------------------------------
class GoogleOauth(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        credential = (
            request.data.get("credential") or ""
        ).strip()

        if not credential:
            return api_response(
                {
                    "code": "auth.google_credential_required",
                    "error": "Google credential is required.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            google_data = id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID,
            )

        except ValueError:
            return api_response(
                {
                    "code": "auth.invalid_google_credential",
                    "error": "Invalid Google credential.",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        email = google_data.get("email")
        google_id = google_data.get("sub")
        email_verified = google_data.get("email_verified", False)

        if not email or not google_id:
            return api_response(
                {
                    "code": "auth.google_account_incomplete",
                    "error": "Google account information is incomplete.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not email_verified:
            return api_response(
                {
                    "code": "auth.google_email_not_verified",
                    "error": "Your Google email address must be verified.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = email.lower().strip()

        with transaction.atomic():
            user = (
                Users.objects.select_for_update()
                .filter(google_id=google_id)
                .first()
            )

            if user:
                if user.email.lower() != email:
                    return api_response(
                        {
                            "code": "auth.google_account_linked_elsewhere",
                            "error": (
                                "This Google account is already "
                                "linked to a different account."
                            ),
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            else:
                user = (
                    Users.objects.select_for_update()
                    .filter(email=email)
                    .first()
                )

            if user:
                if not user.is_active:
                    return api_response(
                        {
                            "code": "auth.account_inactive",
                            "error": (
                                "This account is locked or inactive. "
                                "Please contact a super_admin."
                            ),
                            "account_locked": True,
                        },
                        status=status.HTTP_403_FORBIDDEN,
                    )

                if user.auth_provider == "local":
                    if user.role in ["admin", "super_admin"]:
                        if user.has_expired_initial_password():
                            return api_response(
                                {
                                    "code": "auth.initial_password_expired",
                                    "error": (
                                        "Your initial password has expired. "
                                        "Please use the password recovery "
                                        "process before using Google login."
                                    ),
                                    "initial_password_expired": True,
                                },
                                status=status.HTTP_403_FORBIDDEN,
                            )

                        if not user.initial_password_changed:
                            return api_response(
                                {
                                    "code": "auth.initial_password_required",
                                    "error": (
                                        "You must log in with your initial "
                                        "password and change it before using "
                                        "Google login."
                                    ),
                                    "initial_password_required": True,
                                },
                                status=status.HTTP_403_FORBIDDEN,
                            )

                    user.google_id = google_id
                    user.email_verified = True

                    user.save(
                        update_fields=[
                            "google_id",
                            "email_verified",
                        ]
                    )

                elif user.auth_provider == "google":
                    user.google_id = google_id
                    user.email_verified = True

                    user.save(
                        update_fields=[
                            "google_id",
                            "email_verified",
                        ]
                    )

                else:
                    return api_response(
                        {
                            "code": "auth.different_auth_method",
                            "error": (
                                "This account uses a different "
                                "authentication method."
                            ),
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            else:
                user = Users.objects.create_user(
                    email=email,
                    auth_provider="google",
                    google_id=google_id,
                    role="buyer",
                    email_verified=True,
                    is_active=True,
                    initial_password_changed=True,
                    initial_password_expires=None,
                )

        register_successful_login(request, user)

        return create_auth_response(user, "Google login successful")


# ------------------------------ TOKEN REFRESH --------------------------------
class TokenRefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.COOKIES.get(
            settings.REFRESH_COOKIE_NAME
        )

        if not refresh_token:
            return api_response(
                {
                    "code": "auth.refresh_token_not_found",
                    "error": "Refresh token not found",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            refresh = RefreshToken(refresh_token)

            user_id = refresh.get("user_id")

            if not user_id:
                return api_response(
                    {
                        "code": "auth.invalid_refresh_token",
                        "error": "Invalid refresh token",
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            user = Users.objects.get(id=user_id)

            if not user.is_active:
                return api_response(
                    {
                        "code": "auth.account_inactive",
                        "error": "This account is inactive",
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            if user.has_expired_initial_password():
                return api_response(
                    {
                        "code": "auth.initial_password_expired",
                        "error": (
                            "Your initial password has expired. "
                            "Please use the password recovery process."
                        ),
                        "initial_password_expired": True,
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            access = refresh.access_token

            access["user_id"] = str(user.id)
            access["email"] = user.email
            access["role"] = user.role
            access["auth_provider"] = user.auth_provider

            return api_response(
                {
                    "access": str(access),
                },
                status=status.HTTP_200_OK,
            )

        except (TokenError, Users.DoesNotExist):
            return api_response(
                {
                    "code": "auth.invalid_refresh_token",
                    "error": "Invalid or expired refresh token",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )


# ------------------------------ LOGOUT --------------------------------
class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        response = api_response(
            {
                "code": "auth.logout_successful",
                "message": "Logout successful",
            },
            status=status.HTTP_200_OK,
        )

        response.delete_cookie(
            settings.REFRESH_COOKIE_NAME,
            path="/token/refresh/",
        )

        return response


# ------------------------------ PROFILE --------------------------------
class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def serialize_profile(self, user):
        profile = getattr(user, "profile", None)

        return {
            "id": str(user.id),
            "email": user.email,
            "role": user.role,
            "auth_provider": user.auth_provider,
            "display_name": get_user_display_name(user),
            "first_name": profile.first_name if profile else None,
            "last_name": profile.last_name if profile else None,
            "phone_number": profile.phone_number if profile else None,
            "national_id": profile.national_id if profile else None,
        }

    def get(self, request):
        return api_response(
            self.serialize_profile(request.user),
            status=status.HTTP_200_OK,
        )

    def patch(self, request):
        if request.user.role != "buyer":
            return api_response(
                {
                    "code": "auth.buyer_profile_only",
                    "error": (
                        "Only buyer accounts can manage profile details."
                    ),
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        profile = getattr(request.user, "profile", None)

        if profile is None:
            required_fields = [
                "first_name",
                "last_name",
                "phone_number",
                "national_id",
            ]

            invalid_fields = (
                set(request.data.keys()) - set(required_fields)
            )

            if invalid_fields:
                return api_response(
                    {
                        "code": "auth.invalid_profile_fields",
                        "error": "Invalid profile fields.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            missing_fields = [
                field
                for field in required_fields
                if (
                    field not in request.data
                    or not str(request.data.get(field)).strip()
                )
            ]

            if missing_fields:
                return api_response(
                    {
                        "code": "auth.profile_fields_required",
                        "error": (
                            "First name, last name, phone number, "
                            "and national ID are required."
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            first_name = str(request.data.get("first_name")).strip()
            last_name = str(request.data.get("last_name")).strip()
            phone_number = str(request.data.get("phone_number")).strip()
            national_id = str(request.data.get("national_id")).strip()

            if Profile.objects.filter(phone_number=phone_number).exists():
                return api_response(
                    {
                        "code": "auth.phone_number_already_used",
                        "error": "That phone number is already in use.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if Profile.objects.filter(national_id=national_id).exists():
                return api_response(
                    {
                        "code": "auth.national_id_already_used",
                        "error": "That national ID is already in use.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            profile = Profile(
                user=request.user,
                first_name=first_name,
                last_name=last_name,
                phone_number=phone_number,
                national_id=national_id,
            )

            try:
                profile.full_clean()
                profile.save()

            except ValidationError as error:
                if hasattr(error, "message_dict"):
                    return api_response(
                        {
                            "code": "auth.profile_validation_error",
                            "error": error.message_dict,
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                return api_response(
                    {
                        "code": "auth.profile_validation_error",
                        "error": error.messages,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            return api_response(
                self.serialize_profile(request.user),
                status=status.HTTP_200_OK,
            )

        invalid_fields = (
            set(request.data.keys()) - {"phone_number"}
        )

        if invalid_fields:
            return api_response(
                {
                    "code": "auth.profile_readonly_fields",
                    "error": (
                        "First name, last name, and national ID "
                        "cannot be edited."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if "phone_number" not in request.data:
            return api_response(
                {
                    "code": "auth.phone_number_required",
                    "error": "phone_number is required.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        phone_number = request.data.get("phone_number")

        if phone_number is None or not str(phone_number).strip():
            return api_response(
                {
                    "code": "auth.phone_number_required",
                    "error": "Phone number cannot be empty.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        phone_number = str(phone_number).strip()

        if (
            Profile.objects.filter(phone_number=phone_number)
            .exclude(user=request.user)
            .exists()
        ):
            return api_response(
                {
                    "code": "auth.phone_number_already_used",
                    "error": "That phone number is already in use.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile.phone_number = phone_number

        try:
            profile.full_clean(exclude=["national_id"])

            profile.save(
                update_fields=["phone_number"]
            )

        except ValidationError as error:
            if hasattr(error, "message_dict"):
                return api_response(
                    {
                        "code": "auth.profile_validation_error",
                        "error": error.message_dict,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            return api_response(
                {
                    "code": "auth.profile_validation_error",
                    "error": error.messages,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return api_response(
            self.serialize_profile(request.user),
            status=status.HTTP_200_OK,
        )


# ------------------------------ FORGOT PASSWORD --------------------------------
class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = (
            request.data.get("email") or ""
        ).strip().lower()

        new_password = request.data.get("new_password") or ""

        if not email:
            return api_response(
                {
                    "code": "auth.email_required",
                    "error": "Email is required",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not new_password:
            return api_response(
                {
                    "code": "auth.new_password_required",
                    "error": "New password is required",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        password_error = validate_password(new_password)

        if password_error:
            return api_response(
                {
                    "code": "auth.password_policy_invalid",
                    "error": password_error,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            user = (
                Users.objects.select_for_update()
                .filter(email=email)
                .first()
            )

            if not user:
                return api_response(
                    {
                        "code": "auth.account_not_found",
                        "error": "Account not found",
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            if user.auth_provider != "local":
                return api_response(
                    {
                        "code": "auth.google_password_reset_unavailable",
                        "error": (
                            "Password reset is not available "
                            "for Google accounts"
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not user.email_verified:
                return api_response(
                    {
                        "code": "auth.email_not_verified",
                        "error": "Please verify your email first",
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            if not user.is_active:
                return api_response(
                    {
                        "code": "auth.account_inactive",
                        "error": "This account is inactive.",
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            if user.check_password(new_password):
                return api_response(
                    {
                        "code": "auth.password_must_be_different",
                        "error": (
                            "New password must be different "
                            "from your current password"
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if (
                user.forgot_password_otp_locked_until
                and user.forgot_password_otp_locked_until > timezone.now()
            ):
                return otp_locked_response(
                    user.forgot_password_otp_locked_until
                )

            can_resend, wait_seconds = (
                user.can_resend_forgot_password_otp()
            )

            if not can_resend:
                return otp_resend_limit_response(wait_seconds)

            initial = is_initial_otp(
                user,
                "forgot_password_otp_last_sent",
                "forgot_password_otp_resend_count",
            )

            otp = user.generate_forgot_password_otp(
                is_initial=initial
            )

            transaction.on_commit(
                lambda: send_email_task.delay(
                    email,
                    otp,
                    "forgot_password",
                )
            )

        return api_response(
            {
                "code": "auth.otp_sent",
                "message": "OTP sent to your email",
                "wait_seconds": user.OTP_RESEND_COOLDOWN_SECONDS,
            },
            status=status.HTTP_200_OK,
        )

    def put(self, request):
        email = (
            request.data.get("email") or ""
        ).strip().lower()

        otp = (
            request.data.get("otp") or ""
        ).strip()

        new_password = request.data.get("new_password") or ""

        if not email or not otp or not new_password:
            return api_response(
                {
                    "code": "auth.email_otp_and_password_required",
                    "error": "Email, OTP and new password are required",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        password_error = validate_password(new_password)

        if password_error:
            return api_response(
                {
                    "code": "auth.password_policy_invalid",
                    "error": password_error,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            user = (
                Users.objects.select_for_update()
                .filter(email=email)
                .first()
            )

            if not user:
                return api_response(
                    {
                        "code": "auth.account_not_found",
                        "error": "Account not found",
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            if user.auth_provider != "local":
                return api_response(
                    {
                        "code": "auth.google_password_reset_unavailable",
                        "error": (
                            "Password reset is not available "
                            "for Google accounts"
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not user.email_verified:
                return api_response(
                    {
                        "code": "auth.email_not_verified",
                        "error": "Please verify your email first",
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            if not user.is_active:
                return api_response(
                    {
                        "code": "auth.account_inactive",
                        "error": "This account is inactive.",
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            if user.check_password(new_password):
                return api_response(
                    {
                        "code": "auth.password_must_be_different",
                        "error": (
                            "New password must be different "
                            "from your current password"
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            verification = user.verify_forgot_password_otp(otp)

            if verification is not True:
                return otp_verification_failure(
                    user,
                    verification,
                    "forgot_password_otp_hash",
                    "forgot_password_otp_expires",
                    "forgot_password_otp_attempts",
                )

            user.set_password(new_password)

            update_fields = ["password"]

            if user.role in ["admin", "super_admin"]:
                user.initial_password_changed = True
                user.initial_password_expires = None

                update_fields.extend([
                    "initial_password_changed",
                    "initial_password_expires",
                ])

            user.save(update_fields=update_fields)

        response = api_response(
            {
                "code": "auth.password_reset_successful",
                "message": "Password reset successfully",
            },
            status=status.HTTP_200_OK,
        )

        response.delete_cookie(
            settings.REFRESH_COOKIE_NAME,
            path="/token/refresh/",
        )

        return response


# ------------------------------ CHANGE PASSWORD ---------------------------------------
class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current_password = (
            request.data.get("current_password") or ""
        ).strip()

        new_password = request.data.get("new_password") or ""

        if not current_password or not new_password:
            return api_response(
                {
                    "code": "auth.password_fields_required",
                    "error": (
                        "Current password and new password are required."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            user = (
                Users.objects.select_for_update()
                .get(id=request.user.id)
            )

            if user.auth_provider != "local":
                return api_response(
                    {
                        "code": "auth.google_password_reset_unavailable",
                        "error": (
                            "Password changes are not available "
                            "for Google accounts."
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not user.check_password(current_password):
                return api_response(
                    {
                        "code": "auth.current_password_incorrect",
                        "error": "Current password is incorrect.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if user.check_password(new_password):
                return api_response(
                    {
                        "code": "auth.password_must_be_different",
                        "error": (
                            "New password must be different "
                            "from your current password."
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            password_error = validate_password(new_password)

            if password_error:
                return api_response(
                    {
                        "code": "auth.password_policy_invalid",
                        "error": password_error,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if (
                user.change_password_otp_locked_until
                and user.change_password_otp_locked_until > timezone.now()
            ):
                return otp_locked_response(
                    user.change_password_otp_locked_until
                )

            can_resend, wait_seconds = (
                user.can_resend_change_password_otp()
            )

            if not can_resend:
                return otp_resend_limit_response(wait_seconds)

            initial = is_initial_otp(
                user,
                "change_password_otp_last_sent",
                "change_password_otp_resend_count",
            )

            otp = user.generate_change_password_otp(
                is_initial=initial
            )

            transaction.on_commit(
                lambda: send_email_task.delay(
                    user.email,
                    otp,
                    "change_password",
                )
            )

        return api_response(
            {
                "code": "auth.otp_sent",
                "message": "OTP sent to your email",
                "wait_seconds": user.OTP_RESEND_COOLDOWN_SECONDS,
            },
            status=status.HTTP_200_OK,
        )

    def put(self, request):
        otp = (
            request.data.get("otp") or ""
        ).strip()

        new_password = request.data.get("new_password") or ""

        if not otp:
            return api_response(
                {
                    "code": "auth.otp_required",
                    "error": "OTP is required.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not new_password:
            return api_response(
                {
                    "code": "auth.new_password_required",
                    "error": "New password is required.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        password_error = validate_password(new_password)

        if password_error:
            return api_response(
                {
                    "code": "auth.password_policy_invalid",
                    "error": password_error,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            user = (
                Users.objects.select_for_update()
                .get(id=request.user.id)
            )

            if user.auth_provider != "local":
                return api_response(
                    {
                        "code": "auth.google_password_reset_unavailable",
                        "error": (
                            "Password changes are not available "
                            "for Google accounts."
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if user.check_password(new_password):
                return api_response(
                    {
                        "code": "auth.password_must_be_different",
                        "error": (
                            "New password must be different "
                            "from your current password."
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            verification = user.verify_change_password_otp(otp)

            if verification is not True:
                return otp_verification_failure(
                    user,
                    verification,
                    "change_password_otp_hash",
                    "change_password_otp_expires",
                    "change_password_otp_attempts",
                )

            user.set_password(new_password)

            update_fields = ["password"]

            if user.role in ["admin", "super_admin"]:
                user.initial_password_changed = True
                user.initial_password_expires = None

                update_fields.extend([
                    "initial_password_changed",
                    "initial_password_expires",
                ])

            user.save(update_fields=update_fields)

        return api_response(
            {
                "code": "auth.password_changed_successfully",
                "message": "Password changed successfully.",
            },
            status=status.HTTP_200_OK,
        )


# ------------------------------ DELETE ACCOUNT --------------------------------
class DeleteAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        with transaction.atomic():
            user = (
                Users.objects.select_for_update()
                .get(id=request.user.id)
            )

            if (
                user.delete_account_otp_locked_until
                and user.delete_account_otp_locked_until > timezone.now()
            ):
                return otp_locked_response(
                    user.delete_account_otp_locked_until
                )

            can_resend, wait_seconds = (
                user.can_resend_delete_account_otp()
            )

            if not can_resend:
                return otp_resend_limit_response(wait_seconds)

            initial = is_initial_otp(
                user,
                "delete_account_otp_last_sent",
                "delete_account_otp_resend_count",
            )

            otp = user.generate_delete_account_otp(
                is_initial=initial
            )

            transaction.on_commit(
                lambda: send_email_task.delay(
                    user.email,
                    otp,
                    "delete_account",
                )
            )

        return api_response(
            {
                "code": "auth.otp_sent",
                "message": "OTP sent to your email",
                "wait_seconds": user.OTP_RESEND_COOLDOWN_SECONDS,
            },
            status=status.HTTP_200_OK,
        )

    def delete(self, request):
        otp = (
            request.data.get("otp") or ""
        ).strip()

        if not otp:
            return api_response(
                {
                    "code": "auth.otp_required",
                    "error": "OTP is required",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            user = (
                Users.objects.select_for_update()
                .get(id=request.user.id)
            )

            verification = user.verify_delete_account_otp(otp)

            if verification is not True:
                return otp_verification_failure(
                    user,
                    verification,
                    "delete_account_otp_hash",
                    "delete_account_otp_expires",
                    "delete_account_otp_attempts",
                )

            user.delete()

        response = api_response(
            {
                "code": "auth.account_deleted_successfully",
                "message": "Account deleted successfully",
            },
            status=status.HTTP_200_OK,
        )

        response.delete_cookie(
            settings.REFRESH_COOKIE_NAME,
            path="/token/refresh/",
        )

        return response