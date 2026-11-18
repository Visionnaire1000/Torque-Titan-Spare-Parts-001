import logging
from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.db import transaction, IntegrityError
from django.db.models import Sum
from django.db.models.functions import (
    TruncDay,
    TruncWeek,
    TruncMonth,
    TruncYear,
)
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import serializers, status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from app.models import (
    Users,
    Orders,
    OrderItems,
    SpareParts,
    Reviews,
)

from utils.cloudflare import (
    upload_image_to_r2,
    is_r2_image_url,
)

from utils.tasks import (
    send_admin_credentials_email_task,
    send_order_status_email_task,
    cleanup_r2_image,
    send_account_unlocked_email_task,
)

from .buyerViews import (
    get_requested_language,
    detect_comment_language,
    get_cached_translation_result,
)


logger = logging.getLogger(__name__)


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


# --------------------------- SERIALIZERS ----------------------------------------------
class SparePartsSerializer(serializers.ModelSerializer):
    translated_description = serializers.SerializerMethodField()
    translation_pending = serializers.SerializerMethodField()

    class Meta:
        model = SpareParts
        fields = "__all__"

    def _get_description_translation(self, obj):
        cache_key = ("description_translation", obj.pk)

        if cache_key in self._translation_results:
            return self._translation_results[cache_key]

        request = self.context.get("request")
        description = obj.description or ""

        if request is None or not description.strip():
            result = (description, False)
        else:
            target_language = get_requested_language(request)
            source_language = detect_comment_language(description)

            result = get_cached_translation_result(
                text=description,
                source_language=source_language,
                target_language=target_language,
            )

        self._translation_results[cache_key] = result
        return result

    def get_translated_description(self, obj):
        translated_text, _ = self._get_description_translation(obj)
        return translated_text

    def get_translation_pending(self, obj):
        _, pending = self._get_description_translation(obj)
        return pending

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._translation_results = {}


class ReviewsSerializer(serializers.ModelSerializer):
    translated_comment = serializers.SerializerMethodField()
    translation_pending = serializers.SerializerMethodField()

    class Meta:
        model = Reviews
        fields = "__all__"

    def get_translated_comment(self, obj):
        return obj.comment or ""

    def get_translation_pending(self, obj):
        return False


