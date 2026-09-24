from django.urls import path


from app.views.authViews import (
    RegisterView,
    VerifyAccountView,
    ResendOTPView,
    LoginView,
    GoogleLoginView,
    ForgotPasswordView,
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
    MyReviewsView,
    BuyerOrdersView,
)

from app.views.adminViews import (
    CreateAdminView,
    ListAdminsView,
    DeleteAdminView,
    AdminOrdersView,
    AdminSparePartsView,
    AdminReviewsView,
    AdminReviewsBySparePartView,
    ReviewsAnalyticsView,
    RevenueAnalyticsView,
)

from app.views.checkout.stripeViews import (
    CreateStripeSessionView,
    CancelStripeSessionView,
    StripeWebhookView,
)

from app.views.checkout.paystackViews import (
    CreatePaystackSessionView,
    VerifyPaystackSessionView,
    PaystackWebhookView,
)

from app.views.checkout.paypalViews import (
    CreatePayPalSessionView,
    CapturePayPalSessionView,
    CancelPaypalSessionView,
    PayPalWebhookView,
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
        "forgot-password/",
        ForgotPasswordView.as_view(),
        name="forgot-password",
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
        ReviewEditView.as_view(),
        name="review-reaction",
    ),

    path(
        "buyer-reviews/",
       MyReviewsView.as_view(),
       name="buyer-reviews",
    ),


    # ---------------------- BUYER ORDERS -------------------------------------
    path(
        "orders/",
        BuyerOrdersView.as_view(),
        name="orders",
    ),

    path(
        "orders/<str:order_id>/",
        BuyerOrdersView.as_view(),
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
        "checkout/create-stripe-session/",
        CreateStripeSessionView.as_view(),
        name="create-stripe-session",
    ),

     path(
        "checkout/stripe-cancel/",
        CancelStripeSessionView.as_view(),
        name="stripe-cancel",
    ),

    path(
        "webhook/stripe/",
        StripeWebhookView.as_view(),
        name="stripe-webhook",
    ),

    # ---------------------- PAYSTACK CHECKOUT -------------------------------------
    path(
        "checkout/create-paystack-session/",
        CreatePaystackSessionView.as_view(),
        name="create-paystack-session",
    ),

    path(
        "checkout/verify-paystack-session/<str:reference>/",
        VerifyPaystackSessionView.as_view(),
        name="verify-paystack-session",
    ),

    path(
        "webhook/paystack/",
        PaystackWebhookView.as_view(),
        name="paystack-webhook",
    ),

    # ---------------------- PAYPAL CHECKOUT -------------------------------------
    path(
        "checkout/create-paypal-session/",
        CreatePayPalSessionView.as_view(),
        name="create-paypal-session",
    ),
    
    path(
        "checkout/paypal-capture/",
        CapturePayPalSessionView.as_view(),
        name="paypal-capture",
    ),

    path(
        "checkout/paypal-cancel/",
        CancelPaypalSessionView.as_view(),
        name="paypal-cancel",
    ),

    path(
        "webhook/paypal/",
        PayPalWebhookView.as_view(),
        name="paypal-webhook",
    ),
       
    # ---------------------- DATA ANALYTICS -------------------------------------
    path(
        "admin/revenue-analytics/",
        RevenueAnalyticsView.as_view(),
        name="revenue-analytics",
    ),

    path(
        "admin/reviews-analytics/",
        ReviewsAnalyticsView.as_view(),
        name="reviews-analytics",
        ),
]