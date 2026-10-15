import os

from dotenv import load_dotenv

load_dotenv()

os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "config.settings",
)

from celery import Celery
from celery.schedules import crontab


celery = Celery(
    "worker",
    broker=os.getenv("CELERY_BROKER_URL"),
    backend=os.getenv("CELERY_RESULT_BACKEND"),
)

celery.config_from_object(
    "django.conf:settings",
    namespace="CELERY",
)

celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    imports=("utils.tasks",),
    beat_schedule={
        "lock-expired-initial-admin-accounts": {
            "task": "utils.tasks.lock_expired_initial_admin_accounts",
            "schedule": crontab(minute="*"),
        },
    },
)

celery.autodiscover_tasks(["utils"])
