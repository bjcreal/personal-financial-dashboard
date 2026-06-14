"""
Account management endpoints.

Mirrors the original Next.js API routes under /api/accounts/*.
"""
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.models.account import (
    AccountResponse, AccountBalanceResponse,
    ManualAccountCreate, RefreshRequest, DisconnectRequest,
    UpdateNicknameRequest, ToggleVisibilityResponse,
)
from app.services import dynamodb as db
from app.services import plaid, coinbase

router = APIRouter()


def _balance_to_response(b: Optional[dict]) -> Optional[AccountBalanceResponse]:
    if not b:
        return None
    return AccountBalanceResponse(
        balance_id=b.get("balanceId", ""),
        current=float(b.get("current", 0)),
        available=float(b["available"]) if b.get("available") else None,
        limit=float(b["limit"]) if b.get("limit") else None,
        date=b.get("date", ""),
    )


def _account_to_response(account: dict, item: Optional[dict], balance: Optional[dict]) -> dict:
    return {
        "id": account["accountId"],
        "name": account["name"],
        "nickname": account.get("nickname"),
        "type": account["type"],
        "subtype": account.get("subtype"),
        "mask": account.get("mask"),
        "hidden": account.get("hidden", False),
        "institution": item.get("institutionName") or item.get("institutionId") if item else None,
        "institutionLogo": item.get("institutionLogo") if item else None,
        "balance": _balance_to_response(balance),
        "lastUpdated": balance.get("date") if balance else None,
        "url": account.get("url"),
        "metadata": account.get("metadata"),
        "plaidItem": {"institutionId": item.get("institutionId")} if item else None,
    }


# ── GET /api/accounts ─────────────────────────────────────────────────────────

@router.get("")
def list_accounts(user_id: str = Depends(get_current_user)):
    accounts = db.get_accounts(user_id)
    items_by_id = {i["itemId"]: i for i in db.get_plaid_items(user_id)}

    result = []
    for account in accounts:
        item = items_by_id.get(account.get("itemId", ""))
        balance = db.get_latest_balance(account["accountId"])
        result.append(_account_to_response(account, item, balance))
    return result


# ── GET /api/accounts/history ─────────────────────────────────────────────────

@router.get("/history")
def accounts_with_history(user_id: str = Depends(get_current_user)):
    accounts = db.get_accounts(user_id)
    items_by_id = {i["itemId"]: i for i in db.get_plaid_items(user_id)}

    result = []
    for account in accounts:
        item = items_by_id.get(account.get("itemId", ""))
        history = db.get_balance_history(account["accountId"], limit=365)
        account_data = _account_to_response(account, item, history[0] if history else None)
        account_data["balanceHistory"] = [
            {"current": float(b.get("current", 0)), "date": b.get("date")} for b in reversed(history)
        ]
        result.append(account_data)
    return result


# ── POST /api/accounts/refresh ────────────────────────────────────────────────

