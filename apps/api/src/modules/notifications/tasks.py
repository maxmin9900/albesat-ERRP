from src.core.celery_app import celery_app
from src.modules.notifications.whatsapp import send_otp_sync


@celery_app.task(name="notifications.send_otp_whatsapp", bind=True, max_retries=3)
def send_otp_whatsapp(self, phone: str, code: str) -> dict[str, bool]:
    try:
        ok = send_otp_sync(phone, code)
        if not ok:
            raise RuntimeError("WhatsApp send failed")
        return {"sent": True}
    except Exception as exc:
        raise self.retry(exc=exc, countdown=5 * (self.request.retries + 1)) from exc
