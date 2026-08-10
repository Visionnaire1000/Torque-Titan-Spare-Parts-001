import hashlib
import secrets
import uuid
from datetime import timedelta

from django.contrib.auth.hashers import make_password, check_password
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Avg
from django.utils import timezone


# (UUID helper)
def generate_uuid():
    return str(uuid.uuid4())

# ------------------------------USERS MODEL------------------------------------------
class Users(models.Model):

    id = models.CharField(
        max_length=36,
        primary_key=True,
        default=generate_uuid,
        editable=False
    )

    email = models.EmailField(
        unique=True
    )

    password_hash = models.CharField(
        max_length=255
    )

    role = models.CharField(
        max_length=30,
        default="buyer"
    )

    # (Email verification)
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

    otp_last_sent = models.DateTimeField(
        null=True,
        blank=True
    )

    otp_resend_count = models.IntegerField(
        default=0
    )

    otp_attempts = models.IntegerField(
        default=0
    )

    otp_locked_until = models.DateTimeField(
        null=True,
        blank=True
    )

    # (OTP Constants)
    OTP_EXPIRY_MINUTES = 10
    OTP_RESEND_COOLDOWN_SECONDS = 60
    MAX_OTP_RESENDS = 5
    MAX_OTP_ATTEMPTS = 5
    OTP_LOCK_MINUTES = 15

    class Meta:
        db_table = "users"

    # (VALIDATION)
    def clean(self):
        if not self.email or "@" not in self.email:
            raise ValidationError("Invalid email address")

        self.email = self.email.lower().strip()

    # (PASSWORD)
    def set_password(self, password: str):
        self.password_hash = make_password(password)

    def check_password(self, password: str) -> bool:
        return check_password(
            password,
            self.password_hash
        )

    # (OTP)
    def _hash_otp(self, otp: str) -> str:
        return hashlib.sha256(
            otp.encode()
        ).hexdigest()

    def generate_email_otp(self):

        raw_otp = str(
            secrets.randbelow(900000) + 100000
        )

        self.email_otp_hash = self._hash_otp(
            raw_otp
        )

        self.email_otp_expires = (
            timezone.now()
            + timedelta(
                minutes=self.OTP_EXPIRY_MINUTES
            )
        )

        self.otp_last_sent = timezone.now()

        self.otp_resend_count = (
            self.otp_resend_count or 0
        ) + 1

        self.otp_attempts = 0
        self.otp_locked_until = None

        self.save(
            update_fields=[
                "email_otp_hash",
                "email_otp_expires",
                "otp_last_sent",
                "otp_resend_count",
                "otp_attempts",
                "otp_locked_until",
            ]
        )

        return raw_otp

    def can_resend_otp(
        self,
        cooldown_seconds=60,
        max_resends=5
    ):

        now = timezone.now()

        if self.otp_resend_count >= max_resends:
            return False, 0

        if not self.otp_last_sent:
            return True, 0

        elapsed = (
            now - self.otp_last_sent
        ).total_seconds()

        if elapsed >= cooldown_seconds:
            return True, 0

        remaining = int(
            cooldown_seconds - elapsed
        )

        return False, remaining

    def verify_email_otp(self, otp: str):

        now = timezone.now()

        if (
            self.otp_locked_until
            and now < self.otp_locked_until
        ):
            return "locked"

        if (
            not self.email_otp_hash
            or not self.email_otp_expires
        ):
            return False

        if self.email_otp_expires < now:
            return False

        if self._hash_otp(otp) != self.email_otp_hash:

            self.otp_attempts += 1

            if self.otp_attempts >= self.MAX_OTP_ATTEMPTS:
                self.otp_locked_until = (
                    now
                    + timedelta(
                        minutes=self.OTP_LOCK_MINUTES
                    )
                )

            self.save(
                update_fields=[
                    "otp_attempts",
                    "otp_locked_until",
                ]
            )

            return False

        # (Successful verification0
        self.email_verified = True
        self.email_otp_hash = None
        self.email_otp_expires = None
        self.otp_attempts = 0
        self.otp_resend_count = 0
        self.otp_locked_until = None

        self.save(
            update_fields=[
                "email_verified",
                "email_otp_hash",
                "email_otp_expires",
                "otp_attempts",
                "otp_resend_count",
                "otp_locked_until",
            ]
        )

        return True

    # (DISPLAY NAME)
    @property
    def display_name(self):

        if (
            hasattr(self, "first_name")
            and hasattr(self, "last_name")
            and self.first_name
            and self.last_name
        ):
            return f"{self.first_name} {self.last_name}"

        if self.email:

            name_part = self.email.split("@")[0]

            name_part = (
                name_part
                .replace(".", " ")
                .replace("_", " ")
            )

            return " ".join(
                word.capitalize()
                for word in name_part.split()
            )

        return "User"

    def save(self, *args, **kwargs):

        if self.email:
            self.email = self.email.lower().strip()

        self.full_clean()

        super().save(*args, **kwargs)

    def __str__(self):
        return self.email

    
