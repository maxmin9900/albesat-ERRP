"""WhatsApp Cloud API client for OTP delivery."""

import logging
import re

import httpx

from src.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

GRAPH_API = "https://graph.facebook.com/v21.0"


def normalize_phone_e164(phone: str) -> str:
    """Normalize to digits only (WhatsApp Cloud expects country code without +)."""
    digits = re.sub(r"\D", "", phone.strip())
    # "00" is the international prefix written in place of "+".
    if digits.startswith("00"):
        digits = digits[2:]
    # Local Oman mobile (8 digits, starts 7/9) -> prefix the country code.
    if len(digits) == 8 and digits[0] in ("7", "9"):
        digits = "968" + digits
    # Some UIs write the national form as 0XXXXXXXX.
    elif len(digits) == 9 and digits.startswith("0") and digits[1] in ("7", "9"):
        digits = "968" + digits[1:]
    # Iranian customers write their mobile as 09XXXXXXXXX.
    elif len(digits) == 11 and digits.startswith("09"):
        digits = "98" + digits[1:]
    return digits


class WhatsAppProvider:
    def send_otp(self, phone: str, code: str) -> bool:
        mode = settings.whatsapp_mode.lower()
        if mode == "mock":
            logger.info("WhatsApp MOCK OTP to %s: %s", phone, code)
            return True
        if mode == "disabled":
            logger.warning("WhatsApp disabled; OTP not sent to %s", phone)
            return False
        return self._send_cloud_template(phone, code)

    def _send_cloud_template(self, phone: str, code: str) -> bool:
        if not settings.whatsapp_access_token or not settings.whatsapp_phone_number_id:
            logger.error("WhatsApp Cloud API credentials missing")
            return False

        to = normalize_phone_e164(phone)
        url = f"{GRAPH_API}/{settings.whatsapp_phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {settings.whatsapp_access_token}",
            "Content-Type": "application/json",
        }

        # Authentication template with OTP body parameter
        payload: dict = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "template",
            "template": {
                "name": settings.whatsapp_otp_template_name,
                "language": {"code": settings.whatsapp_otp_template_language},
                "components": [
                    {
                        "type": "body",
                        "parameters": [{"type": "text", "text": code}],
                    }
                ],
            },
        }

        # Optional copy-code button for authentication templates
        if settings.whatsapp_otp_include_button:
            payload["template"]["components"].append(
                {
                    "type": "button",
                    "sub_type": "url",
                    "index": "0",
                    "parameters": [{"type": "text", "text": code}],
                }
            )

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(url, headers=headers, json=payload)
                if response.status_code >= 400:
                    logger.error(
                        "WhatsApp API error %s: %s",
                        response.status_code,
                        response.text[:500],
                    )
                    return False
                logger.info("WhatsApp OTP sent to %s", to)
                return True
        except httpx.HTTPError as exc:
            logger.exception("WhatsApp HTTP error: %s", exc)
            return False

    def _send_template(
        self,
        phone: str,
        template_name: str,
        language: str,
        *,
        body_params: list[str] | None = None,
        button_url_suffix: str | None = None,
    ) -> bool:
        """Send any approved template — works outside the 24h window."""
        if not settings.whatsapp_access_token or not settings.whatsapp_phone_number_id:
            logger.error("WhatsApp Cloud API credentials missing")
            return False

        to = normalize_phone_e164(phone)
        url = f"{GRAPH_API}/{settings.whatsapp_phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {settings.whatsapp_access_token}",
            "Content-Type": "application/json",
        }
        components: list[dict] = []
        if body_params:
            components.append(
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": str(p)} for p in body_params],
                }
            )
        # Dynamic URL button: Meta appends this suffix to the template's base URL.
        if button_url_suffix:
            components.append(
                {
                    "type": "button",
                    "sub_type": "url",
                    "index": "0",
                    "parameters": [{"type": "text", "text": str(button_url_suffix)}],
                }
            )
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language},
                "components": components,
            },
        }
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(url, headers=headers, json=payload)
                if response.status_code >= 400:
                    logger.error(
                        "WhatsApp template '%s' error %s: %s",
                        template_name,
                        response.status_code,
                        response.text[:500],
                    )
                    return False
                logger.info("WhatsApp template '%s' sent to %s", template_name, to)
                return True
        except httpx.HTTPError as exc:
            logger.exception("WhatsApp HTTP error: %s", exc)
            return False

    def _send_text_message(self, phone: str, body: str) -> bool:
        if not settings.whatsapp_access_token or not settings.whatsapp_phone_number_id:
            logger.error("WhatsApp Cloud API credentials missing")
            return False
        to = normalize_phone_e164(phone)
        url = f"{GRAPH_API}/{settings.whatsapp_phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {settings.whatsapp_access_token}",
            "Content-Type": "application/json",
        }
        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "text",
            "text": {"preview_url": False, "body": body[:4096]},
        }
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(url, headers=headers, json=payload)
                if response.status_code >= 400:
                    logger.error(
                        "WhatsApp text error %s: %s",
                        response.status_code,
                        response.text[:500],
                    )
                    return False
                return True
        except httpx.HTTPError as exc:
            logger.exception("WhatsApp HTTP error: %s", exc)
            return False


