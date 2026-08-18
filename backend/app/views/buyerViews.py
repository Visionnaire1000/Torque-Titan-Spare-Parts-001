from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import serializers, status

from app.models import (
    SpareParts,
    Orders,
    Reviews,
    ReviewReactions,
)


# --------------------------- SERIALIZATION ----------------------------------------------
class SparePartsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SpareParts
        fields = "__all__"


class ReviewsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reviews
        fields = "__all__"

def serialize_review(review, include_likes=False):
    
    data = ReviewsSerializer(review).data

    # Always return IDs as strings
    data["id"] = str(review.id)
    data["user_id"] = str(review.user_id)

    data["user_display_name"] = review.user_display_name
    data["total_likes"] = review.total_likes
    data["total_dislikes"] = review.total_dislikes

    if include_likes:
        data["likes"] = [
            {
                "user_id": str(reaction.user_id),
                "is_like": reaction.is_like,
            }
            for reaction in review.likes.all()
        ]

    return data

def serialize_sparepart(part, include_reviews=False):
    """Serialize a SpareParts instance without relying on Flask SerializerMixin."""

    data = SparePartsSerializer(part).data

    if include_reviews:
        data["reviews"] = [
            serialize_review(review)
            for review in part.reviews.all()
        ]

    return data


# --------------------------- SPAREPARTS ----------------------------------------------
class SparePartsListView(APIView):
    permission_classes = [AllowAny]

    PRICE_RANGES = {
        "tyre": {
            "sedan": {"low": 15000, "medium": 30000},
            "suv": {"low": 25000, "medium": 40000},
            "truck": {"low": 35000, "medium": 45000},
            "bus": {"low": 25000, "medium": 30000},
        },
        "rim": {
            "sedan": {"low": 20000, "medium": 30000},
            "suv": {"low": 25000, "medium": 35000},
            "truck": {"low": 30000, "medium": 35000},
            "bus": {"low": 25000, "medium": 30000},
        },
        "battery": {
            "sedan": {"low": 20000, "medium": 30000},
            "suv": {"low": 26000, "medium": 35000},
            "truck": {"low": 26000, "medium": 35000},
            "bus": {"low": 35000, "medium": 40000},
        },
        "oil filter": {
            "default": {"low": 7500, "medium": 8500},
        },
    }

    def get(self, request, part_id=None):

        # --------------------------- SINGLE ITEM ---------------------------
        if part_id:
            part = get_object_or_404(
                SpareParts,
                pk=part_id,
            )

            result = serialize_sparepart(
                part,
                include_reviews=True,
            )

            return Response(
                result,
                status=status.HTTP_200_OK,
            )

        # --------------------------- PAGINATION ---------------------------
        try:
            page = int(
                request.query_params.get("page", 1)
            )
        except (ValueError, TypeError):
            page = 1

        try:
            per_page = int(
                request.query_params.get("per_page", 16)
            )
        except (ValueError, TypeError):
            per_page = 16

        page = max(page, 1)
        per_page = max(per_page, 1)

        queryset = SpareParts.objects.all()

        # --------------------------- BASIC FILTERS ---------------------------
        category = (
            request.query_params.get("category") or ""
        ).lower()

        vehicle_type = (
            request.query_params.get("vehicle_type") or ""
        ).lower()

        brand = request.query_params.get("brand")
        colour = request.query_params.get("colour")

        if category:
            queryset = queryset.filter(
                category__icontains=category
            )

        if brand:
            queryset = queryset.filter(
                brand__icontains=brand
            )

        if vehicle_type:
            queryset = queryset.filter(
                vehicle_type__icontains=vehicle_type
            )

        if colour:
            queryset = queryset.filter(
                colour__icontains=colour
            )

        # --------------------------- PRICE FILTER ---------------------------
        price_filter = request.query_params.get("price")

        category_ranges = self.PRICE_RANGES.get(category)

        ranges = None

        if category_ranges:
            ranges = (
                category_ranges.get(vehicle_type)
                or category_ranges.get("default")
            )

        if price_filter and ranges:
            low = ranges["low"]
            medium = ranges["medium"]

            if price_filter == "low":
                queryset = queryset.filter(
                    buying_price__lt=low
                )

            elif price_filter == "medium":
                queryset = queryset.filter(
                    buying_price__gte=low,
                    buying_price__lte=medium,
                )

            elif price_filter == "high":
                queryset = queryset.filter(
                    buying_price__gt=medium
                )

        # --------------------------- PAGINATION ---------------------------
        total = queryset.count()

        start = (page - 1) * per_page
        end = start + per_page

        items = queryset[start:end]

        pages = (
            (total + per_page - 1) // per_page
            if total
            else 0
        )

        return Response(
            {
                "items": [
                    serialize_sparepart(part)
                    for part in items
                ],
                "total": total,
                "page": page,
                "pages": pages,
            },
            status=status.HTTP_200_OK,
        )


