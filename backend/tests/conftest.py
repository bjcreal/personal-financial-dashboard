"""
Shared pytest fixtures.

Uses moto to mock DynamoDB and Secrets Manager — no real AWS credentials needed.
All table names match the defaults in config.py (the "dev" stage names).
"""
import json
import os
import pytest
import boto3
from moto import mock_aws
from fastapi.testclient import TestClient

# Set env vars BEFORE importing app modules so config picks them up
os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "testing")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "testing")
os.environ.setdefault("STAGE", "dev")
os.environ.setdefault("PLAID_ENV", "sandbox")
os.environ.setdefault("USERS_TABLE", "financial-dashboard-users-dev")
os.environ.setdefault("PLAID_ITEMS_TABLE", "financial-dashboard-plaid-items-dev")
os.environ.setdefault("ACCOUNTS_TABLE", "financial-dashboard-accounts-dev")
os.environ.setdefault("BALANCES_TABLE", "financial-dashboard-balances-dev")
os.environ.setdefault("TRANSACTIONS_TABLE", "financial-dashboard-transactions-dev")


# ── DynamoDB table definitions (mirrors template.yaml) ───────────────────────

TABLE_DEFS = [
    {
        "TableName": "financial-dashboard-users-dev",
        "BillingMode": "PAY_PER_REQUEST",
        "AttributeDefinitions": [{"AttributeName": "userId", "AttributeType": "S"}],
        "KeySchema": [{"AttributeName": "userId", "KeyType": "HASH"}],
    },
    {
        "TableName": "financial-dashboard-plaid-items-dev",
        "BillingMode": "PAY_PER_REQUEST",
        "AttributeDefinitions": [
            {"AttributeName": "userId", "AttributeType": "S"},
            {"AttributeName": "itemId", "AttributeType": "S"},
        ],
        "KeySchema": [
            {"AttributeName": "userId", "KeyType": "HASH"},
            {"AttributeName": "itemId", "KeyType": "RANGE"},
        ],
    },
    {
        "TableName": "financial-dashboard-accounts-dev",
        "BillingMode": "PAY_PER_REQUEST",
        "AttributeDefinitions": [
            {"AttributeName": "userId", "AttributeType": "S"},
            {"AttributeName": "accountId", "AttributeType": "S"},
        ],
        "KeySchema": [
            {"AttributeName": "userId", "KeyType": "HASH"},
            {"AttributeName": "accountId", "KeyType": "RANGE"},
        ],
        "GlobalSecondaryIndexes": [
            {
                "IndexName": "accountId-index",
                "KeySchema": [{"AttributeName": "accountId", "KeyType": "HASH"}],
                "Projection": {"ProjectionType": "ALL"},
            }
        ],
    },
    {
        "TableName": "financial-dashboard-balances-dev",
        "BillingMode": "PAY_PER_REQUEST",
        "AttributeDefinitions": [
            {"AttributeName": "accountId", "AttributeType": "S"},
            {"AttributeName": "dateTimestamp", "AttributeType": "S"},
        ],
        "KeySchema": [
            {"AttributeName": "accountId", "KeyType": "HASH"},
            {"AttributeName": "dateTimestamp", "KeyType": "RANGE"},
        ],
    },
    {
        "TableName": "financial-dashboard-transactions-dev",
        "BillingMode": "PAY_PER_REQUEST",
        "AttributeDefinitions": [
            {"AttributeName": "accountId", "AttributeType": "S"},
            {"AttributeName": "datePlaidId", "AttributeType": "S"},
            {"AttributeName": "userId", "AttributeType": "S"},
            {"AttributeName": "date", "AttributeType": "S"},
        ],
        "KeySchema": [
            {"AttributeName": "accountId", "KeyType": "HASH"},
            {"AttributeName": "datePlaidId", "KeyType": "RANGE"},
        ],
        "GlobalSecondaryIndexes": [
            {
                "IndexName": "userId-date-index",
                "KeySchema": [
                    {"AttributeName": "userId", "KeyType": "HASH"},
                    {"AttributeName": "date", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            }
        ],
    },
]

PLAID_SECRET = {"client_id": "test_client", "secret": "test_secret"}
COINBASE_SECRET = {"client_id": "cb_client", "client_secret": "cb_secret"}


@pytest.fixture(scope="function")
def aws_mock():
    """Start moto mock for DynamoDB + Secrets Manager for a single test."""
    with mock_aws():
        ddb = boto3.resource("dynamodb", region_name="us-east-1")
        for defn in TABLE_DEFS:
            ddb.create_table(**defn)

        sm = boto3.client("secretsmanager", region_name="us-east-1")
        sm.create_secret(
            Name="financial-dashboard/plaid",
            SecretString=json.dumps(PLAID_SECRET),
        )
        sm.create_secret(
            Name="financial-dashboard/coinbase",
            SecretString=json.dumps(COINBASE_SECRET),
        )
        yield ddb


@pytest.fixture(scope="function")
def client(aws_mock):
    """FastAPI TestClient with mocked AWS and a pre-seeded test user."""
    # Clear lru_cache so services pick up fresh boto3 clients inside mock context
    from app.services import dynamodb as db
    from app.services.secrets import _get_client as _sm_client
    from app.dependencies import get_dynamodb_resource, get_secrets_client
    from app.config import get_settings

    get_dynamodb_resource.cache_clear()
    get_secrets_client.cache_clear()
    _sm_client.cache_clear()
    get_settings.cache_clear()

    from app.main import app

    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


@pytest.fixture
def auth_headers():
    """Simulate Cognito-authenticated request via the X-User-Id dev bypass."""
    return {"X-User-Id": "user-test-123"}


@pytest.fixture
def seeded_item(aws_mock):
    """Pre-seed a Plaid item + account + balance for tests that need existing data."""
    from app.services import dynamodb as db

    user_id = "user-test-123"
    item = db.put_plaid_item(user_id, {
        "item_id": "item-abc",
        "access_token": "access-sandbox-abc",
        "provider": "plaid",
        "institution_id": "ins_1",
        "institution_name": "First Bank",
        "institution_logo": None,
    })
    account = db.put_account(user_id, {
        "plaid_id": "plaid-acct-001",
        "name": "Checking",
        "type": "depository",
        "subtype": "checking",
        "mask": "0001",
        "item_id": "item-abc",
    })
    db.put_balance(account["accountId"], 1000.00, 950.00, None)
    return {"user_id": user_id, "item": item, "account": account}
