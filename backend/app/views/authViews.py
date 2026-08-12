from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status

from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from app.models import (
    Users
)
from utils.tasks import send_email_task


# ============================================================
# AUTH
# ============================================================

class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data

        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            return Response(
                {
                    "error": "Email and password required",
                    "wait_seconds": 0,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing_user = Users.objects.filter(email=email).first()

        if existing_user:
            return Response(
                {
                    "error": "Email already exists. Use resend to get OTP again.",
                    "wait_seconds": 0,
                },
                status=status.HTTP_409_CONFLICT,
            )

        try:
            with transaction.atomic():
                user = Users(
                    email=email,
                    email_verified=False,
                )

                user.set_password(password)

                raw_otp = user.generate_email_otp()

                user.save()

            send_email_task.delay(user.email, raw_otp)

            return Response(
                {
                    "status": "success",
                    "message": "Verification code sent to your email",
                    "wait_seconds": Users.OTP_RESEND_COOLDOWN_SECONDS,
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception as exc:
            print("Register error:", exc)

            return Response(
                {
                    "error": "Internal server error",
                    "wait_seconds": 0,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ResendOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data or {}

        email = data.get("email")

        user = None
        is_logged_in = False

        # ----------------------------------------------------
        # Logged-in user
        # ----------------------------------------------------

        if request.user and request.user.is_authenticated:
            user = request.user
            is_logged_in = True

        # ----------------------------------------------------
        # Registration fallback
        # ----------------------------------------------------

        if not user and email:
            user = Users.objects.filter(email=email).first()

        if not user:
            return Response(
                {
                    "status": "error",
                    "message": "User not found",
                    "wait_seconds": 0,
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # Don't resend registration OTP for verified users.
        # Logged-in users can still use this for password change.
        if not is_logged_in and user.email_verified:
            return Response(
                {
                    "status": "info",
                    "message": "Email already verified",
                    "wait_seconds": 0,
                },
                status=status.HTTP_200_OK,
            )

        # ----------------------------------------------------
        # Cooldown / resend limit
        # ----------------------------------------------------

        can_resend, wait_seconds = user.can_resend_otp(
            cooldown_seconds=Users.OTP_RESEND_COOLDOWN_SECONDS,
            max_resends=Users.MAX_OTP_RESENDS,
        )

        if not can_resend:
            return Response(
                {
                    "status": "error",
                    "message": (
                        "Too many failed attempts. "
                        "OTP locked for 15 minutes"
                    ),
                    "wait_seconds": wait_seconds,
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # ----------------------------------------------------
        # Generate new OTP
        # ----------------------------------------------------

        raw_otp = user.generate_email_otp()
        user.save()

        send_email_task.delay(user.email, raw_otp)

        return Response(
            {
                "status": "success",
                "message": "New OTP sent to your email",
                "wait_seconds": Users.OTP_RESEND_COOLDOWN_SECONDS,
            },
            status=status.HTTP_200_OK,
        )


class VerifyAccountView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data

        email = data.get("email")
        otp = data.get("otp")

        user = Users.objects.filter(email=email).first()

        if not user:
            return Response(
                {"error": "User not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        result = user.verify_email_otp(otp)

        if result == "locked":
            return Response(
                {
                    "error": (
                        "Too many failed attempts. "
                        "OTP locked for 15 minutes."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if not result:
            user.save()

            return Response(
                {"error": "Invalid or expired code"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.save()

        return Response(
            {"message": "Account verified successfully"},
            status=status.HTTP_200_OK,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data

        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            return Response(
                {"error": "Email and password required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = Users.objects.filter(email=email).first()

        if not user or not user.check_password(password):
            return Response(
                {"error": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.email_verified:
            return Response(
                {"error": "Please verify your email first"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # ----------------------------------------------------
        # SimpleJWT
        # ----------------------------------------------------

        refresh = RefreshToken.for_user(user)
        access = refresh.access_token

        # Match your Flask 15-minute access token lifetime.
        access.set_exp(
            lifetime=timedelta(minutes=15)
        )

        return Response(
            {
                "access_token": str(access),
                "refresh_token": str(refresh),
                "role": user.role,
                "display_name": user.display_name,
            },
            status=status.HTTP_200_OK,
        )


class TokenRefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.data.get("refresh_token")

        if not refresh_token:
            return Response(
                {"error": "Refresh token required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            refresh = RefreshToken(refresh_token)

            access = refresh.access_token

            access.set_exp(
                lifetime=timedelta(minutes=15)
            )

            return Response(
                {
                    "access_token": str(access),
                },
                status=status.HTTP_200_OK,
            )

        except TokenError:
            return Response(
                {"error": "Invalid or expired refresh token"},
                status=status.HTTP_401_UNAUTHORIZED,
            )


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data or {}

        current_password = data.get("current_password")
        otp = data.get("otp")
        new_password = data.get("new_password")

        if not current_password:
            return Response(
                {"error": "Current password is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user

        if not user.check_password(current_password):
            return Response(
                {"error": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # ----------------------------------------------------
        # OTP lock check
        # ----------------------------------------------------

        if user.otp_locked_until:
            now = timezone.now()

            if now < user.otp_locked_until:
                remaining = int(
                    (
                        user.otp_locked_until - now
                    ).total_seconds()
                )

                return Response(
                    {
                        "error": (
                            "Too many failed attempts. "
                            "OTP locked for 15 minutes"
                        ),
                        "wait_seconds": max(remaining, 0),
                    },
                    status=423,
                )

        # ----------------------------------------------------
        # Send OTP
        # ----------------------------------------------------

        if not otp and not new_password:
            raw_otp = user.generate_email_otp()
            user.save()

            send_email_task.delay(user.email, raw_otp)

            return Response(
                {
                    "status": "otp_sent",
                    "message": "OTP sent to your email",
                    "wait_seconds": (
                        Users.OTP_RESEND_COOLDOWN_SECONDS
                    ),
                },
                status=status.HTTP_200_OK,
            )

        # ----------------------------------------------------
        # Verify OTP + change password
        # ----------------------------------------------------

        if not otp or not new_password:
            return Response(
                {
                    "error": (
                        "OTP and new password are required"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = user.verify_email_otp(otp)
        user.save()

        if result == "locked":
            if user.otp_locked_until:
                remaining = int(
                    (
                        user.otp_locked_until
                        - timezone.now()
                    ).total_seconds()
                )
            else:
                remaining = Users.OTP_RESEND_COOLDOWN_SECONDS

            return Response(
                {
                    "error": (
                        "Too many failed attempts. "
                        "OTP locked for 15 minutes"
                    ),
                    "wait_seconds": max(remaining, 0),
                },
                status=423,
            )

        if not result:
            return Response(
                {"error": "Invalid or expired OTP"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            user.set_password(new_password)
            user.save()

            return Response(
                {
                    "status": "success",
                    "message": "Password updated successfully",
                },
                status=status.HTTP_200_OK,
            )

        except Exception as exc:
            print("Password change error:", exc)

            return Response(
                {"error": "Internal server error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class DeleteAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        data = request.data or {}

        password = data.get("password")

        if not password:
            return Response(
                {"error": "Password confirmation required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user

        if not user.check_password(password):
            return Response(
                {"error": "Invalid password"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            user.delete()

            return Response(
                {
                    "status": "success",
                    "message": "Account deleted",
                },
                status=status.HTTP_200_OK,
            )

        except Exception as exc:
            print("Delete error:", exc)

            return Response(
                {"error": "Internal server error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
