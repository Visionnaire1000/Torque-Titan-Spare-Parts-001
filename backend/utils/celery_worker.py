import os

from celery import Celery
from dotenv import load_dotenv


load_dotenv()


celery = Celery(
    "worker",
    broker=os.getenv(
        "CELERY_BROKER_URL"
    ),
    backend=os.getenv(
        "CELERY_RESULT_BACKEND"
    ),
)


celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=[
        "json"
    ],
    timezone="UTC",
    enable_utc=True,
)


import utils.tasks