from unittest.mock import patch

from src.modules.notifications.whatsapp import WhatsAppProvider, normalize_phone_e164


def test_normalize_phone_iran():
    assert normalize_phone_e164("09121234567") == "989121234567"


def test_whatsapp_mock_mode():
    provider = WhatsAppProvider()
    with patch("src.modules.notifications.whatsapp.settings") as mock_settings:
        mock_settings.whatsapp_mode = "mock"
        assert provider.send_otp("+989121234567", "123456") is True
