from decimal import Decimal, InvalidOperation

from datetime import timedelta

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone

from django.db.models import Sum
from utils.tasks import (send_order_status_email_task,)
from django.db.models.functions import (
    TruncDay,
    TruncWeek,
    TruncMonth,
    TruncYear,
)

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import serializers, status

from utils.cloudflare import upload_image_to_r2

from app.models import (
    Users,
    Orders,
    OrderItems,
    SpareParts,
    Reviews,
)


from utils.tasks import ( send_account_unlocked_email_task, )


# --------------------------- DECIMAL HELPERS ----------------------------------------------
def money_to_decimal(value):
    if value is None:
        return Decimal("0.00")

    try:
        return Decimal(str(value)).quantize(
            Decimal("0.01")
        )

    except (
        TypeError,
        ValueError,
        InvalidOperation,
    ):
        raise ValueError("Invalid monetary value")


def money_to_float(value):
    return float(
        money_to_decimal(value)
    )


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
        None
    )

    if profile:
        full_name = (
            f"{profile.first_name} "
            f"{profile.last_name}"
        ).strip()

        if full_name:
            return full_name

    return "User"


# --------------------------- SERIALIZERS ----------------------------------------------
class SparePartsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SpareParts
        fields = "__all__"


class ReviewsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reviews
        fields = "__all__"



