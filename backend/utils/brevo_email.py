def send_otp_email(to_email: str, otp_code: str):
    """
    Sandbox / dev version: prints OTP instead of sending email.
    """
    print(f"[SANDBOX] OTP for {to_email}: {otp_code}")
    return True
