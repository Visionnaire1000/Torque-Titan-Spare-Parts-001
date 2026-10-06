from utils.celery_worker import celery

from utils.brevo_email import (
    send_admin_credentials_email,
    send_new_login_email,
    send_otp_email,
    send_order_confirmation_email,
    send_order_status_email,
)


@celery.task(
    name="utils.tasks.send_email_task"
)
def send_email_task(
    user_email: str,
    otp_code: str,
    otp_type: str,
):
    success = send_otp_email(
        user_email,
        otp_code,
        otp_type,
    )

    return success


@celery.task(
    name="utils.tasks.send_admin_credentials_email_task"
)
def send_admin_credentials_email_task(
    user_email: str,
    password: str,
    role: str,
):
    success = send_admin_credentials_email(
        user_email,
        password,
        role,
    )

    return success


@celery.task(
    name="utils.tasks.send_order_confirmation_email_task"
)
def send_order_confirmation_email_task(
    user_email: str,
    order_id: str,
    total_price: str,
    payment_method: str,
):
    success = send_order_confirmation_email(
        user_email,
        order_id,
        total_price,
        payment_method,
    )

    return success


@celery.task(
    name="utils.tasks.send_order_status_email_task"
)
def send_order_status_email_task(
    user_email: str,
    order_id: str,
    order_status: str,
):
    success = send_order_status_email(
        user_email,
        order_id,
        order_status,
    )

    return success


@celery.task(
    name="utils.tasks.send_new_login_email_task"
)
def send_new_login_email_task(
    user_email: str,
    ip_address: str,
    user_agent: str,
):
    success = send_new_login_email(
        user_email,
        ip_address,
        user_agent,
    )

    return success