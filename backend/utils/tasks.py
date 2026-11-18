import hashlib
import logging
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from utils.celery_worker import celery
from utils.cloudflare import (
    delete_image_from_r2,
    get_r2_client,
    get_r2_object_key,
)

from app.models import Users, SpareParts

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


logger = logging.getLogger(__name__)


# ------------------------------------ EMAILS -----------------------------------
@celery.task(name="utils.tasks.send_email_task")
def send_email_task(
    user_email: str,
    otp_code: str,
    otp_type: str,
):
    return send_otp_email(user_email, otp_code, otp_type)


@celery.task(name="utils.tasks.send_admin_credentials_email_task")
def send_admin_credentials_email_task(
    user_email: str,
    password: str,
    role: str,
):
    return send_admin_credentials_email(user_email, password, role)


@celery.task(name="utils.tasks.send_order_confirmation_email_task")
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


@celery.task(name="utils.tasks.send_order_cancellation_email_task")
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


@celery.task(name="utils.tasks.send_order_status_email_task")
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


@celery.task(name="utils.tasks.send_new_login_email_task")
def send_new_login_email_task(
    user_email: str,
    ip_address: str,
    user_agent: str,
):
    return send_new_login_email(user_email, ip_address, user_agent)


@celery.task(name="utils.tasks.send_account_locked_email_task")
def send_account_locked_email_task(
    user_email: str,
    role: str,
):
    return send_account_locked_email(user_email, role)


@celery.task(name="utils.tasks.send_account_unlocked_email_task")
def send_account_unlocked_email_task(
    user_email: str,
    role: str,
):
    return send_account_unlocked_email(user_email, role)


# -------------------------- AUTOMATIC ADMIN LOCKING ----------------------------
@celery.task(name="utils.tasks.lock_expired_initial_admin_accounts")
def lock_expired_initial_admin_accounts():
    now = timezone.now()

    expired_accounts = Users.objects.filter(
        role__in=["admin", "super_admin"],
        initial_password_changed=False,
        initial_password_expires__isnull=False,
        initial_password_expires__lte=now,
        is_active=True,
    )

    locked_count = 0

    for user in expired_accounts.iterator():
        updated = Users.objects.filter(
            pk=user.pk,
            role__in=["admin", "super_admin"],
            initial_password_changed=False,
            initial_password_expires__isnull=False,
            initial_password_expires__lte=now,
            is_active=True,
        ).update(is_active=False)

        if not updated:
            continue

        send_account_locked_email_task.delay(
            user.email,
            user.role,
        )

        locked_count += 1

        logger.info(
            "Locked expired initial admin account: %s",
            user.email,
        )

    logger.info(
        "Expired initial admin account check completed. Accounts locked: %s",
        locked_count,
    )

    return locked_count


# -------------------------------- CLOUDFLARE R2 --------------------------------
@celery.task(
    bind=True,
    name="utils.tasks.cleanup_r2_image",
    max_retries=8,
    default_retry_delay=60,
)
def cleanup_r2_image(self, image_url):
    if not image_url:
        logger.warning(
            "R2 deletion skipped: image URL is empty."
        )
        return False

    try:
        deleted = delete_image_from_r2(image_url)

        if not deleted:
            logger.info(
                "R2 deletion skipped for unsupported or external URL: %s",
                image_url,
            )
            return False

        logger.info(
            "R2 image deletion succeeded: %s",
            image_url,
        )

        return True

    except Exception as exc:
        if self.request.retries >= self.max_retries:
            logger.critical(
                "R2 image deletion permanently failed after %s retries. Image URL: %s",
                self.max_retries,
                image_url,
                exc_info=True,
            )
            raise

        logger.exception(
            "R2 image deletion failed. Retry %s of %s. URL: %s",
            self.request.retries + 1,
            self.max_retries,
            image_url,
        )

        raise self.retry(
            exc=exc,
            countdown=min(
                60 * (2 ** self.request.retries),
                3600,
            ),
        )


# -------------------------- ORPHAN IMAGE CLEANUP -------------------------------
@celery.task(
    bind=True,
    name="utils.tasks.cleanup_orphaned_r2_images",
    max_retries=3,
    default_retry_delay=300,
)
def cleanup_orphaned_r2_images(self):
    """Delete unreferenced R2 spare-part images at least 24 hours old."""

    try:
        client = get_r2_client()
        paginator = client.get_paginator("list_objects_v2")

        current_referenced_keys = {
            key
            for image_url in (
                SpareParts.objects
                .exclude(image__isnull=True)
                .exclude(image="")
                .values_list("image", flat=True)
                .iterator()
            )
            if (key := get_r2_object_key(image_url))
        }

        cutoff = timezone.now() - timedelta(hours=24)

        scanned = 0
        deleted = 0
        failed = 0
        skipped = 0

        for page in paginator.paginate(
            Bucket=settings.R2_BUCKET_NAME,
            Prefix="spareparts/",
        ):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                scanned += 1

                if key in current_referenced_keys:
                    skipped += 1
                    continue

                last_modified = obj.get("LastModified")

                if not last_modified or last_modified >= cutoff:
                    skipped += 1
                    continue

                try:
                    client.delete_object(
                        Bucket=settings.R2_BUCKET_NAME,
                        Key=key,
                    )

                    deleted += 1

                    logger.info(
                        "Deleted orphaned R2 image: %s",
                        key,
                    )

                except Exception:
                    failed += 1

                    logger.exception(
                        "Failed to delete orphaned R2 image: %s",
                        key,
                    )

        result = {
            "scanned": scanned,
            "deleted": deleted,
            "failed": failed,
            "skipped": skipped,
        }

        logger.info(
            "R2 orphan cleanup completed: %s",
            result,
        )

        return result

    except Exception as exc:
        if self.request.retries >= self.max_retries:
            logger.critical(
                "R2 orphan cleanup permanently failed after %s retries.",
                self.max_retries,
                exc_info=True,
            )
            raise

        logger.exception(
            "R2 orphan cleanup failed. Retry %s of %s.",
            self.request.retries + 1,
            self.max_retries,
        )

        raise self.retry(
            exc=exc,
            countdown=min(
                300 * (2 ** self.request.retries),
                3600,
            ),
        )


