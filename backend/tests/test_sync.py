"""Tests for the EventBridge daily sync handler."""
import json
import pytest
import boto3
from unittest.mock import patch
from app.services import dynamodb as db


USER = "user-test-123"


def _seed_user(ddb):
    ddb.Table("financial-dashboard-users-dev").put_item(
        Item={"userId": USER, "email": "test@example.com"}
    )


def _seed_plaid_item(item_id="item-sync-1", access_token="access-sandbox-sync", institution_id="ins_sync"):
    item = db.put_plaid_item(USER, {
        "item_id": item_id,
        "access_token": access_token,
        "provider": "plaid",
        "institution_id": institution_id,
        "institution_name": "Sync Bank",
    })
    account = db.put_account(USER, {
        "plaid_id": f"plaid-{item_id}-001",
        "name": "Sync Checking",
        "type": "depository",
        "item_id": item_id,
    })
    db.put_balance(account["accountId"], 500.0, None, None)
    return item, account


@patch("app.services.plaid.get_balances")
def test_sync_refreshes_plaid_accounts(mock_balances, aws_mock):
    _seed_user(aws_mock)
    item, account = _seed_plaid_item()

    mock_balances.return_value = [{
        "account_id": f"plaid-{item['itemId']}-001",
        "balances": {"current": 750.0, "available": 700.0, "limit": None},
    }]

    from sync.handler import handler
    result = handler({}, {})

    assert result["statusCode"] == 200
    latest = db.get_latest_balance(account["accountId"])
    assert float(latest["current"]) == 750.0


@patch("app.services.plaid.get_balances")
def test_sync_skips_manual_accounts(mock_balances, aws_mock):
    _seed_user(aws_mock)
    db.put_plaid_item(USER, {
        "item_id": "manual-item-1",
        "access_token": "manual",
        "provider": "manual",
        "institution_id": "manual-item-1",
    })

    from sync.handler import handler
    handler({}, {})
    mock_balances.assert_not_called()


@patch("app.services.plaid.get_balances")
def test_sync_skips_coinbase_accounts(mock_balances, aws_mock):
    _seed_user(aws_mock)
    db.put_plaid_item(USER, {
        "item_id": "coinbase-item",
        "access_token": "cb-access-token",
        "provider": "coinbase",
        "institution_id": "coinbase",
    })

    from sync.handler import handler
    handler({}, {})
    mock_balances.assert_not_called()


@patch("app.services.plaid.get_balances")
def test_sync_records_error_and_continues(mock_balances, aws_mock):
    _seed_user(aws_mock)
    _seed_plaid_item("item-ok", "access-ok", "ins_ok")
    _seed_plaid_item("item-bad", "access-bad", "ins_bad")

    def side_effect(access_token):
        if access_token == "access-bad":
            raise Exception("Plaid API error")
        return [{"account_id": "plaid-item-ok-001", "balances": {"current": 100.0, "available": None, "limit": None}}]

    mock_balances.side_effect = side_effect

    from sync.handler import handler
    result = handler({}, {})

    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert any(len(r.get("errors", [])) > 0 for r in body["results"])


@patch("app.services.plaid.get_balances")
def test_sync_no_users(mock_balances, aws_mock):
    from sync.handler import handler
    result = handler({}, {})
    assert result["statusCode"] == 200
    mock_balances.assert_not_called()
