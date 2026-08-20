from django.urls import path


from app.views.authViews import (
    RegisterView,
    VerifyAccountView,
    ResendOTPView,
    LoginView,
    GoogleLoginView,
    ChangePasswordView,
    DeleteAccountView,
    TokenRefreshView,
    LogoutView,
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

from app.views.stripeViews import (
    CreateCheckoutSessionView,
    StripeWebhookView,
)


urlpatterns = [

    # ---------------------- AUTHENTICATION -------------------------------------
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
        "auth/google/",
        GoogleLoginView.as_view(),
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
        "token/refresh/",
        TokenRefreshView.as_view(),
        name="refresh",
    ),

    path(
        "logout/",
        LogoutView.as_view(),
        name="logout",
    ),


    # ---------------------- BUYER SPARE-PARTS -------------------------------------
    path(
        "spareparts/",
        SparePartsListView.as_view(),
        name="spareparts",
    ),

    path(
        "spareparts/<str:part_id>/",
        SparePartsListView.as_view(),
        name="sparepart-detail",
    ),


    # ---------------------- BUYER REVIEWS -------------------------------------
    path(
        "reviews/<str:part_id>/",
        ReviewsView.as_view(),
        name="reviews",
    ),

    path(
        "reviews/<str:review_id>/react/",
        ReviewReactionsView.as_view(),
        name="review-reaction",
        ),

    path(
        "reviews/<str:review_id>/edit/",
        ReviewEditView.as_view(),
        name="review-edit",
    ),

    path(
        "reviews/<str:review_id>/delete/",
        ReviewReactionsView.as_view(),
        name="review-reaction",
    ),


    # ---------------------- BUYER ORDERS -------------------------------------
    path(
        "orders/",
        OrdersView.as_view(),
        name="orders",
    ),

    path(
        "orders/<str:order_id>/",
        OrdersView.as_view(),
        name="order-detail",
    ),


    # ---------------------- ADMIN ACCOUNT MANAGEMENT -------------------------------------
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
        "admin/delete-admin/<str:admin_id>/",
        DeleteAdminView.as_view(),
        name="delete-admin",
    ),


    # ---------------------- ADMIN SPARE-PARTS -------------------------------------
    path(
        "admin/spareparts/",
        AdminSparePartsView.as_view(),
        name="admin-spareparts",
    ),

    path(
        "admin/spareparts/<str:spare_id>/",
        AdminSparePartsView.as_view(),
        name="admin-sparepart-detail",
    ),


    # ---------------------- ADMIN REVIEWS -------------------------------------
    path(
        "admin/reviews/",
        AdminReviewsView.as_view(),
        name="admin-reviews",
    ),

    path(
        "admin/reviews/<str:review_id>/reactions/",
        AdminReviewReactionsView.as_view(),
        name="admin-review-reactions",
    ),

    path(
        "admin/reviews/sparepart/<str:sparepart_id>/",
        AdminReviewsBySparePartView.as_view(),
        name="admin-reviews-by-sparepart",
    ),


    # ---------------------- ADMIN ORDERS -------------------------------------
    path(
        "admin/orders/",
        AdminOrdersView.as_view(),
        name="admin-orders",
    ),

    path(
        "admin/orders/<str:order_id>/",
        AdminOrdersView.as_view(),
        name="admin-order-detail",
    ),

    # ---------------------- STRIPE CHECKOUT -------------------------------------
    path(
        "create-checkout-session/",
        CreateCheckoutSessionView.as_view(),
        name="create-checkout-session",
    ),
    
    path(
        "webhook/",
        StripeWebhookView.as_view(),
        name="admin-order-detail",
    ),
]