"""AWS Secrets Manager helpers."""
import json
import boto3
from functools import lru_cache
from app.config import get_settings


@lru_cache
def _get_client():
    return boto3.client("secretsmanager")


def get_secret(secret_name: str) -> dict:
    """Retrieve and parse a JSON secret from Secrets Manager."""
    client = _get_client()
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response["SecretString"])


def get_plaid_credentials() -> dict:
    """Return {'client_id': ..., 'secret': ...}"""
    settings = get_settings()
    return get_secret(settings.plaid_secret_name)


def get_coinbase_credentials() -> dict:
    """Return {'client_id': ..., 'client_secret': ...}"""
    settings = get_settings()
    return get_secret(settings.coinbase_secret_name)