# --------------------------- ADMIN MANAGEMENT ----------------------------------------------
class CreateAdminView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current_user = request.user

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

        email = str(data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        role = data.get("role", "admin")

        if not email or not password:
            return Response(
                {"error": "Email and password are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if role not in ["admin", "super_admin"]:
            return Response(
                {
                    "error": (
                        "Invalid role. Role must be "
                        "admin or super_admin."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():

                if Users.objects.filter(email=email).exists():
                    return Response(
                        {"error": "Email already exists"},
                        status=status.HTTP_409_CONFLICT,
                    )

                extra_fields = {
                    "email_verified": True,
                    "initial_password_changed": False,
                }

                if role == "admin":
                    admin_user = Users.objects.create_admin(
                        email=email,
                        password=password,
                        **extra_fields,
                    )
                else:
                    admin_user = Users.objects.create_super_admin(
                        email=email,
                        password=password,
                        **extra_fields,
                    )

                admin_user.set_initial_admin_password_expiry()

                admin_id = admin_user.id
                admin_email = admin_user.email
                admin_role = admin_user.role
                display_name = admin_user.display_name

                def send_credentials():
                    try:
                        send_admin_credentials_email_task.delay(
                            admin_email,
                            password,
                            admin_role,
                        )
                    except Exception:
                        logger.exception(
                            "Failed to queue admin credentials email "
                            "for %s.",
                            admin_email,
                        )

                transaction.on_commit(send_credentials)

            return Response(
                {
                    "message": (
                        f"{admin_role} account created and verified successfully. "
                        "Initial password must be changed within 12 hours."
                    ),
                    "id": str(admin_id),
                    "email": admin_email,
                    "display_name": display_name,
                    "role": admin_role,
                },
                status=status.HTTP_201_CREATED,
            )

        except IntegrityError:
            return Response(
                {"error": "Email already exists"},
                status=status.HTTP_409_CONFLICT,
            )

        except Exception:
            logger.exception("Create admin error.")

            return Response(
                {"error": "Internal server error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ListAdminsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        current_user = request.user

        if current_user.role != "super_admin":
            return Response(
                {
                    "error": "Only super_admin can list admins"
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
            .exclude(id=current_user.id)
            .order_by("role", "email")
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
            {"admins": admins_list},
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
                        "Only super_admin can unlock accounts"
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            with transaction.atomic():
                admin_user = (
                    Users.objects
                    .select_for_update()
                    .filter(
                        pk=admin_id,
                        role__in=["admin", "super_admin"],
                    )
                    .first()
                )

                if not admin_user:
                    return Response(
                        {"error": "Admin account not found"},
                        status=status.HTTP_404_NOT_FOUND,
                    )

                if admin_user.id == current_user.id:
                    return Response(
                        {
                            "error": (
                                "You cannot unlock your own "
                                "account here."
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

                admin_id_value = str(admin_user.id)
                admin_email = admin_user.email
                admin_role = admin_user.role
                initial_password_expired = (
                    admin_user.has_expired_initial_password()
                )
                is_locked = not admin_user.is_active

                def send_unlocked_email():
                    try:
                        send_account_unlocked_email_task.delay(
                            admin_email,
                            admin_role,
                        )
                    except Exception:
                        logger.exception(
                            "Failed to queue account-unlocked email "
                            "for %s.",
                            admin_email,
                        )

                transaction.on_commit(send_unlocked_email)

            return Response(
                {
                    "message": (
                        f"{admin_role} "
                        f"{admin_email} "
                        "unlocked successfully"
                    ),
                    "id": admin_id_value,
                    "email": admin_email,
                    "role": admin_role,
                    "is_active": True,
                    "initial_password_expired": initial_password_expired,
                    "is_locked": is_locked,
                },
                status=status.HTTP_200_OK,
            )

        except Exception:
            logger.exception("Failed to unlock admin account %s.", admin_id)

            return Response(
                {"error": "Internal server error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class DeleteAdminView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, admin_id):
        current_user = request.user

        if current_user.role != "super_admin":
            return Response(
                {
                    "error": "Only super_admin can delete admins"
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            with transaction.atomic():
                admin_user = (
                    Users.objects
                    .select_for_update()
                    .filter(
                        pk=admin_id,
                        role__in=["admin", "super_admin"],
                    )
                    .first()
                )

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
                                "You cannot delete your own "
                                "account here."
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
                        f"{role} {email} deleted successfully"
                    )
                },
                status=status.HTTP_200_OK,
            )

        except Exception:
            logger.exception("Failed to delete admin account %s.", admin_id)

            return Response(
                {"error": "Internal server error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# --------------------------- SUPPORT FOR FRENCH SEARCHES ------------------------
FRENCH_CATEGORY_ALIASES = {
    "pneu": "tyre",
    "pneus": "tyre",
    "pneu de voiture": "tyre",
    "pneus de voiture": "tyre",
    "jante": "rim",
    "jantes": "rim",
    "batterie": "battery",
    "batteries": "battery",
    "filtre à huile": "oil filter",
    "filtre huile": "oil filter",
}


def normalize_sparepart_category(category):
    if not category:
        return ""

    normalized = " ".join(
        str(category).strip().lower().split()
    )

    return FRENCH_CATEGORY_ALIASES.get(
        normalized,
        normalized,
    )


# ------------------------------ SPARE PARTS MANAGEMENT -------------------------------------------
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

    def _normalize_category(self, value):
        return normalize_sparepart_category(value)

    def _schedule_r2_image_cleanup(self, image_url):
        if not image_url or not is_r2_image_url(image_url):
            return

        try:
            cleanup_r2_image.delay(image_url)
        except Exception:
            logger.exception(
                "Failed to schedule Cloudflare R2 image cleanup."
            )

    def post(self, request):
        if not self._check_admin(request):
            return Response(
                {"error": "Admins only"},
                status=status.HTTP_403_FORBIDDEN,
            )

        data = request.data
        image_url = None

        try:
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

            image_file = request.FILES.get("image")
            image_url = upload_image_to_r2(image_file)

            spare = SpareParts.objects.create(
                category=self._normalize_category(
                    data.get("category")
                ),
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
                    "message": "Spare part created successfully",
                    "sparepart": SparePartsSerializer(
                        spare,
                        context={"request": request},
                    ).data,
                },
                status=status.HTTP_201_CREATED,
            )

        except ValueError as exc:
            if image_url:
                self._schedule_r2_image_cleanup(image_url)

            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as exc:
            if image_url:
                self._schedule_r2_image_cleanup(image_url)

            logger.exception("Failed to create spare part.")

            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    def put(self, request, spare_id):
        if not self._check_admin(request):
            return Response(
                {"error": "Admins only"},
                status=status.HTTP_403_FORBIDDEN,
            )

        spare = get_object_or_404(
            SpareParts,
            id=spare_id,
        )

        data = request.data
        old_image_url = spare.image
        new_image_url = None

        try:
            changes_detected = False

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

                if field == "category":
                    new_value = self._normalize_category(
                        data.get(field)
                    )
                else:
                    new_value = self._normalize_value(
                        data.get(field)
                    )

                if field in [
                    "category",
                    "vehicle_type",
                    "brand",
                    "colour",
                ] and not new_value:
                    return Response(
                        {
                            "error": (
                                f"{field.replace('_', ' ').capitalize()} "
                                "cannot be empty"
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                current_value = self._normalize_value(
                    getattr(spare, field)
                )

                if new_value != current_value:
                    changes_detected = True
                    setattr(
                        spare,
                        field,
                        new_value,
                    )

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
                    setattr(spare, field, value)

            image_file = request.FILES.get("image")

            if image_file:
                new_image_url = upload_image_to_r2(
                    image_file
                )

                spare.image = new_image_url
                changes_detected = True

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

            spare.save()

            if new_image_url and old_image_url != new_image_url:
                self._schedule_r2_image_cleanup(old_image_url)

            return Response(
                {
                    "message": "Spare part updated successfully",
                    "sparepart": SparePartsSerializer(
                        spare,
                        context={"request": request},
                    ).data,
                },
                status=status.HTTP_200_OK,
            )

        except ValueError as exc:
            if new_image_url:
                self._schedule_r2_image_cleanup(new_image_url)

            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as exc:
            if new_image_url:
                self._schedule_r2_image_cleanup(new_image_url)

            logger.exception(
                "Failed to update spare part %s.",
                spare_id,
            )

            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    def delete(self, request, spare_id):
        if not self._check_admin(request):
            return Response(
                {"error": "Admins only"},
                status=status.HTTP_403_FORBIDDEN,
            )

        spare = get_object_or_404(
            SpareParts,
            id=spare_id,
        )

        image_url = spare.image

        try:
            spare.delete()

            self._schedule_r2_image_cleanup(image_url)

            return Response(
                {
                    "message": "Spare part deleted successfully"
                },
                status=status.HTTP_200_OK,
            )

        except Exception as exc:
            logger.exception(
                "Failed to delete spare part %s.",
                spare_id,
            )

            return Response(
                {"error": str(exc)},
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
                {"error": "Admins only"},
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
            .order_by("-created_at")
        )

        result = []

        for review in reviews:
            review_dict = ReviewsSerializer(
                review,
                context={"request": request},
            ).data

            review_dict["sparepart_id"] = str(
                review.sparepart_id
            )

            sparepart = review.sparepart

            review_dict["sparepart_image"] = (
                sparepart.image
                if sparepart and sparepart.image
                else None
            )

            user = review.user

            review_dict["user_display_name"] = (
                get_user_display_name(user)
            )

            review_dict["user_email"] = (
                user.email if user else ""
            )

            review_dict["total_likes"] = review.total_likes
            review_dict["total_dislikes"] = review.total_dislikes

            review_dict["created_at"] = (
                review.created_at.isoformat()
                if review.created_at
                else None
            )

            reactions = review.likes.all()

            review_dict["likes"] = [
                {
                    "user_id": str(reaction.user_id),
                    "user_display_name": get_user_display_name(
                        reaction.user
                    ),
                    "is_like": True,
                }
                for reaction in reactions
                if reaction.is_like
            ]

            review_dict["dislikes"] = [
                {
                    "user_id": str(reaction.user_id),
                    "user_display_name": get_user_display_name(
                        reaction.user
                    ),
                    "is_like": False,
                }
                for reaction in reactions
                if not reaction.is_like
            ]

            result.append(review_dict)

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
                {"error": "Unauthorized"},
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
            .filter(sparepart_id=sparepart_id)
            .order_by("-created_at")
        )

        result = []

        for review in reviews:
            review_dict = ReviewsSerializer(
                review,
                context={"request": request},
            ).data

            review_dict["sparepart_id"] = str(
                review.sparepart_id
            )

            user = review.user

            review_dict["user_display_name"] = (
                get_user_display_name(user)
            )

            review_dict["user_email"] = (
                user.email if user else ""
            )

            review_dict["total_likes"] = review.total_likes
            review_dict["total_dislikes"] = review.total_dislikes

            review_dict["created_at"] = (
                review.created_at.isoformat()
                if review.created_at
                else None
            )

            reactions = review.likes.all()

            review_dict["likes"] = [
                {
                    "user_id": str(reaction.user_id),
                    "user_display_name": get_user_display_name(
                        reaction.user
                    ),
                    "is_like": True,
                }
                for reaction in reactions
                if reaction.is_like
            ]

            review_dict["dislikes"] = [
                {
                    "user_id": str(reaction.user_id),
                    "user_display_name": get_user_display_name(
                        reaction.user
                    ),
                    "is_like": False,
                }
                for reaction in reactions
                if not reaction.is_like
            ]

            result.append(review_dict)

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
                {"error": "Admins only"},
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
            vehicle_type = sparepart.vehicle_type
            category = sparepart.category
            brand = sparepart.brand

            key = (
                vehicle_type,
                category,
                brand,
            )

            if key not in analytics:
                analytics[key] = {
                    "vehicle_type": vehicle_type,
                    "category": category,
                    "brand": brand,
                    "total_reviews": 0,
                    "total_rating": 0.0,
                }

            total_reviews = sparepart.total_reviews

            average_rating = float(
                sparepart.average_rating or 0
            )

            analytics[key]["total_reviews"] += total_reviews

            analytics[key]["total_rating"] += (
                average_rating * total_reviews
            )

        grouped = {}

        for item in analytics.values():
            group_key = (
                item["vehicle_type"],
                item["category"],
            )

            if group_key not in grouped:
                grouped[group_key] = {
                    "vehicle_type": item["vehicle_type"],
                    "category": item["category"],
                    "brands": [],
                }

            total_reviews = item["total_reviews"]

            average_rating = (
                item["total_rating"] / total_reviews
                if total_reviews > 0
                else 0.0
            )

            grouped[group_key]["brands"].append(
                {
                    "brand": item["brand"],
                    "average_rating": round(
                        average_rating,
                        1,
                    ),
                    "total_reviews": total_reviews,
                }
            )

        result = list(grouped.values())

        for group in result:
            group["brands"].sort(
                key=lambda brand: (
                    -brand["average_rating"],
                    -brand["total_reviews"],
                    brand["brand"].lower(),
                )
            )

        result.sort(
            key=lambda group: (
                group["vehicle_type"],
                group["category"],
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

    def get(self, request):
        if not self._check_admin(request):
            return Response(
                {"error": "Admins only"},
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
            .filter(paid=True)
            .exclude(status="expired")
            .order_by("-created_at")
        )

        summary = []

        for order in orders:
            order_items = list(
                order.order_items.all()
            )

            total_price = sum(
                (
                    money_to_decimal(item.subtotal)
                    for item in order_items
                ),
                Decimal("0.00"),
            )

            total_quantity = sum(
                int(item.quantity or 0)
                for item in order_items
            )

            profile = getattr(
                order.user,
                "profile",
                None,
            )

            if profile:
                customer_profile = {
                    "id": str(profile.id),
                    "first_name": profile.first_name,
                    "last_name": profile.last_name,
                    "phone_number": profile.phone_number,
                    "national_id": profile.national_id,
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

            address = order.address

            if address:
                address_details = {
                    "id": str(address.id),
                    "street": address.street,
                    "city": address.city,
                    "postal_code": address.postal_code,
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

            order_data = {
                "id": str(order.id),
                "status": order.status,
                "paid": order.paid,
                "payment_method": order.payment_method,
                "customer": {
                    "id": str(order.user.id),
                    "email": order.user.email,
                    "name": customer_name,
                    "profile": customer_profile,
                },
                "total_quantity": total_quantity,
                "total_price": money_to_float(total_price),
                "address": address_string,
                "address_details": address_details,
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
                        "id": str(item.id),
                        "quantity": int(item.quantity or 0),
                        "unit_price": money_to_float(
                            item.unit_price
                        ),
                        "subtotal": money_to_float(
                            item.subtotal
                        ),
                        "sparepart": (
                            {
                                "id": str(item.sparepart.id),
                                "brand": item.sparepart.brand,
                                "category": item.sparepart.category,
                                "vehicle_type": (
                                    item.sparepart.vehicle_type
                                ),
                                "image": item.sparepart.image,
                            }
                            if item.sparepart
                            else None
                        ),
                    }
                    for item in order_items
                ],
            }

            summary.append(order_data)

        return Response(
            {"orders": summary},
            status=status.HTTP_200_OK,
        )

    def patch(self, request, order_id):
        if not self._check_admin(request):
            return Response(
                {"error": "Admins only"},
                status=status.HTTP_403_FORBIDDEN,
            )

        data = request.data or {}
        new_status = data.get("status")

        if not new_status:
            return Response(
                {"error": "Missing status field"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        allowed_transitions = {
            "pending": ["shipped", "cancelled"],
            "shipped": ["delivered"],
            "delivered": [],
            "cancelled": [],
        }

        try:
            with transaction.atomic():
                order = get_object_or_404(
                    Orders.objects.select_for_update(),
                    pk=order_id,
                )

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

                current_status = order.status

                if new_status not in allowed_transitions.get(
                    current_status,
                    [],
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

                customer_email = order.user.email
                order_id_value = str(order.id)

                order.status = new_status

                if (
                    new_status == "shipped"
                    and not order.shipped_at
                ):
                    order.shipped_at = timezone.now()

                if (
                    new_status == "delivered"
                    and not order.delivered_at
                ):
                    order.delivered_at = timezone.now()

                order.save(
                    update_fields=[
                        "status",
                        "shipped_at",
                        "delivered_at",
                    ]
                )

                if new_status in ["shipped", "delivered"]:

                    def send_status_email():
                        try:
                            send_order_status_email_task.delay(
                                customer_email,
                                order_id_value,
                                new_status,
                            )
                        except Exception:
                            logger.exception(
                                "Failed to queue order status email "
                                "for order %s.",
                                order_id_value,
                            )

                    transaction.on_commit(send_status_email)

                response_data = {
                    "message": (
                        f"Order {order_id_value} updated successfully"
                    ),
                    "status": order.status,
                    "payment_method": order.payment_method,
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
                }

            return Response(
                response_data,
                status=status.HTTP_200_OK,
            )

        except Http404:
            return Response(
                {"error": "Order not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        except Exception:
            logger.exception(
                "Failed to update order status for order %s.",
                order_id,
            )

            return Response(
                {"error": "Internal server error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
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

        if user.role not in ["admin", "super_admin"]:
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
                        "Invalid period. Use daily, weekly, "
                        "monthly or yearly."
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
                            "Use sedan, suv, truck or bus."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if category:
            category = category.lower().strip()

            if category not in self.VALID_CATEGORIES:
                return Response(
                    {"error": "Invalid category."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        order_items = (
            OrderItems.objects
            .select_related(
                "order",
                "sparepart",
            )
            .filter(order__paid=True)
            .exclude(order__status__iexact="cancelled")
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
                today - timedelta(days=today.weekday())
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

        if period == "daily":
            truncated_date = TruncDay("order__created_at")

        elif period == "weekly":
            truncated_date = TruncWeek("order__created_at")

        elif period == "yearly":
            truncated_date = TruncYear("order__created_at")

        else:
            truncated_date = TruncMonth("order__created_at")

        timeline = (
            order_items
            .annotate(period_date=truncated_date)
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
                        item["sparepart__vehicle_type"] or ""
                    ),
                    "parts_sold": int(
                        item["parts_sold"] or 0
                    ),
                    "revenue": money_to_float(
                        item["revenue"]
                    ),
                }
            )

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
                        item["sparepart__category"] or ""
                    ),
                    "parts_sold": int(
                        item["parts_sold"] or 0
                    ),
                    "revenue": money_to_float(
                        item["revenue"]
                    ),
                }
            )

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
                        item["sparepart__vehicle_type"] or ""
                    ),
                    "category": (
                        item["sparepart__category"] or ""
                    ),
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
                for item in brands
            ]

        all_time_brand_data = get_brand_data(
            order_items
        )

        brand_data = get_brand_data(
            period_order_items
        )

        brand_timeline = (
            order_items
            .annotate(period_date=truncated_date)
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