# ------------------------------SPAREPARTS MODEL------------------------------------------
class SpareParts(models.Model):

    id = models.CharField(
        max_length=36,
        primary_key=True,
        default=generate_uuid,
        editable=False
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

    buying_price = models.FloatField()

    marked_price = models.FloatField()

    discount_amount = models.FloatField(
        default=0.0
    )

    discount_percentage = models.FloatField(
        default=0.0
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

        if self.marked_price and self.buying_price:

            self.discount_amount = round(
                self.marked_price
                - self.buying_price,
                2
            )

            self.discount_percentage = round(
                (
                    self.discount_amount
                    / self.marked_price
                ) * 100,
                2
            ) if self.marked_price > 0 else 0.0

        else:

            self.discount_amount = 0.0
            self.discount_percentage = 0.0

    def update_review_stats(self):

        reviews = self.reviews.all()

        self.total_reviews = reviews.count()

        average = reviews.filter(
            rating__gte=1,
            rating__lte=5
        ).aggregate(
            average=Avg("rating")
        )["average"]

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

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.brand} - {self.category}"


    
# ------------------------------REVIEWS MODEL------------------------------------------
class Reviews(models.Model):

    id = models.CharField(
        max_length=36,
        primary_key=True,
        default=generate_uuid,
        editable=False
    )

    user = models.ForeignKey(
        Users,
        on_delete=models.CASCADE,
        related_name="reviews"
    )

    sparepart = models.ForeignKey(
        SpareParts,
        on_delete=models.CASCADE,
        related_name="reviews"
    )

    comment = models.TextField(
        null=True,
        blank=True
    )

    rating = models.IntegerField(
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(
        default=timezone.now
    )

    total_likes = models.IntegerField(
        default=0
    )

    total_dislikes = models.IntegerField(
        default=0
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

    def update_reaction_stats(self):

        self.total_likes = self.likes.filter(
            is_like=True
        ).count()

        self.total_dislikes = self.likes.filter(
            is_like=False
        ).count()

        self.save(
            update_fields=[
                "total_likes",
                "total_dislikes",
            ]
        )

    # (USER DISPLAY NAME)
    @property
    def user_display_name(self):

        return (
            self.user.display_name
            if self.user
            else "User"
        )

    def save(self, *args, **kwargs):

        self.full_clean()

        super().save(*args, **kwargs)

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
        return f"Review by {self.user_display_name}"

# ------------------------------REVIEW REACTIONS MODEL------------------------------------------
class ReviewReactions(models.Model):

    id = models.CharField(
        max_length=36,
        primary_key=True,
        default=generate_uuid,
        editable=False
    )

    user = models.ForeignKey(
        Users,
        on_delete=models.CASCADE,
        related_name="likes"
    )

    review = models.ForeignKey(
        Reviews,
        on_delete=models.CASCADE,
        related_name="likes"
    )

    is_like = models.BooleanField()

    class Meta:
        db_table = "review_reactions"

    # (Validation)
    def clean(self):

        if not isinstance(
            self.is_like,
            bool
        ):
            raise ValidationError(
                "is_like must be True or False"
            )

    def save(self, *args, **kwargs):

        self.full_clean()

        super().save(*args, **kwargs)

        self.review.update_reaction_stats()
        self.review.sparepart.update_review_stats()

    def delete(self, *args, **kwargs):

        review = self.review

        result = super().delete(
            *args,
            **kwargs
        )

        review.update_reaction_stats()
        review.sparepart.update_review_stats()

        return result

    def __str__(self):

        return (
            f"{self.user.email} - "
            f"{'Like' if self.is_like else 'Dislike'}"
        )

    
# ------------------------------ORDERS MODEL------------------------------------------
class Orders(models.Model):

    id = models.CharField(
        max_length=36,
        primary_key=True,
        default=generate_uuid,
        editable=False
    )

    user = models.ForeignKey(
        Users,
        on_delete=models.CASCADE,
        related_name="orders"
    )

    status = models.CharField(
        max_length=50,
        default="pending"
    )

    paid = models.BooleanField(
        default=False
    )

    created_at = models.DateTimeField(
        default=timezone.now
    )

    total_price = models.FloatField(
        default=0.0
    )

    shipped_at = models.DateTimeField(
        null=True,
        blank=True
    )

    delivered_at = models.DateTimeField(
        null=True,
        blank=True
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

    class Meta:
        db_table = "orders"

    def calculate_total(self):

        self.total_price = round(
            sum(
                item.subtotal
                for item in self.order_items.all()
            ),
            2
        )

        self.save(
            update_fields=[
                "total_price"
            ]
        )

        return self.total_price

    def __str__(self):
        return f"Order {self.id}"


# ------------------------------ORDER ITEMS MODEL------------------------------------------
class OrderItems(models.Model):

    id = models.CharField(
        max_length=36,
        primary_key=True,
        default=generate_uuid,
        editable=False
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

    quantity = models.IntegerField(
        default=1
    )

    unit_price = models.FloatField()

    subtotal = models.FloatField()

    class Meta:
        db_table = "order_items"

    def calculate_subtotal(
        self,
        use_sparepart_price_if_empty=True
    ):

        if (
            use_sparepart_price_if_empty
            and (
                self.unit_price is None
                or self.unit_price == 0
            )
            and self.sparepart
        ):

            self.unit_price = round(
                self.sparepart.marked_price
                - self.sparepart.discount_amount,
                2
            )

        self.subtotal = round(
            self.unit_price * self.quantity,
            2
        )

        return self.subtotal

    # --------------------------------SAVE-----------------------------------------
    def save(self, *args, **kwargs):

        self.calculate_subtotal(
            use_sparepart_price_if_empty=True
        )

        super().save(*args, **kwargs)

        self.order.calculate_total()

    
    # --------------------------------DELETE----------------------------------------
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

