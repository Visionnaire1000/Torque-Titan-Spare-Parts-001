import uuid

import pytest
from rest_framework.test import APIClient

from app.models import (
    Users,
    SpareParts,
    Reviews,
)


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def user():
    return Users.objects.create(
        email="buyer@example.com",
        password_hash="test-password",
        role="buyer",
    )


@pytest.fixture
def second_user():
    return Users.objects.create(
        email="buyer2@example.com",
        password_hash="test-password",
        role="buyer",
    )


@pytest.fixture
def sparepart():
    return SpareParts.objects.create(
        brand="Michelin",
        category="tyre",
        vehicle_type="sedan",
        colour="Black",
        buying_price=20000,
        marked_price=20000,
        discount_percentage=0,
        image="https://example.com/tyre.jpg",
    )


@pytest.fixture
def review(user, sparepart):
    return Reviews.objects.create(
        user=user,
        sparepart=sparepart,
        rating=5,
        comment="Excellent tyre",
    )


@pytest.mark.django_db
def test_get_reviews_for_sparepart(
    client,
    sparepart,
    review,
):
    response = client.get(
        f"/reviews/{sparepart.id}/"
    )

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 1
    assert str(data[0]["id"]) == str(review.id)
    assert data[0]["rating"] == 5
    assert data[0]["comment"] == "Excellent tyre"


@pytest.mark.django_db
def test_get_reviews_for_nonexistent_sparepart(
    client,
):
    nonexistent_id = uuid.uuid4()

    response = client.get(
        f"/reviews/{nonexistent_id}/"
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_create_review_requires_authentication(
    client,
    sparepart,
):
    response = client.post(
        f"/reviews/{sparepart.id}/",
        {
            "rating": 5,
            "comment": "Great product",
        },
        format="json",
    )

    assert response.status_code == 401


@pytest.mark.django_db
def test_create_review(
    client,
    user,
    sparepart,
):
    client.force_authenticate(user=user)

    response = client.post(
        f"/reviews/{sparepart.id}/",
        {
            "rating": 5,
            "comment": "Great product",
        },
        format="json",
    )

    assert response.status_code == 201

    data = response.json()

    assert data["rating"] == 5
    assert data["comment"] == "Great product"

    assert Reviews.objects.filter(
        user=user,
        sparepart=sparepart,
    ).exists()


@pytest.mark.django_db
def test_create_review_with_invalid_rating(
    client,
    user,
    sparepart,
):
    client.force_authenticate(user=user)

    response = client.post(
        f"/reviews/{sparepart.id}/",
        {
            "rating": 6,
            "comment": "Invalid rating",
        },
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_create_review_with_non_integer_rating(
    client,
    user,
    sparepart,
):
    client.force_authenticate(user=user)

    response = client.post(
        f"/reviews/{sparepart.id}/",
        {
            "rating": "excellent",
            "comment": "Invalid rating",
        },
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_create_review_without_rating_or_comment(
    client,
    user,
    sparepart,
):
    client.force_authenticate(user=user)

    response = client.post(
        f"/reviews/{sparepart.id}/",
        {},
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_duplicate_review_is_rejected(
    client,
    user,
    sparepart,
    review,
):
    client.force_authenticate(user=user)

    response = client.post(
        f"/reviews/{sparepart.id}/",
        {
            "rating": 4,
            "comment": "Another review",
        },
        format="json",
    )

    assert response.status_code == 409

    assert Reviews.objects.filter(
        user=user,
        sparepart=sparepart,
    ).count() == 1


@pytest.mark.django_db
def test_owner_can_edit_review(
    client,
    user,
    review,
):
    client.force_authenticate(user=user)

    response = client.patch(
        f"/reviews/{review.id}/edit/",
        {
            "rating": 4,
            "comment": "Updated review",
        },
        format="json",
    )

    assert response.status_code == 200

    review.refresh_from_db()

    assert review.rating == 4
    assert review.comment == "Updated review"


@pytest.mark.django_db
def test_non_owner_cannot_edit_review(
    client,
    second_user,
    review,
):
    client.force_authenticate(user=second_user)

    response = client.patch(
        f"/reviews/{review.id}/edit/",
        {
            "rating": 1,
            "comment": "Trying to edit another review",
        },
        format="json",
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_owner_can_delete_review(
    client,
    user,
    review,
):
    client.force_authenticate(user=user)

    response = client.delete(
        f"/reviews/{review.id}/edit/"
    )

    assert response.status_code == 200

    assert not Reviews.objects.filter(
        id=review.id
    ).exists()


@pytest.mark.django_db
def test_non_owner_cannot_delete_review(
    client,
    second_user,
    review,
):
    client.force_authenticate(user=second_user)

    response = client.delete(
        f"/reviews/{review.id}/edit/"
    )

    assert response.status_code == 403

    assert Reviews.objects.filter(
        id=review.id
    ).exists()


@pytest.mark.django_db
def test_reaction_requires_authentication(
    client,
    review,
):
    response = client.post(
        f"/reviews/{review.id}/react/",
        {
            "is_like": True,
        },
        format="json",
    )

    assert response.status_code == 401


@pytest.mark.django_db
def test_user_can_like_review(
    client,
    second_user,
    review,
):
    client.force_authenticate(user=second_user)

    response = client.post(
        f"/reviews/{review.id}/react/",
        {
            "is_like": True,
        },
        format="json",
    )

    assert response.status_code == 200

    data = response.json()

    assert data["action"] == "added"
    assert data["review"]["total_likes"] == 1
    assert data["review"]["total_dislikes"] == 0
    assert data["review"]["user_reaction"] is True


@pytest.mark.django_db
def test_same_reaction_removes_reaction(
    client,
    second_user,
    review,
):
    client.force_authenticate(user=second_user)

    client.post(
        f"/reviews/{review.id}/react/",
        {
            "is_like": True,
        },
        format="json",
    )

    response = client.post(
        f"/reviews/{review.id}/react/",
        {
            "is_like": True,
        },
        format="json",
    )

    assert response.status_code == 200

    data = response.json()

    assert data["action"] == "removed"
    assert data["review"]["total_likes"] == 0
    assert data["review"]["user_reaction"] is None


@pytest.mark.django_db
def test_different_reaction_switches_reaction(
    client,
    second_user,
    review,
):
    client.force_authenticate(user=second_user)

    client.post(
        f"/reviews/{review.id}/react/",
        {
            "is_like": True,
        },
        format="json",
    )

    response = client.post(
        f"/reviews/{review.id}/react/",
        {
            "is_like": False,
        },
        format="json",
    )

    assert response.status_code == 200

    data = response.json()

    assert data["action"] == "switched"
    assert data["review"]["total_likes"] == 0
    assert data["review"]["total_dislikes"] == 1
    assert data["review"]["user_reaction"] is False


@pytest.mark.django_db
def test_user_cannot_react_to_own_review(
    client,
    user,
    review,
):
    client.force_authenticate(user=user)

    response = client.post(
        f"/reviews/{review.id}/react/",
        {
            "is_like": True,
        },
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_reaction_requires_is_like(
    client,
    second_user,
    review,
):
    client.force_authenticate(user=second_user)

    response = client.post(
        f"/reviews/{review.id}/react/",
        {},
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_reaction_requires_boolean(
    client,
    second_user,
    review,
):
    client.force_authenticate(user=second_user)

    response = client.post(
        f"/reviews/{review.id}/react/",
        {
            "is_like": "true",
        },
        format="json",
    )

    assert response.status_code == 400