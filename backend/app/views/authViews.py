import re

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import (
    AllowAny,
    IsAuthenticated,
)
from rest_framework import status

from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.models import (
    Users,
    LoginDevice,
    LoginRecord,
)

from utils.tasks import (
    send_email_task,
    send_new_login_email_task,
)


# ------------------------------ PASSWORD VALIDATION --------------------------------
PASSWORD_PATTERN = (
    r"^(?=.*[A-Z])"
    r"(?=.*\d)"
    r"(?=.*[@$!%*?&])"
    r"[A-Za-z\d@$!%*?&]{8,}$"
)


def validate_password(password):
    if not re.fullmatch(
        PASSWORD_PATTERN,
        password,
    ):
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

    if user.role in [
        "admin",
        "super_admin",
    ]:
        return user.display_name

    profile = getattr(
        user,
        "profile",
        None,
    )

    if profile:

        full_name = (
            f"{profile.first_name} "
            f"{profile.last_name}"
        ).strip()

        if full_name:
            return full_name

    return "User"


# ------------------------------ OTP LOCK --------------------------------
def get_remaining_lock_seconds(
    locked_until,
):

    if not locked_until:
        return 0

    remaining = int(
        (
            locked_until
            - timezone.now()
        ).total_seconds()
    )

    return max(
        remaining,
        0,
    )


def otp_locked_response(
    locked_until,
):

    remaining = get_remaining_lock_seconds(
        locked_until
    )

    return Response(
        {
            "error": (
                "Too many failed attempts. "
                "OTP locked for 5 minutes"
            ),
            "wait_seconds": remaining,
        },
        status=423,
    )


# ------------------------------ OTP RESEND RESPONSE --------------------------------
def otp_resend_response(
    user,
    message="OTP sent to your email",
):

    return Response(
        {
            "message": message,
            "wait_seconds": (
                user.OTP_RESEND_COOLDOWN_SECONDS
            ),
        },
        status=status.HTTP_200_OK,
    )


