from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.core.exceptions import ValidationError
from django.shortcuts import get_object_or_404

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import serializers, status

from app.models import (
    SpareParts,
    Address,
    CartItems,
    Orders,
    Reviews,
    ReviewReactions,
)


# --------------------------- DECIMAL HELPERS ----------------------------------------------
def money_to_decimal(value):
    if value is None:
        return Decimal("0.00")

    try:
        return Decimal(str(value)).quantize(
            Decimal("0.01")
        )
    except (InvalidOperation, ValueError, TypeError):
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


class SparePartsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SpareParts
        fields = "__all__"


class ReviewsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reviews
        fields = "__all__"


# ------------------------------REVIEW SERIALIZATION---------------------------------------
def serialize_review(
    review,
    include_likes=False,
    current_user=None
):
    current_reaction = None

    if (
        current_user
        and current_user.is_authenticated
    ):
        reaction = ReviewReactions.objects.filter(
            review=review,
            user=current_user
        ).first()

        if reaction:
            current_reaction = reaction.is_like

    data = {
        "id": str(review.id),
        "user_id": str(review.user.id),
        "sparepart": str(review.sparepart.id),
        "rating": review.rating,
        "comment": review.comment,
        "created_at": review.created_at,
        "user_display_name": get_user_display_name(
            review.user
        ),
        "total_likes": review.total_likes,
        "total_dislikes": review.total_dislikes,
        "user_reaction": current_reaction,
    }

    if include_likes:
        data["likes"] = [
            {
                "user_id": str(reaction.user.id),
                "user_display_name": get_user_display_name(
                    reaction.user
                ),
            }
            for reaction in ReviewReactions.objects.filter(
                review=review,
                is_like=True
            ).select_related(
                "user",
                "user__profile"
            )
        ]

        data["dislikes"] = [
            {
                "user_id": str(reaction.user.id),
                "user_display_name": get_user_display_name(
                    reaction.user
                ),
            }
            for reaction in ReviewReactions.objects.filter(
                review=review,
                is_like=False
            ).select_related(
                "user",
                "user__profile"
            )
        ]

    return data

# ------------------------------SPARE PART SERIALIZATION---------------------------------------
def serialize_sparepart(
    part,
    include_reviews=False,
    current_user=None
):
    data = {
        "id": str(part.id),
        "category": part.category,
        "vehicle_type": part.vehicle_type,
        "brand": part.brand,
        "colour": part.colour,
        "buying_price": money_to_float(
            part.buying_price
        ),
        "marked_price": money_to_float(
            part.marked_price
        ),
        "discount_amount": money_to_float(
            part.discount_amount
        ),
        "discount_percentage": money_to_float(
            part.discount_percentage
        ),
        "image": part.image,
        "description": part.description,
        "average_rating": money_to_float(
            part.average_rating
        ),
        "total_reviews": part.total_reviews,
    }

    if include_reviews:
        reviews = Reviews.objects.filter(
            sparepart=part,
            user__role="buyer",
            comment__isnull=False
        ).exclude(
            comment=""
        ).select_related(
            "user",
            "user__profile"
        ).prefetch_related(
            "likes"
        )

        data["reviews"] = [
            serialize_review(
                review,
                current_user=current_user
            )
            for review in reviews
        ]

    return data


