"""
EventBridge scheduled sync Lambda handler.

Triggered daily via EventBridge cron (see template.yaml SyncFunction).
Iterates over all users and refreshes Plaid + Coinbase balances.
"""
from __future__ import annotations
import json
import boto3
from datetime import datetime, timezone

from app.config import get_settings
from app.services import dynamodb as db, plaid, coinbase

_settings = get_settings()
_dynamodb = boto3.resource("dynamodb")


def handler(event, context):
    print(f"Daily sync started at {datetime.now(timezone.utc).isoformat()}")

    users_table = _dynamodb.Table(_settings.users_table)
    users = users_table.scan().get("Items", [])
    print(f"Syncing {len(users)} user(s)")

    results = []

    for user in users:
        user_id = user["userId"]
        user_result = {"userId": user_id, "institutions": [], "errors": []}

        items = db.get_plaid_items(user_id)
        for item in items:
            if item.get("accessToken") == "manual":
                continue

            try:
                if item.get("provider") == "coinbase":
                    access_token = item["accessToken"]
                    try:
                        cb_accounts = coinbase.get_accounts_with_usd_value(access_token)
                    except Exception:
                        if not item.get("refreshToken"):
                            raise
                        tokens = coinbase.refresh_access_token(item["refreshToken"])
                        access_token = tokens["access_token"]
                        db.update_plaid_item(user_id, item["itemId"], {
                            "accessToken": tokens["access_token"],
                            "refreshToken": tokens["refresh_token"],
                        })
                        cb_accounts = coinbase.get_accounts_with_usd_value(access_token)

                    refreshed = 0
                    for cb_account in cb_accounts:
                        plaid_id = f"coinbase_{cb_account['id']}"
                        existing = db.get_account_by_plaid_id(user_id, plaid_id)
                        if existing:
                            db.put_balance(
                                existing["accountId"],
                                cb_account["usd_value"],
                                cb_account["usd_value"],
                                None,
                            )
                            refreshed += 1
                    user_result["institutions"].append({
                        "name": item.get("institutionName", "Coinbase"),
                        "accountsRefreshed": refreshed,
                    })

                else:
                    plaid_balances = plaid.get_balances(item["accessToken"])
                    refreshed = 0
                    for plaid_account in plaid_balances:
                        existing = db.get_account_by_plaid_id(user_id, plaid_account["account_id"])
                        if existing:
                            db.put_balance(
                                existing["accountId"],
                                float(plaid_account["balances"].get("current") or 0),
                                plaid_account["balances"].get("available"),
                                plaid_account["balances"].get("limit"),
                            )
                            refreshed += 1
                    user_result["institutions"].append({
                        "name": item.get("institutionName", "Unknown"),
                        "accountsRefreshed": refreshed,
                    })

            except Exception as e:
                error_msg = f"Error syncing {item.get('institutionName', item['itemId'])}: {e}"
                print(error_msg)
                user_result["errors"].append(error_msg)

        results.append(user_result)

    print(f"Daily sync complete: {json.dumps(results, default=str)}")
    return {"statusCode": 200, "body": json.dumps({"synced": len(users), "results": results})}
