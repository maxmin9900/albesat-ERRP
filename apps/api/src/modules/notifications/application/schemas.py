from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class NotificationItem(BaseModel):
    id: str
    title: str
    message: str
    href: str
    category: str
    created_at: datetime


class NotificationsResponse(BaseModel):
    items: list[NotificationItem]
    total: int
