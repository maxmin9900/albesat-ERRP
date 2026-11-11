"""Import all models for Alembic autogenerate."""

from src.modules.auth.infrastructure.models import (  # noqa: F401
    OtpCode,
    Permission,
    RefreshToken,
    Role,
    RolePermission,
    User,
    UserRole,
)
from src.modules.audit.infrastructure.models import AuditLog  # noqa: F401
from src.modules.orders.infrastructure.models import Order, OrderPaymentRecord, OrderStatusHistory  # noqa: F401
from src.modules.payments.infrastructure.models import (  # noqa: F401
    Invoice,
    Partner,
    PartnerSettlement,
    PaymentReminderLog,
    PaymentTransaction,
)
from src.modules.sessions.infrastructure.models import (  # noqa: F401
    DeliveryRouteSession,
    DeliveryRouteStop,
    ServiceSession,
)
from src.modules.repair.infrastructure.models import RepairRequest  # noqa: F401
from src.modules.repair.infrastructure.models import RepairRequestPhoto  # noqa: F401
from src.modules.customers.infrastructure.models import CustomerPaymentRecord, CustomerProfile  # noqa: F401
from src.modules.qr_tracking.infrastructure.models import (  # noqa: F401
    Carpet,
    CarpetDeliveryLog,
    CarpetOperationLog,
    CarpetStatusEvent,
    PhysicalQrTag,
    QrCode,
    QrScanLog,
)
from src.shared.database.base import Base

__all__ = ["Base"]
