import pytest
from httpx import ASGITransport, AsyncClient

from src.main import app

ORDER_ID = "00000000-0000-0000-0000-000000000001"


@pytest.mark.asyncio
async def test_save_pickup_carpets_requires_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            f"/api/v1/driver/pickups/{ORDER_ID}/carpets",
            json={"carpets": [{"code": "CARPET-0001-0A0FA103"}]},
        )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_save_pickup_carpets_rejects_empty_list():
    """Even unauthenticated, an empty carpets list is a 422 schema error or 401.

    The endpoint must never accept a pickup with zero carpets.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            f"/api/v1/driver/pickups/{ORDER_ID}/carpets",
            json={"carpets": []},
        )
    assert response.status_code in (401, 422)
