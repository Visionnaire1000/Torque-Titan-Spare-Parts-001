from utils.celery_worker import celery
from utils.brevo_email import send_otp_email

@celery.task(name="utils.tasks.send_email_task")
def send_email_task(user_email: str, otp_code: str):
    """
    Celery task to send OTP in sandbox mode.
    Recipient is ignored; always prints OTP.
    """
    # Prints OTP in worker logs
    success = send_otp_email(user_email, otp_code)
    return success
