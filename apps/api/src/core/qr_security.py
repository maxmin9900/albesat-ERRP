"""HMAC-signed QR payload generation and verification."""

import base64
import hashlib
import hmac
import json
import re
import time
from urllib.parse import parse_qs, urlparse
from uuid import UUID

from src.core.config import get_settings

settings = get_settings()

QR_PREFIX = "FZ"
MAX_AGE_SECONDS = 365 * 24 * 3600
_FZ_TOKEN_RE = re.compile(r"FZ\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+")


def normalize_qr_scan_code(code: str) -> str:
    """Normalize manual entry / camera scans (URLs, whitespace, tracking labels)."""
    clean = (code or "").strip().strip("\ufeff")
    if not clean:
        return clean
    if clean.startswith("http://") or clean.startswith("https://"):
        parsed = urlparse(clean)
        qs = parse_qs(parsed.query)
        for key in ("code", "qr", "q", "c"):
            if qs.get(key):
                clean = qs[key][0].strip()
                break
        else:
            clean = parsed.path.rstrip("/").split("/")[-1].strip()
    match = _FZ_TOKEN_RE.search(clean)
    if match:
        return match.group(0)
    return clean.lstrip("#").strip()


def _sign(message: str) -> str:
    return hmac.new(
        settings.qr_hmac_secret.encode(),
        message.encode(),
        hashlib.sha256,
    ).hexdigest()[:16]


def generate_signed_code(
    carpet_id: UUID,
    carpet_code: str,
    *,
    nonce: str | None = None,
) -> tuple[str, str]:
    """Returns (full_scannable_code, signature_hash_for_db)."""
    issued_at = int(time.time())
    payload: dict[str, str | int] = {"cid": str(carpet_id), "code": carpet_code, "ts": issued_at}
    if nonce:
        payload["n"] = nonce
    raw = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":")).encode()
    ).decode().rstrip("=")
    sign_input = f"{carpet_id}:{carpet_code}:{issued_at}"
    if nonce:
        sign_input = f"{sign_input}:{nonce}"
    sig = _sign(sign_input)
    full_code = f"{QR_PREFIX}.{raw}.{sig}"
    sig_hash = hashlib.sha256(full_code.encode()).hexdigest()
    return full_code, sig_hash


def decode_and_verify(code: str) -> dict | None:
    """Returns {carpet_id, carpet_code, issued_at} or None if invalid/forged."""
    clean = normalize_qr_scan_code(code)
    parts = clean.split(".")
    if len(parts) != 3 or parts[0] != QR_PREFIX:
        return None

    _, raw, provided_sig = parts
    try:
        padded = raw + "=" * ((4 - len(raw) % 4) % 4)
        data = json.loads(base64.urlsafe_b64decode(padded))
        carpet_id = UUID(data["cid"])
        carpet_code = data["code"]
        issued_at = int(data["ts"])
        nonce = data.get("n")
    except (ValueError, KeyError, json.JSONDecodeError, TypeError):
        return None

    if time.time() - issued_at > MAX_AGE_SECONDS:
        return None

    sign_input = f"{carpet_id}:{carpet_code}:{issued_at}"
    if nonce:
        sign_input = f"{sign_input}:{nonce}"
    expected = _sign(sign_input)
    if not hmac.compare_digest(provided_sig, expected):
        return None

    return {"carpet_id": carpet_id, "carpet_code": carpet_code, "issued_at": issued_at}
