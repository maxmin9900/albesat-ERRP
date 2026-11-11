"""EPIC 1 US-3/US-4: reset role->permission matrix to spec + repair assessment fields

Revision ID: 010
Revises: 009

Migration 001 granted `admin` nearly every permission (all except roles:manage),
so access control did not match US-4. This migration resets each role's
permission set to exactly the US-4 access matrix and adds repair-team
assessment columns (repair type / price / deadline / review notes).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Exact US-4 access matrix. super_admin gets ALL permissions (handled separately).
ROLE_PERMISSIONS: dict[str, list[str]] = {
    # ادمین: ثبت سفارش، مدیریت مشتری/CRM، سفارش Partner، Session، مشاهده فاکتور،
    # تایید تعمیر. عدم دسترسی: مدیریت کاربران/Role، تنظیمات سیستم، پرداخت‌سازی.
    "admin": [
        "orders:create", "orders:read", "orders:update",
        "sessions:read", "payments:read", "partners:read",
        "repair:read", "repair:approve", "crm:read", "reports:read",
    ],
    # تیم عملیات: دریافت فرش، اسکن/تولید QR، مدیریت وضعیت عملیات، ثبت نیاز به تعمیر،
    # مشاهده وضعیت تعمیرات. عدم دسترسی: پرداخت‌ها، گزارش مالی، کاربران، تایید تعمیر.
    "operation_team": [
        "operations:read", "operations:update",
        "qr:scan", "qr:generate", "orders:read",
        "repair:create", "repair:read",
    ],
    # راننده (لجستیک): Pickup/Delivery/Route، اسکن و الصاق QR، تحویل و ثبت پرداخت تحویل.
    # عدم دسترسی: کاربران، تغییر قیمت، تایید تعمیر، گزارش مالی کل، مدیریت شستشو.
    "driver": [
        "logistics:read", "logistics:pickup", "logistics:deliver",
        "qr:scan", "qr:generate", "orders:read",
    ],
    # تیم تعمیرات: مشاهده صف، ثبت نوع/قیمت/Deadline/نتیجه بررسی، شروع/پایان تعمیر.
    # عدم دسترسی: پرداخت‌ها، کاربران، Delivery، تغییر وضعیت مالی.
    "repair_team": [
        "repair:read", "repair:update", "qr:scan", "orders:read",
    ],
    # تیم مالی/CRM: فاکتورها، ثبت/تغییر پرداخت، بدهکاران، یادآوری، گزارش مالی، تسویه Partner.
    # عدم دسترسی: عملیات شستشو، مدیریت لجستیک، تغییر وضعیت عملیاتی فرش.
    "finance_team": [
        "payments:read", "payments:create", "payments:manage",
        "finance:read", "finance:manage", "crm:read",
        "partners:read", "reports:read", "orders:read",
    ],
    # مشتری: مشاهده سفارش خود.
    "customer": ["orders:read"],
}


def _reset_role(conn, slug: str, perms: list[str]) -> None:
    conn.execute(
        sa.text(
            "DELETE FROM role_permissions WHERE role_id = "
            "(SELECT id FROM roles WHERE slug = :slug)"
        ),
        {"slug": slug},
    )
    for perm in perms:
        conn.execute(
            sa.text(
                """
                INSERT INTO role_permissions (role_id, permission_id)
                SELECT r.id, p.id FROM roles r, permissions p
                WHERE r.slug = :slug AND p.name = :perm
                """
            ),
            {"slug": slug, "perm": perm},
        )


def upgrade() -> None:
    op.add_column("repair_requests", sa.Column("assessment_notes", sa.Text(), nullable=True))
    op.add_column(
        "repair_requests",
        sa.Column("assessed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "repair_requests",
        sa.Column(
            "assessed_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
    )

    conn = op.get_bind()

    # مدیر سیستم: دسترسی کامل به همه ماژول‌ها → every permission.
    conn.execute(
        sa.text(
            "DELETE FROM role_permissions WHERE role_id = "
            "(SELECT id FROM roles WHERE slug = 'super_admin')"
        )
    )
    conn.execute(
        sa.text(
            """
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
            WHERE r.slug = 'super_admin'
            """
        )
    )

    for slug, perms in ROLE_PERMISSIONS.items():
        _reset_role(conn, slug, perms)


def downgrade() -> None:
    op.drop_column("repair_requests", "assessed_by_user_id")
    op.drop_column("repair_requests", "assessed_at")
    op.drop_column("repair_requests", "assessment_notes")
