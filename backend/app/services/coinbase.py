"""Coinbase OAuth and account balance service."""
from __future__ import annotations
import httpx
from typing import Optional

from app.services.secrets import get_coinbase_credentials

COINBASE_API = "https://api.coinbase.com"
CB_VERSION = "2024-02-07"
_HEADERS_BASE = {"CB-VERSION": CB_VERSION}

COINBASE_SCOPES = "wallet:accounts:read"


def get_auth_url(redirect_uri: str) -> str:
    creds = get_coinbase_credentials()
    return (
        f"{COINBASE_API}/oauth/authorize"
        f"?client_id={creds['client_id']}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&scope={COINBASE_SCOPES}"
    )


def exchange_code(code: str, redirect_uri: str) -> dict:
    """Exchange OAuth code for access + refresh tokens."""
    creds = get_coinbase_credentials()
    with httpx.Client() as client:
        response = client.post(
            f"{COINBASE_API}/oauth/token",
            json={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": creds["client_id"],
                "client_secret": creds["client_secret"],
                "redirect_uri": redirect_uri,
            },
        )
        response.raise_for_status()
        return response.json()


def refresh_access_token(refresh_token: str) -> dict:
    """Use refresh token to get a new access token."""
    creds = get_coinbase_credentials()
    with httpx.Client() as client:
        response = client.post(
            f"{COINBASE_API}/oauth/token",
            json={
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": creds["client_id"],
                "client_secret": creds["client_secret"],
            },
        )
        response.raise_for_status()
        return response.json()


def get_spot_price(currency: str) -> Optional[float]:
    """Get USD spot price for a cryptocurrency."""
    try:
        with httpx.Client() as client:
            response = client.get(
                f"{COINBASE_API}/v2/prices/{currency}-USD/spot",
                headers=_HEADERS_BASE,
            )
            if not response.is_success:
                return None
            data = response.json()["data"]
            return float(data["amount"])
    except Exception:
        return None


def get_accounts(access_token: str) -> list[dict]:
    """Fetch all Coinbase accounts (wallets) for the authenticated user."""
    headers = {"Authorization": f"Bearer {access_token}", **_HEADERS_BASE}
    accounts = []
    url = f"{COINBASE_API}/v2/accounts?limit=100"

    with httpx.Client() as client:
        while url:
            response = client.get(url, headers=headers)
            response.raise_for_status()
            body = response.json()
            accounts.extend(body["data"])
            next_uri = body.get("pagination", {}).get("next_uri")
            url = f"{COINBASE_API}{next_uri}" if next_uri else None

    return accounts


def get_accounts_with_usd_value(access_token: str) -> list[dict]:
    """
    Return Coinbase accounts that have a non-zero balance with USD value resolved.
    Skips accounts where no spot price is available.
    """
    result = []
    for account in get_accounts(access_token):
        crypto_amount = float(account["balance"]["amount"])
        if crypto_amount <= 0:
            continue
        currency = account["balance"]["currency"]
        spot_price = get_spot_price(currency)
        if spot_price is None:
            continue
        result.append({
            "id": account["id"],
            "name": account["name"],
            "currency": currency,
            "crypto_amount": crypto_amount,
            "usd_value": crypto_amount * spot_price,
        })
    return result