@router.post("/refresh")
def refresh_all(body: RefreshRequest = RefreshRequest(), user_id: str = Depends(get_current_user)):
    items = db.get_plaid_items(user_id)
    if body.institution_id:
        items = [i for i in items if i.get("institutionId") == body.institution_id]

    changes = []
    total_change = 0.0

    for item in items:
        if item.get("accessToken") == "manual":
            continue

        try:
            if item.get("provider") == "coinbase":
                access_token = item["accessToken"]
                # Try refreshing token if needed
                try:
                    coinbase_accounts = coinbase.get_accounts_with_usd_value(access_token)
                except Exception:
                    if not item.get("refreshToken"):
                        raise
                    tokens = coinbase.refresh_access_token(item["refreshToken"])
                    access_token = tokens["access_token"]
                    db.update_plaid_item(user_id, item["itemId"], {
                        "accessToken": tokens["access_token"],
                        "refreshToken": tokens["refresh_token"],
                    })
                    coinbase_accounts = coinbase.get_accounts_with_usd_value(access_token)

                institution_change = {"name": item.get("institutionName", "Coinbase"), "accounts": []}
                for cb_account in coinbase_accounts:
                    plaid_id = f"coinbase_{cb_account['id']}"
                    existing = db.get_account_by_plaid_id(user_id, plaid_id)
                    usd_value = cb_account["usd_value"]

                    if existing:
                        prev_balance = db.get_latest_balance(existing["accountId"])
                        prev = float(prev_balance.get("current", 0)) if prev_balance else 0
                        db.put_balance(existing["accountId"], usd_value, usd_value, None)
                        change = usd_value - prev
                        if abs(change) > 0.01:
                            institution_change["accounts"].append({
                                "name": existing["name"],
                                "nickname": existing.get("nickname"),
                                "previousBalance": prev,
                                "currentBalance": usd_value,
                                "change": change,
                                "isPositive": change > 0,
                            })
                            total_change += change
                    else:
                        new_account = db.put_account(user_id, {
                            "plaid_id": plaid_id,
                            "name": f"{cb_account['name']} ({cb_account['currency']})",
                            "type": "investment",
                            "subtype": "crypto",
                            "item_id": item["itemId"],
                        })
                        db.put_balance(new_account["accountId"], usd_value, usd_value, None)

                if institution_change["accounts"]:
                    changes.append(institution_change)

            else:
                # Plaid
                plaid_accounts = plaid.get_balances(item["accessToken"])
                institution_change = {"name": item.get("institutionName", "Unknown Bank"), "accounts": []}

                for plaid_account in plaid_accounts:
                    existing = db.get_account_by_plaid_id(user_id, plaid_account["account_id"])
                    if not existing:
                        continue
                    current = float(plaid_account["balances"].get("current") or 0)
                    prev_balance = db.get_latest_balance(existing["accountId"])
                    prev = float(prev_balance.get("current", 0)) if prev_balance else 0
                    db.put_balance(
                        existing["accountId"],
                        current,
                        plaid_account["balances"].get("available"),
                        plaid_account["balances"].get("limit"),
                    )
                    change = current - prev
                    if abs(change) > 0.01:
                        institution_change["accounts"].append({
                            "name": existing["name"],
                            "nickname": existing.get("nickname"),
                            "previousBalance": prev,
                            "currentBalance": current,
                            "change": change,
                            "isPositive": change > 0,
                        })
                        total_change += change

                if institution_change["accounts"]:
                    changes.append(institution_change)

        except Exception as e:
            print(f"Error refreshing item {item.get('itemId')}: {e}")

    return {"success": True, "changes": changes, "totalChange": total_change}


# ── POST /api/accounts/manual ─────────────────────────────────────────────────

@router.post("/manual")
def create_manual_account(body: ManualAccountCreate, user_id: str = Depends(get_current_user)):
    # Create a placeholder PlaidItem for manual accounts
    item_id = f"manual_{str(uuid.uuid4())}"
    db.put_plaid_item(user_id, {
        "item_id": item_id,
        "access_token": "manual",
        "provider": "manual",
        "institution_id": item_id,
        "institution_name": body.name,
    })
    account = db.put_account(user_id, {
        "plaid_id": f"manual_{str(uuid.uuid4())}",
        "name": body.name,
        "type": body.type,
        "subtype": body.subtype,
        "item_id": item_id,
        "url": body.url,
        "metadata": body.metadata,
    })
    db.put_balance(account["accountId"], body.balance, body.balance, None)
    return {"success": True, "account": account}


# ── POST /api/accounts/disconnect ────────────────────────────────────────────

@router.post("/disconnect")
def disconnect_institution(body: DisconnectRequest, user_id: str = Depends(get_current_user)):
    item = db.get_plaid_item_by_institution(user_id, body.institution_id)
    if not item:
        raise HTTPException(status_code=404, detail="Institution not found")
    db.delete_accounts_by_institution(user_id, body.institution_id, item["itemId"])
    db.delete_plaid_items_by_institution(user_id, body.institution_id)
    return {"success": True}


# ── POST /api/accounts/{accountId}/refresh ───────────────────────────────────

@router.post("/{account_id}/refresh")
def refresh_account(account_id: str, user_id: str = Depends(get_current_user)):
    account = db.get_account(account_id)
    if not account or account.get("userId") != user_id:
        raise HTTPException(status_code=404, detail="Account not found")
    item = db.get_plaid_item(user_id, account["itemId"])
    if not item or item.get("accessToken") == "manual":
        raise HTTPException(status_code=400, detail="Cannot refresh manual account")

    if item.get("provider") == "coinbase":
        cb_accounts = coinbase.get_accounts_with_usd_value(item["accessToken"])
        plaid_id = account["plaidId"]
        match = next((a for a in cb_accounts if f"coinbase_{a['id']}" == plaid_id), None)
        if match:
            db.put_balance(account_id, match["usd_value"], match["usd_value"], None)
    else:
        balances = plaid.get_balances(item["accessToken"])
        match = next((b for b in balances if b["account_id"] == account["plaidId"]), None)
        if match:
            db.put_balance(
                account_id,
                float(match["balances"].get("current") or 0),
                match["balances"].get("available"),
                match["balances"].get("limit"),
            )
    return {"success": True}


# ── POST /api/accounts/{accountId}/toggle-visibility ─────────────────────────

