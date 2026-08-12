from django.urls import path


from app.views.authViews import (
    RegisterView,
    VerifyAccountView,
    ResendOTPView,
    LoginView,
    ChangePasswordView,
    DeleteAccountView,
    TokenRefreshView,
)

from app.views.buyerViews import (
    SparePartsListView,
    ReviewsView,
    ReviewEditView,
    ReviewReactionsView,
    OrdersView,
)

from app.views.adminViews import (
    CreateAdminView,
    ListAdminsView,
    DeleteAdminView,
    AdminOrdersView,
    AdminSparePartsView,
    AdminReviewsView,
    AdminReviewReactionsView,
    AdminReviewsBySparePartView,
)


urlpatterns = [

    # ----------------------AUTHENTICATION-------------------------------------
    path(
        "register/",
        RegisterView.as_view(),
        name="register",
    ),

    path(
        "verify-account/",
        VerifyAccountView.as_view(),
        name="verify-account",
    ),

    path(
        "resend-otp/",
        ResendOTPView.as_view(),
        name="resend-otp",
    ),

    path(
        "login/",
        LoginView.as_view(),
        name="login",
    ),

    path(
        "change-password/",
        ChangePasswordView.as_view(),
        name="change-password",
    ),

    path(
        "delete-account/",
        DeleteAccountView.as_view(),
        name="delete-account",
    ),

    path(
        "refresh/",
        TokenRefreshView.as_view(),
        name="refresh",
    ),

    # ----------------------BUYER SPARE-PARTS-------------------------------------
    path(
        "spareparts/",
        SparePartsListView.as_view(),
        name="spareparts",
    ),

    path(
        "spareparts/<int:part_id>/",
        SparePartsListView.as_view(),
        name="sparepart-detail",
    ),

    # ----------------------BUYER-REVIEWS-------------------------------------
    path(
        "reviews/<int:part_id>/",
        ReviewsView.as_view(),
        name="reviews",
    ),

    path(
        "reviews/edit/<int:review_id>/",
        ReviewEditView.as_view(),
        name="review-edit",
    ),

    path(
        "reviews/<int:review_id>/react/",
        ReviewReactionsView.as_view(),
        name="review-reaction",
    ),

    # ----------------------BUYER-ORDERS-------------------------------------
    path(
        "orders/",
        OrdersView.as_view(),
        name="orders",
    ),

    path(
        "orders/<int:order_id>/",
        OrdersView.as_view(),
        name="order-detail",
    ),

    # ----------------------ADMIN-ACCOUNT-MANAGEMENT-------------------------------------
    path(
        "admin/create-admin/",
        CreateAdminView.as_view(),
        name="create-admin",
    ),

    path(
        "admin/admins/",
        ListAdminsView.as_view(),
        name="list-admins",
    ),

    path(
        "admin/delete-admin/<uuid:admin_id>/",
        DeleteAdminView.as_view(),
        name="delete-admin",
    ),

    # ----------------------ADMIN-SPAREPARTS-------------------------------------
    path(
        "admin/spareparts/",
        AdminSparePartsView.as_view(),
        name="admin-spareparts",
    ),

    path(
        "admin/spareparts/<int:spare_id>/",
        AdminSparePartsView.as_view(),
        name="admin-sparepart-detail",
    ),

    # ----------------------ADMIN-REVIEWS-------------------------------------
    path(
        "admin/reviews/",
        AdminReviewsView.as_view(),
        name="admin-reviews",
    ),

    path(
        "admin/reviews/<int:review_id>/reactions/",
        AdminReviewReactionsView.as_view(),
        name="admin-review-reactions",
    ),

    path(
        "admin/reviews/sparepart/<int:sparepart_id>/",
        AdminReviewsBySparePartView.as_view(),
        name="admin-reviews-by-sparepart",
    ),

    # ----------------------ADMIN-ORDERS-------------------------------------
    path(
        "admin/orders/",
        AdminOrdersView.as_view(),
        name="admin-orders",
    ),

    path(
        "admin/orders/<int:order_id>/",
        AdminOrdersView.as_view(),
        name="admin-order-detail",
    ),
]