# -------------------------------- TRANSLATIONS ---------------------------------
SUPPORTED_TRANSLATION_LANGUAGES = {
    "en",
    "sw",
    "fr",
    "ar",
    "zh",
    "hi",
    "es",
    "pt",
    "de",
    "it",
    "ja",
    "ko",
    "ru",
    "tr",
    "nl",
}


def get_translation_cache_key(
    text: str,
    source_language: str,
    target_language: str,
) -> str:
    """Return a stable cache key for text and its language pair."""

    normalized_text = text.strip()

    text_hash = hashlib.sha256(
        normalized_text.encode("utf-8")
    ).hexdigest()

    return (
        f"translation:{source_language}:{target_language}:{text_hash}"
    )


def _translate_direct(
    text: str,
    source_language: str,
    target_language: str,
) -> str:
    """Translate using an installed Argos direct language pair."""

    import argostranslate.translate

    translated = argostranslate.translate.translate(
        text,
        source_language,
        target_language,
    )

    if not translated:
        raise ValueError(
            f"Argos returned an empty translation for "
            f"{source_language} -> {target_language}."
        )

    return translated


def _translate_segment_cached(
    text: str,
    source_language: str,
    target_language: str,
) -> str:
    """Translate one segment and cache its source/target pair."""

    if source_language == target_language:
        return text

    cache_key = get_translation_cache_key(
        text,
        source_language,
        target_language,
    )

    cached = cache.get(cache_key)

    if cached is not None:
        return cached

    translated = _translate_direct(
        text,
        source_language,
        target_language,
    )

    cache.set(
        cache_key,
        translated,
        timeout=None,
    )

    return translated


def _translate_text(
    text: str,
    source_language: str,
    target_language: str,
) -> str:
    """Translate between supported languages using a direct Argos pair."""

    if source_language == target_language:
        return text

    return _translate_segment_cached(
        text,
        source_language,
        target_language,
    )


def _run_translation(
    text: str,
    source_language: str,
    target_language: str,
) -> dict:
    """Shared synchronous translation implementation for Celery tasks."""

    source_language = (
        source_language or "en"
    ).strip().lower()

    target_language = (
        target_language or "en"
    ).strip().lower()

    if not isinstance(text, str) or not text.strip():
        return {
            "original": text,
            "translated": text,
            "source_language": source_language,
            "target_language": target_language,
            "cached": False,
        }

    if (
        source_language not in SUPPORTED_TRANSLATION_LANGUAGES
        or target_language not in SUPPORTED_TRANSLATION_LANGUAGES
    ):
        raise ValueError(
            f"Unsupported translation language pair: "
            f"{source_language} -> {target_language}"
        )

    normalized_text = text.strip()

    final_cache_key = get_translation_cache_key(
        normalized_text,
        source_language,
        target_language,
    )

    cached_translation = cache.get(final_cache_key)

    if cached_translation is not None:
        return {
            "original": text,
            "translated": cached_translation,
            "source_language": source_language,
            "target_language": target_language,
            "cached": True,
        }

    translated_text = _translate_text(
        normalized_text,
        source_language,
        target_language,
    )

    cache.set(
        final_cache_key,
        translated_text,
        timeout=None,
    )

    logger.info(
        "Translation completed and cached: %s -> %s",
        source_language,
        target_language,
    )

    return {
        "original": text,
        "translated": translated_text,
        "source_language": source_language,
        "target_language": target_language,
        "cached": False,
    }


@celery.task(
    bind=True,
    name="utils.tasks.translate_text",
    max_retries=3,
    default_retry_delay=30,
)
def translate_text(
    self,
    text: str,
    target_language: str,
    source_language: str = "en",
):
    """Translate text, cache the result, and manage pending state."""

    normalized_source = (
        source_language or "en"
    ).strip().lower()

    normalized_target = (
        target_language or "en"
    ).strip().lower()

    pending_key = (
        f"{get_translation_cache_key(text, normalized_source, normalized_target)}"
        ":pending"
    )

    try:
        result = _run_translation(
            text,
            normalized_source,
            normalized_target,
        )

        cache.delete(pending_key)

        return result

    except Exception as exc:
        logger.exception(
            "Translation failed from %s to %s.",
            normalized_source,
            normalized_target,
        )

        if self.request.retries >= self.max_retries:
            cache.delete(pending_key)

            logger.error(
                "Translation permanently failed after %s retries.",
                self.max_retries,
            )

            raise

        raise self.retry(
            exc=exc,
            countdown=30 * (self.request.retries + 1),
        )