@router.post("/{account_id}/toggle-visibility")
def toggle_visibility(account_id: str, user_id: str = Depends(get_current_user)):
    account = db.get_account(account_id)
    if not account or account.get("userId") != user_id:
        raise HTTPException(status_code=404, detail="Account not found")
    new_hidden = not account.get("hidden", False)
    db.update_account(user_id, account_id, {"hidden": new_hidden})
    return {"hidden": new_hidden}


# ── POST /api/accounts/{accountId}/update-nickname ───────────────────────────

@router.post("/{account_id}/update-nickname")
def update_nickname(account_id: str, body: UpdateNicknameRequest, user_id: str = Depends(get_current_user)):
    account = db.get_account(account_id)
    if not account or account.get("userId") != user_id:
        raise HTTPException(status_code=404, detail="Account not found")
    db.update_account(user_id, account_id, {"nickname": body.nickname})
    return {"success": True}


# ── GET /api/accounts/{accountId}/details ────────────────────────────────────

@router.get("/{account_id}/details")
def get_account_details(account_id: str, user_id: str = Depends(get_current_user)):
    """Full account detail: metadata + recent transactions + download logs."""
    account = db.get_account(account_id)
    if not account or account.get("userId") != user_id:
        raise HTTPException(status_code=404, detail="Account not found")
    item = db.get_plaid_item(user_id, account.get("itemId", ""))
    transactions = db.get_transactions(account_id, limit=1000)
    return {
        "id": account["accountId"],
        "name": account["name"],
        "nickname": account.get("nickname"),
        "type": account["type"],
        "subtype": account.get("subtype"),
        "mask": account.get("mask"),
        "hidden": account.get("hidden", False),
        "plaidItem": {
            "institutionName": item.get("institutionName") if item else None,
            "institutionLogo": item.get("institutionLogo") if item else None,
        },
        "transactions": [
            {
                "id": t.get("transactionId", t.get("plaidId")),
                "date": t.get("date"),
                "name": t.get("name"),
                "amount": float(t.get("amount", 0)),
                "category": t.get("category"),
                "pending": t.get("pending", False),
            }
            for t in transactions
        ],
        "downloadLogs": [],
    }


# ── GET /api/accounts/{accountId}/transactions ───────────────────────────────

@router.get("/{account_id}/transactions")
def get_transactions(account_id: str, limit: int = 100, offset: int = 0, user_id: str = Depends(get_current_user)):
    account = db.get_account(account_id)
    if not account or account.get("userId") != user_id:
        raise HTTPException(status_code=404, detail="Account not found")
    transactions = db.get_transactions(account_id, limit=limit, offset=offset)
    return transactions


# ── POST /api/accounts/{accountId}/transactions (sync) ───────────────────────

@router.post("/{account_id}/transactions")
def sync_transactions(account_id: str, user_id: str = Depends(get_current_user)):
    account = db.get_account(account_id)
    if not account or account.get("userId") != user_id:
        raise HTTPException(status_code=404, detail="Account not found")
    item = db.get_plaid_item(user_id, account["itemId"])
    if not item or item.get("accessToken") == "manual":
        raise HTTPException(status_code=400, detail="Cannot sync manual account")

    result = plaid.sync_transactions(item["accessToken"], account["plaidId"])
    now = datetime.now(timezone.utc).isoformat()

    # Process added transactions
    for txn in result["added"]:
        date = txn.get("date", "")
        plaid_id = txn["transaction_id"]
        db.put_transaction({
            "accountId": account_id,
            "userId": user_id,
            "datePlaidId": f"{date}#{plaid_id}",
            "plaidId": plaid_id,
            "date": date,
            "name": txn.get("name", ""),
            "amount": str(txn.get("amount", 0)),
            "category": txn.get("category", [None])[0] if txn.get("category") else None,
            "merchantName": txn.get("merchant_name"),
            "pending": txn.get("pending", False),
            "isoCurrencyCode": txn.get("iso_currency_code"),
            "paymentChannel": txn.get("payment_channel"),
            "personalFinanceCategory": (txn.get("personal_finance_category") or {}).get("primary"),
            "createdAt": now,
        })

    # Process modified transactions
    for txn in result["modified"]:
        date = txn.get("date", "")
        plaid_id = txn["transaction_id"]
        db.update_transaction(account_id, f"{date}#{plaid_id}", {
            "name": txn.get("name", ""),
            "amount": str(txn.get("amount", 0)),
            "pending": txn.get("pending", False),
        })

    # Process removed transactions
    for txn in result["removed"]:
        # We need the original date to rebuild the sort key; query by plaidId
        existing_txns = db.get_transactions(account_id, limit=1000)
        for existing in existing_txns:
            if existing.get("plaidId") == txn["transaction_id"]:
                db.delete_transaction(account_id, existing["datePlaidId"])
                break

    return {
        "success": True,
        "added": len(result["added"]),
        "modified": len(result["modified"]),
        "removed": len(result["removed"]),
    }


