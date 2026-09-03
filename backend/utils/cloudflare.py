import os
import uuid

import boto3
from django.conf import settings


# ------------------------------ CLOUDFLARE R2 ------------------------------------------
def get_r2_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )


# ------------------------------ UPLOAD IMAGE ------------------------------------------
def upload_image_to_r2(image_file):
    """
    Upload an image file to Cloudflare R2
    and return the public image URL.
    """

    if not image_file:
        return None

    # ---------------- FILE TYPE ----------------
    if not image_file.content_type.startswith("image/"):
        raise ValueError(
            "Only image files are allowed."
        )

    # ---------------- FILE SIZE ----------------
    max_size = 5 * 1024 * 1024  # 5 MB

    if image_file.size > max_size:
        raise ValueError(
            "Image must be 5 MB or smaller."
        )

    # ---------------- FILE EXTENSION ----------------
    extension = os.path.splitext(
        image_file.name or ""
    )[1].lower()

    allowed_extensions = [
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
        ".gif",
    ]

    if extension not in allowed_extensions:
        raise ValueError(
            "Unsupported image format. "
            "Use JPG, JPEG, PNG, WEBP, or GIF."
        )

    # ---------------- UNIQUE FILE NAME ----------------
    file_name = (
        f"{uuid.uuid4()}"
        f"{extension}"
    )

    object_key = (
        f"spareparts/{file_name}"
    )

    # ---------------- UPLOAD TO R2 ----------------
    client = get_r2_client()

    client.upload_fileobj(
        image_file,
        settings.R2_BUCKET_NAME,
        object_key,
        ExtraArgs={
            "ContentType": image_file.content_type,
        },
    )

    # ---------------- PUBLIC URL ----------------
    public_url = (
        settings.R2_PUBLIC_URL.rstrip("/")
    )

    return (
        f"{public_url}/"
        f"{object_key}"
    )