# --------------------------- ADMIN MANAGEMENT ----------------------------------------------
class CreateAdminView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current_user = request.user

        # --------------------------- SUPER ADMIN CHECK ---------------------------
        if current_user.role != "super_admin":
            return Response(
                {
                    "error": (
                        "Only super_admin can create "
                        "admin or super_admin accounts"
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        data = request.data or {}

        email = data.get("email")
        password = data.get("password")
        role = data.get(
            "role",
            "admin",
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

        email = str(email).strip().lower()

        if not email:
            return Response(
                {
                    "error": "Email cannot be empty"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --------------------------- ROLE VALIDATION ---------------------------
        if role not in [
            "admin",
            "super_admin",
        ]:
            return Response(
                {
                    "error": (
                        "Invalid role. Role must be "
                        "admin or super_admin."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --------------------------- EMAIL CHECK ---------------------------
        if Users.objects.filter(
            email=email
        ).exists():
            return Response(
                {
                    "error": "Email already exists"
                },
                status=status.HTTP_409_CONFLICT,
            )

        try:
            with transaction.atomic():
                admin_user = Users(
                    email=email,
                    role=role,

                    email_verified=True,

                    email_otp_hash=None,
                    email_otp_expires=None,
                    email_otp_last_sent=None,
                    email_otp_resend_count=0,
                    email_otp_attempts=0,
                    email_otp_locked_until=None,

                    # Initial password must be changed within the expiry period.
                    initial_password_changed=False,
                )

                admin_user.set_password(
                    password
                )

                admin_user.set_initial_admin_password_expiry()

                admin_user.save()

            # --------------------------- SEND CREDENTIALS EMAIL ---------------------------
            from utils.tasks import (
                send_admin_credentials_email_task,
            )

            send_admin_credentials_email_task.delay(
                admin_user.email,
                password,
                admin_user.role,
            )

            return Response(
                {
                    "message": (
                        f"{role} account created and "
                        "verified successfully. "
                        "Initial password must be changed "
                        "within 12 hours."
                    ),
                    "id": str(
                        admin_user.id
                    ),
                    "email": admin_user.email,
                    "display_name": (
                        admin_user.display_name
                    ),
                    "role": admin_user.role,
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception as exc:
            print(
                "Create admin error:",
                exc,
            )

            return Response(
                {
                    "error": "Internal server error"
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ListAdminsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        current_user = request.user

        if current_user.role != "super_admin":
            return Response(
                {
                    "error": (
                        "Only super_admin can "
                        "list admins"
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        admins = (
            Users.objects
            .filter(
                role__in=[
                    "admin",
                    "super_admin",
                ]
            )
            .exclude(
                id=current_user.id
            )
            .order_by(
                "role",
                "email",
            )
        )

        admins_list = []

        for admin in admins:
            admins_list.append(
                {
                    "id": str(admin.id),
                    "email": admin.email,
                    "display_name": admin.display_name,
                    "role": admin.role,
                    "is_active": admin.is_active,
                    "initial_password_expired": (
                        admin.has_expired_initial_password()
                    ),
                    "is_locked": not admin.is_active,
                }
            )

        return Response(
            {
                "admins": admins_list
            },
            status=status.HTTP_200_OK,
        )


class UnlockAdminAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, admin_id):
        current_user = request.user

        if current_user.role != "super_admin":
            return Response(
                {
                    "error": (
                        "Only super_admin can "
                        "unlock accounts"
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        admin_user = Users.objects.filter(
            pk=admin_id,
            role__in=[
                "admin",
                "super_admin",
            ],
        ).first()

        if not admin_user:
            return Response(
                {
                    "error": (
                        "Admin account not found"
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if admin_user.id == current_user.id:
            return Response(
                {
                    "error": (
                        "You cannot unlock your "
                        "own account here."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        admin_user.is_active = True

        if not admin_user.initial_password_changed:
            admin_user.initial_password_expires = (
                timezone.now()
                + timedelta(
                    hours=Users.INITIAL_PASSWORD_EXPIRY_HOURS
                )
            )

        admin_user.save(
            update_fields=[
                "is_active",
                "initial_password_expires",
            ]
        )

        send_account_unlocked_email_task.delay(
            admin_user.email,
            admin_user.role,
        )

        return Response(
            {
                "message": (
                    f"{admin_user.role} "
                    f"{admin_user.email} "
                    "unlocked successfully"
                ),
                "id": str(admin_user.id),
                "email": admin_user.email,
                "role": admin_user.role,
                "is_active": admin_user.is_active,
                "initial_password_expired": (
                    admin_user.has_expired_initial_password()
                ),
                "is_locked": not admin_user.is_active,
            },
            status=status.HTTP_200_OK,
        )


class DeleteAdminView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, admin_id):
        current_user = request.user

        if current_user.role != "super_admin":
            return Response(
                {
                    "error": (
                        "Only super_admin can "
                        "delete admins"
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        admin_user = Users.objects.filter(
            pk=admin_id,
            role__in=[
                "admin",
                "super_admin",
            ],
        ).first()

        if not admin_user:
            return Response(
                {
                    "error": (
                        "Admin not found or cannot "
                        "delete this user"
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if admin_user.id == current_user.id:
            return Response(
                {
                    "error": (
                        "You cannot delete your "
                        "own account here."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = admin_user.email
        role = admin_user.role

        admin_user.delete()

        return Response(
            {
                "message": (
                    f"{role} {email} "
                    "deleted successfully"
                )
            },
            status=status.HTTP_200_OK,
        )



# ------------------------------ Spare Parts Management -------------------------------------------
class AdminSparePartsView(APIView):
    permission_classes = [IsAuthenticated]

    parser_classes = [
        MultiPartParser,
        FormParser,
    ]

    def _check_admin(self, request):
        return request.user.role in [
            "admin",
            "super_admin",
        ]

    def _normalize_value(self, value):
        if value is None:
            return ""

        return str(value).strip()

    def _normalize_price(self, value):
        try:
            return Decimal(str(value))
        except (
            TypeError,
            ValueError,
            InvalidOperation,
        ):
            return None

    # ---------------- CREATE ----------------
    def post(self, request):
        if not self._check_admin(request):
            return Response(
                {
                    "error": "Admins only"
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        data = request.data

        try:
            # ---------------- REQUIRED FIELDS ----------------
            required_fields = [
                "category",
                "vehicle_type",
                "brand",
                "colour",
                "buying_price",
                "marked_price",
                "image",
            ]

            for field in required_fields:
                value = (
                    request.FILES.get(field)
                    if field == "image"
                    else data.get(field)
                )

                if value is None or (
                    field != "image"
                    and not str(value).strip()
                ):
                    return Response(
                        {
                            "error": (
                                f"{field.replace('_', ' ').capitalize()} "
                                "is required"
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            # ---------------- PRICE VALIDATION ----------------
            buying_price = self._normalize_price(
                data.get("buying_price")
            )

            marked_price = self._normalize_price(
                data.get("marked_price")
            )

            if (
                buying_price is None
                or marked_price is None
                or buying_price < 0
                or marked_price < 0
                or buying_price != buying_price.to_integral_value()
                or marked_price != marked_price.to_integral_value()
            ):
                return Response(
                    {
                        "error": (
                            "Buying price and marked price "
                            "must be valid whole numbers"
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # ---------------- IMAGE UPLOAD ----------------
            image_file = request.FILES.get("image")

            image_url = upload_image_to_r2(
                image_file
            )

            # ---------------- CREATE ----------------
            spare = SpareParts.objects.create(
                category=data.get("category"),
                vehicle_type=data.get("vehicle_type"),
                brand=data.get("brand"),
                colour=data.get("colour"),
                buying_price=buying_price,
                marked_price=marked_price,
                image=image_url,
                description=data.get("description"),
            )

            return Response(
                {
                    "message": (
                        "Spare part created "
                        "successfully"
                    ),
                    "sparepart": (
                        SparePartsSerializer(
                            spare
                        ).data
                    ),
                },
                status=status.HTTP_201_CREATED,
            )

        except ValueError as exc:
            return Response(
                {
                    "error": str(exc)
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as exc:
            return Response(
                {
                    "error": str(exc)
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    # ---------------- UPDATE ----------------
    def put(self, request, spare_id):
        if not self._check_admin(request):
            return Response(
                {
                    "error": "Admins only"
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        spare = get_object_or_404(
            SpareParts,
            id=spare_id,
        )

        data = request.data

        try:
            changes_detected = False

            # ---------------- TEXT FIELDS ----------------
            text_fields = [
                "category",
                "vehicle_type",
                "brand",
                "colour",
                "description",
            ]

            for field in text_fields:
                if field not in data:
                    continue

                new_value = self._normalize_value(
                    data.get(field)
                )

                current_value = self._normalize_value(
                    getattr(spare, field)
                )

                if new_value != current_value:
                    changes_detected = True
                    setattr(
                        spare,
                        field,
                        data.get(field),
                    )

            # ---------------- PRICE FIELDS ----------------
            price_fields = [
                "buying_price",
                "marked_price",
            ]

            for field in price_fields:
                if field not in data:
                    continue

                value = self._normalize_price(
                    data.get(field)
                )

                if (
                    value is None
                    or value < 0
                    or value != value.to_integral_value()
                ):
                    return Response(
                        {
                            "error": (
                                f"{field.replace('_', ' ').capitalize()} "
                                "must be a valid whole number"
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                current_value = self._normalize_price(
                    getattr(spare, field)
                )

                if value != current_value:
                    changes_detected = True
                    setattr(
                        spare,
                        field,
                        value,
                    )

            # ---------------- IMAGE FIELD ----------------
            image_file = request.FILES.get("image")

            if image_file:
                changes_detected = True

                image_url = upload_image_to_r2(
                    image_file
                )

                spare.image = image_url

            # ---------------- NO CHANGES ----------------
            if not changes_detected:
                return Response(
                    {
                        "error": (
                            "No changes detected. "
                            "Update at least one field "
                            "before saving."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # ---------------- SAVE ----------------
            spare.save()

            return Response(
                {
                    "message": (
                        "Spare part updated "
                        "successfully"
                    ),
                    "sparepart": (
                        SparePartsSerializer(
                            spare
                        ).data
                    ),
                },
                status=status.HTTP_200_OK,
            )

        except ValueError as exc:
            return Response(
                {
                    "error": str(exc)
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as exc:
            return Response(
                {
                    "error": str(exc)
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    # ---------------- DELETE ----------------
    def delete(self, request, spare_id):
        if not self._check_admin(request):
            return Response(
                {
                    "error": "Admins only"
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        spare = get_object_or_404(
            SpareParts,
            id=spare_id,
        )

        try:
            spare.delete()

            return Response(
                {
                    "message": (
                        "Spare part deleted "
                        "successfully"
                    )
                },
                status=status.HTTP_200_OK,
            )

        except Exception as exc:
            return Response(
                {
                    "error": str(exc)
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        
# --------------------------- ADMIN REVIEWS ----------------------------------------------
class AdminReviewsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        current_user = request.user

        if current_user.role not in [
            "admin",
            "super_admin",
        ]:
            return Response(
                {
                    "error": "Admins only"
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        reviews = (
            Reviews.objects
            .select_related(
                "user",
                "user__profile",
                "sparepart",
            )
            .prefetch_related(
                "likes",
                "likes__user",
                "likes__user__profile",
            )
            .order_by(
                "-created_at"
            )
        )

        result = []

        for review in reviews:
            review_dict = (
                ReviewsSerializer(
                    review
                ).data
            )

            review_dict["sparepart_id"] = (
                str(
                    review.sparepart_id
                )
            )

            sparepart = review.sparepart

            review_dict["sparepart_image"] = (
                sparepart.image
                if sparepart
                and sparepart.image
                else None
            )

            user = review.user

            review_dict["user_display_name"] = (
                get_user_display_name(user)
            )

            review_dict["user_email"] = (
                user.email
                if user
                else ""
            )

            review_dict["total_likes"] = (
                review.total_likes
            )

            review_dict["total_dislikes"] = (
                review.total_dislikes
            )

            review_dict["created_at"] = (
                review.created_at.isoformat()
                if review.created_at
                else None
            )

            reactions = review.likes.all()

            review_dict["likes"] = [
                {
                    "user_id": str(
                        reaction.user_id
                    ),
                    "user_display_name": (
                        get_user_display_name(
                            reaction.user
                        )
                    ),
                    "is_like": True,
                }
                for reaction in reactions
                if reaction.is_like
            ]

            review_dict["dislikes"] = [
                {
                    "user_id": str(
                        reaction.user_id
                    ),
                    "user_display_name": (
                        get_user_display_name(
                            reaction.user
                        )
                    ),
                    "is_like": False,
                }
                for reaction in reactions
                if not reaction.is_like
            ]

            result.append(
                review_dict
            )

        return Response(
            result,
            status=status.HTTP_200_OK,
        )


class AdminReviewsBySparePartView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, sparepart_id):
        current_user = request.user

        if current_user.role not in [
            "admin",
            "super_admin",
        ]:
            return Response(
                {
                    "error": "Unauthorized"
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        reviews = (
            Reviews.objects
            .select_related(
                "user",
                "user__profile",
            )
            .prefetch_related(
                "likes",
                "likes__user",
                "likes__user__profile",
            )
            .filter(
                sparepart_id=sparepart_id
            )
            .order_by(
                "-created_at"
            )
        )

        result = []

        for review in reviews:
            review_dict = (
                ReviewsSerializer(
                    review
                ).data
            )

            review_dict["sparepart_id"] = (
                str(
                    review.sparepart_id
                )
            )

            user = review.user

            review_dict["user_display_name"] = (
                get_user_display_name(user)
            )

            review_dict["user_email"] = (
                user.email
                if user
                else ""
            )

            review_dict["total_likes"] = (
                review.total_likes
            )

            review_dict["total_dislikes"] = (
                review.total_dislikes
            )

            review_dict["created_at"] = (
                review.created_at.isoformat()
                if review.created_at
                else None
            )

            reactions = review.likes.all()

            review_dict["likes"] = [
                {
                    "user_id": str(
                        reaction.user_id
                    ),
                    "user_display_name": (
                        get_user_display_name(
                            reaction.user
                        )
                    ),
                    "is_like": True,
                }
                for reaction in reactions
                if reaction.is_like
            ]

            review_dict["dislikes"] = [
                {
                    "user_id": str(
                        reaction.user_id
                    ),
                    "user_display_name": (
                        get_user_display_name(
                            reaction.user
                        )
                    ),
                    "is_like": False,
                }
                for reaction in reactions
                if not reaction.is_like
            ]

            result.append(
                review_dict
            )

        return Response(
            result,
            status=status.HTTP_200_OK,
        )


# --------------------------- ADMIN REVIEWS ANALYTICS ----------------------------------------------
class ReviewsAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        current_user = request.user

        if current_user.role not in [
            "admin",
            "super_admin",
        ]:
            return Response(
                {
                    "error": "Admins only"
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        spareparts = (
            SpareParts.objects
            .filter(
                average_rating__gt=0,
                total_reviews__gt=0,
            )
        )

        analytics = {}

        for sparepart in spareparts:
            vehicle_type = (
                sparepart.vehicle_type
            )

            category = (
                sparepart.category
            )

            brand = (
                sparepart.brand
            )

            key = (
                vehicle_type,
                category,
                brand,
            )

            if key not in analytics:
                analytics[key] = {
                    "vehicle_type": (
                        vehicle_type
                    ),
                    "category": category,
                    "brand": brand,
                    "total_reviews": 0,
                    "total_rating": 0.0,
                }

            total_reviews = (
                sparepart.total_reviews
            )

            average_rating = float(
                sparepart.average_rating or 0
            )

            analytics[key][
                "total_reviews"
            ] += total_reviews

            analytics[key][
                "total_rating"
            ] += (
                average_rating
                * total_reviews
            )

        grouped = {}

        for item in analytics.values():
            group_key = (
                item["vehicle_type"],
                item["category"],
            )

            if group_key not in grouped:
                grouped[group_key] = {
                    "vehicle_type": (
                        item["vehicle_type"]
                    ),
                    "category": (
                        item["category"]
                    ),
                    "brands": [],
                }

            total_reviews = (
                item["total_reviews"]
            )

            average_rating = (
                item["total_rating"]
                / total_reviews
                if total_reviews > 0
                else 0.0
            )

            grouped[group_key][
                "brands"
            ].append(
                {
                    "brand": item["brand"],
                    "average_rating": round(
                        average_rating,
                        1,
                    ),
                    "total_reviews": (
                        total_reviews
                    ),
                }
            )

        result = list(
            grouped.values()
        )

        for group in result:
            group["brands"].sort(
                key=lambda brand: (
                    -brand[
                        "average_rating"
                    ],
                    -brand[
                        "total_reviews"
                    ],
                    brand[
                        "brand"
                    ].lower(),
                )
            )

        result.sort(
            key=lambda group: (
                group[
                    "vehicle_type"
                ],
                group[
                    "category"
                ],
            )
        )

        return Response(
            result,
            status=status.HTTP_200_OK,
        )



# --------------------------- ADMIN ORDERS ----------------------------------------------
class AdminOrdersView(APIView):
    permission_classes = [IsAuthenticated]

    def _check_admin(self, request):
        return request.user.role in [
            "admin",
            "super_admin",
        ]

    # Get paid orders only
    def get(self, request):
        if not self._check_admin(request):
            return Response(
                {
                    "error": "Admins only"
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        orders = (
            Orders.objects
            .select_related(
                "user__profile",
                "address",
            )
            .prefetch_related(
                "order_items__sparepart"
            )
            .filter(
                paid=True
            )
            .exclude(
                status="expired"
            )
            .order_by(
                "-created_at"
            )
        )

        summary = []

        for order in orders:
            order_items = list(
                order.order_items.all()
            )

            total_price = sum(
                (
                    money_to_decimal(
                        item.subtotal
                    )
                    for item in order_items
                ),
                Decimal("0.00"),
            )

            total_quantity = sum(
                int(
                    item.quantity or 0
                )
                for item in order_items
            )

            # --------------------------- CUSTOMER PROFILE ---------------------------
            profile = getattr(
                order.user,
                "profile",
                None
            )

            if profile:
                customer_profile = {
                    "id": str(
                        profile.id
                    ),
                    "first_name": (
                        profile.first_name
                    ),
                    "last_name": (
                        profile.last_name
                    ),
                    "phone_number": (
                        profile.phone_number
                    ),
                    "national_id": (
                        profile.national_id
                    ),
                }

                customer_name = " ".join(
                    value
                    for value in [
                        profile.first_name,
                        profile.last_name,
                    ]
                    if value
                )

            else:
                customer_profile = None
                customer_name = ""

            # --------------------------- ADDRESS ---------------------------
            address = order.address

            if address:
                address_details = {
                    "id": str(
                        address.id
                    ),
                    "street": address.street,
                    "city": address.city,
                    "postal_code": (
                        address.postal_code
                    ),
                    "country": address.country,
                }

                address_string = ", ".join(
                    value
                    for value in [
                        address.street,
                        address.city,
                        address.postal_code,
                        address.country,
                    ]
                    if value
                )

            else:
                address_details = None
                address_string = ""

            # --------------------------- ORDER DATA ---------------------------
            order_data = {
                "id": str(
                    order.id
                ),
                "status": order.status,
                "paid": order.paid,
                "payment_method": (
                    order.payment_method
                ),

                "customer": {
                    "id": str(
                        order.user.id
                    ),
                    "email": order.user.email,
                    "name": customer_name,
                    "profile": customer_profile,
                },

                "total_quantity": total_quantity,

                "total_price": (
                    money_to_float(
                        total_price
                    )
                ),

                "address": address_string,

                "address_details": (
                    address_details
                ),

                "created_at": (
                    order.created_at.isoformat()
                    if order.created_at
                    else None
                ),

                "shipped_at": (
                    order.shipped_at.isoformat()
                    if order.shipped_at
                    else None
                ),

                "delivered_at": (
                    order.delivered_at.isoformat()
                    if order.delivered_at
                    else None
                ),

                "items": [
                    {
                        "id": str(
                            item.id
                        ),
                        "quantity": int(
                            item.quantity or 0
                        ),
                        "unit_price": (
                            money_to_float(
                                item.unit_price
                            )
                        ),
                        "subtotal": (
                            money_to_float(
                                item.subtotal
                            )
                        ),
                        "sparepart": (
                            {
                                "id": str(
                                    item.sparepart.id
                                ),
                                "brand": (
                                    item.sparepart.brand
                                ),
                                "category": (
                                    item.sparepart.category
                                ),
                                "vehicle_type": (
                                    item.sparepart.vehicle_type
                                ),
                                "image": (
                                    item.sparepart.image
                                ),
                            }
                            if item.sparepart
                            else None
                        ),
                    }
                    for item in order_items
                ],
            }

            summary.append(
                order_data
            )

        return Response(
            {
                "orders": summary
            },
            status=status.HTTP_200_OK,
        )

    # Update order status
    def patch(
        self,
        request,
        order_id,
    ):
        if not self._check_admin(request):
            return Response(
                {
                    "error": "Admins only"
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        order = get_object_or_404(
            Orders,
            pk=order_id,
        )

        # --------------------------- PAID CHECK ---------------------------
        if not order.paid:
            return Response(
                {
                    "error": (
                        "Only paid orders can be "
                        "updated by an admin"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = request.data or {}

        new_status = data.get(
            "status"
        )

        if not new_status:
            return Response(
                {
                    "error": "Missing status field"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --------------------------- STATUS TRANSITIONS ---------------------------
        allowed_transitions = {
            "pending": [
                "shipped",
                "cancelled",
            ],
            "shipped": [
                "delivered",
            ],
            "delivered": [],
            "cancelled": [],
        }

        current_status = (
            order.status
        )

        if new_status not in (
            allowed_transitions.get(
                current_status,
                [],
            )
        ):
            return Response(
                {
                    "error": (
                        "Cannot change order status "
                        f"from '{current_status}' "
                        f"to '{new_status}'"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --------------------------- CUSTOMER EMAIL ---------------------------
        customer_email = order.user.email

        # --------------------------- UPDATE STATUS ---------------------------
        order.status = new_status

        # --------------------------- SHIPPED TIME ---------------------------
        if (
            new_status == "shipped"
            and not order.shipped_at
        ):
            order.shipped_at = (
                timezone.now()
            )

        # --------------------------- DELIVERED TIME ---------------------------
        if (
            new_status == "delivered"
            and not order.delivered_at
        ):
            order.delivered_at = (
                timezone.now()
            )

        order.save()

        # --------------------------- ORDER STATUS EMAIL ---------------------------
        if new_status in [
            "shipped",
            "delivered",
        ]:
            transaction.on_commit(
                lambda: send_order_status_email_task.delay(
                    customer_email,
                    str(order.id),
                    new_status,
                )
            )

        return Response(
            {
                "message": (
                    f"Order {order.id} "
                    "updated successfully"
                ),
                "status": order.status,
                "payment_method": (
                    order.payment_method
                ),
                "shipped_at": (
                    order.shipped_at.isoformat()
                    if order.shipped_at
                    else None
                ),
                "delivered_at": (
                    order.delivered_at.isoformat()
                    if order.delivered_at
                    else None
                ),
            },
            status=status.HTTP_200_OK,
        )
    


# --------------------------- REVENUE DATA ANALYTICS ----------------------------------------------
class RevenueAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    VALID_PERIODS = {
        "daily",
        "weekly",
        "monthly",
        "yearly",
    }

    VALID_VEHICLE_TYPES = {
        "sedan",
        "suv",
        "truck",
        "bus",
    }

    VALID_CATEGORIES = {
        "tyre",
        "rim",
        "battery",
        "oil filter",
    }

    def get(self, request):
        user = request.user

        if not user.is_authenticated:
            return Response(
                {
                    "detail": (
                        "Authentication credentials "
                        "were not provided."
                    )
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if user.role not in [
            "admin",
            "super_admin",
        ]:
            return Response(
                {
                    "detail": (
                        "You do not have permission "
                        "to view analytics."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        period = (
            request.query_params
            .get("period", "monthly")
            .lower()
            .strip()
        )

        vehicle_type = request.query_params.get(
            "vehicle_type"
        )

        category = request.query_params.get(
            "category"
        )

        if period not in self.VALID_PERIODS:
            return Response(
                {
                    "error": (
                        "Invalid period. "
                        "Use daily, weekly, monthly "
                        "or yearly."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if vehicle_type:
            vehicle_type = vehicle_type.lower().strip()

            if vehicle_type not in self.VALID_VEHICLE_TYPES:
                return Response(
                    {
                        "error": (
                            "Invalid vehicle_type. "
                            "Use sedan, suv, truck "
                            "or bus."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if category:
            category = category.lower().strip()

            if category not in self.VALID_CATEGORIES:
                return Response(
                    {
                        "error": "Invalid category."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        order_items = (
            OrderItems.objects
            .select_related(
                "order",
                "sparepart",
            )
            .filter(
                order__paid=True
            )
            .exclude(
                order__status__iexact="cancelled"
            )
        )

        if vehicle_type:
            order_items = order_items.filter(
                sparepart__vehicle_type__iexact=vehicle_type
            )

        if category:
            order_items = order_items.filter(
                sparepart__category__iexact=category
            )

        today = timezone.localdate()

        if period == "daily":
            period_start_date = today

        elif period == "weekly":
            period_start_date = (
                today - timezone.timedelta(days=today.weekday())
            )

        elif period == "monthly":
            period_start_date = today.replace(day=1)

        else:
            period_start_date = today.replace(
                month=1,
                day=1,
            )

        period_order_items = order_items.filter(
            order__created_at__date__gte=period_start_date,
            order__created_at__date__lte=today,
        )

        summary_data = order_items.aggregate(
            parts_sold=Sum("quantity"),
            revenue=Sum("subtotal"),
        )

        parts_sold = int(
            summary_data["parts_sold"] or 0
        )

        revenue = money_to_float(
            summary_data["revenue"]
        )

        orders_count = (
            order_items
            .values("order_id")
            .distinct()
            .count()
        )

        # TIMELINE
        if period == "daily":
            truncated_date = TruncDay(
                "order__created_at"
            )

        elif period == "weekly":
            truncated_date = TruncWeek(
                "order__created_at"
            )

        elif period == "yearly":
            truncated_date = TruncYear(
                "order__created_at"
            )

        else:
            truncated_date = TruncMonth(
                "order__created_at"
            )

        timeline = (
            order_items
            .annotate(
                period_date=truncated_date
            )
            .values("period_date")
            .annotate(
                parts_sold=Sum("quantity"),
                revenue=Sum("subtotal"),
            )
            .order_by("period_date")
        )

        timeline_data = []

        for item in timeline:
            period_date = item["period_date"]

            if period in ["daily", "weekly"]:
                period_label = (
                    period_date.strftime("%Y-%m-%d")
                    if period_date
                    else ""
                )

            elif period == "monthly":
                period_label = (
                    period_date.strftime("%Y-%m")
                    if period_date
                    else ""
                )

            else:
                period_label = (
                    period_date.strftime("%Y")
                    if period_date
                    else ""
                )

            timeline_data.append(
                {
                    "period": period_label,
                    "parts_sold": int(
                        item["parts_sold"] or 0
                    ),
                    "revenue": money_to_float(
                        item["revenue"]
                    ),
                }
            )

        # VEHICLE TYPE BREAKDOWN
        vehicle_types = (
            order_items
            .values("sparepart__vehicle_type")
            .annotate(
                parts_sold=Sum("quantity"),
                revenue=Sum("subtotal"),
            )
            .order_by("-revenue")
        )

        vehicle_type_data = []

        for item in vehicle_types:
            vehicle_type_data.append(
                {
                    "vehicle_type": (
                        item["sparepart__vehicle_type"]
                        or ""
                    ),
                    "parts_sold": int(
                        item["parts_sold"] or 0
                    ),
                    "revenue": money_to_float(
                        item["revenue"]
                    ),
                }
            )

        # CATEGORY BREAKDOWN
        categories = (
            order_items
            .values("sparepart__category")
            .annotate(
                parts_sold=Sum("quantity"),
                revenue=Sum("subtotal"),
            )
            .order_by("-revenue")
        )

        category_data = []

        for item in categories:
            category_data.append(
                {
                    "category": (
                        item["sparepart__category"]
                        or ""
                    ),
                    "parts_sold": int(
                        item["parts_sold"] or 0
                    ),
                    "revenue": money_to_float(
                        item["revenue"]
                    ),
                }
            )

        # BRAND BREAKDOWN HELPER
        def get_brand_data(queryset):
            brands = (
                queryset
                .values(
                    "sparepart__vehicle_type",
                    "sparepart__category",
                    "sparepart__brand",
                )
                .annotate(
                    parts_sold=Sum("quantity"),
                    revenue=Sum("subtotal"),
                )
                .order_by("-revenue")
            )

            return [
                {
                    "vehicle_type": (
                        item["sparepart__vehicle_type"]
                        or ""
                    ),
                    "category": (
                        item["sparepart__category"]
                        or ""
                    ),
                    "brand": (
                        item["sparepart__brand"]
                        or ""
                    ),
                    "parts_sold": int(
                        item["parts_sold"] or 0
                    ),
                    "revenue": money_to_float(
                        item["revenue"]
                    ),
                }
                for item in brands
            ]

        # ALL-TIME BRAND SALES
        all_time_brand_data = get_brand_data(
            order_items
        )

        # SELECTED-PERIOD BRAND SALES
        brand_data = get_brand_data(
            period_order_items
        )

        # BRAND SALES BY EACH TIMELINE PERIOD
        # Groups sales by date interval and brand.
        brand_timeline = (
            order_items
            .annotate(
                period_date=truncated_date
            )
            .values(
                "period_date",
                "sparepart__brand",
            )
            .annotate(
                parts_sold=Sum("quantity"),
                revenue=Sum("subtotal"),
            )
            .order_by(
                "period_date",
                "-revenue",
            )
        )

        brand_timeline_data = []

        for item in brand_timeline:
            period_date = item["period_date"]

            if not period_date:
                continue

            if period in ["daily", "weekly"]:
                period_label = period_date.strftime(
                    "%Y-%m-%d"
                )

            elif period == "monthly":
                period_label = period_date.strftime(
                    "%Y-%m"
                )

            else:
                period_label = period_date.strftime(
                    "%Y"
                )

            brand_timeline_data.append(
                {
                    "period": period_label,
                    "brand": (
                        item["sparepart__brand"] or ""
                    ),
                    "parts_sold": int(
                        item["parts_sold"] or 0
                    ),
                    "revenue": money_to_float(
                        item["revenue"]
                    ),
                }
            )

        return Response(
            {
                "filters": {
                    "period": period,
                    "vehicle_type": vehicle_type,
                    "category": category,
                },
                "summary": {
                    "parts_sold": parts_sold,
                    "revenue": revenue,
                    "orders": orders_count,
                },
                "timeline": timeline_data,
                "vehicle_types": vehicle_type_data,
                "categories": category_data,
                "brands": brand_data,
                "all_time_brands": all_time_brand_data,
                "brand_timeline": brand_timeline_data,
            },
            status=status.HTTP_200_OK,
        )