def otp_resend_limit_response(
    wait_seconds,
):

    if wait_seconds > 0:

        return Response(
            {
                "error": (
                    "Please wait before "
                    "requesting another OTP"
                ),
                "wait_seconds": wait_seconds,
            },
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    return Response(
        {
            "error": (
                "Maximum OTP resends "
                "reached"
            )
        },
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )


# ------------------------------ LOGIN SECURITY --------------------------------
def get_client_ip(request):

    forwarded_for = request.META.get(
        "HTTP_X_FORWARDED_FOR"
    )

    if forwarded_for:

        return (
            forwarded_for
            .split(",")[0]
            .strip()
        )

    return request.META.get(
        "REMOTE_ADDR"
    )


def register_successful_login(
    request,
    user,
):

    device_id = (
        request.data.get("device_id")
        or ""
    ).strip()

    if not device_id:
        return

    user_agent = (
        request.META.get(
            "HTTP_USER_AGENT"
        )
        or ""
    )

    ip_address = get_client_ip(
        request
    )

    if not ip_address:
        return

    with transaction.atomic():

        user_locked = (
            Users.objects.select_for_update()
            .get(
                id=user.id
            )
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

            device.last_ip_address = (
                ip_address
            )

            device.user_agent = (
                user_agent
            )

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

        if (
            is_new_device
            and has_previous_login
        ):

            transaction.on_commit(
                lambda: send_new_login_email_task.delay(
                    user_locked.email,
                    ip_address,
                    user_agent,
                )
            )


# ------------------------------ AUTH RESPONSE --------------------------------
def create_auth_response(
    user,
    message,
):

    refresh = RefreshToken.for_user(
        user
    )

    refresh["user_id"] = str(
        user.id
    )
    refresh["email"] = user.email
    refresh["role"] = user.role
    refresh["auth_provider"] = (
        user.auth_provider
    )

    access = refresh.access_token

    response = Response(
        {
            "access": str(access),
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

    permission_classes = [
        AllowAny
    ]

    def post(
        self,
        request,
    ):

        email = (
            request.data.get("email")
            or ""
        ).strip().lower()

        password = (
            request.data.get("password")
            or ""
        )

        if not email or not password:

            return Response(
                {
                    "error": (
                        "Email and password "
                        "are required"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        password_error = validate_password(
            password
        )

        if password_error:

            return Response(
                {
                    "error": password_error
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if Users.objects.filter(
            email=email
        ).exists():

            return Response(
                {
                    "error": (
                        "An account with this "
                        "email already exists"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = Users(
            email=email,
            auth_provider="local",
            role="buyer",
            email_verified=False,
            is_active=True,
        )

        user.set_password(
            password
        )

        user.save()

        otp = user.generate_email_otp()

        send_email_task.delay(
            email,
            otp,
            "verify_account",
        )

        return Response(
            {
                "message": (
                    "Registration successful. "
                    "OTP sent to your email."
                ),
                "wait_seconds": (
                    user.OTP_RESEND_COOLDOWN_SECONDS
                ),
            },
            status=status.HTTP_201_CREATED,
        )


# ------------------------------ RESEND OTP --------------------------------
class ResendOTPView(APIView):

    permission_classes = [
        AllowAny
    ]

    def post(
        self,
        request,
    ):

        email = (
            request.data.get("email")
            or ""
        ).strip().lower()

        otp_type = (
            request.data.get("otp_type")
            or "email"
        )

        if not email:

            return Response(
                {
                    "error": "Email is required"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:

            user = Users.objects.get(
                email=email
            )

        except Users.DoesNotExist:

            return Response(
                {
                    "error": "Account not found"
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if otp_type == "email":

            if user.email_verified:

                return Response(
                    {
                        "error": (
                            "Account is already "
                            "verified"
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if (
                user.email_otp_locked_until
                and user.email_otp_locked_until
                > timezone.now()
            ):

                return otp_locked_response(
                    user.email_otp_locked_until
                )

            can_resend, wait_seconds = (
                user.can_resend_email_otp()
            )

            if not can_resend:

                return otp_resend_limit_response(
                    wait_seconds
                )

            otp = user.generate_email_otp()

            send_email_task.delay(
                email,
                otp,
                "verify_account",
            )

            return otp_resend_response(
                user,
                "OTP resent successfully",
            )

        otp_field_map = {
            "forgot_password": (
                user.can_resend_change_password_otp,
                user.generate_change_password_otp,
                "change_password",
                user.change_password_otp_locked_until,
            ),
            "change_password": (
                user.can_resend_change_password_otp,
                user.generate_change_password_otp,
                "change_password",
                user.change_password_otp_locked_until,
            ),
            "delete_account": (
                user.can_resend_delete_account_otp,
                user.generate_delete_account_otp,
                "delete_account",
                user.delete_account_otp_locked_until,
            ),
        }

        otp_config = otp_field_map.get(
            otp_type
        )

        if not otp_config:

            return Response(
                {
                    "error": "Invalid OTP type"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        (
            can_resend_method,
            generate_method,
            email_otp_type,
            locked_until,
        ) = otp_config

        if (
            locked_until
            and locked_until > timezone.now()
        ):

            return otp_locked_response(
                locked_until
            )

        can_resend, wait_seconds = (
            can_resend_method()
        )

        if not can_resend:

            return otp_resend_limit_response(
                wait_seconds
            )

        otp = generate_method()

        send_email_task.delay(
            email,
            otp,
            email_otp_type,
        )

        return otp_resend_response(
            user,
            "OTP resent successfully",
        )


# ------------------------------ VERIFY ACCOUNT --------------------------------
class VerifyAccountView(APIView):

    permission_classes = [
        AllowAny
    ]

    def post(
        self,
        request,
    ):

        email = (
            request.data.get("email")
            or ""
        ).strip().lower()

        otp = (
            request.data.get("otp")
            or ""
        ).strip()

        if not email or not otp:

            return Response(
                {
                    "error": (
                        "Email and OTP are required"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:

            user = Users.objects.get(
                email=email
            )

        except Users.DoesNotExist:

            return Response(
                {
                    "error": "Account not found"
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if user.email_verified:

            return Response(
                {
                    "message": (
                        "Account is already verified"
                    )
                },
                status=status.HTTP_200_OK,
            )

        verification = (
            user.verify_email_otp(
                otp
            )
        )

        if verification == "locked":

            return otp_locked_response(
                user.email_otp_locked_until
            )

        if verification is False:

            if (
                user.email_otp_locked_until
                and user.email_otp_locked_until
                > timezone.now()
            ):

                return otp_locked_response(
                    user.email_otp_locked_until
                )

            if (
                not user.email_otp_hash
                or not user.email_otp_expires
                or timezone.now()
                >= user.email_otp_expires
            ):

                return Response(
                    {
                        "error": "OTP has expired"
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            return Response(
                {
                    "error": "Invalid OTP",
                    "attempts_remaining": (
                        user.MAX_OTP_ATTEMPTS
                        - user.email_otp_attempts
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "message": (
                    "Account verified successfully"
                )
            },
            status=status.HTTP_200_OK,
        )


# ------------------------------ LOGIN --------------------------------
class LoginView(APIView):

    permission_classes = [
        AllowAny
    ]

    def post(
        self,
        request,
    ):

        email = (
            request.data.get("email")
            or ""
        ).strip().lower()

        password = (
            request.data.get("password")
            or ""
        )

        if not email or not password:

            return Response(
                {
                    "error": (
                        "Email and password "
                        "are required"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:

            user = Users.objects.get(
                email=email
            )

        except Users.DoesNotExist:

            return Response(
                {
                    "error": (
                        "Invalid email or password"
                    )
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.check_password(
            password
        ):

            return Response(
                {
                    "error": (
                        "Invalid email or password"
                    )
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if user.has_expired_initial_password():

            if user.is_active:

                user.is_active = False

                user.save(
                    update_fields=[
                        "is_active"
                    ]
                )

            return Response(
                {
                    "error": (
                        "Your initial password has "
                        "expired. Your account is locked. "
                        "Please contact a super_admin "
                        "to unlock your account."
                    ),
                    "account_locked": True,
                    "initial_password_expired": True,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if not user.is_active:

            return Response(
                {
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

            return Response(
                {
                    "error": (
                        "Please verify your "
                        "email before logging in"
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        register_successful_login(
            request,
            user,
        )

        return create_auth_response(
            user,
            "Login successful",
        )


# ------------------------------ GOOGLE LOGIN ---------------------------------------
class GoogleLoginView(APIView):

    permission_classes = [
        AllowAny
    ]

    def post(
        self,
        request,
    ):

        credential = (
            request.data.get("credential")
            or ""
        ).strip()

        if not credential:

            return Response(
                {
                    "error": (
                        "Google credential is required."
                    )
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

            return Response(
                {
                    "error": (
                        "Invalid Google credential."
                    )
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        email = google_data.get(
            "email"
        )

        google_id = google_data.get(
            "sub"
        )

        email_verified = google_data.get(
            "email_verified",
            False,
        )

        if not email or not google_id:

            return Response(
                {
                    "error": (
                        "Google account information "
                        "is incomplete."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not email_verified:

            return Response(
                {
                    "error": (
                        "Your Google email address "
                        "must be verified."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = email.lower().strip()

        # ------------------------------ FIND USER ------------------------------
        user = (
            Users.objects
            .filter(
                google_id=google_id
            )
            .first()
        )

        if user:

            if user.email.lower() != email:

                return Response(
                    {
                        "error": (
                            "This Google account is already "
                            "linked to a different account."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        else:

            user = (
                Users.objects
                .filter(
                    email=email
                )
                .first()
            )

        # ------------------------------ EXISTING USER ------------------------------
        if user:

            # Existing local account
            if user.auth_provider == "local":

                # Admin accounts must complete their initial password change before Google login is allowed
                if user.role in [
                    "admin",
                    "super_admin",
                ]:

                    if user.has_expired_initial_password():

                        if user.is_active:

                            user.is_active = False

                            user.save(
                                update_fields=[
                                    "is_active"
                                ]
                            )

                        return Response(
                            {
                                "error": (
                                    "Your initial password has "
                                    "expired. Your account is locked. "
                                    "Please contact a super_admin "
                                    "to unlock your account."
                                ),
                                "account_locked": True,
                                "initial_password_expired": True,
                            },
                            status=status.HTTP_403_FORBIDDEN,
                        )

                    if not user.initial_password_changed:

                        return Response(
                            {
                                "error": (
                                    "You must log in with your "
                                    "initial password and change "
                                    "it before using Google login."
                                ),
                                "initial_password_required": True,
                            },
                            status=status.HTTP_403_FORBIDDEN,
                        )

                # Link Google to the existing account
                user.google_id = google_id
                user.email_verified = True

                user.save(
                    update_fields=[
                        "google_id",
                        "email_verified",
                    ]
                )

            # Existing Google account
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

                return Response(
                    {
                        "error": (
                            "This account uses a different "
                            "authentication method."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # ------------------------------ ACTIVE CHECK ------------------------------
            if not user.is_active:

                return Response(
                    {
                        "error": (
                            "This account is locked or inactive. "
                            "Please contact a super_admin."
                        ),
                        "account_locked": True,
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        # ------------------------------ NEW GOOGLE USER ------------------------------
        else:

            # Google can only create buyer accounts.
            user = Users(
                email=email,
                google_id=google_id,
                auth_provider="google",
                role="buyer",
                email_verified=True,
                is_active=True,
                is_staff=False,
                initial_password_changed=True,
                initial_password_expires=None,
            )

            user.set_unusable_password()

            user.save()

        # ------------------------------ LOGIN TRACKING ------------------------------
        register_successful_login(
            request,
            user,
        )

        return create_auth_response(
            user,
            "Google login successful",
        )


# ------------------------------ TOKEN REFRESH --------------------------------
class TokenRefreshView(APIView):

    permission_classes = [
        AllowAny
    ]

    def post(
        self,
        request,
    ):

        refresh_token = request.COOKIES.get(
            settings.REFRESH_COOKIE_NAME
        )

        if not refresh_token:

            return Response(
                {
                    "error": (
                        "Refresh token not found"
                    )
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:

            refresh = RefreshToken(
                refresh_token
            )

            user_id = refresh.get(
                "user_id"
            )

            if not user_id:

                return Response(
                    {
                        "error": (
                            "Invalid refresh token"
                        )
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            user = Users.objects.get(
                id=user_id
            )

            if not user.is_active:

                return Response(
                    {
                        "error": (
                            "This account is inactive"
                        )
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            access = refresh.access_token

            access["user_id"] = str(
                user.id
            )
            access["email"] = user.email
            access["role"] = user.role
            access["auth_provider"] = (
                user.auth_provider
            )

            return Response(
                {
                    "access": str(access)
                },
                status=status.HTTP_200_OK,
            )

        except (
            TokenError,
            Users.DoesNotExist,
        ):

            return Response(
                {
                    "error": (
                        "Invalid or expired "
                        "refresh token"
                    )
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )


# ------------------------------ LOGOUT --------------------------------
class LogoutView(APIView):

    permission_classes = [
        AllowAny
    ]

    def post(
        self,
        request,
    ):

        response = Response(
            {
                "message": (
                    "Logout successful"
                )
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

    permission_classes = [
        IsAuthenticated
    ]

    def serialize_profile(
        self,
        user,
    ):

        profile = getattr(
            user,
            "profile",
            None,
        )

        return {
            "id": str(
                user.id
            ),
            "email": user.email,
            "role": user.role,
            "auth_provider": (
                user.auth_provider
            ),
            "display_name": (
                get_user_display_name(
                    user
                )
            ),
            "first_name": (
                profile.first_name
                if profile
                else None
            ),
            "last_name": (
                profile.last_name
                if profile
                else None
            ),
            "phone_number": (
                profile.phone_number
                if profile
                else None
            ),
            "national_id": (
                profile.national_id
                if profile
                else None
            ),
        }

    def get(
        self,
        request,
    ):

        return Response(
            self.serialize_profile(
                request.user
            ),
            status=status.HTTP_200_OK,
        )

    def patch(
        self,
        request,
    ):

        if request.user.role != "buyer":

            return Response(
                {
                    "error": (
                        "Only buyer accounts can "
                        "manage profile details."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        profile = getattr(
            request.user,
            "profile",
            None,
        )

        # ------------------------------ CREATE PROFILE ------------------------------
        if profile is None:

            required_fields = [
                "first_name",
                "last_name",
                "phone_number",
                "national_id",
            ]

            invalid_fields = (
                set(request.data.keys())
                - set(required_fields)
            )

            if invalid_fields:

                return Response(
                    {
                        "error": (
                            "Invalid profile fields."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            missing_fields = [
                field
                for field in required_fields
                if (
                    field not in request.data
                    or not str(
                        request.data.get(
                            field
                        )
                    ).strip()
                )
            ]

            if missing_fields:

                return Response(
                    {
                        "error": (
                            "First name, last name, "
                            "phone number, and national "
                            "ID are required."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            from app.models import Profile

            first_name = str(
                request.data.get(
                    "first_name"
                )
            ).strip()

            last_name = str(
                request.data.get(
                    "last_name"
                )
            ).strip()

            phone_number = str(
                request.data.get(
                    "phone_number"
                )
            ).strip()

            national_id = str(
                request.data.get(
                    "national_id"
                )
            ).strip()

            if Profile.objects.filter(
                phone_number=phone_number
            ).exists():

                return Response(
                    {
                        "error": (
                            "That phone number is "
                            "already in use."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if Profile.objects.filter(
                national_id=national_id
            ).exists():

                return Response(
                    {
                        "error": (
                            "That national ID is "
                            "already in use."
                        )
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

                if hasattr(
                    error,
                    "message_dict",
                ):

                    return Response(
                        {
                            "error": (
                                error.message_dict
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                return Response(
                    {
                        "error": (
                            error.messages
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            return Response(
                self.serialize_profile(
                    request.user
                ),
                status=status.HTTP_200_OK,
            )

        # ------------------------------ UPDATE PROFILE ------------------------------
        invalid_fields = (
            set(request.data.keys())
            - {
                "phone_number"
            }
        )

        if invalid_fields:

            return Response(
                {
                    "error": (
                        "First name, last name, and "
                        "national ID cannot be edited."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if "phone_number" not in request.data:

            return Response(
                {
                    "error": (
                        "phone_number is required."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        phone_number = request.data.get(
            "phone_number"
        )

        if (
            phone_number is None
            or not str(
                phone_number
            ).strip()
        ):

            return Response(
                {
                    "error": (
                        "Phone number cannot be empty."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        phone_number = str(
            phone_number
        ).strip()

        from app.models import Profile

        if Profile.objects.filter(
            phone_number=phone_number
        ).exclude(
            user=request.user
        ).exists():

            return Response(
                {
                    "error": (
                        "That phone number is "
                        "already in use."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile.phone_number = phone_number

        try:

            profile.full_clean(
                exclude=[
                    "national_id"
                ]
            )

            profile.save(
                update_fields=[
                    "phone_number"
                ]
            )

        except ValidationError as error:

            if hasattr(
                error,
                "message_dict",
            ):

                return Response(
                    {
                        "error": (
                            error.message_dict
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            return Response(
                {
                    "error": (
                        error.messages
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            self.serialize_profile(
                request.user
            ),
            status=status.HTTP_200_OK,
        )
    

# ------------------------------ FORGOT PASSWORD --------------------------------
class ForgotPasswordView(APIView):

    permission_classes = [
        AllowAny
    ]

    def post(
        self,
        request,
    ):

        email = (
            request.data.get("email")
            or ""
        ).strip().lower()

        new_password = (
            request.data.get("new_password")
            or ""
        )

        if not email:

            return Response(
                {
                    "error": "Email is required"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not new_password:

            return Response(
                {
                    "error": (
                        "New password is required"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        password_error = validate_password(
            new_password
        )

        if password_error:

            return Response(
                {
                    "error": password_error
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:

            user = Users.objects.get(
                email=email
            )

        except Users.DoesNotExist:

            return Response(
                {
                    "error": "Account not found"
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if user.auth_provider != "local":

            return Response(
                {
                    "error": (
                        "Password reset is not "
                        "available for Google accounts"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.email_verified:

            return Response(
                {
                    "error": (
                        "Please verify your "
                        "email first"
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if user.check_password(
            new_password
        ):

            return Response(
                {
                    "error": (
                        "New password must be "
                        "different from your "
                        "current password"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if (
            user.change_password_otp_locked_until
            and user.change_password_otp_locked_until
            > timezone.now()
        ):

            return otp_locked_response(
                user.change_password_otp_locked_until
            )

        can_resend, wait_seconds = (
            user.can_resend_change_password_otp()
        )

        if not can_resend:

            return otp_resend_limit_response(
                wait_seconds
            )

        otp = (
            user.generate_change_password_otp()
        )

        send_email_task.delay(
            email,
            otp,
            "change_password",
        )

        return Response(
            {
                "message": (
                    "OTP sent to your email"
                ),
                "wait_seconds": (
                    user.OTP_RESEND_COOLDOWN_SECONDS
                ),
            },
            status=status.HTTP_200_OK,
        )

    def put(
        self,
        request,
    ):

        email = (
            request.data.get("email")
            or ""
        ).strip().lower()

        otp = (
            request.data.get("otp")
            or ""
        ).strip()

        new_password = (
            request.data.get("new_password")
            or ""
        )

        if (
            not email
            or not otp
            or not new_password
        ):

            return Response(
                {
                    "error": (
                        "Email, OTP and new "
                        "password are required"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        password_error = validate_password(
            new_password
        )

        if password_error:

            return Response(
                {
                    "error": password_error
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:

            user = Users.objects.get(
                email=email
            )

        except Users.DoesNotExist:

            return Response(
                {
                    "error": "Account not found"
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if user.auth_provider != "local":

            return Response(
                {
                    "error": (
                        "Password reset is not "
                        "available for Google accounts"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.email_verified:

            return Response(
                {
                    "error": (
                        "Please verify your "
                        "email first"
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        verification = (
            user.verify_change_password_otp(
                otp
            )
        )

        if verification == "locked":

            return otp_locked_response(
                user.change_password_otp_locked_until
            )

        if verification is False:

            if (
                user.change_password_otp_locked_until
                and user.change_password_otp_locked_until
                > timezone.now()
            ):

                return otp_locked_response(
                    user.change_password_otp_locked_until
                )

            if (
                not user.change_password_otp_hash
                or not user.change_password_otp_expires
                or timezone.now()
                >= user.change_password_otp_expires
            ):

                return Response(
                    {
                        "error": "OTP has expired"
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            return Response(
                {
                    "error": "Invalid OTP",
                    "attempts_remaining": (
                        user.MAX_OTP_ATTEMPTS
                        - user.change_password_otp_attempts
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user.check_password(
            new_password
        ):

            return Response(
                {
                    "error": (
                        "New password must be "
                        "different from your "
                        "current password"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(
            new_password
        )

        user.save(
            update_fields=[
                "password",
            ]
        )

        response = Response(
            {
                "message": (
                    "Password reset successfully"
                )
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
        user = request.user

        current_password = (
            request.data.get("current_password")
            or ""
        ).strip()

        new_password = (
            request.data.get("new_password")
            or ""
        )

        if not current_password or not new_password:
            return Response(
                {
                    "error": (
                        "Current password and new password "
                        "are required."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.check_password(current_password):
            return Response(
                {
                    "error": (
                        "Current password is incorrect."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user.check_password(new_password):
            return Response(
                {
                    "error": (
                        "New password must be different "
                        "from your current password."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        password_error = validate_password(
            new_password
        )

        if password_error:
            return Response(
                {
                    "error": password_error
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if (
            user.change_password_otp_locked_until
            and user.change_password_otp_locked_until
            > timezone.now()
        ):
            return otp_locked_response(
                user.change_password_otp_locked_until
            )

        can_resend, wait_seconds = (
            user.can_resend_change_password_otp()
        )

        if not can_resend:
            return otp_resend_limit_response(
                wait_seconds
            )

        otp = user.generate_change_password_otp()

        send_email_task.delay(
            user.email,
            otp,
            "change_password",
        )

        return Response(
            {
                "message": (
                    "OTP sent to your email"
                ),
                "wait_seconds": (
                    user.OTP_RESEND_COOLDOWN_SECONDS
                ),
            },
            status=status.HTTP_200_OK,
        )

    def put(self, request):
        user = request.user

        otp = (
            request.data.get("otp")
            or ""
        ).strip()

        new_password = (
            request.data.get("new_password")
            or ""
        )

        if not otp:
            return Response(
                {
                    "error": "OTP is required."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not new_password:
            return Response(
                {
                    "error": (
                        "New password is required."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        password_error = validate_password(
            new_password
        )

        if password_error:
            return Response(
                {
                    "error": password_error
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user.check_password(new_password):
            return Response(
                {
                    "error": (
                        "New password must be different "
                        "from your current password."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        verification = (
            user.verify_change_password_otp(
                otp
            )
        )

        if verification == "locked":
            return otp_locked_response(
                user.change_password_otp_locked_until
            )

        if verification is False:

            if (
                user.change_password_otp_locked_until
                and user.change_password_otp_locked_until
                > timezone.now()
            ):
                return otp_locked_response(
                    user.change_password_otp_locked_until
                )

            if (
                not user.change_password_otp_hash
                or not user.change_password_otp_expires
                or timezone.now()
                >= user.change_password_otp_expires
            ):
                return Response(
                    {
                        "error": "OTP has expired"
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            return Response(
                {
                    "error": "Invalid OTP",
                    "attempts_remaining": (
                        user.MAX_OTP_ATTEMPTS
                        - user.change_password_otp_attempts
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)

        if user.role in [
            "admin",
            "super_admin",
        ]:
            user.mark_initial_password_changed()

        user.save(
            update_fields=[
                "password",
                "initial_password_changed",
                "initial_password_expires",
            ]
        )

        return Response(
            {
                "message": (
                    "Password changed successfully."
                )
            },
            status=status.HTTP_200_OK,
        )

    
# ------------------------------ DELETE ACCOUNT --------------------------------
class DeleteAccountView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    def post(
        self,
        request,
    ):

        user = request.user

        if (
            user.delete_account_otp_locked_until
            and user.delete_account_otp_locked_until
            > timezone.now()
        ):

            return otp_locked_response(
                user.delete_account_otp_locked_until
            )

        can_resend, wait_seconds = (
            user.can_resend_delete_account_otp()
        )

        if not can_resend:

            return otp_resend_limit_response(
                wait_seconds
            )

        otp = (
            user.generate_delete_account_otp()
        )

        send_email_task.delay(
            user.email,
            otp,
            "delete_account",
        )

        return Response(
            {
                "message": (
                    "OTP sent to your email"
                ),
                "wait_seconds": (
                    user.OTP_RESEND_COOLDOWN_SECONDS
                ),
            },
            status=status.HTTP_200_OK,
        )

    def delete(
        self,
        request,
    ):

        user = request.user

        otp = (
            request.data.get("otp")
            or ""
        ).strip()

        if not otp:

            return Response(
                {
                    "error": "OTP is required"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        verification = (
            user.verify_delete_account_otp(
                otp
            )
        )

        if verification == "locked":

            return otp_locked_response(
                user.delete_account_otp_locked_until
            )

        if verification is False:

            if (
                user.delete_account_otp_locked_until
                and user.delete_account_otp_locked_until
                > timezone.now()
            ):

                return otp_locked_response(
                    user.delete_account_otp_locked_until
                )

            if (
                not user.delete_account_otp_hash
                or not user.delete_account_otp_expires
                or timezone.now()
                >= user.delete_account_otp_expires
            ):

                return Response(
                    {
                        "error": "OTP has expired"
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            return Response(
                {
                    "error": "Invalid OTP",
                    "attempts_remaining": (
                        user.MAX_OTP_ATTEMPTS
                        - user.delete_account_otp_attempts
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.delete()

        response = Response(
            {
                "message": (
                    "Account deleted successfully"
                )
            },
            status=status.HTTP_200_OK,
        )

        response.delete_cookie(
            settings.REFRESH_COOKIE_NAME,
            path="/token/refresh/",
        )

        return response
