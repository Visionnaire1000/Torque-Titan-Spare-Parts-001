import hashlib
import secrets
import uuid
import re

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractBaseUser
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Avg
from django.utils import timezone



# ------------------------------ USERS MANAGER -----------------------------------------
class UsersManager(BaseUserManager):

    def create_user(
        self,
        email,
        password=None,
        **extra_fields
    ):

        if not email:
            raise ValueError(
                "Email is required"
            )

        email = (
            email
            .lower()
            .strip()
        )

        user = self.model(
            email=email,
            **extra_fields
        )

        if password:
            user.set_password(password)

        user.save(
            using=self._db
        )

        return user

    def create_superuser(
        self,
        email,
        password,
        **extra_fields
    ):

        if not password:
            raise ValueError(
                "Superuser password is required"
            )

        extra_fields.setdefault(
            "role",
            "super_admin"
        )

        extra_fields.setdefault(
            "is_staff",
            True
        )

        extra_fields.setdefault(
            "is_superuser",
            True
        )

        extra_fields.setdefault(
            "is_active",
            True
        )

        user = self.create_user(
            email=email,
            password=password,
            **extra_fields
        )

        return user


# ------------------------------ USERS MODEL ------------------------------------------
class Users(AbstractBaseUser):

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    email = models.EmailField(
        unique=True
    )

    # ------------------------------ AUTH PROVIDER -------------------------------
    auth_provider = models.CharField(
        max_length=20,
        choices=[
            ("local", "Local"),
            ("google", "Google"),
        ],
        default="local",
    )

    google_id = models.CharField(
        max_length=255,
        unique=True,
        null=True,
        blank=True,
    )

    # ------------------------------ INITIAL ADMIN PASSWORD -----------------------
    initial_password_expires = models.DateTimeField(
        null=True,
        blank=True,
    )

    initial_password_changed = models.BooleanField(
        default=False,
    )

    # ------------------------------ ROLE -----------------------------------------
    role = models.CharField(
        max_length=30,
        choices=[
            ("buyer", "Buyer"),
            ("admin", "Admin"),
            ("super_admin", "Super Admin"),
        ],
        default="buyer",
    )

    is_active = models.BooleanField(
        default=True
    )

    is_staff = models.BooleanField(
        default=False
    )

    # ------------------------------ EMAIL VERIFICATION --------------------------
    email_verified = models.BooleanField(
        default=False
    )

    email_otp_hash = models.CharField(
        max_length=255,
        null=True,
        blank=True
    )

    email_otp_expires = models.DateTimeField(
        null=True,
        blank=True
    )

    email_otp_last_sent = models.DateTimeField(
        null=True,
        blank=True
    )

    email_otp_resend_count = models.IntegerField(
        default=0
    )

    email_otp_attempts = models.IntegerField(
        default=0
    )

    email_otp_locked_until = models.DateTimeField(
        null=True,
        blank=True
    )

    # ------------------------------ CHANGE PASSWORD / FORGOT PASSWORD OTP -------
    change_password_otp_hash = models.CharField(
        max_length=255,
        null=True,
        blank=True
    )

    change_password_otp_expires = models.DateTimeField(
        null=True,
        blank=True
    )

    change_password_otp_last_sent = models.DateTimeField(
        null=True,
        blank=True
    )

    change_password_otp_resend_count = models.IntegerField(
        default=0
    )

    change_password_otp_attempts = models.IntegerField(
        default=0
    )

    change_password_otp_locked_until = models.DateTimeField(
        null=True,
        blank=True
    )

    # ------------------------------ DELETE ACCOUNT OTP --------------------------
    delete_account_otp_hash = models.CharField(
        max_length=255,
        null=True,
        blank=True
    )

    delete_account_otp_expires = models.DateTimeField(
        null=True,
        blank=True
    )

    delete_account_otp_last_sent = models.DateTimeField(
        null=True,
        blank=True
    )

    delete_account_otp_resend_count = models.IntegerField(
        default=0
    )

    delete_account_otp_attempts = models.IntegerField(
        default=0
    )

    delete_account_otp_locked_until = models.DateTimeField(
        null=True,
        blank=True
    )

    # ------------------------------ OTP CONSTANTS -------------------------------
    OTP_EXPIRY_MINUTES = 5

    OTP_RESEND_COOLDOWN_SECONDS = 60

    MAX_OTP_RESENDS = 5

    MAX_OTP_ATTEMPTS = 5

    OTP_LOCK_MINUTES = 5

    INITIAL_PASSWORD_EXPIRY_HOURS = 12

    # ------------------------------ AUTH CONFIGURATION --------------------------
    USERNAME_FIELD = "email"

    REQUIRED_FIELDS = []

    objects = UsersManager()

    class Meta:
        db_table = "users"

    # ------------------------------ VALIDATION ----------------------------------
    def clean(self):

        if (
            not self.email
            or "@" not in self.email
        ):
            raise ValidationError(
                "Invalid email address"
            )

        self.email = (
            self.email
            .lower()
            .strip()
        )

    # ------------------------------ INITIAL ADMIN PASSWORD -----------------------
    def set_initial_admin_password_expiry(self):

        if self.role not in [
            "admin",
            "super_admin",
        ]:
            return

        self.initial_password_expires = (
            timezone.now()
            + timedelta(
                hours=self.INITIAL_PASSWORD_EXPIRY_HOURS
            )
        )

        self.initial_password_changed = False

        self.save(
            update_fields=[
                "initial_password_expires",
                "initial_password_changed",
            ]
        )

    def has_expired_initial_password(self):

        if self.role not in [
            "admin",
            "super_admin",
        ]:
            return False

        if self.initial_password_changed:
            return False

        if not self.initial_password_expires:
            return False

        return timezone.now() >= (
            self.initial_password_expires
        )

    def mark_initial_password_changed(self):

        self.initial_password_changed = True
        self.initial_password_expires = None

        self.save(
            update_fields=[
                "initial_password_changed",
                "initial_password_expires",
            ]
        )

    # ------------------------------ OTP HASH ------------------------------------
    def _hash_otp(
        self,
        otp: str
    ) -> str:

        return hashlib.sha256(
            otp.encode()
        ).hexdigest()

    def _generate_otp(self) -> str:

        return str(
            secrets.randbelow(900000)
            + 100000
        )

    # ------------------------------ GENERIC OTP GENERATION -----------------------
    def _generate_action_otp(
        self,
        hash_field: str,
        expires_field: str,
        last_sent_field: str,
        resend_count_field: str,
        attempts_field: str,
        locked_until_field: str,
    ):

        raw_otp = self._generate_otp()

        now = timezone.now()

        setattr(
            self,
            hash_field,
            self._hash_otp(raw_otp)
        )

        setattr(
            self,
            expires_field,
            now + timedelta(
                minutes=self.OTP_EXPIRY_MINUTES
            )
        )

        setattr(
            self,
            last_sent_field,
            now
        )

        setattr(
            self,
            resend_count_field,
            (
                getattr(
                    self,
                    resend_count_field
                )
                or 0
            ) + 1
        )

        setattr(
            self,
            attempts_field,
            0
        )

        setattr(
            self,
            locked_until_field,
            None
        )

        self.save(
            update_fields=[
                hash_field,
                expires_field,
                last_sent_field,
                resend_count_field,
                attempts_field,
                locked_until_field,
            ]
        )

        return raw_otp

    # ------------------------------ EMAIL OTP -----------------------------------
    def generate_email_otp(self):

        return self._generate_action_otp(
            "email_otp_hash",
            "email_otp_expires",
            "email_otp_last_sent",
            "email_otp_resend_count",
            "email_otp_attempts",
            "email_otp_locked_until",
        )

    # ------------------------------ CHANGE PASSWORD / FORGOT PASSWORD OTP --------
    def generate_change_password_otp(self):

        return self._generate_action_otp(
            "change_password_otp_hash",
            "change_password_otp_expires",
            "change_password_otp_last_sent",
            "change_password_otp_resend_count",
            "change_password_otp_attempts",
            "change_password_otp_locked_until",
        )

    # ------------------------------ DELETE ACCOUNT OTP --------------------------
    def generate_delete_account_otp(self):

        return self._generate_action_otp(
            "delete_account_otp_hash",
            "delete_account_otp_expires",
            "delete_account_otp_last_sent",
            "delete_account_otp_resend_count",
            "delete_account_otp_attempts",
            "delete_account_otp_locked_until",
        )

    # ------------------------------ GENERIC RESEND CONTROL -----------------------
    def _can_resend_otp(
        self,
        last_sent_field: str,
        resend_count_field: str,
        cooldown_seconds=None,
        max_resends=None,
    ):

        cooldown_seconds = (
            cooldown_seconds
            if cooldown_seconds is not None
            else self.OTP_RESEND_COOLDOWN_SECONDS
        )

        max_resends = (
            max_resends
            if max_resends is not None
            else self.MAX_OTP_RESENDS
        )

        now = timezone.now()

        resend_count = getattr(
            self,
            resend_count_field
        ) or 0

        if resend_count >= max_resends:
            return False, 0

        last_sent = getattr(
            self,
            last_sent_field
        )

        if not last_sent:
            return True, 0

        elapsed = (
            now - last_sent
        ).total_seconds()

        if elapsed >= cooldown_seconds:
            return True, 0

        remaining = max(
            0,
            int(
                cooldown_seconds - elapsed
            )
        )

        return False, remaining

    # ------------------------------ EMAIL RESEND CONTROL ------------------------
    def can_resend_email_otp(
        self,
        cooldown_seconds=None,
        max_resends=None
    ):

        return self._can_resend_otp(
            "email_otp_last_sent",
            "email_otp_resend_count",
            cooldown_seconds,
            max_resends,
        )

    # ------------------------------ CHANGE PASSWORD RESEND CONTROL --------------
    def can_resend_change_password_otp(
        self,
        cooldown_seconds=None,
        max_resends=None
    ):

        return self._can_resend_otp(
            "change_password_otp_last_sent",
            "change_password_otp_resend_count",
            cooldown_seconds,
            max_resends,
        )

    # ------------------------------ DELETE ACCOUNT RESEND CONTROL ---------------
    def can_resend_delete_account_otp(
        self,
        cooldown_seconds=None,
        max_resends=None
    ):

        return self._can_resend_otp(
            "delete_account_otp_last_sent",
            "delete_account_otp_resend_count",
            cooldown_seconds,
            max_resends,
        )

    # ------------------------------ EMAIL OTP VERIFY ----------------------------
    def verify_email_otp(
        self,
        otp: str
    ):

        now = timezone.now()

        if (
            self.email_otp_locked_until
            and now < self.email_otp_locked_until
        ):
            return "locked"

        if (
            not self.email_otp_hash
            or not self.email_otp_expires
        ):
            return False

        if self.email_otp_expires < now:
            return False

        if (
            self._hash_otp(otp)
            != self.email_otp_hash
        ):

            self.email_otp_attempts += 1

            if (
                self.email_otp_attempts
                >= self.MAX_OTP_ATTEMPTS
            ):
                self.email_otp_locked_until = (
                    now
                    + timedelta(
                        minutes=self.OTP_LOCK_MINUTES
                    )
                )

            self.save(
                update_fields=[
                    "email_otp_attempts",
                    "email_otp_locked_until",
                ]
            )

            return False

        self.email_verified = True
        self.email_otp_hash = None
        self.email_otp_expires = None
        self.email_otp_last_sent = None
        self.email_otp_resend_count = 0
        self.email_otp_attempts = 0
        self.email_otp_locked_until = None

        self.save(
            update_fields=[
                "email_verified",
                "email_otp_hash",
                "email_otp_expires",
                "email_otp_last_sent",
                "email_otp_resend_count",
                "email_otp_attempts",
                "email_otp_locked_until",
            ]
        )

        return True

    # ------------------------------ CHANGE PASSWORD OTP VERIFY ------------------
    def verify_change_password_otp(
        self,
        otp: str
    ):

        now = timezone.now()

        if (
            self.change_password_otp_locked_until
            and now < self.change_password_otp_locked_until
        ):
            return "locked"

        if (
            not self.change_password_otp_hash
            or not self.change_password_otp_expires
        ):
            return False

        if self.change_password_otp_expires < now:
            return False

        if (
            self._hash_otp(otp)
            != self.change_password_otp_hash
        ):

            self.change_password_otp_attempts += 1

            if (
                self.change_password_otp_attempts
                >= self.MAX_OTP_ATTEMPTS
            ):
                self.change_password_otp_locked_until = (
                    now
                    + timedelta(
                        minutes=self.OTP_LOCK_MINUTES
                    )
                )

            self.save(
                update_fields=[
                    "change_password_otp_attempts",
                    "change_password_otp_locked_until",
                ]
            )

            return False

        self.change_password_otp_hash = None
        self.change_password_otp_expires = None
        self.change_password_otp_last_sent = None
        self.change_password_otp_resend_count = 0
        self.change_password_otp_attempts = 0
        self.change_password_otp_locked_until = None

        self.save(
            update_fields=[
                "change_password_otp_hash",
                "change_password_otp_expires",
                "change_password_otp_last_sent",
                "change_password_otp_resend_count",
                "change_password_otp_attempts",
                "change_password_otp_locked_until",
            ]
        )

        return True

    # ------------------------------ DELETE ACCOUNT OTP VERIFY -------------------
    def verify_delete_account_otp(
        self,
        otp: str
    ):

        now = timezone.now()

        if (
            self.delete_account_otp_locked_until
            and now < self.delete_account_otp_locked_until
        ):
            return "locked"

        if (
            not self.delete_account_otp_hash
            or not self.delete_account_otp_expires
        ):
            return False

        if self.delete_account_otp_expires < now:
            return False

        if (
            self._hash_otp(otp)
            != self.delete_account_otp_hash
        ):

            self.delete_account_otp_attempts += 1

            if (
                self.delete_account_otp_attempts
                >= self.MAX_OTP_ATTEMPTS
            ):
                self.delete_account_otp_locked_until = (
                    now
                    + timedelta(
                        minutes=self.OTP_LOCK_MINUTES
                    )
                )

            self.save(
                update_fields=[
                    "delete_account_otp_attempts",
                    "delete_account_otp_locked_until",
                ]
            )

            return False

        self.delete_account_otp_hash = None
        self.delete_account_otp_expires = None
        self.delete_account_otp_last_sent = None
        self.delete_account_otp_resend_count = 0
        self.delete_account_otp_attempts = 0
        self.delete_account_otp_locked_until = None

        self.save(
            update_fields=[
                "delete_account_otp_hash",
                "delete_account_otp_expires",
                "delete_account_otp_last_sent",
                "delete_account_otp_resend_count",
                "delete_account_otp_attempts",
                "delete_account_otp_locked_until",
            ]
        )

        return True

    # ------------------------------ DISPLAY NAME --------------------------------
    @property
    def display_name(self):

        if self.email:

            name_part = (
                self.email
                .split("@")[0]
            )

            name_part = (
                name_part
                .replace(".", " ")
                .replace("_", " ")
            )

            first_name = (
                name_part
                .split()[0]
            )

            return first_name.capitalize()

        return "User"
    
    # ------------------------------ SAVE -----------------------------------------
    def save(
        self,
        *args,
        **kwargs
    ):

        if self.email:

            self.email = (
                self.email
                .lower()
                .strip()
            )

        self.full_clean()

        super().save(
            *args,
            **kwargs
        )

    # ------------------------------ STRING ---------------------------------------
    def __str__(self):

        return self.email


