from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field
import uuid


class Transaction(BaseModel):
    transaction_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    account_id: str
    user_id: str
    plaid_id: str
    date: str  # ISO date string YYYY-MM-DD
    date_plaid_id: str  # DynamoDB sort key: date#plaid_id
    name: str
    amount: float
    category: Optional[str] = None
    merchant_name: Optional[str] = None
    pending: bool = False
    # Investment fields
    fees: Optional[float] = None
    price: Optional[float] = None
    quantity: Optional[float] = None
    # Security fields
    security_id: Optional[str] = None
    ticker_symbol: Optional[str] = None
    isin: Optional[str] = None
    cusip: Optional[str] = None
    sedol: Optional[str] = None
    institution_security_id: Optional[str] = None
    security_name: Optional[str] = None
    security_type: Optional[str] = None
    close_price: Optional[float] = None
    close_price_as_of: Optional[str] = None
    is_cash_equivalent: Optional[bool] = None
    type: Optional[str] = None
    subtype: Optional[str] = None
    iso_currency_code: Optional[str] = None
    unofficial_currency_code: Optional[str] = None
    market_identifier_code: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    # Regular transaction fields
    authorized_date: Optional[str] = None
    payment_channel: Optional[str] = None
    transaction_code: Optional[str] = None
    personal_finance_category: Optional[str] = None
    merchant_entity_id: Optional[str] = None
    # Location
    location_address: Optional[str] = None
    location_city: Optional[str] = None
    location_region: Optional[str] = None
    location_postal_code: Optional[str] = None
    location_country: Optional[str] = None
    location_lat: Optional[float] = None
    location_lon: Optional[float] = None
    # Payment metadata
    by_order_of: Optional[str] = None
    payee: Optional[str] = None
    payer: Optional[str] = None
    payment_method: Optional[str] = None
    payment_processor: Optional[str] = None
    ppd_id: Optional[str] = None
    reason: Optional[str] = None
    reference_number: Optional[str] = None
    created_at: Optional[str] = None


class TransactionDownloadLog(BaseModel):
    log_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    account_id: str
    start_date: str
    end_date: str
    num_transactions: int
    status: str  # 'success' or 'error'
    error_message: Optional[str] = None
    created_at: str