# ------------------------------SPARE PARTS---------------------------------------
class SparePartsListView(APIView):
    permission_classes = [AllowAny]

    PRICE_RANGES = {
        "tyre": {
            "sedan": (15000, 30000),
            "suv": (25000, 40000),
            "truck": (35000, 45000),
            "bus": (25000, 30000),
        },
        "rim": {
            "sedan": (20000, 30000),
            "suv": (25000, 35000),
            "truck": (30000, 35000),
            "bus": (25000, 35000),
        },
        "battery": {
            "sedan": (20000, 30000),
            "suv": (26000, 35000),
            "truck": (26000, 35000),
            "bus": (35000, 40000),
        },
        "oil_filter": {
            "sedan": (7500, 8500),
            "suv": (7500, 8500),
            "truck": (7500, 8500),
            "bus": (7500, 8500),
        },
    }

    def get(self, request, part_id=None):
        # ------------------------------SINGLE SPARE PART---------------------------------------
        if part_id:
            part = get_object_or_404(
                SpareParts,
                id=part_id
            )

            return Response(
                serialize_sparepart(
                    part,
                    include_reviews=True,
                    current_user=request.user
                ),
                status=status.HTTP_200_OK
            )

        # ------------------------------FILTERS---------------------------------------
        queryset = SpareParts.objects.all()

        category = request.query_params.get(
            "category"
        )
        vehicle_type = request.query_params.get(
            "vehicle_type"
        )
        brand = request.query_params.get(
            "brand"
        )
        colour = request.query_params.get(
            "colour"
        )
        min_price = request.query_params.get(
            "min_price"
        )
        max_price = request.query_params.get(
            "max_price"
        )
        top_discounts = request.query_params.get(
            "top_discounts"
        )

        if category:
            queryset = queryset.filter(
                category__iexact=category
            )

        if vehicle_type:
            queryset = queryset.filter(
                vehicle_type__iexact=vehicle_type
            )

        if brand:
            queryset = queryset.filter(
                brand__iexact=brand
            )

        if colour:
            queryset = queryset.filter(
                colour__iexact=colour
            )

        # ------------------------------PRICE FILTER---------------------------------------
        if min_price:
            try:
                queryset = queryset.filter(
                    marked_price__gte=money_to_decimal(
                        min_price
                    )
                )
            except ValueError:
                return Response(
                    {
                        "error": "Invalid minimum price."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        if max_price:
            try:
                queryset = queryset.filter(
                    marked_price__lte=money_to_decimal(
                        max_price
                    )
                )
            except ValueError:
                return Response(
                    {
                        "error": "Invalid maximum price."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        # ------------------------------PAGINATION---------------------------------------
        try:
            page = max(
                int(
                    request.query_params.get(
                        "page",
                        1
                    )
                ),
                1
            )
        except ValueError:
            page = 1

        page_size_param = request.query_params.get(
            "per_page"
        )

        if page_size_param is None:
            page_size_param = request.query_params.get(
                "page_size",
                12
            )

        try:
            page_size = max(
                int(page_size_param),
                1
            )
        except ValueError:
            page_size = 12

        # ------------------------------TOP DISCOUNTS---------------------------------------
        if top_discounts:
            top_discounts_value = top_discounts.strip().lower()

            if top_discounts_value in {
                "true",
                "1",
                "yes",
            }:
                queryset = queryset.filter(
                    discount_percentage__gt=0
                ).order_by(
                    "-discount_percentage",
                    "-discount_amount",
                    "-id",
                )

            else:
                try:
                    limit = int(
                        top_discounts
                    )

                    if limit <= 0:
                        raise ValueError

                    queryset = queryset.filter(
                        discount_percentage__gt=0
                    ).order_by(
                        "-discount_percentage",
                        "-discount_amount",
                        "-id",
                    )[:limit]

                except ValueError:
                    return Response(
                        {
                            "error": (
                                "Invalid top_discounts value."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

        # ------------------------------PAGINATION---------------------------------------
        total_items = queryset.count()

        start = (
            page - 1
        ) * page_size

        end = start + page_size

        parts = queryset[start:end]

        return Response(
            {
                "results": [
                    serialize_sparepart(
                        part,
                        current_user=request.user
                    )
                    for part in parts
                ],
                "count": total_items,
                "page": page,
                "page_size": page_size,
                "total_pages": (
                    (
                        total_items
                        + page_size
                        - 1
                    ) // page_size
                    if total_items
                    else 0
                ),
            },
            status=status.HTTP_200_OK
        )


# --------------------------- SPAREPARTS ----------------------------------------------
class SparePartsListView(APIView):
    permission_classes = [AllowAny]

    PRICE_RANGES = {
        "tyre": {
            "sedan": {
                "low": Decimal("15000.00"),
                "medium": Decimal("30000.00"),
            },
            "suv": {
                "low": Decimal("25000.00"),
                "medium": Decimal("40000.00"),
            },
            "truck": {
                "low": Decimal("35000.00"),
                "medium": Decimal("45000.00"),
            },
            "bus": {
                "low": Decimal("25000.00"),
                "medium": Decimal("30000.00"),
            },
        },

        "rim": {
            "sedan": {
                "low": Decimal("20000.00"),
                "medium": Decimal("30000.00"),
            },
            "suv": {
                "low": Decimal("25000.00"),
                "medium": Decimal("35000.00"),
            },
            "truck": {
                "low": Decimal("30000.00"),
                "medium": Decimal("35000.00"),
            },
            "bus": {
                "low": Decimal("25000.00"),
                "medium": Decimal("35000.00"),
            },
        },

        "battery": {
            "sedan": {
                "low": Decimal("20000.00"),
                "medium": Decimal("30000.00"),
            },
            "suv": {
                "low": Decimal("26000.00"),
                "medium": Decimal("35000.00"),
            },
            "truck": {
                "low": Decimal("26000.00"),
                "medium": Decimal("35000.00"),
            },
            "bus": {
                "low": Decimal("35000.00"),
                "medium": Decimal("40000.00"),
            },
        },

        "oil filter": {
            "default": {
                "low": Decimal("7500.00"),
                "medium": Decimal("8500.00"),
            },
        },
    }

    def get(
        self,
        request,
        part_id=None,
    ):

        # --------------------------- CURRENT USER ---------------------------
        current_user = (
            request.user
            if request.user.is_authenticated
            else None
        )

        # --------------------------- SINGLE ITEM ---------------------------
        if part_id:

            part = get_object_or_404(
                SpareParts,
                pk=part_id,
            )

            result = serialize_sparepart(
                part,
                include_reviews=True,
                current_user=current_user,
            )

            return Response(
                result,
                status=status.HTTP_200_OK,
            )

        # --------------------------- PAGINATION ---------------------------
        try:
            page = int(
                request.query_params.get(
                    "page",
                    1,
                )
            )

        except (
            ValueError,
            TypeError,
        ):
            page = 1

        try:
            per_page = int(
                request.query_params.get(
                    "per_page",
                    16,
                )
            )

        except (
            ValueError,
            TypeError,
        ):
            per_page = 16

        page = max(
            page,
            1,
        )

        per_page = max(
            per_page,
            1,
        )

        queryset = SpareParts.objects.all()

        # --------------------------- BASIC FILTERS ---------------------------
        category = (
            request.query_params.get(
                "category"
            )
            or ""
        ).lower()

        vehicle_type = (
            request.query_params.get(
                "vehicle_type"
            )
            or ""
        ).lower()

        brand = request.query_params.get(
            "brand"
        )

        colour = request.query_params.get(
            "colour"
        )

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
        price_filter = request.query_params.get(
            "price"
        )

        category_ranges = self.PRICE_RANGES.get(
            category
        )

        ranges = None

        if category_ranges:
            ranges = (
                category_ranges.get(
                    vehicle_type
                )
                or category_ranges.get(
                    "default"
                )
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

        # --------------------------- TOP DISCOUNTS ---------------------------
        top_discounts = (
            request.query_params.get(
                "top_discounts",
                ""
            ).lower()
            == "true"
        )

        if top_discounts and not category:

            all_items = list(
                queryset.order_by(
                    "-discount_percentage",
                    "id",
                )
            )

            grouped = {}

            for item in all_items:

                item_category = (
                    (item.category or "Other")
                    .strip()
                    .lower()
                )

                if item_category not in grouped:
                    grouped[item_category] = []

                grouped[item_category].append(
                    item
                )

            categories = sorted(
                grouped.keys(),
                key=lambda cat: (
                    grouped[cat][0].discount_percentage
                    if grouped[cat]
                    else 0
                ),
                reverse=True,
            )

            selected = []

            while len(selected) < per_page:

                added = False

                for cat in categories:

                    if not grouped[cat]:
                        continue

                    selected.append(
                        grouped[cat].pop(0)
                    )

                    added = True

                    if len(selected) >= per_page:
                        break

                if not added:
                    break

            return Response(
                {
                    "items": [
                        serialize_sparepart(
                            part,
                            current_user=current_user,
                        )
                        for part in selected
                    ],
                    "total": len(selected),
                    "page": 1,
                    "pages": 1,
                },
                status=status.HTTP_200_OK,
            )

        # --------------------------- PAGINATION ---------------------------
        total = queryset.count()

        start = (
            page - 1
        ) * per_page

        end = start + per_page

        items = queryset[start:end]

        pages = (
            (
                total
                + per_page
                - 1
            )
            // per_page
            if total
            else 0
        )

        return Response(
            {
                "items": [
                    serialize_sparepart(
                        part,
                        current_user=current_user,
                    )
                    for part in items
                ],
                "total": total,
                "page": page,
                "pages": pages,
            },
            status=status.HTTP_200_OK,
        )


# ------------------------------REVIEWS---------------------------------------
class ReviewsView(APIView):
    permission_classes = [AllowAny]

    def get(
        self,
        request,
        part_id
    ):
        # ------------------------------GET REVIEWS---------------------------------------
        part = get_object_or_404(
            SpareParts,
            id=part_id
        )

        reviews = Reviews.objects.filter(
            sparepart=part,
            user__role="buyer"
        ).select_related(
            "user",
            "user__profile"
        ).prefetch_related(
            "likes"
        )

        return Response(
            [
                serialize_review(
                    review,
                    current_user=request.user
                )
                for review in reviews
            ],
            status=status.HTTP_200_OK
        )

    def post(
        self,
        request,
        part_id
    ):
        # ------------------------------CREATE REVIEW---------------------------------------
        if not request.user.is_authenticated:
            return Response(
                {
                    "error": (
                        "Authentication required."
                    )
                },
                status=status.HTTP_401_UNAUTHORIZED
            )

        if request.user.role != "buyer":
            return Response(
                {
                    "error": (
                        "Only buyer accounts can "
                        "create reviews."
                    )
                },
                status=status.HTTP_403_FORBIDDEN
            )

        part = get_object_or_404(
            SpareParts,
            id=part_id
        )

        rating = request.data.get(
            "rating"
        )

        comment = request.data.get(
            "comment"
        )

        # ------------------------------VALIDATE RATING---------------------------------------
        if rating is not None:
            try:
                rating = int(rating)
            except (
                TypeError,
                ValueError
            ):
                return Response(
                    {
                        "error": (
                            "Rating must be an integer "
                            "from 1 to 5."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            if rating < 1 or rating > 5:
                return Response(
                    {
                        "error": (
                            "Rating must be between "
                            "1 and 5."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        # ------------------------------VALIDATE COMMENT---------------------------------------
        if comment is not None:
            comment = str(
                comment
            ).strip()

        if not comment:
            comment = None

        # ------------------------------REQUIRE RATING OR COMMENT---------------------------------------
        if rating is None and comment is None:
            return Response(
                {
                    "error": (
                        "A rating or comment is "
                        "required to submit a review."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # ------------------------------CHECK EXISTING REVIEW---------------------------------------
        if Reviews.objects.filter(
            user=request.user,
            sparepart=part
        ).exists():
            return Response(
                {
                    "error": (
                        "You have already reviewed "
                        "this spare part."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # ------------------------------CREATE REVIEW---------------------------------------
        with transaction.atomic():
            review = Reviews.objects.create(
                user=request.user,
                sparepart=part,
                rating=rating,
                comment=comment
            )

        return Response(
            {
                "message": (
                    "Rating submitted successfully."
                    if rating is not None and comment is None
                    else
                    "Comment submitted successfully."
                    if rating is None and comment is not None
                    else
                    "Review submitted successfully."
                ),
                "review_id": str(
                    review.id
                ),
            },
            status=status.HTTP_201_CREATED
        )


# ------------------------------EDIT REVIEW---------------------------------------
class ReviewEditView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(
        self,
        request,
        review_id
    ):
        # ------------------------------UPDATE REVIEW---------------------------------------
        if request.user.role != "buyer":
            return Response(
                {
                    "error": (
                        "Only buyer accounts can "
                        "edit reviews."
                    )
                },
                status=status.HTTP_403_FORBIDDEN
            )

        review = get_object_or_404(
            Reviews,
            id=review_id
        )

        if review.user_id != request.user.id:
            return Response(
                {
                    "error": (
                        "You can only edit your "
                        "own review."
                    )
                },
                status=status.HTTP_403_FORBIDDEN
            )

        rating = request.data.get(
            "rating",
            review.rating
        )

        comment = request.data.get(
            "comment",
            review.comment
        )

        # ------------------------------VALIDATE RATING---------------------------------------
        if rating is not None:
            try:
                rating = int(rating)
            except (
                TypeError,
                ValueError
            ):
                return Response(
                    {
                        "error": (
                            "Rating must be an integer "
                            "from 1 to 5."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            if rating < 1 or rating > 5:
                return Response(
                    {
                        "error": (
                            "Rating must be between "
                            "1 and 5."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        # ------------------------------VALIDATE COMMENT---------------------------------------
        if comment is not None:
            comment = str(
                comment
            ).strip()

        if not comment:
            comment = None

        # ------------------------------REQUIRE RATING OR COMMENT---------------------------------------
        if rating is None and comment is None:
            return Response(
                {
                    "error": (
                        "A rating or comment is "
                        "required for a review."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # ------------------------------UPDATE REVIEW---------------------------------------
        with transaction.atomic():
            review.rating = rating
            review.comment = comment
            review.save(
                update_fields=[
                    "rating",
                    "comment"
                ]
            )

        return Response(
            {
                "message": (
                    "Rating updated successfully."
                    if rating is not None and comment is None
                    else
                    "Comment updated successfully."
                    if rating is None and comment is not None
                    else
                    "Review updated successfully."
                ),
                "review_id": str(
                    review.id
                ),
            },
            status=status.HTTP_200_OK
        )

    def delete(
        self,
        request,
        review_id
    ):
        # ------------------------------DELETE REVIEW---------------------------------------
        if request.user.role != "buyer":
            return Response(
                {
                    "error": (
                        "Only buyer accounts can "
                        "delete reviews."
                    )
                },
                status=status.HTTP_403_FORBIDDEN
            )

        review = get_object_or_404(
            Reviews,
            id=review_id
        )

        if review.user_id != request.user.id:
            return Response(
                {
                    "error": (
                        "You can only delete your "
                        "own review."
                    )
                },
                status=status.HTTP_403_FORBIDDEN
            )

        with transaction.atomic():
            review.delete()

        return Response(
            {
                "message": (
                    "Review deleted successfully."
                )
            },
            status=status.HTTP_200_OK
        )


# ------------------------------REVIEW REACTIONS---------------------------------------
class ReviewReactionsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(
        self,
        request,
        review_id
    ):
        # ------------------------------REACT TO COMMENT---------------------------------------
        if request.user.role != "buyer":
            return Response(
                {
                    "error": (
                        "Only buyer accounts can "
                        "react to comments."
                    )
                },
                status=status.HTTP_403_FORBIDDEN
            )

        review = get_object_or_404(
            Reviews,
            id=review_id
        )

        if not review.comment:
            return Response(
                {
                    "error": (
                        "Only comments can receive "
                        "reactions."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if review.user_id == request.user.id:
            return Response(
                {
                    "error": (
                        "You cannot react to your "
                        "own comment."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        is_like = request.data.get(
            "is_like"
        )

        if not isinstance(
            is_like,
            bool
        ):
            return Response(
                {
                    "error": (
                        "is_like must be a boolean."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # ------------------------------CREATE OR UPDATE REACTION---------------------------------------
        with transaction.atomic():
            reaction = ReviewReactions.objects.filter(
                review=review,
                user=request.user
            ).first()

            if reaction:
                if reaction.is_like == is_like:
                    reaction.delete()

                    return Response(
                        {
                            "message": (
                                "Reaction removed."
                            ),
                            "total_likes": (
                                review.total_likes
                            ),
                            "total_dislikes": (
                                review.total_dislikes
                            ),
                            "current_user_reaction": None,
                        },
                        status=status.HTTP_200_OK
                    )

                reaction.is_like = is_like

                reaction.save(
                    update_fields=[
                        "is_like"
                    ]
                )
            else:
                reaction = ReviewReactions.objects.create(
                    review=review,
                    user=request.user,
                    is_like=is_like
                )

        return Response(
            {
                "message": (
                    "Reaction updated."
                ),
                "total_likes": (
                    review.total_likes
                ),
                "total_dislikes": (
                    review.total_dislikes
                ),
                "current_user_reaction": (
                    "like"
                    if reaction.is_like
                    else "dislike"
                ),
            },
            status=status.HTTP_200_OK
        )


# ------------------------------MY REVIEWS---------------------------------------
class MyReviewsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(
        self,
        request
    ):
        # ------------------------------GET MY REVIEWS---------------------------------------
        if request.user.role != "buyer":
            return Response(
                {
                    "error": (
                        "Only buyer accounts can "
                        "access buyer reviews."
                    )
                },
                status=status.HTTP_403_FORBIDDEN
            )

        reviews = Reviews.objects.filter(
            user=request.user
        ).select_related(
            "sparepart",
            "user",
            "user__profile"
        ).prefetch_related(
            "likes"
        )

        return Response(
            [
                {
                    "id": str(review.id),
                    "sparepart_id": str(
                        review.sparepart.id
                    ),
                    "sparepart": {
                        "id": str(
                            review.sparepart.id
                        ),
                        "brand": review.sparepart.brand,
                        "category": review.sparepart.category,
                        "vehicle_type": (
                            review.sparepart.vehicle_type
                        ),
                        "image_url": review.sparepart.image,
                        "buying_price": (
                            review.sparepart.buying_price
                        ),
                        "discount_percentage": (
                            review.sparepart.discount_percentage
                        ),
                    },
                    "user_display_name": get_user_display_name(
                        review.user
                    ),
                    "rating": review.rating,
                    "comment": review.comment,
                    "created_at": review.created_at,
                    "total_likes": review.total_likes,
                    "total_dislikes": review.total_dislikes,
                }
                for review in reviews
            ],
            status=status.HTTP_200_OK
        )


# ------------------------------ADDRESS---------------------------------------
class BuyerAddressView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    def serialize_address(
        self,
        address
    ):

        return {
            "id": str(
                address.id
            ),
            "user": str(
                address.user.id
            ),
            "street": address.street,
            "city": address.city,
            "postal_code": address.postal_code,
            "country": address.country,
            "created_at": address.created_at,
            "updated_at": address.updated_at,
        }

    def check_buyer(
        self,
        request
    ):

        if request.user.role != "buyer":

            return Response(
                {
                    "error": (
                        "Only buyer accounts have "
                        "addresses."
                    )
                },
                status=status.HTTP_403_FORBIDDEN
            )

        return None

    def handle_validation_error(
        self,
        error
    ):

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
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            {
                "error": error.messages
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    def get(
        self,
        request
    ):

        buyer_error = self.check_buyer(
            request
        )

        if buyer_error:
            return buyer_error

        address = Address.objects.filter(
            user=request.user
        ).first()

        if not address:

            return Response(
                {
                    "error": (
                        "Address does not exist."
                    )
                },
                status=status.HTTP_404_NOT_FOUND
            )

        return Response(
            self.serialize_address(
                address
            ),
            status=status.HTTP_200_OK
        )

    def post(
        self,
        request
    ):

        buyer_error = self.check_buyer(
            request
        )

        if buyer_error:
            return buyer_error

        if Address.objects.filter(
            user=request.user
        ).exists():

            return Response(
                {
                    "error": (
                        "You already have an address."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        street = request.data.get(
            "street"
        )

        city = request.data.get(
            "city"
        )

        postal_code = request.data.get(
            "postal_code"
        )

        country = request.data.get(
            "country"
        )

        if (
            street is None
            or not str(
                street
            ).strip()
        ):

            return Response(
                {
                    "error": (
                        "Street is required."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if (
            city is None
            or not str(
                city
            ).strip()
        ):

            return Response(
                {
                    "error": (
                        "City is required."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if (
            country is None
            or not str(
                country
            ).strip()
        ):

            return Response(
                {
                    "error": (
                        "Country is required."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        address = Address(
            user=request.user,
            street=str(
                street
            ).strip(),
            city=str(
                city
            ).strip(),
            postal_code=(
                str(
                    postal_code
                ).strip()
                if postal_code is not None
                else ""
            ),
            country=str(
                country
            ).strip(),
        )

        try:

            address.full_clean()

            address.save()

        except ValidationError as error:

            return self.handle_validation_error(
                error
            )

        return Response(
            self.serialize_address(
                address
            ),
            status=status.HTTP_201_CREATED
        )

    def put(
        self,
        request
    ):

        buyer_error = self.check_buyer(
            request
        )

        if buyer_error:
            return buyer_error

        address = Address.objects.filter(
            user=request.user
        ).first()

        if not address:

            return Response(
                {
                    "error": (
                        "Address does not exist."
                    )
                },
                status=status.HTTP_404_NOT_FOUND
            )

        street = request.data.get(
            "street"
        )

        city = request.data.get(
            "city"
        )

        postal_code = request.data.get(
            "postal_code"
        )

        country = request.data.get(
            "country"
        )

        if (
            street is None
            or not str(
                street
            ).strip()
        ):

            return Response(
                {
                    "error": (
                        "Street is required."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if (
            city is None
            or not str(
                city
            ).strip()
        ):

            return Response(
                {
                    "error": (
                        "City is required."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if (
            country is None
            or not str(
                country
            ).strip()
        ):

            return Response(
                {
                    "error": (
                        "Country is required."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        address.street = str(
            street
        ).strip()

        address.city = str(
            city
        ).strip()

        address.postal_code = (
            str(
                postal_code
            ).strip()
            if postal_code is not None
            else ""
        )

        address.country = str(
            country
        ).strip()

        try:

            address.full_clean()

            address.save()

        except ValidationError as error:

            return self.handle_validation_error(
                error
            )

        return Response(
            self.serialize_address(
                address
            ),
            status=status.HTTP_200_OK
        )

    def patch(
        self,
        request
    ):

        buyer_error = self.check_buyer(
            request
        )

        if buyer_error:
            return buyer_error

        address = Address.objects.filter(
            user=request.user
        ).first()

        if not address:

            return Response(
                {
                    "error": (
                        "Address does not exist."
                    )
                },
                status=status.HTTP_404_NOT_FOUND
            )

        allowed_fields = {
            "street",
            "city",
            "postal_code",
            "country",
        }

        invalid_fields = (
            set(request.data.keys())
            - allowed_fields
        )

        if invalid_fields:

            return Response(
                {
                    "error": (
                        "Only street, city, postal_code "
                        "and country can be edited."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if not request.data:

            return Response(
                {
                    "error": (
                        "At least one address field "
                        "is required."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        for field in allowed_fields:

            if field not in request.data:
                continue

            value = request.data.get(
                field
            )

            if field != "postal_code":

                if (
                    value is None
                    or not str(
                        value
                    ).strip()
                ):

                    return Response(
                        {
                            "error": (
                                f"{field.replace('_', ' ').capitalize()} "
                                "cannot be empty."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

                value = str(
                    value
                ).strip()

            else:

                if value is None:

                    value = ""

                else:

                    value = str(
                        value
                    ).strip()

            setattr(
                address,
                field,
                value,
            )

        try:

            address.full_clean()

            address.save()

        except ValidationError as error:

            return self.handle_validation_error(
                error
            )

        return Response(
            self.serialize_address(
                address
            ),
            status=status.HTTP_200_OK
        )

    def delete(
        self,
        request
    ):

        buyer_error = self.check_buyer(
            request
        )

        if buyer_error:
            return buyer_error

        address = Address.objects.filter(
            user=request.user
        ).first()

        if not address:

            return Response(
                {
                    "error": (
                        "Address does not exist."
                    )
                },
                status=status.HTTP_404_NOT_FOUND
            )

        address.delete()

        return Response(
            {
                "message": (
                    "Address deleted successfully."
                )
            },
            status=status.HTTP_200_OK
        )


# ------------------------------ CART ITEMS ---------------------------------------
class CartItemsView(APIView):
    permission_classes = [IsAuthenticated]

    def serialize_cart_item(
        self,
        cart_item
    ):
        sparepart = cart_item.sparepart

        unit_price = (
            money_to_decimal(
                sparepart.marked_price
            )
            - money_to_decimal(
                sparepart.discount_amount
            )
        ).quantize(
            Decimal("0.01")
        )

        subtotal = (
            unit_price
            * cart_item.quantity
        ).quantize(
            Decimal("0.01")
        )

        return {
            "id": str(cart_item.id),
            "sparepart": serialize_sparepart(
                sparepart
            ),
            "quantity": cart_item.quantity,
            "unit_price": money_to_float(
                unit_price
            ),
            "subtotal": money_to_float(
                subtotal
            ),
            "created_at": cart_item.created_at,
            "updated_at": cart_item.updated_at,
        }

    def get(
        self,
        request
    ):
        cart_items = (
            CartItems.objects
            .filter(
                user=request.user
            )
            .select_related(
                "sparepart"
            )
            .order_by(
                "-created_at"
            )
        )

        if not cart_items.exists():
            return Response(
                {
                    "items": [],
                    "total_quantity": 0,
                    "total_price": 0.0,
                },
                status=status.HTTP_200_OK
            )

        items = [
            self.serialize_cart_item(
                cart_item
            )
            for cart_item in cart_items
        ]

        total_price = sum(
            (
                money_to_decimal(
                    item["subtotal"]
                )
                for item in items
            ),
            Decimal("0.00")
        ).quantize(
            Decimal("0.01")
        )

        total_quantity = sum(
            item["quantity"]
            for item in items
        )

        return Response(
            {
                "items": items,
                "total_quantity": total_quantity,
                "total_price": money_to_float(
                    total_price
                ),
            },
            status=status.HTTP_200_OK
        )

    def post(
        self,
        request
    ):
        sparepart_id = request.data.get(
            "sparepart_id"
        )

        quantity = request.data.get(
            "quantity",
            1
        )

        if not sparepart_id:
            return Response(
                {
                    "error": (
                        "sparepart_id is required."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            quantity = int(
                quantity
            )
        except (
            TypeError,
            ValueError
        ):
            return Response(
                {
                    "error": (
                        "Quantity must be a "
                        "positive integer."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if quantity <= 0:
            return Response(
                {
                    "error": (
                        "Quantity must be greater "
                        "than zero."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        sparepart = get_object_or_404(
            SpareParts,
            id=sparepart_id
        )

        with transaction.atomic():
            cart_item, created = (
                CartItems.objects
                .select_for_update()
                .get_or_create(
                    user=request.user,
                    sparepart=sparepart,
                    defaults={
                        "quantity": quantity
                    }
                )
            )

            if not created:
                cart_item.quantity += quantity

                cart_item.save(
                    update_fields=[
                        "quantity",
                        "updated_at"
                    ]
                )

        return Response(
            self.serialize_cart_item(
                cart_item
            ),
            status=(
                status.HTTP_201_CREATED
                if created
                else status.HTTP_200_OK
            )
        )

    def patch(
        self,
        request,
        cart_item_id
    ):
        cart_item = get_object_or_404(
            CartItems,
            id=cart_item_id,
            user=request.user
        )

        quantity = request.data.get(
            "quantity"
        )

        if quantity is None:
            return Response(
                {
                    "error": (
                        "quantity is required."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            quantity = int(
                quantity
            )
        except (
            TypeError,
            ValueError
        ):
            return Response(
                {
                    "error": (
                        "Quantity must be a "
                        "positive integer."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if quantity <= 0:
            return Response(
                {
                    "error": (
                        "Quantity must be greater "
                        "than zero. Use DELETE "
                        "to remove the item."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        cart_item.quantity = quantity

        cart_item.save(
            update_fields=[
                "quantity",
                "updated_at"
            ]
        )

        return Response(
            self.serialize_cart_item(
                cart_item
            ),
            status=status.HTTP_200_OK
        )

    def delete(
        self,
        request,
        cart_item_id
    ):
        cart_item = get_object_or_404(
            CartItems,
            id=cart_item_id,
            user=request.user
        )

        cart_item.delete()

        return Response(
            {
                "message": (
                    "Item removed from cart successfully."
                )
            },
            status=status.HTTP_200_OK
        )

    
# ------------------------------BUYER ORDERS---------------------------------------
class BuyerOrdersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(
        self,
        request
    ):
        # ------------------------------GET BUYER ORDERS---------------------------------------
        if request.user.role != "buyer":
            return Response(
                {
                    "error": (
                        "Only buyer accounts have "
                        "orders."
                    )
                },
                status=status.HTTP_403_FORBIDDEN
            )

        orders = Orders.objects.filter(
            user=request.user,
            paid=True
        ).select_related(
            "address"
        ).prefetch_related(
            "order_items__sparepart"
        ).order_by(
            "-created_at"
        )

        response_data = []

        for order in orders:
            
            # ------------------------------ORDER ITEMS---------------------------------------
            items = []
            total_quantity = 0

            for item in order.order_items.all():
                subtotal = money_to_decimal(
                    item.subtotal
                )

                quantity = item.quantity

                total_quantity += quantity

                items.append(
                    {
                        "id": str(item.id),
                        "sparepart": (
                            serialize_sparepart(
                                item.sparepart
                            )
                        ),
                        "quantity": quantity,
                        "unit_price": (
                            money_to_float(
                                item.unit_price
                            )
                        ),
                        "subtotal": (
                            money_to_float(
                                subtotal
                            )
                        ),
                    }
                )

            # ------------------------------ORDER ADDRESS---------------------------------------
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

            # ------------------------------ORDER RESPONSE---------------------------------------
            response_data.append(
                {
                    "id": str(order.id),
                    "status": order.status,
                    "paid": order.paid,
                    "payment_method": (
                        order.payment_method
                    ),
                    "created_at": order.created_at,
                    "total_price": (
                        money_to_float(
                            money_to_decimal(
                                order.total_price
                            )
                        )
                    ),
                    "total_quantity": (
                        total_quantity
                    ),
                    "address": address_string,
                    "address_details": (
                        address_details
                    ),
                    "items": items,
                }
            )

        return Response(
            response_data,
            status=status.HTTP_200_OK
        )

    def patch(
        self,
        request,
        order_id
    ):
        # ------------------------------CANCEL ORDER---------------------------------------
        if request.user.role != "buyer":
            return Response(
                {
                    "error": (
                        "Only buyer accounts can "
                        "cancel orders."
                    )
                },
                status=status.HTTP_403_FORBIDDEN
            )

        order = get_object_or_404(
            Orders,
            id=order_id
        )

        if order.user_id != request.user.id:
            return Response(
                {
                    "error": (
                        "You can only update your "
                        "own orders."
                    )
                },
                status=status.HTTP_403_FORBIDDEN
            )

        if not order.paid:
            return Response(
                {
                    "error": (
                        "Only paid orders can be "
                        "cancelled."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if order.status != "pending":
            return Response(
                {
                    "error": (
                        "Only pending orders can "
                        "be cancelled."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        new_status = request.data.get(
            "status"
        )

        if new_status != "cancelled":
            return Response(
                {
                    "error": (
                        "The only allowed status "
                        "update is cancelled."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            order.status = "cancelled"

            order.save(
                update_fields=[
                    "status"
                ]
            )

        return Response(
            {
                "message": (
                    "Order cancelled successfully."
                ),
                "order_id": str(
                    order.id
                ),
                "status": order.status,
            },
            status=status.HTTP_200_OK
        )