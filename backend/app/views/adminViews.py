from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone

from django.db.models import (Avg, Count, Sum, Q)
from django.db.models.functions import (TruncDay, TruncWeek, TruncMonth, TruncYear)

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


# --------------------------- SERIALIZERS ----------------------------------------------
class SparePartsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SpareParts
        fields = "__all__"


class ReviewsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reviews
        fields = "__all__"


# --------------------------- ACCOUNT MANAGEMENT ----------------------------------------------
class CreateAdminView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current_user = request.user

        if current_user.role != "super_admin":
            return Response(
                {"error": "Only super_admin can create admins"},
                status=status.HTTP_403_FORBIDDEN,
            )

        data = request.data or {}

        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            return Response(
                {"error": "Email and password are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = email.strip().lower()

        if Users.objects.filter(email=email).exists():
            return Response(
                {"error": "Email already exists"},
                status=status.HTTP_409_CONFLICT,
            )

        try:
            with transaction.atomic():
                admin_user = Users(
                    email=email,
                    role="admin",
                    email_verified=True,
                    email_otp_hash=None,
                    email_otp_expires=None,
                    otp_last_sent=None,
                    otp_resend_count=0,
                    otp_attempts=0,
                    otp_locked_until=None,
                )

                admin_user.set_password(password)
                admin_user.save()

            return Response(
                {
                    "message": (
                        "Admin account created and "
                        "verified successfully"
                    ),
                    "id": str(admin_user.id),
                    "email": admin_user.email,
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception as exc:
            print("Create admin error:", exc)

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
                {"error": "Only super_admin can list admins"},
                status=status.HTTP_403_FORBIDDEN,
            )

        admins = Users.objects.filter(
            role="admin"
        ).order_by("email")

        admins_list = [
            {
                "id": str(admin.id),
                "email": admin.email,
            }
            for admin in admins
        ]

        return Response(
            {"admins": admins_list},
            status=status.HTTP_200_OK,
        )


class DeleteAdminView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, admin_id):
        current_user = request.user

        if current_user.role != "super_admin":
            return Response(
                {"error": "Only super_admin can delete admins"},
                status=status.HTTP_403_FORBIDDEN,
            )

        admin_user = Users.objects.filter(
            pk=admin_id,
            role="admin",
        ).first()

        if not admin_user:
            return Response(
                {
                    "error": (
                        "Admin not found or cannot delete "
                        "this user"
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        email = admin_user.email

        admin_user.delete()

        return Response(
            {
                "message": (
                    f"Admin {email} deleted successfully"
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

            # ---------------- PRICE VALIDATION ----------------
            try:

                buying_price = Decimal(
                    str(
                        data.get(
                            "buying_price",
                            0,
                        )
                    )
                )

                marked_price = Decimal(
                    str(
                        data.get(
                            "marked_price",
                            0,
                        )
                    )
                )

            except (
                TypeError,
                ValueError,
                InvalidOperation,
            ):

                return Response(
                    {
                        "error": "Invalid price values"
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # ---------------- IMAGE UPLOAD ----------------
            image_file = request.FILES.get(
                "image"
            )

            image_url = None

            if image_file:

                image_url = upload_image_to_r2(
                    image_file
                )

            # ---------------- CREATE ----------------
            spare = SpareParts.objects.create(

                category=data.get(
                    "category"
                ),

                vehicle_type=data.get(
                    "vehicle_type"
                ),

                brand=data.get(
                    "brand"
                ),

                colour=data.get(
                    "colour"
                ),

                buying_price=buying_price,

                marked_price=marked_price,

                image=image_url,

                description=data.get(
                    "description"
                ),
            )

            return Response(
                {
                    "message": (
                        "Spare part created "
                        "successfully"
                    ),
                    "sparepart":
                        SparePartsSerializer(
                            spare
                        ).data,
                },
                status=status.HTTP_201_CREATED,
            )

        except ValueError as e:

            return Response(
                {
                    "error": str(e)
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as e:

            return Response(
                {
                    "error": str(e)
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

            # ---------------- UPDATE FIELDS ----------------
            fields = [
                "category",
                "vehicle_type",
                "brand",
                "colour",
                "buying_price",
                "marked_price",
                "description",
            ]

            for field in fields:

                if field not in data:
                    continue

                if field in [
                    "buying_price",
                    "marked_price",
                ]:

                    try:

                        value = Decimal(
                            str(
                                data[field]
                            )
                        )

                    except (
                        TypeError,
                        ValueError,
                        InvalidOperation,
                    ):

                        return Response(
                            {
                                "error": (
                                    f"Invalid value "
                                    f"for {field}"
                                )
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    setattr(
                        spare,
                        field,
                        value,
                    )

                else:

                    setattr(
                        spare,
                        field,
                        data[field],
                    )

            # ---------------- NEW IMAGE ----------------
            image_file = request.FILES.get(
                "image"
            )

            if image_file:

                image_url = upload_image_to_r2(
                    image_file
                )

                spare.image = image_url

            # ---------------- SAVE ----------------
            spare.save()

            return Response(
                {
                    "message": (
                        "Spare part updated "
                        "successfully"
                    ),
                    "sparepart":
                        SparePartsSerializer(
                            spare
                        ).data,
                },
                status=status.HTTP_200_OK,
            )

        except ValueError as e:

            return Response(
                {
                    "error": str(e)
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as e:

            return Response(
                {
                    "error": str(e)
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

            # Only deletes the database record.
            # The image remains in Cloudflare R2.
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

        except Exception as e:

            return Response(
                {
                    "error": str(e)
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
                {"error": "Admins only"},
                status=status.HTTP_403_FORBIDDEN,
            )

        reviews = (
            Reviews.objects
            .select_related(
                "user",
                "sparepart",
            )
            .prefetch_related("likes")
            .order_by("-created_at")
        )

        result = []

        for review in reviews:

            review_dict = ReviewsSerializer(
                review
            ).data

            review_dict["sparepart_id"] = (
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
                f"{review.user_display_name} "
                f"({user.email if user else 'unknown'})"
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

            review_dict["likes"] = [
                {
                    "user_id": reaction.user_id,
                    "is_like": reaction.is_like,
                }
                for reaction in review.likes.all()
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
            .select_related("user")
            .prefetch_related("likes")
            .filter(sparepart_id=sparepart_id)
            .order_by("-created_at")
        )

        result = []

        for review in reviews:

            review_dict = ReviewsSerializer(
                review
            ).data

            review_dict["sparepart_id"] = (
                review.sparepart_id
            )

            user = review.user

            review_dict["user_display_name"] = (
                f"{review.user_display_name} "
                f"({user.email if user else 'unknown'})"
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

            review_dict["likes"] = [
                {
                    "user_id": reaction.user_id,
                    "is_like": reaction.is_like,
                }
                for reaction in review.likes.all()
            ]

            result.append(review_dict)

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

    # Get all orders
    def get(self, request):
        if not self._check_admin(request):
            return Response(
                {"error": "Admins only"},
                status=status.HTTP_403_FORBIDDEN,
            )

        orders = (
            Orders.objects
            .prefetch_related(
                "order_items__sparepart"
            )
            .order_by("-created_at")
        )

        summary = []

        for order in orders:

            order_items = list(
                order.order_items.all()
            )

            total_price = sum(
                float(item.subtotal or 0)
                for item in order_items
            )

            total_items = sum(
                int(item.quantity or 0)
                for item in order_items
            )

            order_data = {
                "id": order.id,
                "status": order.status,
                "paid": order.paid,
                "total_items": total_items,
                "total_price": total_price,

                "address": (
                    f"{order.street}, "
                    f"{order.city}, "
                    f"{order.country}"
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

                "order_items": [
                    {
                        "id": item.id,
                        "quantity": int(
                            item.quantity or 0
                        ),
                        "price": float(
                            item.unit_price or 0
                        ),
                        "subtotal": float(
                            item.subtotal or 0
                        ),
                        "sparepart": {
                            "id": item.sparepart.id,
                            "brand": item.sparepart.brand,
                            "category": item.sparepart.category,
                            "vehicle_type": (
                                item.sparepart.vehicle_type
                            ),
                            "image_url": (
                                item.sparepart.image
                            ),
                        },
                    }
                    for item in order_items
                ],
            }

            summary.append(order_data)

        return Response(
            {"orders": summary},
            status=status.HTTP_200_OK,
        )

    # Update order status
    def patch(self, request, order_id):
        if not self._check_admin(request):
            return Response(
                {"error": "Admins only"},
                status=status.HTTP_403_FORBIDDEN,
            )

        order = get_object_or_404(
            Orders,
            pk=order_id,
        )

        data = request.data or {}

        new_status = data.get("status")

        if not new_status:
            return Response(
                {"error": "Missing status field"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        allowed_statuses = [
            "pending",
            "cancelled",
            "shipped",
            "delivered",
        ]

        if new_status not in allowed_statuses:
            return Response(
                {
                    "error": (
                        "Invalid status. "
                        f"Allowed: {allowed_statuses}"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

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

        order.save()

        return Response(
            {
                "message": (
                    f"Order {order.id} updated successfully"
                ),
                "status": order.status,
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


# --------------------------- ADMIN DATA ANALYTICS ----------------------------------------------
class DataAnalyticsView(APIView):
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

        # PARAMETERS
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

        # VALIDATION
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
            vehicle_type = (
                vehicle_type
                .lower()
                .strip()
            )

            if (
                vehicle_type
                not in self.VALID_VEHICLE_TYPES
            ):
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
            category = (
                category
                .lower()
                .strip()
            )

            if category not in self.VALID_CATEGORIES:
                return Response(
                    {
                        "error": "Invalid category."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # BASE ORDER ITEMS
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

        # VEHICLE TYPE FILTER
        if vehicle_type:
            order_items = order_items.filter(
                sparepart__vehicle_type__iexact=vehicle_type
            )

        # CATEGORY FILTER
        if category:
            order_items = order_items.filter(
                sparepart__category__iexact=category
            )

        # SUMMARY
        summary_data = order_items.aggregate(
            parts_sold=Sum("quantity"),
            revenue=Sum("subtotal"),
        )

        parts_sold = int(
            summary_data["parts_sold"] or 0
        )

        revenue = float(
            summary_data["revenue"] or 0
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

            if period == "daily":
                period_label = (
                    period_date.strftime("%Y-%m-%d")
                    if period_date
                    else ""
                )

            elif period == "weekly":
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
                    "revenue": float(
                        item["revenue"] or 0
                    ),
                }
            )

        # VEHICLE TYPE BREAKDOWN
        vehicle_types = (
            order_items
            .values(
                "sparepart__vehicle_type"
            )
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
                        item[
                            "sparepart__vehicle_type"
                        ]
                        or ""
                    ),
                    "parts_sold": int(
                        item["parts_sold"] or 0
                    ),
                    "revenue": float(
                        item["revenue"] or 0
                    ),
                }
            )

        # CATEGORY BREAKDOWN
        categories = (
            order_items
            .values(
                "sparepart__category"
            )
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
                        item[
                            "sparepart__category"
                        ]
                        or ""
                    ),
                    "parts_sold": int(
                        item["parts_sold"] or 0
                    ),
                    "revenue": float(
                        item["revenue"] or 0
                    ),
                }
            )

        # BRAND BREAKDOWN
        brands = (
            order_items
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

        brand_data = []

        for item in brands:

            brand_data.append(
                {
                    "brand": (
                        item[
                            "sparepart__brand"
                        ]
                        or ""
                    ),
                    "parts_sold": int(
                        item["parts_sold"] or 0
                    ),
                    "revenue": float(
                        item["revenue"] or 0
                    ),
                }
            )

        # FINAL RESPONSE
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
            },
            status=status.HTTP_200_OK,
        )

