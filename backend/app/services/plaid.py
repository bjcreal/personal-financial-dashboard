"""Plaid API client and operations."""
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Optional

import plaid
from plaid.api import plaid_api
from plaid.model.country_code import CountryCode
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.accounts_balance_get_request import AccountsBalanceGetRequest
from plaid.model.item_get_request import ItemGetRequest
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.institutions_get_by_id_request import InstitutionsGetByIdRequest
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.products import Products
from plaid.model.transactions_sync_request import TransactionsSyncRequest
from plaid.model.transactions_sync_request_options import TransactionsSyncRequestOptions

from app.config import get_settings
from app.services.secrets import get_plaid_credentials


def _get_plaid_client() -> plaid_api.PlaidApi:
    settings = get_settings()
    creds = get_plaid_credentials()

    env_map = {
        "sandbox": plaid.Environment.Sandbox,
        "development": plaid.Environment.Development,
        "production": plaid.Environment.Production,
    }
    configuration = plaid.Configuration(
        host=env_map.get(settings.plaid_env, plaid.Environment.Sandbox),
        api_key={"clientId": creds["client_id"], "secret": creds["secret"]},
    )
    api_client = plaid.ApiClient(configuration)
    return plaid_api.PlaidApi(api_client)


def create_link_token(user_id: str) -> str:
    client = _get_plaid_client()
    request = LinkTokenCreateRequest(
        user=LinkTokenCreateRequestUser(client_user_id=user_id),
        client_name="Personal Financial Dashboard",
        products=[Products("transactions"), Products("investments")],
        country_codes=[CountryCode("US")],
        language="en",
    )
    response = client.link_token_create(request)
    return response["link_token"]


def format_logo_url(logo: Optional[str], institution_id: str) -> Optional[str]:
    if not logo:
        return None
    if logo.startswith("data:") or logo.startswith("http"):
        return logo
    return f"data:image/png;base64,{logo}"


def exchange_public_token(public_token: str) -> tuple[str, str]:
    """Returns (access_token, item_id)."""
    client = _get_plaid_client()
    response = client.item_public_token_exchange(
        ItemPublicTokenExchangeRequest(public_token=public_token)
    )
    return response["access_token"], response["item_id"]


def get_institution_details(access_token: str) -> tuple[str, dict]:
    """Returns (institution_id, institution_dict)."""
    client = _get_plaid_client()
    item_resp = client.item_get(ItemGetRequest(access_token=access_token))
    institution_id = item_resp["item"]["institution_id"]
    if not institution_id:
        raise ValueError("Institution ID missing from Plaid item")

    inst_resp = client.institutions_get_by_id(
        InstitutionsGetByIdRequest(
            institution_id=institution_id,
            country_codes=[CountryCode("US")],
            options={"include_optional_metadata": True},
        )
    )
    return institution_id, inst_resp["institution"]


def get_accounts(access_token: str) -> list[dict]:
    client = _get_plaid_client()
    response = client.accounts_get(AccountsGetRequest(access_token=access_token))
    return response["accounts"]


def get_balances(access_token: str) -> list[dict]:
    client = _get_plaid_client()
    response = client.accounts_balance_get(AccountsBalanceGetRequest(access_token=access_token))
    return response["accounts"]


def sync_transactions(access_token: str, account_plaid_id: str) -> dict:
    """
    Fetch all added/modified/removed transactions for a given account using
    the transactions/sync endpoint (cursor-based pagination).

    Returns {'added': [...], 'modified': [...], 'removed': [...]}
    """
    client = _get_plaid_client()
    added, modified, removed = [], [], []
    cursor = None

    while True:
        request = TransactionsSyncRequest(
            access_token=access_token,
            options=TransactionsSyncRequestOptions(
                include_original_description=True,
                account_id=account_plaid_id,
            ),
            **({"cursor": cursor} if cursor else {}),
            count=500,
        )
        response = client.transactions_sync(request)

        added.extend(t for t in response["added"] if t["account_id"] == account_plaid_id)
        modified.extend(t for t in response["modified"] if t["account_id"] == account_plaid_id)
        removed.extend(t for t in response["removed"] if t["account_id"] == account_plaid_id)

        if not response["has_more"]:
            break
        cursor = response["next_cursor"]

    return {"added": added, "modified": modified, "removed": removed}


def refresh_institution(access_token: str) -> dict:
    """Refresh institution metadata for an existing PlaidItem."""
    client = _get_plaid_client()
    item_resp = client.item_get(ItemGetRequest(access_token=access_token))
    institution_id = item_resp["item"]["institution_id"]
    if not institution_id:
        return {}
    inst_resp = client.institutions_get_by_id(
        InstitutionsGetByIdRequest(
            institution_id=institution_id,
            country_codes=[CountryCode("US")],
            options={"include_optional_metadata": True},
        )
    )
    inst = inst_resp["institution"]
    return {
        "institutionName": inst.get("name"),
        "institutionLogo": format_logo_url(inst.get("logo"), institution_id),
    }
