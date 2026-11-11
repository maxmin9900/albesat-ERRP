import pytest
from httpx import ASGITransport, AsyncClient

from src.core.middleware.csrf import generate_csrf_token
from src.core.sanitize import sanitize_string
from src.main import app


def test_sanitize_strips_html():
    result = sanitize_string("<script>alert(1)</script>")
    assert "<" not in result
    assert "alert(1)" in result


@pytest.mark.asyncio
async def test_csrf_blocks_without_token():
    from src.core.config import get_settings

    settings = get_settings()
    if not settings.csrf_enabled:
        pytest.skip("CSRF disabled in test env")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/orders",
            json={"customer_name": "Test"},
            headers={"Authorization": "Bearer invalid"},
        )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_security_headers_present():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert "X-Request-ID" in response.headers


@pytest.mark.asyncio
async def test_auth_csrf_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/auth/csrf")
    assert response.status_code == 200
    assert "csrf_token" in response.json()


def test_generate_csrf_token_unique():
    assert generate_csrf_token() != generate_csrf_token()
