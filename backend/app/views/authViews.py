from django.conf import settings
from django.db import transaction
from django.utils import timezone

import secrets

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status

from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from app.models import Users
from utils.tasks import send_email_task


def get_remaining_lock_seconds(locked_until):
    if not locked_until:
        return 0

    remaining = int(
        (locked_until - timezone.now()).total_seconds()
    )

    return max(remaining, 0)


def otp_locked_response(locked_until):
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


# ------------------------------ REGISTER ---------------------------------------
class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data or {}

        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            return Response(
                {
                    "error": (
                        "Email and password required"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = email.strip().lower()

        if Users.objects.filter(email=email).exists():
            return Response(
                {
                    "error": (
                        "An account with this email "
                        "already exists"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = Users(
            email=email,
            email_verified=False,
            auth_provider="local",
        )

        user.set_password(password)

        raw_otp = user.generate_email_otp()

        send_email_task.delay(
            user.email,
            raw_otp,
        )

        return Response(
            {
                "status": "otp_sent",
                "message": (
                    "Verification OTP sent "
                    "to your email"
                ),
                "wait_seconds": 60,
            },
            status=status.HTTP_201_CREATED,
        )


# ------------------------------ RESEND OTP ---------------------------------------
class ResendOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data or {}

        email = data.get("email")
        purpose = data.get("purpose")

        authenticated_user = (
            request.user
            if request.user.is_authenticated
            else None
        )

        if authenticated_user:
            user = authenticated_user

            if not purpose:
                purpose = "change_password"

        else:
            if not email:
                return Response(
                    {
                        "error": "Email required"
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            email = email.strip().lower()

            user = Users.objects.filter(
                email=email
            ).first()

            if not user:
                return Response(
                    {
                        "error": "Account not found"
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            if not purpose:
                purpose = "registration"

        if purpose not in {
            "registration",
            "change_password",
            "delete_account",
        }:
            return Response(
                {
                    "error": "Invalid OTP purpose"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if purpose == "registration":

            if user.email_verified:
                return Response(
                    {
                        "error": (
                            "Email is already verified"
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not user.can_resend_email_otp():
                return Response(
                    {
                        "error": (
                            "Please wait before "
                            "requesting another OTP"
                        ),
                        "wait_seconds": 60,
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )

            raw_otp = user.generate_email_otp()

        elif purpose == "change_password":

            if not user.can_resend_change_password_otp():
                return Response(
                    {
                        "error": (
                            "Please wait before "
                            "requesting another OTP"
                        ),
                        "wait_seconds": 60,
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )

            raw_otp = (
                user.generate_change_password_otp()
            )

        else:

            if not user.can_resend_delete_account_otp():
                return Response(
                    {
                        "error": (
                            "Please wait before "
                            "requesting another OTP"
                        ),
                        "wait_seconds": 60,
                    },
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )

            raw_otp = (
                user.generate_delete_account_otp()
            )

        send_email_task.delay(
            user.email,
            raw_otp,
        )

        return Response(
            {
                "status": "otp_sent",
                "message": (
                    "OTP sent to your email"
                ),
                "wait_seconds": 60,
            },
            status=status.HTTP_200_OK,
        )


# ------------------------------ VERIFY ACCOUNT ---------------------------------------
class VerifyAccountView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data or {}

        email = data.get("email")
        otp = data.get("otp")

        if not email or not otp:
            return Response(
                {
                    "error": (
                        "Email and OTP required"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = email.strip().lower()

        user = Users.objects.filter(
            email=email
        ).first()

        if not user:
            return Response(
                {
                    "error": "Account not found"
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if user.email_otp_locked_until:
            if (
                user.email_otp_locked_until
                > timezone.now()
            ):
                return otp_locked_response(
                    user.email_otp_locked_until
                )

        if not user.verify_email_otp(otp):
            return Response(
                {
                    "error": "Invalid or expired OTP"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "message": (
                    "Email verified successfully"
                )
            },
            status=status.HTTP_200_OK,
        )


# ------------------------------ LOGIN ---------------------------------------
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data or {}

        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            return Response(
                {
                    "error": (
                        "Email and password required"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = email.strip().lower()

        user = Users.objects.filter(
            email=email
        ).first()

        if not user or not user.check_password(password):
            return Response(
                {
                    "error": "Invalid credentials"
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.email_verified:
            return Response(
                {
                    "error": (
                        "Please verify your email first"
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        refresh = RefreshToken.for_user(user)

        refresh["user_id"] = str(user.id)
        refresh["email"] = user.email
        refresh["role"] = user.role
        refresh["display_name"] = user.display_name
        refresh["auth_provider"] = user.auth_provider

        access = refresh.access_token

        response = Response(
            {
                "access": str(access),
                "message": "Login successful",
            },
            status=status.HTTP_200_OK,
        )

        response.set_cookie(
            key=settings.REFRESH_COOKIE_NAME,
            value=str(refresh),
            max_age=settings.REFRESH_COOKIE_MAX_AGE,
            httponly=True,
            secure=settings.REFRESH_COOKIE_SECURE,
            samesite=settings.REFRESH_COOKIE_SAMESITE,
            path="/token/refresh/",
        )

        return response


# ------------------------------ GOOGLE LOGIN ---------------------------------------
class GoogleLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        credential = request.data.get("credential")

        if not credential:
            return Response(
                {
                    "error": (
                        "Google credential required"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from google.oauth2 import id_token
            from google.auth.transport import requests

            google_data = (
                id_token.verify_oauth2_token(
                    credential,
                    requests.Request(),
                    settings.GOOGLE_CLIENT_ID,
                )
            )

        except Exception:
            return Response(
                {
                    "error": (
                        "Invalid Google credential"
                    )
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if (
            google_data.get("aud")
            != settings.GOOGLE_CLIENT_ID
        ):
            return Response(
                {
                    "error": (
                        "Invalid Google client"
                    )
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        google_id = google_data.get("sub")
        email = google_data.get("email")
        email_verified = google_data.get(
            "email_verified",
            False,
        )

        if not google_id or not email:
            return Response(
                {
                    "error": (
                        "Invalid Google account data"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not email_verified:
            return Response(
                {
                    "error": (
                        "Google email is not verified"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = email.strip().lower()

        user = Users.objects.filter(
            google_id=google_id
        ).first()

        if not user:
            user = Users.objects.filter(
                email=email
            ).first()

        if not user:
            user = Users(
                email=email,
                google_id=google_id,
                email_verified=True,
                auth_provider="google",
            )

            user.set_password(
                secrets.token_urlsafe(32)
            )

            user.save()

        else:
            changed = False

            if not user.google_id:
                user.google_id = google_id
                changed = True

            if not user.email_verified:
                user.email_verified = True
                changed = True

            if user.auth_provider != "google":
                user.auth_provider = "google"
                changed = True

            if changed:
                user.save()

        refresh = RefreshToken.for_user(user)

        refresh["user_id"] = str(user.id)
        refresh["email"] = user.email
        refresh["role"] = user.role
        refresh["display_name"] = user.display_name
        refresh["auth_provider"] = user.auth_provider

        access = refresh.access_token

        response = Response(
            {
                "access": str(access),
                "message": (
                    "Google login successful"
                ),
            },
            status=status.HTTP_200_OK,
        )

        response.set_cookie(
            key=settings.REFRESH_COOKIE_NAME,
            value=str(refresh),
            max_age=settings.REFRESH_COOKIE_MAX_AGE,
            httponly=True,
            secure=settings.REFRESH_COOKIE_SECURE,
            samesite=settings.REFRESH_COOKIE_SAMESITE,
            path="/token/refresh/",
        )

        return response


# ------------------------------ TOKEN REFRESH ---------------------------------------
class TokenRefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.COOKIES.get(
            settings.REFRESH_COOKIE_NAME
        )

        if not refresh_token:
            return Response(
                {
                    "error": (
                        "Refresh token required"
                    )
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            refresh = RefreshToken(
                refresh_token
            )

            access = refresh.access_token

            access["user_id"] = (
                refresh.get("user_id")
            )

            access["email"] = (
                refresh.get("email")
            )

            access["role"] = (
                refresh.get("role")
            )

            access["display_name"] = (
                refresh.get("display_name")
            )

            access["auth_provider"] = (
                refresh.get("auth_provider")
            )

            return Response(
                {
                    "access": str(access)
                },
                status=status.HTTP_200_OK,
            )

        except TokenError:
            return Response(
                {
                    "error": (
                        "Invalid or expired "
                        "refresh token"
                    )
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )


# ------------------------------ LOGOUT ---------------------------------------
class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        response = Response(
            {
                "message": "Logged out successfully"
            },
            status=status.HTTP_200_OK,
        )

        response.delete_cookie(
            key=settings.REFRESH_COOKIE_NAME,
            path="/token/refresh/",
        )

        return response


# ------------------------------ FORGOT PASSWORD ---------------------------------------
class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data or {}

        email = data.get("email")
        new_password = data.get("new_password")

        if not email or not new_password:
            return Response(
                {
                    "error": (
                        "Email and new password "
                        "required"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = email.strip().lower()

        user = Users.objects.filter(
            email=email
        ).first()

        if not user:
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
                        "available for this account"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.email_verified:
            return Response(
                {
                    "error": (
                        "Please verify your email first"
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if user.check_password(new_password):
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

        if user.change_password_otp_locked_until:
            if (
                user.change_password_otp_locked_until
                > timezone.now()
            ):
                return otp_locked_response(
                    user.change_password_otp_locked_until
                )

        if not user.can_resend_change_password_otp():
            return Response(
                {
                    "error": (
                        "Please wait before "
                        "requesting another OTP"
                    ),
                    "wait_seconds": 60,
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        raw_otp = (
            user.generate_change_password_otp()
        )

        send_email_task.delay(
            user.email,
            raw_otp,
        )

        return Response(
            {
                "status": "otp_sent",
                "message": (
                    "Password reset OTP sent "
                    "to your email"
                ),
                "wait_seconds": 60,
            },
            status=status.HTTP_200_OK,
        )

    def put(self, request):
        data = request.data or {}

        email = data.get("email")
        otp = data.get("otp")
        new_password = data.get("new_password")

        if not email or not otp or not new_password:
            return Response(
                {
                    "error": (
                        "Email, OTP and new password "
                        "required"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = email.strip().lower()

        user = Users.objects.filter(
            email=email
        ).first()

        if not user:
            return Response(
                {
                    "error": "Account not found"
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if user.change_password_otp_locked_until:
            if (
                user.change_password_otp_locked_until
                > timezone.now()
            ):
                return otp_locked_response(
                    user.change_password_otp_locked_until
                )

        if not user.verify_change_password_otp(
            otp
        ):
            return Response(
                {
                    "error": (
                        "Invalid or expired OTP"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user.check_password(new_password):
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

        user.set_password(new_password)
        user.save()

        return Response(
            {
                "message": (
                    "Password reset successfully"
                )
            },
            status=status.HTTP_200_OK,
        )
    
# ------------------------------ CHANGE PASSWORD ---------------------------------------
class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data or {}

        current_password = data.get("current_password")
        new_password = data.get("new_password")

        if not current_password or not new_password:
            return Response(
                {
                    "error": (
                        "Current password and new password "
                        "are required"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user

        if not user.check_password(current_password):
            return Response(
                {
                    "error": "Current password is incorrect"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user.check_password(new_password):
            return Response(
                {
                    "error": (
                        "New password must be different "
                        "from your current password"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user.change_password_otp_locked_until:
            if (
                user.change_password_otp_locked_until
                > timezone.now()
            ):
                return otp_locked_response(
                    user.change_password_otp_locked_until
                )

        if not user.can_resend_change_password_otp():
            return Response(
                {
                    "error": (
                        "Please wait before requesting "
                        "another OTP"
                    ),
                    "wait_seconds": 60,
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        raw_otp = user.generate_change_password_otp()

        send_email_task.delay(
            user.email,
            raw_otp,
        )

        return Response(
            {
                "status": "otp_sent",
                "message": (
                    "Password change OTP sent "
                    "to your email"
                ),
                "wait_seconds": 60,
            },
            status=status.HTTP_200_OK,
        )

    def put(self, request):
        data = request.data or {}

        otp = data.get("otp")
        new_password = data.get("new_password")

        if not otp or not new_password:
            return Response(
                {
                    "error": "OTP and new password required"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user

        if user.change_password_otp_locked_until:
            if (
                user.change_password_otp_locked_until
                > timezone.now()
            ):
                return otp_locked_response(
                    user.change_password_otp_locked_until
                )

        if not user.verify_change_password_otp(otp):
            return Response(
                {
                    "error": "Invalid or expired OTP"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user.check_password(new_password):
            return Response(
                {
                    "error": (
                        "New password must be different "
                        "from your current password"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save()

        return Response(
            {
                "message": "Password changed successfully"
            },
            status=status.HTTP_200_OK,
        )

    
# ------------------------------ DELETE ACCOUNT ---------------------------------------
class DeleteAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        if user.delete_account_otp_locked_until:
            if (
                user.delete_account_otp_locked_until
                > timezone.now()
            ):
                return otp_locked_response(
                    user.delete_account_otp_locked_until
                )

        if not user.can_resend_delete_account_otp():
            return Response(
                {
                    "error": (
                        "Please wait before "
                        "requesting another OTP"
                    ),
                    "wait_seconds": 60,
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        raw_otp = (
            user.generate_delete_account_otp()
        )

        send_email_task.delay(
            user.email,
            raw_otp,
        )

        return Response(
            {
                "status": "otp_sent",
                "message": (
                    "Account deletion OTP sent "
                    "to your email"
                ),
                "wait_seconds": 60,
            },
            status=status.HTTP_200_OK,
        )

    def delete(self, request):
        data = request.data or {}

        otp = data.get("otp")

        if not otp:
            return Response(
                {
                    "error": "OTP required"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user

        if user.delete_account_otp_locked_until:
            if (
                user.delete_account_otp_locked_until
                > timezone.now()
            ):
                return otp_locked_response(
                    user.delete_account_otp_locked_until
                )

        if not user.verify_delete_account_otp(
            otp
        ):
            return Response(
                {
                    "error": (
                        "Invalid or expired OTP"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        response = Response(
            {
                "message": (
                    "Account deleted successfully"
                )
            },
            status=status.HTTP_200_OK,
        )

        user.delete()

        response.delete_cookie(
            key=settings.REFRESH_COOKIE_NAME,
            path="/token/refresh/",
        )

        return response