# ------------------------------ PROFILE MODEL ----------------------------------------
class Profile(models.Model):

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    user = models.OneToOneField(
        Users,
        on_delete=models.CASCADE,
        related_name="profile",
    )

    first_name = models.CharField(
        max_length=100
    )

    last_name = models.CharField(
        max_length=100
    )

    phone_number = models.CharField(
        max_length=20,
        unique=True,
    )

    national_id = models.CharField(
        max_length=50,
        unique=True,
    )

    class Meta:
        db_table = "profiles"

    def clean(self):

        super().clean()

        self.phone_number = (
            self.phone_number
            or ""
        ).strip()

        self.national_id = (
            self.national_id
            or ""
        ).strip()

        phone_pattern = (
            r"^\+?[1-9]\d{7,14}$"
        )

        national_id_pattern = (
            r"^[A-Za-z0-9]"
            r"[A-Za-z0-9\s\-/]{3,49}$"
        )

        if not re.fullmatch(
            phone_pattern,
            self.phone_number,
        ):
            raise ValidationError(
                {
                    "phone_number": (
                        "Phone number must be a valid "
                        "international phone number with "
                        "8 to 15 digits."
                    )
                }
            )

        if not re.fullmatch(
            national_id_pattern,
            self.national_id,
        ):
            raise ValidationError(
                {
                    "national_id": (
                        "National ID must be 4 to 50 "
                        "characters and contain only "
                        "letters, numbers, spaces, "
                        "hyphens, or slashes."
                    )
                }
            )

    def __str__(self):

        return (
            f"{self.first_name} "
            f"{self.last_name}"
        )


