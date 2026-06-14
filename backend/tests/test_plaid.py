"""Tests for the Plaid router."""
import pytest
from unittest.mock import patch, MagicMock


USER = "user-test-123"
HEADERS = {"X-User-Id": USER}


def _mock_plaid_accounts():
    return [
        {
            "account_id": "plaid-chk-001",
            "name": "Total Checking",
            "type": "depository",
            "subtype": "checking",
            "mask": "1234",
            "balances": {"current": 2500.0, "available": 2400.0, "limit": None},
        }
    ]


@patch("app.services.plaid._get_plaid_client")
def test_create_link_token(mock_client, client):
    mock_api = MagicMock()
    mock_api.link_token_create.return_value = {"link_token": "link-sandbox-abc123"}
    mock_client.return_value = mock_api

    resp = client.post("/api/plaid/create-link-token", headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json()["link_token"] == "link-sandbox-abc123"


@patch("app.services.plaid._get_plaid_client")
def test_create_link_token_requires_auth(mock_client, client):
    resp = client.post("/api/plaid/create-link-token")
    assert resp.status_code == 401


@patch("app.services.plaid.get_accounts")
@patch("app.services.plaid.get_institution_details")
@patch("app.services.plaid.exchange_public_token")
def test_exchange_token_new_institution(mock_exchange, mock_inst, mock_accounts, client):
    mock_exchange.return_value = ("access-sandbox-xyz", "item-xyz")
    mock_inst.return_value = ("ins_chase", {"name": "Chase", "logo": None, "institution_id": "ins_chase"})
    mock_accounts.return_value = _mock_plaid_accounts()

    resp = client.post(
        "/api/plaid/exchange-token",
        json={"public_token": "public-sandbox-token"},
        headers=HEADERS,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["institution"] == "Chase"
    assert "Created" in body["message"]

    accounts = client.get("/api/accounts", headers=HEADERS).json()
    assert len(accounts) == 1
    assert accounts[0]["name"] == "Total Checking"
    assert accounts[0]["balance"]["current"] == 2500.0


@patch("app.services.plaid.get_accounts")
@patch("app.services.plaid.get_institution_details")
@patch("app.services.plaid.exchange_public_token")
def test_exchange_token_updates_existing_institution(mock_exchange, mock_inst, mock_accounts, client, seeded_item):
    mock_exchange.return_value = ("access-sandbox-new", "item-new-456")
    mock_inst.return_value = ("ins_1", {"name": "First Bank Updated", "logo": None})
    mock_accounts.return_value = [
        {
            "account_id": "plaid-chk-NEW",
            "name": "Checking",
            "type": "depository",
            "subtype": "checking",
            "mask": "0001",  # same mask → should update existing account
            "balances": {"current": 1500.0, "available": 1400.0, "limit": None},
        }
    ]

    resp = client.post(
        "/api/plaid/exchange-token",
        json={"public_token": "public-sandbox-relink"},
        headers=HEADERS,
    )
    assert resp.status_code == 200
    assert "Updated" in resp.json()["message"]

    accounts = client.get("/api/accounts", headers=HEADERS).json()
    assert len(accounts) == 1
    assert accounts[0]["balance"]["current"] == 1500.0


@patch("app.services.plaid.refresh_institution")
def test_refresh_institutions(mock_refresh, client, seeded_item):
    mock_refresh.return_value = {"institutionName": "First Bank v2", "institutionLogo": None}

    resp = client.post("/api/plaid/refresh-institutions", headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json()["updated"] == 1
