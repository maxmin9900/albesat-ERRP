import pytest
from httpx import ASGITransport, AsyncClient

from src.main import app


@pytest.mark.asyncio
async def test_qr_scan_requires_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/qr/scan",
            json={"code": "QC-1402-0042"},
        )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_qr_generate_requires_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/qr/generate",
            json={"order_id": "00000000-0000-0000-0000-000000000001"},
        )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_carpets_requires_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/qr/carpets")
    assert response.status_code == 401
