"""
DynamoDB data access layer.

All table names are read from config so they pick up the stage-suffixed names
injected by Lambda environment variables.
"""
from __future__ import annotations
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

import boto3
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError

from app.config import get_settings

_settings = get_settings()
_dynamodb = boto3.resource("dynamodb")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _date_timestamp(date_str: str) -> str:
    """Build a sort key for BalancesTable: date + epoch ms for uniqueness."""
    return f"{date_str}#{int(time.time() * 1000)}"


# ── Users ─────────────────────────────────────────────────────────────────────

def get_user(user_id: str) -> Optional[dict]:
    table = _dynamodb.Table(_settings.users_table)
    resp = table.get_item(Key={"userId": user_id})
    return resp.get("Item")


def put_user(user_id: str, email: str) -> dict:
    table = _dynamodb.Table(_settings.users_table)
    item = {"userId": user_id, "email": email, "createdAt": _now_iso()}
    table.put_item(Item=item, ConditionExpression=Attr("userId").not_exists())
    return item


# ── PlaidItems ────────────────────────────────────────────────────────────────

def get_plaid_items(user_id: str) -> list[dict]:
    table = _dynamodb.Table(_settings.plaid_items_table)
    resp = table.query(KeyConditionExpression=Key("userId").eq(user_id))
    return resp.get("Items", [])


def get_plaid_item(user_id: str, item_id: str) -> Optional[dict]:
    table = _dynamodb.Table(_settings.plaid_items_table)
    resp = table.get_item(Key={"userId": user_id, "itemId": item_id})
    return resp.get("Item")


def get_plaid_item_by_institution(user_id: str, institution_id: str) -> Optional[dict]:
    items = get_plaid_items(user_id)
    return next((i for i in items if i.get("institutionId") == institution_id), None)


def put_plaid_item(user_id: str, data: dict) -> dict:
    table = _dynamodb.Table(_settings.plaid_items_table)
    now = _now_iso()
    item = {
        "userId": user_id,
        "itemId": data["item_id"],
        "accessToken": data["access_token"],
        "refreshToken": data.get("refresh_token"),
        "provider": data.get("provider", "plaid"),
        "institutionId": data["institution_id"],
        "institutionName": data.get("institution_name"),
        "institutionLogo": data.get("institution_logo"),
        "createdAt": now,
        "updatedAt": now,
    }
    table.put_item(Item=item)
    return item


def update_plaid_item(user_id: str, item_id: str, updates: dict) -> dict:
    table = _dynamodb.Table(_settings.plaid_items_table)
    updates["updatedAt"] = _now_iso()
    expr = "SET " + ", ".join(f"#{k} = :{k}" for k in updates)
    names = {f"#{k}": k for k in updates}
    values = {f":{k}": v for k, v in updates.items()}
    table.update_item(
        Key={"userId": user_id, "itemId": item_id},
        UpdateExpression=expr,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
    )
    return get_plaid_item(user_id, item_id)


def delete_plaid_items_by_institution(user_id: str, institution_id: str):
    items = [i for i in get_plaid_items(user_id) if i.get("institutionId") == institution_id]
    table = _dynamodb.Table(_settings.plaid_items_table)
    for item in items:
        table.delete_item(Key={"userId": user_id, "itemId": item["itemId"]})


# ── Accounts ──────────────────────────────────────────────────────────────────

def get_accounts(user_id: str) -> list[dict]:
    table = _dynamodb.Table(_settings.accounts_table)
    resp = table.query(KeyConditionExpression=Key("userId").eq(user_id))
    return resp.get("Items", [])


def get_account(account_id: str) -> Optional[dict]:
    """Look up an account by accountId using the GSI."""
    table = _dynamodb.Table(_settings.accounts_table)
    resp = table.query(
        IndexName="accountId-index",
        KeyConditionExpression=Key("accountId").eq(account_id),
    )
    items = resp.get("Items", [])
    return items[0] if items else None


def get_account_by_plaid_id(user_id: str, plaid_id: str) -> Optional[dict]:
    accounts = get_accounts(user_id)
    return next((a for a in accounts if a.get("plaidId") == plaid_id), None)


def put_account(user_id: str, data: dict) -> dict:
    table = _dynamodb.Table(_settings.accounts_table)
    now = _now_iso()
    account_id = data.get("account_id") or str(uuid.uuid4())
    item = {
        "userId": user_id,
        "accountId": account_id,
        "plaidId": data["plaid_id"],
        "name": data["name"],
        "nickname": data.get("nickname"),
        "type": data["type"],
        "subtype": data.get("subtype"),
        "mask": data.get("mask"),
        "hidden": data.get("hidden", False),
        "metadata": data.get("metadata"),
        "url": data.get("url"),
        "itemId": data["item_id"],
        "createdAt": now,
        "updatedAt": now,
    }
    table.put_item(Item=item)
    return item


def update_account(user_id: str, account_id: str, updates: dict) -> dict:
    table = _dynamodb.Table(_settings.accounts_table)
    updates["updatedAt"] = _now_iso()
    expr = "SET " + ", ".join(f"#{k} = :{k}" for k in updates)
    names = {f"#{k}": k for k in updates}
    values = {f":{k}": v for k, v in updates.items()}
    table.update_item(
        Key={"userId": user_id, "accountId": account_id},
        UpdateExpression=expr,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
    )
    return get_account(account_id)


