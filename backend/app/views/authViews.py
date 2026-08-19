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


# ------------------------------AUTHENTICATION---------------------------------------
class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data or {}

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

        email = email.strip().lower()

        if Users.objects.filter(email=email).exists():
            return Response(
                {
                    "error": (
                        "Email already exists. "
                        "Use resend to get OTP again."
                    ),
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

            send_email_task.delay(
                user.email,
                raw_otp,
            )

            return Response(
                {
                    "status": "success",
                    "message": (
                        "Verification code sent "
                        "to your email"
                    ),
                    "wait_seconds": (
                        Users.OTP_RESEND_COOLDOWN_SECONDS
                    ),
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


# ------------------------------RESEND OTP---------------------------------------
class ResendOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data or {}

        email = data.get("email")

        user = None
        is_logged_in = False

        # Logged-in user
        if (
            request.user
            and request.user.is_authenticated
        ):
            user = request.user
            is_logged_in = True

        # Registration fallback
        if not user and email:
            email = email.strip().lower()

            user = Users.objects.filter(
                email=email
            ).first()

        if not user:
            return Response(
                {
                    "status": "error",
                    "message": "User not found",
                    "wait_seconds": 0,
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if not is_logged_in and user.email_verified:
            return Response(
                {
                    "status": "info",
                    "message": "Email already verified",
                    "wait_seconds": 0,
                },
                status=status.HTTP_200_OK,
            )

        can_resend, wait_seconds = (
            user.can_resend_otp(
                cooldown_seconds=(
                    Users.OTP_RESEND_COOLDOWN_SECONDS
                ),
                max_resends=Users.MAX_OTP_RESENDS,
            )
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

        raw_otp = user.generate_email_otp()

        send_email_task.delay(
            user.email,
            raw_otp,
        )

        return Response(
            {
                "status": "success",
                "message": "New OTP sent to your email",
                "wait_seconds": (
                    Users.OTP_RESEND_COOLDOWN_SECONDS
                ),
            },
            status=status.HTTP_200_OK,
        )


# ------------------------------VERIFY ACCOUNT---------------------------------------
class VerifyAccountView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data or {}

        email = data.get("email")
        otp = data.get("otp")

        if not email or not otp:
            return Response(
                {
                    "error": "Email and OTP are required"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = email.strip().lower()

        user = Users.objects.filter(
            email=email
        ).first()

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
            return Response(
                {
                    "error": "Invalid or expired code"
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
                    "error": "Email and password required"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = email.strip().lower()

        user = Users.objects.filter(
            email=email
        ).first()

        if not user or not user.check_password(password):
            return Response(
                {"error": "Invalid credentials"},
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

        access = refresh.access_token

        response = Response(
            {
                "access_token": str(access),
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
        data = request.data or {}

        credential = data.get("credential")

        if not credential:
            return Response(
                {
                    "error": "Google credential required"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:

            # VERIFY GOOGLE ID TOKEN
            from google.oauth2 import id_token
            from google.auth.transport import requests

            google_user = id_token.verify_oauth2_token(
                credential,
                requests.Request(),
                settings.GOOGLE_CLIENT_ID,
            )

            # VERIFY AUDIENCE
            if (
                google_user.get("aud")
                != settings.GOOGLE_CLIENT_ID
            ):
                return Response(
                    {
                        "error": "Invalid Google client"
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            # GET GOOGLE ACCOUNT DATA
            google_id = google_user.get("sub")
            email = google_user.get("email")
            email_verified = google_user.get(
                "email_verified",
                False,
            )

            if not google_id or not email:
                return Response(
                    {
                        "error": (
                            "Google account information "
                            "is incomplete"
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
                    status=status.HTTP_403_FORBIDDEN,
                )

            email = email.strip().lower()

            # FIND USER BY GOOGLE ID FIRST
            user = Users.objects.filter(
                google_id=google_id
            ).first()

            # FALLBACK TO VERIFIED EMAIL
            if not user:
                user = Users.objects.filter(
                    email=email
                ).first()

            # CREATES NEW USER
            if not user:

                user = Users(
                    email=email,
                    google_id=google_id,
                    email_verified=True,
                    auth_provider="google",
                )

                # Generates a random password so the Google account has no usable password known to the user
                random_password = secrets.token_urlsafe(64)

                user.set_password(random_password)

                user.save()

            # EXISTING USER
            else:

                # If this email was previously registered locally,securely link the Google account to it
                if not user.google_id:
                    user.google_id = google_id

                # Google has verified this email.
                user.email_verified = True

                # continues to support both password login and Google login.
                update_fields = [
                    "google_id",
                    "email_verified",
                ]

                user.save(
                    update_fields=update_fields
                )

            # (CREATE REFRESH TOKEN)
            refresh = RefreshToken.for_user(user)

            # (ADDS STANDARD JWT CLAIMS)
            refresh["user_id"] = str(user.id)
            refresh["email"] = user.email
            refresh["role"] = user.role
            refresh["display_name"] = user.display_name

            access = refresh.access_token

            # (RESPONSE)
            response = Response(
                {
                    "access_token": str(access),
                },
                status=status.HTTP_200_OK,
            )

            # (HTTPONLY REFRESH COOKIE)
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

        except ValueError:

            # Google token is malformed, expired, has the wrong audience, etc.
            return Response(
                {
                    "error": (
                        "Invalid or expired Google credential"
                    )
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        except Exception as exc:
            print(
                "Google login error:",
                exc,
            )

            return Response(
                {
                    "error": "Google authentication failed"
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        

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
                    "error": "Refresh token required"
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            refresh = RefreshToken(refresh_token)

            access = refresh.access_token

            access["user_id"] = refresh.get(
                "user_id"
            )

            access["email"] = refresh.get(
                "email"
            )

            access["role"] = refresh.get(
                "role"
            )

            access["display_name"] = refresh.get(
                "display_name"
            )

            return Response(
                {
                    "access_token": str(access)
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


# ------------------------------LOGOUT---------------------------------------
class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        response = Response(
            {
                "status": "success",
                "message": "Logged out successfully",
            },
            status=status.HTTP_200_OK,
        )

        response.delete_cookie(
            key=settings.REFRESH_COOKIE_NAME,
            path="/token/refresh/",
        )

        return response


# ------------------------------CHANGE PASSWORD---------------------------------------
class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data or {}

        current_password = data.get(
            "current_password"
        )

        otp = data.get("otp")

        new_password = data.get(
            "new_password"
        )

        if not current_password:
            return Response(
                {
                    "error": (
                        "Current password is required"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user

        # ------------------------------ VERIFY PASSWORD ------------------------------
        if not user.check_password(
            current_password
        ):
            return Response(
                {
                    "error": "Invalid credentials"
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # ------------------------------ OTP LOCK -------------------------------------
        if user.otp_locked_until:

            now = timezone.now()

            if now < user.otp_locked_until:

                remaining = int(
                    (
                        user.otp_locked_until
                        - now
                    ).total_seconds()
                )

                return Response(
                    {
                        "error": (
                            "Too many failed attempts. "
                            "OTP locked for 15 minutes"
                        ),
                        "wait_seconds": max(
                            remaining,
                            0,
                        ),
                    },
                    status=423,
                )

        # ------------------------------ SEND OTP -------------------------------------
        if not otp and not new_password:

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
                        "OTP sent to your email"
                    ),
                    "wait_seconds": (
                        Users.OTP_RESEND_COOLDOWN_SECONDS
                    ),
                },
                status=status.HTTP_200_OK,
            )

        # ------------------------------ VALIDATE INPUT -------------------------------
        if not otp or not new_password:

            return Response(
                {
                    "error": (
                        "OTP and new password "
                        "are required"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ------------------------------ VERIFY OTP -----------------------------------
        result = (
            user.verify_change_password_otp(
                otp
            )
        )

        if result == "locked":

            remaining = 0

            if user.otp_locked_until:

                remaining = int(
                    (
                        user.otp_locked_until
                        - timezone.now()
                    ).total_seconds()
                )

            return Response(
                {
                    "error": (
                        "Too many failed attempts. "
                        "OTP locked for 15 minutes"
                    ),
                    "wait_seconds": max(
                        remaining,
                        0,
                    ),
                },
                status=423,
            )

        if not result:

            return Response(
                {
                    "error": (
                        "Invalid or expired OTP"
                    )
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # ------------------------------ CHANGE PASSWORD ------------------------------
        try:

            user.set_password(
                new_password
            )

            user.save()

            return Response(
                {
                    "status": "success",
                    "message": (
                        "Password updated successfully"
                    ),
                },
                status=status.HTTP_200_OK,
            )

        except Exception as exc:

            print(
                "Password change error:",
                exc,
            )

            return Response(
                {
                    "error": "Internal server error"
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

class DeleteAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        # Check OTP lock
        if user.otp_locked_until:
            now = timezone.now()

            if now < user.otp_locked_until:
                remaining = int(
                    (user.otp_locked_until - now).total_seconds()
                )

                return Response(
                    {
                        "error": "Too many failed attempts. OTP locked for 15 minutes",
                        "wait_seconds": max(remaining, 0),
                    },
                    status=423,
                )

        # Generate and send deletion OTP
        raw_otp = user.generate_delete_account_otp()

        send_email_task.delay(
            user.email,
            raw_otp,
        )

        return Response(
            {
                "status": "otp_sent",
                "message": "OTP sent to your email",
                "wait_seconds": Users.OTP_RESEND_COOLDOWN_SECONDS,
            },
            status=status.HTTP_200_OK,
        )

    def delete(self, request):
        user = request.user
        data = request.data or {}

        otp = data.get("otp")

        if not otp:
            return Response(
                {"error": "OTP is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check OTP lock
        if user.otp_locked_until:
            now = timezone.now()

            if now < user.otp_locked_until:
                remaining = int(
                    (user.otp_locked_until - now).total_seconds()
                )

                return Response(
                    {
                        "error": "Too many failed attempts. OTP locked for 15 minutes",
                        "wait_seconds": max(remaining, 0),
                    },
                    status=423,
                )

        # Verify OTP
        result = user.verify_delete_account_otp(otp)

        if result == "locked":
            remaining = 0

            if user.otp_locked_until:
                remaining = int(
                    (
                        user.otp_locked_until
                        - timezone.now()
                    ).total_seconds()
                )

            return Response(
                {
                    "error": "Too many failed attempts. OTP locked for 15 minutes",
                    "wait_seconds": max(remaining, 0),
                },
                status=423,
            )

        if not result:
            return Response(
                {"error": "Invalid or expired OTP"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Delete account
        try:
            user.delete()

            response = Response(
                {
                    "status": "success",
                    "message": "Account deleted",
                },
                status=status.HTTP_200_OK,
            )

            response.delete_cookie(
                key=settings.REFRESH_COOKIE_NAME,
                path="/token/refresh/",
            )

            return response

        except Exception as exc:
            print("Delete error:", exc)

            return Response(
                {"error": "Internal server error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )