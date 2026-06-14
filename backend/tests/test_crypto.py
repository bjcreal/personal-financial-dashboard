"""Tests for the Coinbase OAuth router."""
import pytest
from unittest.mock import patch, MagicMock


USER = "user-test-123"
HEADERS = {"X-User-Id": USER}


@patch("app.services.coinbase.get_coinbase_credentials")
def test_get_oauth_url(mock_creds, client):
    mock_creds.return_value = {"client_id": "cb_id", "client_secret": "cb_secret"}

    resp = client.get("/api/crypto/oauth", headers=HEADERS)
    assert resp.status_code == 200
    url = resp.json()["authUrl"]
    assert "coinbase.com/oauth/authorize" in url
    assert "cb_id" in url
    assert "wallet:accounts:read" in url


@patch("app.services.coinbase.get_accounts_with_usd_value")
@patch("app.services.coinbase.exchange_code")
def test_oauth_callback_new_connection(mock_exchange, mock_accounts, client):
    mock_exchange.return_value = {
        "access_token": "access-cb-123",
        "refresh_token": "refresh-cb-123",
    }
    mock_accounts.return_value = [
        {"id": "wallet-btc", "name": "BTC Wallet", "currency": "BTC",
         "crypto_amount": 0.5, "usd_value": 25000.0},
    ]

    resp = client.get("/api/crypto/oauth/callback?code=auth-code-xyz", headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    accounts = client.get("/api/accounts", headers=HEADERS).json()
    assert len(accounts) == 1
    assert "BTC" in accounts[0]["name"]
    assert accounts[0]["balance"]["current"] == 25000.0


@patch("app.services.coinbase.get_accounts_with_usd_value")
@patch("app.services.coinbase.exchange_code")
def test_oauth_callback_updates_existing_connection(mock_exchange, mock_accounts, client):
    mock_exchange.return_value = {"access_token": "tok-1", "refresh_token": "ref-1"}
    mock_accounts.return_value = []
    client.get("/api/crypto/oauth/callback?code=code-1", headers=HEADERS)

    mock_exchange.return_value = {"access_token": "tok-2", "refresh_token": "ref-2"}
    resp = client.get("/api/crypto/oauth/callback?code=code-2", headers=HEADERS)
    assert resp.status_code == 200

    from app.services import dynamodb as db
    item = db.get_plaid_item_by_institution(USER, "coinbase")
    assert item["accessToken"] == "tok-2"


def test_oauth_callback_requires_auth(client):
    resp = client.get("/api/crypto/oauth/callback?code=auth-code-xyz")
    assert resp.status_code == 401
