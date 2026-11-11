from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.dependencies import CurrentUser
from src.modules.customers.application.schemas import (
    CustomerCreateRequest,
    CustomerDetailResponse,
    CustomerListResponse,
    CustomerProfileResponse,
    MarkCustomerPaidRequest,
    MarkCustomerPaidResponse,
)
from src.modules.customers.application.service import CustomersService
from src.shared.database.session import get_db

router = APIRouter(prefix="/admin/customers", tags=["Customers"])


@router.get("", response_model=CustomerListResponse)
async def list_customers(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    search: str | None = Query(None, max_length=100),
) -> CustomerListResponse:
    return await CustomersService(db).list_customers(user, search)


@router.post("", response_model=CustomerProfileResponse, status_code=201)
async def create_customer(
    data: CustomerCreateRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CustomerProfileResponse:
    """Add Customer (edit doc): register a customer with no order (Rule 1)."""
    return await CustomersService(db).create_customer(data, user)


@router.get("/detail", response_model=CustomerDetailResponse)
async def get_customer_detail(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    phone: str = Query(..., min_length=8, max_length=20),
) -> CustomerDetailResponse:
    """Customer Detail (edit doc): profile + orders + financial summary."""
    return await CustomersService(db).get_customer_detail(phone, user)


@router.post("/mark-paid", response_model=MarkCustomerPaidResponse)
async def mark_customer_paid(
    data: MarkCustomerPaidRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MarkCustomerPaidResponse:
    return await CustomersService(db).mark_paid(data.phone, user, data.customer_name)
