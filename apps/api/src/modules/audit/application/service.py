from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.sanitize import sanitize_optional
from src.modules.audit.infrastructure.models import AuditLog


class AuditService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def log(
        self,
        *,
        action: str,
        method: str,
        path: str,
        user_id: UUID | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        status_code: int | None = None,
        request_id: str | None = None,
        metadata: dict | None = None,
    ) -> None:
        entry = AuditLog(
            user_id=user_id,
            action=sanitize_optional(action, max_length=100) or action[:100],
            resource_type=sanitize_optional(resource_type, max_length=50) if resource_type else None,
            resource_id=sanitize_optional(resource_id, max_length=64) if resource_id else None,
            method=method[:10],
            path=sanitize_optional(path, max_length=512) or path[:512],
            ip_address=ip_address,
            user_agent=sanitize_optional(user_agent, max_length=512) if user_agent else None,
            status_code=status_code,
            request_id=request_id,
            metadata_json=metadata,
        )
        self.db.add(entry)
