"""Input sanitization for user-provided strings."""

import html
import re

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_TAG_PATTERN = re.compile(r"<[^>]+>")


def sanitize_string(value: str, *, max_length: int | None = None) -> str:
    """Strip control chars, HTML tags, and escape entities."""
    cleaned = _CONTROL_CHARS.sub("", value.strip())
    cleaned = _TAG_PATTERN.sub("", cleaned)
    cleaned = html.escape(cleaned, quote=False)
    if max_length is not None and len(cleaned) > max_length:
        cleaned = cleaned[:max_length]
    return cleaned


def sanitize_optional(value: str | None, *, max_length: int | None = None) -> str | None:
    if value is None:
        return None
    return sanitize_string(value, max_length=max_length)
