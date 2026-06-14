from __future__ import annotations
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field
import uuid


class PlaidItemCreate(BaseModel):
    item_id: str
    access_token: str
    refresh_token: Optional[str] = None
    provider: str = "plaid"
    institution_id: str
    institution_name: Optional[str] = None
    institution_logo: Optional[str] = None


class PlaidItem(PlaidItemCreate):
    user_id: str
    created_at: str
    updated_at: str


class AccountBalance(BaseModel):
    balance_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    account_id: str
    current: float
    available: Optional[float] = None
    limit: Optional[float] = None
    date: str  # ISO date string
    date_timestamp: str  # date + ms for DynamoDB sort key


class AccountBalanceResponse(BaseModel):
    balance_id: str
    current: float
    available: Optional[float] = None
    limit: Optional[float] = None
    date: str


class AccountCreate(BaseModel):
    plaid_id: str
    name: str
    nickname: Optional[str] = None
    type: str
    subtype: Optional[str] = None
    mask: Optional[str] = None
    hidden: bool = False
    metadata: Optional[str] = None
    url: Optional[str] = None
    item_id: str


class Account(AccountCreate):
    account_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    created_at: str
    updated_at: str


class AccountResponse(BaseModel):
    id: str
    name: str
    nickname: Optional[str] = None
    type: str
    subtype: Optional[str] = None
    mask: Optional[str] = None
    hidden: bool
    institution: Optional[str] = None
    institution_logo: Optional[str] = None
    balance: Optional[AccountBalanceResponse] = None
    last_updated: Optional[str] = None
    url: Optional[str] = None
    metadata: Optional[str] = None
    plaid_item: Optional[dict] = None


class ManualAccountCreate(BaseModel):
    name: str
    type: str
    subtype: Optional[str] = None
    balance: float
    url: Optional[str] = None
    metadata: Optional[str] = None


class RefreshRequest(BaseModel):
    institution_id: Optional[str] = None


class DisconnectRequest(BaseModel):
    institution_id: str


class UpdateNicknameRequest(BaseModel):
    nickname: str


class ToggleVisibilityResponse(BaseModel):
    hidden: bool
