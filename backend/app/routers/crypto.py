"""Coinbase OAuth flow endpoints."""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.config import get_settings
from app.dependencies import get_current_user
from app.services import dynamodb as db, coinbase

router = APIRouter()


# ── GET /api/crypto/oauth ─────────────────────────────────────────────────────

@router.get("/oauth")
def get_oauth_url(request: Request):
    settings = get_settings()
    # Build redirect URI from request base URL so it works in any environment
    redirect_uri = str(request.base_url).rstrip("/") + "/api/crypto/oauth/callback"
    auth_url = coinbase.get_auth_url(redirect_uri)
    return {"authUrl": auth_url}


# ── GET /api/crypto/oauth/callback ───────────────────────────────────────────

@router.get("/oauth/callback")
def oauth_callback(code: str, request: Request, user_id: str = Depends(get_current_user)):
    settings = get_settings()
    redirect_uri = str(request.base_url).rstrip("/") + "/api/crypto/oauth/callback"

    tokens = coinbase.exchange_code(code, redirect_uri)
    access_token = tokens["access_token"]
    refresh_token = tokens.get("refresh_token")

    # Store Coinbase as a PlaidItem with provider=coinbase
    existing = db.get_plaid_item_by_institution(user_id, "coinbase")
    if existing:
        db.update_plaid_item(user_id, existing["itemId"], {
            "accessToken": access_token,
            "refreshToken": refresh_token,
        })
    else:
        db.put_plaid_item(user_id, {
            "item_id": f"coinbase_{user_id}",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "provider": "coinbase",
            "institution_id": "coinbase",
            "institution_name": "Coinbase",
        })

    # Fetch and store initial balances
    try:
        cb_accounts = coinbase.get_accounts_with_usd_value(access_token)
        item = db.get_plaid_item_by_institution(user_id, "coinbase")
        for cb_account in cb_accounts:
            plaid_id = f"coinbase_{cb_account['id']}"
            existing_account = db.get_account_by_plaid_id(user_id, plaid_id)
            if not existing_account:
                new_account = db.put_account(user_id, {
                    "plaid_id": plaid_id,
                    "name": f"{cb_account['name']} ({cb_account['currency']})",
                    "type": "investment",
                    "subtype": "crypto",
                    "item_id": item["itemId"],
                })
                db.put_balance(new_account["accountId"], cb_account["usd_value"], cb_account["usd_value"], None)
            else:
                db.put_balance(existing_account["accountId"], cb_account["usd_value"], cb_account["usd_value"], None)
    except Exception as e:
        print(f"Error fetching initial Coinbase balances: {e}")

    return {"success": True, "message": "Coinbase connected successfully"}