# ------------------------------ LOGIN DEVICE MODEL ----------------------------------------
class LoginDevice(models.Model):
    user = models.ForeignKey(
        Users,
        on_delete=models.CASCADE,
        related_name="login_devices",
    )
    device_identifier = models.CharField(
        max_length=128,
    )
    user_agent = models.TextField(
        blank=True,
    )
    last_ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
    )
    first_seen_at = models.DateTimeField(
        auto_now_add=True,
    )
    last_seen_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "user",
                    "device_identifier",
                ],
                name="unique_user_device",
            )
        ]


# ------------------------------ LOGIN DEVICE RECORD MODEL ----------------------------------------
class LoginRecord(models.Model):
    user = models.ForeignKey(
        Users,
        on_delete=models.CASCADE,
        related_name="login_records",
    )
    device = models.ForeignKey(
        LoginDevice,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="login_records",
    )
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(
        blank=True,
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
    )


# ------------------------------ ADDRESS MODEL ----------------------------------------
class Address(models.Model):

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    user = models.OneToOneField(
        Users,
        on_delete=models.CASCADE,
        related_name="address",
    )

    street = models.CharField(
        max_length=255
    )

    city = models.CharField(
        max_length=100
    )

    postal_code = models.CharField(
        max_length=30,
        null=True,
        blank=True
    )

    country = models.CharField(
        max_length=100
    )

    created_at = models.DateTimeField(
        default=timezone.now
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        db_table = "addresses"

    def clean(self):

        super().clean()

        self.street = (
            self.street
            or ""
        ).strip()

        self.city = (
            self.city
            or ""
        ).strip()

        self.postal_code = (
            self.postal_code
            or ""
        ).strip()

        self.country = (
            self.country
            or ""
        ).strip()

        street_pattern = (
            r"^(?=.*[A-Za-z0-9])"
            r"[A-Za-z0-9À-ÖØ-öø-ÿ]"
            r"[A-Za-z0-9À-ÖØ-öø-ÿ\s.,'#/&\-]{2,254}$"
        )

        city_pattern = (
            r"^(?=.*[A-Za-zÀ-ÖØ-öø-ÿ])"
            r"[A-Za-zÀ-ÖØ-öø-ÿ\s.'\-]{2,99}$"
        )

        postal_code_pattern = (
            r"^[A-Za-z0-9][A-Za-z0-9\s\-]{1,29}$"
        )

        country_pattern = (
            r"^(?=.*[A-Za-zÀ-ÖØ-öø-ÿ])"
            r"[A-Za-zÀ-ÖØ-öø-ÿ\s.'\-]{2,99}$"
        )

        if not self.street:

            raise ValidationError(
                {
                    "street": (
                        "Street address is required."
                    )
                }
            )

        if not re.fullmatch(
            street_pattern,
            self.street,
        ):

            raise ValidationError(
                {
                    "street": (
                        "Please enter a valid street "
                        "address."
                    )
                }
            )

        if not self.city:

            raise ValidationError(
                {
                    "city": (
                        "City is required."
                    )
                }
            )

        if not re.fullmatch(
            city_pattern,
            self.city,
        ):

            raise ValidationError(
                {
                    "city": (
                        "Please enter a valid city."
                    )
                }
            )

        if self.postal_code:

            if not re.fullmatch(
                postal_code_pattern,
                self.postal_code,
            ):

                raise ValidationError(
                    {
                        "postal_code": (
                            "Please enter a valid "
                            "postal code."
                        )
                    }
                )

        if not self.country:

            raise ValidationError(
                {
                    "country": (
                        "Country is required."
                    )
                }
            )

        if not re.fullmatch(
            country_pattern,
            self.country,
        ):

            raise ValidationError(
                {
                    "country": (
                        "Please enter a valid country."
                    )
                }
            )

    def __str__(self):

        return (
            f"{self.user.email} - "
            f"{self.street}, "
            f"{self.city}"
        )
    

# ------------------------------ SPAREPARTS MODEL -------------------------------------
class SpareParts(models.Model):

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    category = models.CharField(
        max_length=255
    )

    vehicle_type = models.CharField(
        max_length=50
    )

    brand = models.CharField(
        max_length=255
    )

    colour = models.CharField(
        max_length=100,
        null=True,
        blank=True
    )

    buying_price = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    marked_price = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00")
    )

    discount_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00")
    )

    image = models.CharField(
        max_length=500,
        null=True,
        blank=True
    )

    description = models.TextField(
        null=True,
        blank=True
    )

    average_rating = models.FloatField(
        default=0.0
    )

    total_reviews = models.IntegerField(
        default=0
    )

    VALID_VEHICLE_TYPES = [
        "sedan",
        "suv",
        "bus",
        "truck",
    ]

    class Meta:
        db_table = "spareparts"

    def clean(self):

        if self.vehicle_type:

            self.vehicle_type = (
                self.vehicle_type.lower()
            )

            if (
                self.vehicle_type
                not in self.VALID_VEHICLE_TYPES
            ):
                raise ValidationError(
                    "Vehicle type must be one of: "
                    + ", ".join(
                        self.VALID_VEHICLE_TYPES
                    )
                )

    def calculate_discount(self):

        if (
            self.marked_price
            and self.buying_price
        ):

            self.discount_amount = (
                self.marked_price
                - self.buying_price
            ).quantize(
                Decimal("0.01")
            )

            self.discount_percentage = (
                (
                    self.discount_amount
                    / self.marked_price
                ) * Decimal("100")
            ).quantize(
                Decimal("0.01")
            ) if self.marked_price > 0 else Decimal("0.00")

        else:

            self.discount_amount = Decimal("0.00")
            self.discount_percentage = Decimal("0.00")

    def update_review_stats(self):

        reviews = self.reviews.all()

        self.total_reviews = reviews.count()

        average = (
            reviews
            .filter(
                rating__gte=1,
                rating__lte=5
            )
            .aggregate(
                average=Avg("rating")
            )["average"]
        )

        self.average_rating = (
            round(float(average), 1)
            if average is not None
            else 0.0
        )

        self.save(
            update_fields=[
                "total_reviews",
                "average_rating",
            ]
        )

    def save(self, *args, **kwargs):

        self.full_clean()

        self.calculate_discount()

        super().save(
            *args,
            **kwargs
        )

    def __str__(self):

        return (
            f"{self.brand} - "
            f"{self.category}"
        )


