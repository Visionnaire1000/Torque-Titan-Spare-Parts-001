def send_otp_email(
    to_email: str,
    otp_code: str,
    otp_type: str,
):
    if otp_type == "verify_account":
        subject = "Verify Your Torque Titan Spares Account"
        email_title = "ACCOUNT VERIFICATION"

        message = (
            "Your Torque Titan Spares verification OTP is:\n\n"
            f"{otp_code}\n\n"
            "This OTP expires in 5 minutes.\n"
            "If you did not create this account, you can ignore this email."
        )

    elif otp_type == "change_password":
        subject = "Password Change OTP"
        email_title = "PASSWORD CHANGE"

        message = (
            "Your Torque Titan Spares password change OTP is:\n\n"
            f"{otp_code}\n\n"
            "This OTP expires in 5 minutes.\n"
            "If you did not request a password change, please secure your account."
        )

    elif otp_type == "delete_account":
        subject = "Account Deletion OTP"
        email_title = "ACCOUNT DELETION"

        message = (
            "Your Torque Titan Spares account deletion OTP is:\n\n"
            f"{otp_code}\n\n"
            "This OTP expires in 5 minutes.\n"
            "If you did not request account deletion, please secure your account immediately."
        )

    else:
        return False

    print(
        "\n"
        "========================================\n"
        f"{email_title}\n"
        "========================================\n"
        f"To: {to_email}\n"
        f"Subject: {subject}\n"
        "\n"
        f"{message}\n"
        "========================================\n"
    )

    return True


def send_admin_credentials_email(
    to_email: str,
    password: str,
    role: str,
):
    if role == "super_admin":
        role_display = "Super Admin"
    else:
        role_display = "Admin"

    print(
        "\n"
        "========================================\n"
        "ADMIN ACCOUNT CREATED\n"
        "========================================\n"
        f"To: {to_email}\n"
        f"Role: {role_display}\n"
        f"Email: {to_email}\n"
        f"Temporary Password: {password}\n"
        "\n"
        "IMPORTANT:\n"
        "This is your initial account password.\n"
        "You must change your password within 12 hours.\n"
        "If you do not change your password within 12 hours,\n"
        "your account will be locked.\n"
        "\n"
        "Please log in and change your password immediately.\n"
        "========================================\n"
    )

    return True


def send_order_confirmation_email(
    to_email: str,
    order_id: str,
    total_price: str,
    payment_method: str,
):
    payment_method_display = {
        "stripe": "Stripe",
        "paystack": "Paystack",
        "paypal": "PayPal",
    }.get(
        str(payment_method).lower(),
        str(payment_method).title(),
    )

    subject = "Your Order Has Been Confirmed"

    message = (
        "Your payment has been successfully received "
        "and your Torque Titan Spares order has been confirmed.\n\n"
        f"Order ID: {order_id}\n"
        "Payment Status: Paid\n"
        f"Payment Method: {payment_method_display}\n"
        f"Order Total: KES {total_price}\n\n"
        "Thank you for shopping with Torque Titan Spares."
    )

    print(
        "\n"
        "========================================\n"
        "ORDER CONFIRMATION EMAIL\n"
        "========================================\n"
        f"To: {to_email}\n"
        f"Subject: {subject}\n"
        "\n"
        f"{message}\n"
        "========================================\n"
    )

    return True


def send_order_cancellation_email(
    to_email: str,
    order_id: str,
    total_price: str,
    payment_method: str,
):
    payment_method_display = {
        "stripe": "Stripe",
        "paystack": "Paystack",
        "paypal": "PayPal",
    }.get(
        str(payment_method).lower(),
        str(payment_method).title(),
    )

    subject = "Your Order Has Been Cancelled"

    message = (
        "Your Torque Titan Spares order has been successfully cancelled.\n\n"
        f"Order ID: {order_id}\n"
        "Order Status: Cancelled\n"
        f"Payment Method: {payment_method_display}\n"
        f"Order Total: KES {total_price}\n\n"
        "Your order cancellation has been confirmed.\n"
        "Thank you for shopping with Torque Titan Spares."
    )

    print(
        "\n"
        "========================================\n"
        "ORDER CANCELLATION EMAIL\n"
        "========================================\n"
        f"To: {to_email}\n"
        f"Subject: {subject}\n"
        "\n"
        f"{message}\n"
        "========================================\n"
    )

    return True


def send_order_status_email(
    to_email: str,
    order_id: str,
    order_status: str,
):
    if order_status == "shipped":
        subject = "Your Order Has Been Shipped"

        message = (
            "Your Torque Titan Spares order has been shipped.\n\n"
            f"Order ID: {order_id}\n"
            "Status: Shipped\n\n"
            "Your order is now on its way."
        )

    elif order_status == "delivered":
        subject = "Your Order Has Been Delivered"

        message = (
            "Your Torque Titan Spares order has been delivered.\n\n"
            f"Order ID: {order_id}\n"
            "Status: Delivered\n\n"
            "Thank you for shopping with Torque Titan Spares."
        )

    else:
        return False

    print(
        "\n"
        "========================================\n"
        "ORDER STATUS EMAIL\n"
        "========================================\n"
        f"To: {to_email}\n"
        f"Subject: {subject}\n"
        "\n"
        f"{message}\n"
        "========================================\n"
    )

    return True


def send_new_login_email(
    to_email: str,
    ip_address: str,
    user_agent: str,
):
    subject = "New Login to Your Torque Titan Spares Account"

    message = (
        "A new login to your Torque Titan Spares account was detected.\n\n"
        f"IP Address: {ip_address}\n"
        f"Device / Browser: {user_agent}\n\n"
        "If this was you, no action is required.\n\n"
        "If you do not recognize this login, please change your "
        "password immediately and review your account activity."
    )

    print(
        "\n"
        "========================================\n"
        "NEW LOGIN EMAIL\n"
        "========================================\n"
        f"To: {to_email}\n"
        f"Subject: {subject}\n"
        "\n"
        f"{message}\n"
        "========================================\n"
    )

    return True
