from celery import Celery

from src.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "firoozeh",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["src.modules.notifications.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_default_queue="default",
)