# ------------------------------ CART ITEMS MODEL -------------------------------------
class CartItems(models.Model):

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    user = models.ForeignKey(
        Users,
        on_delete=models.CASCADE,
        related_name="cart_items",
    )

    sparepart = models.ForeignKey(
        SpareParts,
        on_delete=models.CASCADE,
        related_name="cart_items",
    )

    quantity = models.PositiveIntegerField(
        default=1
    )

    created_at = models.DateTimeField(
        default=timezone.now
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        db_table = "cart_items"

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "user",
                    "sparepart",
                ],
                name="unique_user_cart_sparepart",
            )
        ]

    def clean(self):

        if self.quantity < 1:

            raise ValidationError(
                "Cart quantity must be at least 1"
            )

    def save(self, *args, **kwargs):

        self.full_clean()

        super().save(
            *args,
            **kwargs
        )

    def __str__(self):

        return (
            f"{self.user.email} - "
            f"{self.sparepart.brand} x "
            f"{self.quantity}"
        )


# ------------------------------ REVIEWS MODEL ----------------------------------------
class Reviews(models.Model):

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    user = models.ForeignKey(
        Users,
        on_delete=models.CASCADE,
        related_name="reviews",
    )

    sparepart = models.ForeignKey(
        SpareParts,
        on_delete=models.CASCADE,
        related_name="reviews",
    )

    comment = models.TextField(
        null=True,
        blank=True,
    )

    rating = models.IntegerField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        default=timezone.now,
    )

    class Meta:
        db_table = "reviews"

    def clean(self):

        if (
            self.rating is not None
            and not 1 <= self.rating <= 5
        ):
            raise ValidationError(
                "Rating must be between 1 and 5"
            )

        if (
            self.rating is None
            and not self.comment
        ):
            raise ValidationError(
                "Review must have a rating or comment"
            )

    @property
    def total_likes(self):

        return self.likes.filter(
            is_like=True
        ).count()

    @property
    def total_dislikes(self):

        return self.likes.filter(
            is_like=False
        ).count()

    @property
    def user_display_name(self):

        if not self.user:
            return "User"

        if self.user.role in [
            "admin",
            "super_admin",
        ]:
            return self.user.display_name

        if hasattr(
            self.user,
            "profile"
        ):

            full_name = (
                f"{self.user.profile.first_name} "
                f"{self.user.profile.last_name}"
            ).strip()

            if full_name:
                return full_name

        return "User"

    def save(self, *args, **kwargs):

        self.full_clean()

        super().save(
            *args,
            **kwargs
        )

        self.sparepart.update_review_stats()

    def delete(self, *args, **kwargs):

        sparepart = self.sparepart

        result = super().delete(
            *args,
            **kwargs
        )

        sparepart.update_review_stats()

        return result

    def __str__(self):

        return (
            f"Review by "
            f"{self.user_display_name}"
        )


