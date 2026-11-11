import pytest
from httpx import ASGITransport, AsyncClient

from src.main import app


@pytest.mark.asyncio
async def test_list_orders_requires_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/orders")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_dashboard_stats_requires_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/dashboard/stats")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_qr_scan_requires_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/qr/scan", json={"code": "QC-1402-0042"})
    assert response.status_code == 401
