from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import CurrentUser
from src.modules.notifications.application.schemas import NotificationsResponse
from src.modules.notifications.application.service import NotificationsService
from src.shared.database.session import get_db

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=NotificationsResponse)
async def list_notifications(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> NotificationsResponse:
    return await NotificationsService(db).list_for_user(user)