# ── DELETE /api/accounts/{accountId}/transactions ────────────────────────────

@router.delete("/{account_id}/transactions")
def delete_all_transactions(account_id: str, user_id: str = Depends(get_current_user)):
    account = db.get_account(account_id)
    if not account or account.get("userId") != user_id:
        raise HTTPException(status_code=404, detail="Account not found")
    db.delete_all_transactions(account_id)
    return {"success": True}


# ── GET /api/accounts/{accountId}/history ────────────────────────────────────

@router.get("/{account_id}/history")
def get_balance_history(account_id: str, user_id: str = Depends(get_current_user)):
    account = db.get_account(account_id)
    if not account or account.get("userId") != user_id:
        raise HTTPException(status_code=404, detail="Account not found")
    history = db.get_balance_history(account_id, limit=365)
    return [
        {
            "id": b.get("balanceId", b.get("dateTimestamp")),
            "current": float(b.get("current", 0)),
            "available": float(b["available"]) if b.get("available") else None,
            "limit": float(b["limit"]) if b.get("limit") else None,
            "date": b.get("date"),
        }
        for b in reversed(history)
    ]


# ── DELETE /api/accounts/{accountId}/history/{balanceId} ─────────────────────

@router.delete("/{account_id}/history/{balance_id}")
def delete_balance_record(account_id: str, balance_id: str, user_id: str = Depends(get_current_user)):
    account = db.get_account(account_id)
    if not account or account.get("userId") != user_id:
        raise HTTPException(status_code=404, detail="Account not found")
    db.delete_balance(account_id, balance_id)
    return {"success": True}


# ── POST /api/accounts/{accountId}/balance (manual balance update) ────────────

class BalanceUpdateRequest(BaseModel):
    balance: float


@router.post("/{account_id}/balance")
def update_manual_balance(account_id: str, body: BalanceUpdateRequest, user_id: str = Depends(get_current_user)):
    account = db.get_account(account_id)
    if not account or account.get("userId") != user_id:
        raise HTTPException(status_code=404, detail="Account not found")
    db.put_balance(account_id, body.balance, body.balance, None)
    return {"success": True}


# ── POST /api/accounts/{accountId}/backfill ───────────────────────────────────

@router.post("/{account_id}/backfill")
def backfill_history(account_id: str, user_id: str = Depends(get_current_user)):
    """Fill in missing monthly balance data points going back to 2022-12-01."""
    account = db.get_account(account_id)
    if not account or account.get("userId") != user_id:
        raise HTTPException(status_code=404, detail="Account not found")

    from datetime import date
    history = db.get_balance_history(account_id, limit=1000)
    if not history:
        return {"message": "No history to backfill from"}

    existing_months = {b.get("date", "")[:7] for b in history}
    oldest_balance = float(history[-1].get("current", 0))

    # Find the earliest date in history
    earliest_date_str = history[-1].get("date", "2022-12-01")[:10]
    earliest_date = date.fromisoformat(earliest_date_str)
    start_date = date(2022, 12, 1)
    if earliest_date < start_date:
        start_date = earliest_date

    created = 0
    current = start_date.replace(day=1)
    end = date.today().replace(day=1)
    while current <= end:
        month_key = current.strftime("%Y-%m")
        if month_key not in existing_months:
            db.put_balance(account_id, oldest_balance, None, None)
            created += 1
        # Advance to next month
        if current.month == 12:
            current = current.replace(year=current.year + 1, month=1)
        else:
            current = current.replace(month=current.month + 1)

    return {"message": f"Backfilled {created} monthly records", "created": created}


# ── POST /api/accounts/{accountId}/clean-daily-records ───────────────────────

@router.post("/{account_id}/clean-daily-records")
def clean_daily_records(account_id: str, user_id: str = Depends(get_current_user)):
    account = db.get_account(account_id)
    if not account or account.get("userId") != user_id:
        raise HTTPException(status_code=404, detail="Account not found")
    deleted = db.clean_balance_records(account_id, granularity="day")
    return {"message": f"Deleted {deleted} duplicate daily records", "deleted": deleted}


# ── POST /api/accounts/{accountId}/clean-monthly-records ─────────────────────

@router.post("/{account_id}/clean-monthly-records")
def clean_monthly_records(account_id: str, user_id: str = Depends(get_current_user)):
    account = db.get_account(account_id)
    if not account or account.get("userId") != user_id:
        raise HTTPException(status_code=404, detail="Account not found")
    deleted = db.clean_balance_records(account_id, granularity="month")
    return {"message": f"Deleted {deleted} duplicate monthly records", "deleted": deleted}
