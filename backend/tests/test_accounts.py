"""Tests for the accounts router."""
import pytest
from unittest.mock import patch


USER = "user-test-123"
HEADERS = {"X-User-Id": USER}


def test_list_accounts_empty(client):
    resp = client.get("/api/accounts", headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_accounts_with_data(client, seeded_item):
    resp = client.get("/api/accounts", headers=HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    acct = data[0]
    assert acct["name"] == "Checking"
    assert acct["type"] == "depository"
    assert acct["balance"]["current"] == 1000.0
    assert acct["institution"] == "First Bank"


def test_list_accounts_requires_auth(client):
    resp = client.get("/api/accounts")
    assert resp.status_code == 401


def test_accounts_history(client, seeded_item):
    resp = client.get("/api/accounts/history", headers=HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert "balanceHistory" in data[0]
    assert len(data[0]["balanceHistory"]) == 1


def test_toggle_visibility(client, seeded_item):
    account_id = seeded_item["account"]["accountId"]

    resp = client.post(f"/api/accounts/{account_id}/toggle-visibility", headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json()["hidden"] is True

    # Toggle back
    resp = client.post(f"/api/accounts/{account_id}/toggle-visibility", headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json()["hidden"] is False


def test_update_nickname(client, seeded_item):
    account_id = seeded_item["account"]["accountId"]

    resp = client.post(
        f"/api/accounts/{account_id}/update-nickname",
        json={"nickname": "My Main Account"},
        headers=HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    accounts = client.get("/api/accounts", headers=HEADERS).json()
    assert accounts[0]["nickname"] == "My Main Account"


def test_create_manual_account(client):
    payload = {"name": "Home Equity", "type": "asset", "subtype": "real_estate", "balance": 450000.0}
    resp = client.post("/api/accounts/manual", json=payload, headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    accounts = client.get("/api/accounts", headers=HEADERS).json()
    assert any(a["name"] == "Home Equity" for a in accounts)
    home = next(a for a in accounts if a["name"] == "Home Equity")
    assert home["balance"]["current"] == 450000.0


def test_disconnect_institution(client, seeded_item):
    resp = client.post(
        "/api/accounts/disconnect",
        json={"institution_id": "ins_1"},
        headers=HEADERS,
    )
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    accounts = client.get("/api/accounts", headers=HEADERS).json()
    assert accounts == []


def test_disconnect_nonexistent_institution(client):
    resp = client.post(
        "/api/accounts/disconnect",
        json={"institution_id": "ins_does_not_exist"},
        headers=HEADERS,
    )
    assert resp.status_code == 404


def test_balance_history_endpoint(client, seeded_item):
    account_id = seeded_item["account"]["accountId"]
    resp = client.get(f"/api/accounts/{account_id}/history", headers=HEADERS)
    assert resp.status_code == 200
    history = resp.json()
    assert len(history) == 1
    assert history[0]["current"] == 1000.0


def test_update_manual_balance(client, seeded_item):
    account_id = seeded_item["account"]["accountId"]
    resp = client.post(
        f"/api/accounts/{account_id}/balance",
        json={"balance": 1234.56},
        headers=HEADERS,
    )
    assert resp.status_code == 200

    history = client.get(f"/api/accounts/{account_id}/history", headers=HEADERS).json()
    assert history[-1]["current"] == 1234.56


def test_get_transactions_empty(client, seeded_item):
    account_id = seeded_item["account"]["accountId"]
    resp = client.get(f"/api/accounts/{account_id}/transactions", headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json() == []


def test_delete_transactions(client, seeded_item):
    from app.services import dynamodb as db
    account_id = seeded_item["account"]["accountId"]

    db.put_transaction({
        "accountId": account_id, "userId": USER,
        "datePlaidId": "2025-01-10#txn-1", "plaidId": "txn-1",
        "date": "2025-01-10", "name": "Grocery", "amount": "55.0", "pending": False,
    })

    assert len(client.get(f"/api/accounts/{account_id}/transactions", headers=HEADERS).json()) == 1

    resp = client.delete(f"/api/accounts/{account_id}/transactions", headers=HEADERS)
    assert resp.status_code == 200
    assert client.get(f"/api/accounts/{account_id}/transactions", headers=HEADERS).json() == []


def test_wrong_user_cannot_access_account(client, seeded_item):
    account_id = seeded_item["account"]["accountId"]
    resp = client.get(
        f"/api/accounts/{account_id}/history",
        headers={"X-User-Id": "other-user-999"},
    )
    assert resp.status_code == 404


def test_clean_daily_records(client, seeded_item):
    from app.services import dynamodb as db
    account_id = seeded_item["account"]["accountId"]

    # Add two more balances on the same day (seeded_item already added one)
    db.put_balance(account_id, 1050.0, None, None)
    db.put_balance(account_id, 1100.0, None, None)

    resp = client.post(f"/api/accounts/{account_id}/clean-daily-records", headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json()["deleted"] == 2
