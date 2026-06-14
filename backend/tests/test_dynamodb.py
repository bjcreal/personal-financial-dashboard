"""Unit tests for the DynamoDB service layer."""
import pytest
from app.services import dynamodb as db


USER_ID = "user-test-123"


def test_put_and_get_plaid_item(aws_mock):
    item = db.put_plaid_item(USER_ID, {
        "item_id": "item-1",
        "access_token": "access-sandbox-1",
        "provider": "plaid",
        "institution_id": "ins_1",
        "institution_name": "Test Bank",
    })
    assert item["itemId"] == "item-1"

    fetched = db.get_plaid_item(USER_ID, "item-1")
    assert fetched["institutionName"] == "Test Bank"


def test_get_plaid_items_empty(aws_mock):
    assert db.get_plaid_items("nobody") == []


def test_put_and_get_account(aws_mock):
    db.put_plaid_item(USER_ID, {
        "item_id": "item-1",
        "access_token": "tok",
        "provider": "plaid",
        "institution_id": "ins_1",
    })
    account = db.put_account(USER_ID, {
        "plaid_id": "plaid-001",
        "name": "Checking",
        "type": "depository",
        "subtype": "checking",
        "item_id": "item-1",
    })
    account_id = account["accountId"]
    fetched = db.get_account(account_id)
    assert fetched is not None
    assert fetched["name"] == "Checking"
    assert fetched["userId"] == USER_ID


def test_update_account(aws_mock):
    db.put_plaid_item(USER_ID, {"item_id": "i1", "access_token": "t", "provider": "plaid", "institution_id": "ins_1"})
    account = db.put_account(USER_ID, {"plaid_id": "p1", "name": "Savings", "type": "depository", "item_id": "i1"})
    db.update_account(USER_ID, account["accountId"], {"hidden": True})
    updated = db.get_account(account["accountId"])
    assert updated["hidden"] is True


def test_put_and_get_balance(aws_mock):
    db.put_plaid_item(USER_ID, {"item_id": "i1", "access_token": "t", "provider": "plaid", "institution_id": "ins_1"})
    account = db.put_account(USER_ID, {"plaid_id": "p1", "name": "Checking", "type": "depository", "item_id": "i1"})
    account_id = account["accountId"]

    db.put_balance(account_id, 500.00, 450.00, None)
    balance = db.get_latest_balance(account_id)
    assert balance is not None
    assert float(balance["current"]) == 500.00
    assert float(balance["available"]) == 450.00


def test_balance_history_ordering(aws_mock):
    db.put_plaid_item(USER_ID, {"item_id": "i1", "access_token": "t", "provider": "plaid", "institution_id": "ins_1"})
    account = db.put_account(USER_ID, {"plaid_id": "p1", "name": "Checking", "type": "depository", "item_id": "i1"})
    account_id = account["accountId"]

    db.put_balance(account_id, 100.0, None, None)
    db.put_balance(account_id, 200.0, None, None)
    db.put_balance(account_id, 300.0, None, None)

    history = db.get_balance_history(account_id, limit=10)
    # ScanIndexForward=False means newest first
    assert float(history[0]["current"]) == 300.0


def test_put_and_get_transaction(aws_mock):
    db.put_plaid_item(USER_ID, {"item_id": "i1", "access_token": "t", "provider": "plaid", "institution_id": "ins_1"})
    account = db.put_account(USER_ID, {"plaid_id": "p1", "name": "Checking", "type": "depository", "item_id": "i1"})
    account_id = account["accountId"]

    txn = {
        "accountId": account_id,
        "userId": USER_ID,
        "datePlaidId": "2025-01-15#txn-abc",
        "plaidId": "txn-abc",
        "date": "2025-01-15",
        "name": "Coffee Shop",
        "amount": "4.50",
        "pending": False,
    }
    db.put_transaction(txn)
    txns = db.get_transactions(account_id, limit=10)
    assert len(txns) == 1
    assert txns[0]["name"] == "Coffee Shop"


def test_delete_all_transactions(aws_mock):
    db.put_plaid_item(USER_ID, {"item_id": "i1", "access_token": "t", "provider": "plaid", "institution_id": "ins_1"})
    account = db.put_account(USER_ID, {"plaid_id": "p1", "name": "Checking", "type": "depository", "item_id": "i1"})
    account_id = account["accountId"]

    for i in range(3):
        db.put_transaction({
            "accountId": account_id, "userId": USER_ID,
            "datePlaidId": f"2025-01-1{i}#txn-{i}", "plaidId": f"txn-{i}",
            "date": f"2025-01-1{i}", "name": f"Txn {i}", "amount": "10.00", "pending": False,
        })

    db.delete_all_transactions(account_id)
    assert db.get_transactions(account_id) == []


def test_get_plaid_item_by_institution(aws_mock):
    db.put_plaid_item(USER_ID, {
        "item_id": "i1", "access_token": "t", "provider": "plaid", "institution_id": "ins_chase",
        "institution_name": "Chase",
    })
    item = db.get_plaid_item_by_institution(USER_ID, "ins_chase")
    assert item is not None
    assert item["institutionName"] == "Chase"

    assert db.get_plaid_item_by_institution(USER_ID, "ins_unknown") is None


def test_clean_balance_records_daily(aws_mock):
    db.put_plaid_item(USER_ID, {"item_id": "i1", "access_token": "t", "provider": "plaid", "institution_id": "ins_1"})
    account = db.put_account(USER_ID, {"plaid_id": "p1", "name": "Checking", "type": "depository", "item_id": "i1"})
    account_id = account["accountId"]

    # Insert 3 balances on the same day
    for _ in range(3):
        db.put_balance(account_id, 100.0, None, None)

    deleted = db.clean_balance_records(account_id, granularity="day")
    # Should keep 1, delete 2
    assert deleted == 2
    assert len(db.get_balance_history(account_id, limit=10)) == 1