class Messenger360Provider:
    """WhatsApp Web bridge (360messenger.com) on the business's own number.

    Unlike the Cloud API this speaks the WhatsApp Web protocol through the
    number already linked on the phone, so there are no templates and no 24h
    customer-service window — every message is plain text. It is not an
    official Meta channel: the linked session can be revoked by WhatsApp, so
    callers must handle a False return as a normal outcome.
    """

    def send_text(self, phone: str, body: str) -> bool:
        key = settings.messenger360_api_key
        if not key:
            logger.error("360messenger API key missing")
            return False
        url = f"{settings.messenger360_base_url.rstrip('/')}/v2/sendMessage"
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }
        payload = {
            "phonenumber": normalize_phone_e164(phone),
            "type": "text",
            "text": body[:4096],
            "options": {"linkPreview": False},
        }
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(url, headers=headers, json=payload)
        except httpx.HTTPError as exc:
            logger.exception("360messenger HTTP error: %s", exc)
            return False

        # The gateway reports most failures (phone unlinked, bad number, plan
        # limits) as HTTP 200 with {"success": false, ...} in the body, so the
        # status code alone is not proof the message went out.
        try:
            data = response.json()
        except ValueError:
            data = None
        success = data.get("success") if isinstance(data, dict) else None
        if response.status_code >= 400 or success is False:
            logger.error(
                "360messenger error %s: %s",
                response.status_code,
                response.text[:500],
            )
            return False
        logger.info("360messenger text sent to %s", payload["phonenumber"])
        return True

    def get_state(self) -> tuple[int, str]:
        """Linked-session state (CONNECTED when the phone is usable)."""
        key = settings.messenger360_api_key
        url = f"{settings.messenger360_base_url.rstrip('/')}/v2/client/getState"
        with httpx.Client(timeout=30.0) as client:
            response = client.get(url, headers={"Authorization": f"Bearer {key}"})
        return response.status_code, response.text[:500]


def _use_360() -> bool:
    return settings.whatsapp_provider.strip().lower() in ("360messenger", "360")


def whatsapp_credentials_ok() -> bool:
    """Whether the active provider has what it needs to send for real."""
    if _use_360():
        return bool(settings.messenger360_api_key)
    return bool(settings.whatsapp_access_token and settings.whatsapp_phone_number_id)


def send_otp_sync(phone: str, code: str) -> bool:
    if _use_360():
        if settings.whatsapp_mode.lower() == "mock":
            logger.info("WhatsApp MOCK OTP to %s: %s", phone, code)
            return True
        body = f"Albesat Carpet Cleaning - your verification code is {code}"
        return Messenger360Provider().send_text(phone, body)
    return WhatsAppProvider().send_otp(phone, code)


def send_payment_reminder_sync(phone: str, message: str) -> bool:
    """US-21C: payment reminder via WhatsApp (mock logs in development)."""
    mode = settings.whatsapp_mode.lower()
    if mode == "mock":
        logger.info("WhatsApp MOCK payment reminder to %s: %s", phone, message[:200])
        return True
    if mode == "disabled" or not settings.payment_reminder_whatsapp:
        logger.warning("WhatsApp payment reminder disabled for %s", phone)
        return False
    if _use_360():
        return Messenger360Provider().send_text(phone, message)
    return WhatsAppProvider()._send_text_message(phone, message)


def send_draft_invoice_sync(
    phone: str,
    message: str,
    *,
    customer_name: str | None = None,
    invoice_number: str | None = None,
    total: str | None = None,
    tracking_code: str | None = None,
) -> bool:
    """US-DI-05: send the confirmed draft invoice to the customer via WhatsApp.

    Cloud API only accepts free-form text inside the 24h customer-service
    window, and a customer who just booked has usually never messaged us — so
    in cloud mode we send an approved template and keep the plain text as the
    fallback for when no template is configured.
    """
    mode = settings.whatsapp_mode.lower()
    if mode == "mock":
        logger.info("WhatsApp MOCK draft invoice to %s: %s", phone, message[:200])
        return True
    if mode == "disabled":
        logger.warning("WhatsApp draft invoice disabled for %s", phone)
        return False

    # The Web bridge sends from the number already linked on the phone, so it
    # needs no template and is not bound by the 24h window.
    if _use_360():
        return Messenger360Provider().send_text(phone, message)

    provider = WhatsAppProvider()
    template = settings.whatsapp_invoice_template_name.strip()
    if template and invoice_number and total:
        sent = provider._send_template(
            phone,
            template,
            settings.whatsapp_invoice_template_language,
            body_params=[customer_name or "Customer", invoice_number, total],
            button_url_suffix=tracking_code,
        )
        if sent:
            return True
        logger.warning("Invoice template failed for %s — falling back to text", phone)
    return provider._send_text_message(phone, message)


def send_sms_reminder_sync(phone: str, message: str) -> bool:
    """US-21C: SMS reminder — mock in development until SMS provider is wired."""
    if not settings.payment_reminder_sms:
        return False
    logger.info("SMS MOCK payment reminder to %s: %s", phone, message[:200])
    return True