# ------------------------------ REVIEW REACTIONS MODEL -------------------------------
class ReviewReactions(models.Model):

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    user = models.ForeignKey(
        Users,
        on_delete=models.CASCADE,
        related_name="likes",
    )

    review = models.ForeignKey(
        Reviews,
        on_delete=models.CASCADE,
        related_name="likes",
    )

    is_like = models.BooleanField()

    class Meta:
        db_table = "review_reactions"

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "user",
                    "review",
                ],
                name="unique_user_review_reaction",
            )
        ]

    def clean(self):

        if not isinstance(
            self.is_like,
            bool,
        ):
            raise ValidationError(
                "is_like must be a boolean"
            )

    def save(self, *args, **kwargs):

        self.full_clean()

        super().save(
            *args,
            **kwargs
        )

    def delete(self, *args, **kwargs):

        return super().delete(
            *args,
            **kwargs
        )

    def __str__(self):

        return (
            f"{self.user.email} - "
            f"{'Like' if self.is_like else 'Dislike'}"
        )


# ------------------------------ ORDERS MODEL -----------------------------------------
class Orders(models.Model):

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    user = models.ForeignKey(
        Users,
        on_delete=models.CASCADE,
        related_name="orders"
    )

    address = models.ForeignKey(
        Address,
        on_delete=models.PROTECT,
        related_name="orders",
    )

    status = models.CharField(
        max_length=50,
        default="pending"
    )

    paid = models.BooleanField(
        default=False
    )

    payment_method = models.CharField(
        max_length=20,
        null=True,
        blank=True,
    )

    payment_reference = models.CharField(
        max_length=255,
        null=True,
        blank=True,
    
    )
    created_at = models.DateTimeField(
        default=timezone.now
    )

    total_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00")
    )

    paypal_exchange_rate = models.DecimalField(
        max_digits=12,
        decimal_places=6,
        null=True,
        blank=True,
    )

    paypal_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )

    shipped_at = models.DateTimeField(
        null=True,
        blank=True
    )

    delivered_at = models.DateTimeField(
        null=True,
        blank=True
    )

    class Meta:
        db_table = "orders"

    def calculate_total(self):

        self.total_price = sum(
            (
                item.subtotal
                if item.subtotal is not None
                else Decimal("0.00")
            )
            for item in self.order_items.all()
        ).quantize(
            Decimal("0.01")
        )

        self.save(
            update_fields=[
                "total_price"
            ]
        )

        return self.total_price

    def __str__(self):

        return f"Order {self.id}"


