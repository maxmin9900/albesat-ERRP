import os

# Disable CSRF for API tests (mutating requests use Bearer only in tests)
os.environ.setdefault("CSRF_ENABLED", "false")

from src.core.config import get_settings

get_settings.cache_clear()
