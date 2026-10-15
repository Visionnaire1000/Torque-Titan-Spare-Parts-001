import os
import uuid
from urllib.parse import unquote, urlparse

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


def get_r2_object_key(image_url):
    if not image_url:
        return None

    public_url = settings.R2_PUBLIC_URL.rstrip("/")
    parsed_public = urlparse(public_url)
    parsed_image = urlparse(str(image_url).strip())

    if (
        parsed_image.scheme not in ("http", "https")
        or parsed_image.netloc.lower() != parsed_public.netloc.lower()
    ):
        return None

    public_path = unquote(parsed_public.path).rstrip("/")
    image_path = unquote(parsed_image.path)

    if public_path:
        if not image_path.startswith(public_path + "/"):
            return None

        image_path = image_path[len(public_path):]

    object_key = image_path.lstrip("/")

    if (
        not object_key.startswith("spareparts/")
        or any(part in ("", ".", "..") for part in object_key.split("/"))
    ):
        return None

    return object_key


def is_r2_image_url(image_url):
    return get_r2_object_key(image_url) is not None


# ------------------------------ UPLOAD IMAGE ------------------------------------------
def upload_image_to_r2(image_file):
    if not image_file:
        return None

    content_type = getattr(image_file, "content_type", None)

    if not content_type or not content_type.startswith("image/"):
        raise ValueError("Only image files are allowed.")

    if image_file.size > 5 * 1024 * 1024:
        raise ValueError("Image must be 5 MB or smaller.")

    extension = os.path.splitext(image_file.name or "")[1].lower()

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

    object_key = f"spareparts/{uuid.uuid4()}{extension}"

    get_r2_client().upload_fileobj(
        image_file,
        settings.R2_BUCKET_NAME,
        object_key,
        ExtraArgs={"ContentType": content_type},
    )

    return f"{settings.R2_PUBLIC_URL.rstrip('/')}/{object_key}"


# ------------------------------ DELETE IMAGE ------------------------------------------
def delete_image_from_r2(image_url):
    object_key = get_r2_object_key(image_url)

    if object_key is None:
        return False

    get_r2_client().delete_object(
        Bucket=settings.R2_BUCKET_NAME,
        Key=object_key,
    )

    return True