# ------------------------------ ORDER ITEMS MODEL ------------------------------------
class OrderItems(models.Model):

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    order = models.ForeignKey(
        Orders,
        on_delete=models.CASCADE,
        related_name="order_items"
    )

    sparepart = models.ForeignKey(
        SpareParts,
        on_delete=models.CASCADE,
        related_name="order_items"
    )

    quantity = models.PositiveIntegerField(
        default=1
    )

    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    subtotal = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    class Meta:
        db_table = "order_items"

    def clean(self):

        if self.quantity < 1:

            raise ValidationError(
                "Order quantity must be at least 1"
            )

    def calculate_subtotal(
        self,
        use_sparepart_price_if_empty=True
    ):

        if (
            use_sparepart_price_if_empty
            and (
                self.unit_price is None
                or self.unit_price == Decimal("0.00")
            )
            and self.sparepart
        ):

            self.unit_price = (
                self.sparepart.marked_price
                - self.sparepart.discount_amount
            ).quantize(
                Decimal("0.01")
            )

        self.subtotal = (
            self.unit_price
            * self.quantity
        ).quantize(
            Decimal("0.01")
        )

        return self.subtotal

    def save(self, *args, **kwargs):

        self.full_clean()

        self.calculate_subtotal(
            use_sparepart_price_if_empty=True
        )

        super().save(
            *args,
            **kwargs
        )

        self.order.calculate_total()

    def delete(self, *args, **kwargs):

        order = self.order

        result = super().delete(
            *args,
            **kwargs
        )

        order.calculate_total()

        return result

    def __str__(self):

        return (
            f"{self.sparepart.brand} "
            f"x {self.quantity}"
        )