# --------------------------- REVIEWS ----------------------------------------------
class ReviewsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, part_id):
        """Get all reviews for a spare part."""

        part = get_object_or_404(
            SpareParts,
            pk=part_id,
        )

        reviews = (
            Reviews.objects
            .filter(sparepart_id=part.id)
            .select_related("user")
            .prefetch_related("likes")
            .order_by("-created_at")
        )

        result = []

        for review in reviews:
            review_dict = serialize_review(
                review,
                include_likes=True,
            )

            result.append(review_dict)

        return Response(
            result,
            status=status.HTTP_200_OK,
        )

    def post(self, request, part_id):
        """Create a review."""

        if not request.user.is_authenticated:
            return Response(
                {
                    "detail": (
                        "Authentication credentials "
                        "were not provided."
                    )
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        user = request.user

        part = get_object_or_404(
            SpareParts,
            pk=part_id,
        )

        data = request.data or {}

        # --------------------------- RATING ---------------------------
        parsed_rating = None
        rating = data.get("rating")

        if rating is not None:
            try:
                parsed_rating = int(rating)

                if not 1 <= parsed_rating <= 5:
                    return Response(
                        {
                            "error": (
                                "Rating must be between 1 and 5"
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            except (ValueError, TypeError):
                return Response(
                    {
                        "error": (
                            "Rating must be an integer"
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # --------------------------- COMMENT ---------------------------
        parsed_comment = None
        comment = data.get("comment")

        if isinstance(comment, str) and comment.strip():
            parsed_comment = comment.strip()

        if parsed_rating is None and not parsed_comment:
            return Response(
                {
                    "error": (
                        "Add a rating or comment"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --------------------------- DUPLICATE REVIEW ---------------------------
        existing = Reviews.objects.filter(
            user_id=user.id,
            sparepart_id=part.id,
        ).first()

        if existing:
            return Response(
                {
                    "error": (
                        "You have already reviewed this item"
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        # --------------------------- CREATE REVIEW ---------------------------
        try:
            with transaction.atomic():
                review = Reviews.objects.create(
                    user_id=user.id,
                    sparepart_id=part.id,
                    rating=parsed_rating,
                    comment=parsed_comment,
                )

        except Exception:
            return Response(
                {
                    "error": "Failed to save review"
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        review_dict = serialize_review(
            review,
            include_likes=True,
        )

        review_dict["total_likes"] = 0
        review_dict["total_dislikes"] = 0
        review_dict["likes"] = []

        return Response(
            review_dict,
            status=status.HTTP_201_CREATED,
        )

# --------------------------- REVIEW EDIT ----------------------------------------------
class ReviewEditView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, review_id):
        """Edit a review. Owner only."""

        review = get_object_or_404(
            Reviews,
            pk=review_id,
        )

        # --------------------------- OWNERSHIP ---------------------------
        if review.user_id != request.user.id:
            return Response(
                {
                    "error": (
                        "Cannot edit others' reviews"
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        data = request.data or {}

        # --------------------------- RATING ---------------------------
        if "rating" in data:

            rating = data.get("rating")

            if rating is None:
                review.rating = None

            else:

                try:
                    rating = int(rating)

                except (
                    ValueError,
                    TypeError,
                ):
                    return Response(
                        {
                            "error": (
                                "Rating must be an integer"
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if not 1 <= rating <= 5:
                    return Response(
                        {
                            "error": (
                                "Rating must be between 1 and 5"
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                review.rating = rating

        # --------------------------- COMMENT ---------------------------
        if "comment" in data:

            comment = data.get("comment")

            if (
                comment is None
                or not isinstance(comment, str)
                or not comment.strip()
            ):
                review.comment = None

            else:
                review.comment = comment.strip()

        # --------------------------- VALIDATE ---------------------------
        if (
            review.rating is None
            and not review.comment
        ):
            return Response(
                {
                    "error": (
                        "Review must have a rating "
                        "or comment"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --------------------------- UPDATE ---------------------------
        try:
            with transaction.atomic():
                review.save()

        except Exception:
            return Response(
                {
                    "error": "Failed to update review"
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            serialize_review(
                review,
                include_likes=True,
            ),
            status=status.HTTP_200_OK,
        )

    def delete(self, request, review_id):
        """Delete a review. Owner only."""

        review = get_object_or_404(
            Reviews,
            pk=review_id,
        )

        # --------------------------- OWNERSHIP ---------------------------
        if review.user_id != request.user.id:
            return Response(
                {
                    "error": (
                        "Cannot delete others' reviews"
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            with transaction.atomic():
                review.delete()

        except Exception:
            return Response(
                {
                    "error": "Failed to delete review"
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "message": "Review deleted"
            },
            status=status.HTTP_200_OK,
        )

# --------------------------- REVIEW REACTIONS ----------------------------------------------
class ReviewReactionsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, review_id):

        review = get_object_or_404(
            Reviews,
            pk=review_id,
        )

        current_user = request.user

        # --------------------------- OWN REVIEW ---------------------------
        if review.user_id == current_user.id:
            return Response(
                {
                    "error": (
                        "Cannot react to your own review"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --------------------------- DATA ---------------------------
        data = request.data or {}

        if "is_like" not in data:
            return Response(
                {
                    "error": "is_like is required"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        is_like = data.get("is_like")

        if not isinstance(is_like, bool):
            return Response(
                {
                    "error": (
                        "is_like must be a boolean"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --------------------------- EXISTING ---------------------------
        existing = (
            ReviewReactions.objects
            .filter(
                user=current_user,
                review=review,
            )
            .first()
        )

        action = "added"

        # --------------------------- REACTION ---------------------------
        try:

            with transaction.atomic():

                if existing:

                    # Same reaction -> remove
                    if existing.is_like == is_like:

                        existing.delete()

                        action = "removed"

                    # Different reaction -> switch
                    else:

                        existing.is_like = is_like

                        existing.save(
                            update_fields=[
                                "is_like"
                            ]
                        )

                        action = "switched"

                else:

                    ReviewReactions.objects.create(
                        user=current_user,
                        review=review,
                        is_like=is_like,
                    )

        except Exception:
            return Response(
                {
                    "error": (
                        "Failed to update reaction"
                    )
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # --------------------------- COUNTS ---------------------------
        total_likes = (
            ReviewReactions.objects
            .filter(
                review=review,
                is_like=True,
            )
            .count()
        )

        total_dislikes = (
            ReviewReactions.objects
            .filter(
                review=review,
                is_like=False,
            )
            .count()
        )

        # --------------------------- CURRENT REACTION ---------------------------
        current_reaction = (
            ReviewReactions.objects
            .filter(
                review=review,
                user=current_user,
            )
            .values_list(
                "is_like",
                flat=True,
            )
            .first()
        )

        return Response(
            {
                "action": action,

                "review": {
                    "id": review.id,

                    "total_likes": (
                        total_likes
                    ),

                    "total_dislikes": (
                        total_dislikes
                    ),

                    "user_reaction": (
                        current_reaction
                        if current_reaction is not None
                        else None
                    ),
                },
            },
            status=status.HTTP_200_OK,
        )


# --------------------------- ORDERS ----------------------------------------------
class OrdersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get logged-in user's orders."""

        current_user = request.user

        orders = (
            Orders.objects
            .prefetch_related(
                "order_items__sparepart"
            )
            .filter(
                user_id=current_user.id
            )
            .order_by("-created_at")
        )

        summary = []

        for order in orders:

            order_items = list(
                order.order_items.all()
            )

            # Calculate in memory.
            total_price = sum(
                float(item.subtotal or 0)
                for item in order_items
            )

            total_items = sum(
                int(item.quantity or 0)
                for item in order_items
            )

            created_at = (
                order.created_at.isoformat()
                if hasattr(order, "created_at")
                and order.created_at
                else None
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
                "created_at": created_at,

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
            {
                "orders": summary
            },
            status=status.HTTP_200_OK,
        )

    def patch(self, request, order_id):
        """Cancel a pending order."""

        current_user = request.user

        order = get_object_or_404(
            Orders,
            pk=order_id,
        )

        # --------------------------- OWNER CHECK ---------------------------
        if order.user_id != current_user.id:
            return Response(
                {
                    "error": (
                        "You cannot modify "
                        "someone else's order"
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        data = request.data or {}

        new_status = data.get("status")

        if not new_status:
            return Response(
                {
                    "error": "Missing status field"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --------------------------- ONLY PENDING ---------------------------
        if order.status != "pending":
            return Response(
                {
                    "error": (
                        "Order cannot be updated "
                        f"(current status: {order.status})"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --------------------------- VALID STATUS ---------------------------
        if new_status not in ["cancelled"]:
            return Response(
                {
                    "error": "Invalid status change"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --------------------------- UPDATE ---------------------------
        order.status = new_status

        order.save(
            update_fields=["status"]
        )

        return Response(
            {
                "message": (
                    f"Order {order_id} status "
                    f"updated to {new_status}"
                )
            },
            status=status.HTTP_200_OK,
        )