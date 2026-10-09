from utils.celery_worker import celery

from django.utils import timezone

from app.models import Users

from utils.brevo_email import (
    send_admin_credentials_email,
    send_new_login_email,
    send_otp_email,
    send_order_confirmation_email,
    send_order_cancellation_email,
    send_order_status_email,
    send_account_locked_email,
    send_account_unlocked_email,
)


@celery.task(
    name="utils.tasks.send_email_task"
)
def send_email_task(
    user_email: str,
    otp_code: str,
    otp_type: str,
):
    return send_otp_email(
        user_email,
        otp_code,
        otp_type,
    )


@celery.task(
    name="utils.tasks.send_admin_credentials_email_task"
)
def send_admin_credentials_email_task(
    user_email: str,
    password: str,
    role: str,
):
    return send_admin_credentials_email(
        user_email,
        password,
        role,
    )


@celery.task(
    name="utils.tasks.send_order_confirmation_email_task"
)
def send_order_confirmation_email_task(
    user_email: str,
    order_id: str,
    total_price: str,
    payment_method: str,
):
    return send_order_confirmation_email(
        user_email,
        order_id,
        total_price,
        payment_method,
    )


@celery.task(
    name="utils.tasks.send_order_cancellation_email_task"
)
def send_order_cancellation_email_task(
    user_email: str,
    order_id: str,
    total_price: str,
    payment_method: str,
):
    return send_order_cancellation_email(
        user_email,
        order_id,
        total_price,
        payment_method,
    )


@celery.task(
    name="utils.tasks.send_order_status_email_task"
)
def send_order_status_email_task(
    user_email: str,
    order_id: str,
    order_status: str,
):
    return send_order_status_email(
        user_email,
        order_id,
        order_status,
    )


@celery.task(
    name="utils.tasks.send_new_login_email_task"
)
def send_new_login_email_task(
    user_email: str,
    ip_address: str,
    user_agent: str,
):
    return send_new_login_email(
        user_email,
        ip_address,
        user_agent,
    )


@celery.task(
    name="utils.tasks.send_account_locked_email_task"
)
def send_account_locked_email_task(
    user_email: str,
    role: str,
):
    return send_account_locked_email(
        user_email,
        role,
    )


@celery.task(
    name="utils.tasks.send_account_unlocked_email_task"
)
def send_account_unlocked_email_task(
    user_email: str,
    role: str,
):
    return send_account_unlocked_email(
        user_email,
        role,
    )


@celery.task(
    name="utils.tasks.lock_expired_initial_admin_accounts"
)
def lock_expired_initial_admin_accounts():
    now = timezone.now()

    expired_accounts = Users.objects.filter(
        role__in=[
            "admin",
            "super_admin",
        ],
        initial_password_changed=False,
        initial_password_expires__isnull=False,
        initial_password_expires__lte=now,
        is_active=True,
    )

    locked_count = 0

    for user in expired_accounts.iterator():
        user.is_active = False

        user.save(
            update_fields=[
                "is_active",
            ]
        )

        send_account_locked_email_task.delay(
            user.email,
            user.role,
        )

        locked_count += 1

    return locked_count