def delete_accounts_by_institution(user_id: str, institution_id: str, item_id: str):
    accounts = [a for a in get_accounts(user_id) if a.get("itemId") == item_id]
    table = _dynamodb.Table(_settings.accounts_table)
    for account in accounts:
        table.delete_item(Key={"userId": user_id, "accountId": account["accountId"]})


# ── Balances ──────────────────────────────────────────────────────────────────

def get_latest_balance(account_id: str) -> Optional[dict]:
    table = _dynamodb.Table(_settings.balances_table)
    resp = table.query(
        KeyConditionExpression=Key("accountId").eq(account_id),
        ScanIndexForward=False,
        Limit=1,
    )
    items = resp.get("Items", [])
    return items[0] if items else None


def get_balance_history(account_id: str, limit: int = 365) -> list[dict]:
    table = _dynamodb.Table(_settings.balances_table)
    resp = table.query(
        KeyConditionExpression=Key("accountId").eq(account_id),
        ScanIndexForward=False,
        Limit=limit,
    )
    return resp.get("Items", [])


def put_balance(account_id: str, current: float, available: Optional[float], limit: Optional[float]) -> dict:
    table = _dynamodb.Table(_settings.balances_table)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    date_ts = _date_timestamp(today)
    item = {
        "accountId": account_id,
        "dateTimestamp": date_ts,
        "balanceId": str(uuid.uuid4()),
        "current": str(current),  # DynamoDB Decimal-safe: store as string, convert on read
        "available": str(available) if available is not None else None,
        "limit": str(limit) if limit is not None else None,
        "date": today,
    }
    table.put_item(Item=item)
    return item


# ── Transactions ──────────────────────────────────────────────────────────────

def get_transactions(account_id: str, limit: int = 100, offset: int = 0) -> list[dict]:
    table = _dynamodb.Table(_settings.transactions_table)
    resp = table.query(
        KeyConditionExpression=Key("accountId").eq(account_id),
        ScanIndexForward=False,
        Limit=limit + offset,
    )
    return resp.get("Items", [])[offset:]


def get_transaction(account_id: str, date_plaid_id: str) -> Optional[dict]:
    table = _dynamodb.Table(_settings.transactions_table)
    resp = table.get_item(Key={"accountId": account_id, "datePlaidId": date_plaid_id})
    return resp.get("Item")


def put_transaction(txn: dict) -> dict:
    table = _dynamodb.Table(_settings.transactions_table)
    table.put_item(Item=txn)
    return txn


def update_transaction(account_id: str, date_plaid_id: str, updates: dict):
    table = _dynamodb.Table(_settings.transactions_table)
    expr = "SET " + ", ".join(f"#{k} = :{k}" for k in updates)
    names = {f"#{k}": k for k in updates}
    values = {f":{k}": v for k, v in updates.items()}
    table.update_item(
        Key={"accountId": account_id, "datePlaidId": date_plaid_id},
        UpdateExpression=expr,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
    )


def delete_transaction(account_id: str, date_plaid_id: str):
    table = _dynamodb.Table(_settings.transactions_table)
    table.delete_item(Key={"accountId": account_id, "datePlaidId": date_plaid_id})


def delete_balance(account_id: str, balance_id: str):
    """Delete a specific balance record by its balanceId (scans for matching dateTimestamp)."""
    table = _dynamodb.Table(_settings.balances_table)
    # balance_id is either balanceId or dateTimestamp — query by account and find it
    resp = table.query(KeyConditionExpression=Key("accountId").eq(account_id))
    for item in resp.get("Items", []):
        if item.get("balanceId") == balance_id or item.get("dateTimestamp") == balance_id:
            table.delete_item(Key={"accountId": account_id, "dateTimestamp": item["dateTimestamp"]})
            return


def clean_balance_records(account_id: str, granularity: str = "day") -> int:
    """
    Keep only the most recent balance record per day or per month.
    Returns the number of deleted records.
    """
    table = _dynamodb.Table(_settings.balances_table)
    resp = table.query(
        KeyConditionExpression=Key("accountId").eq(account_id),
        ScanIndexForward=False,
    )
    items = resp.get("Items", [])

    seen: set[str] = set()
    to_delete = []
    for item in items:
        date_str = item.get("date", "")
        key = date_str[:7] if granularity == "month" else date_str[:10]
        if key in seen:
            to_delete.append(item["dateTimestamp"])
        else:
            seen.add(key)

    with table.batch_writer() as batch:
        for date_ts in to_delete:
            batch.delete_item(Key={"accountId": account_id, "dateTimestamp": date_ts})

    return len(to_delete)


def delete_all_transactions(account_id: str):
    table = _dynamodb.Table(_settings.transactions_table)
    resp = table.query(KeyConditionExpression=Key("accountId").eq(account_id))
    with table.batch_writer() as batch:
        for item in resp.get("Items", []):
            batch.delete_item(Key={"accountId": account_id, "datePlaidId": item["datePlaidId"]})
