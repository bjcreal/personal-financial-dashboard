import os
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # DynamoDB table names (injected by SAM/Lambda environment)
    users_table: str = os.environ.get("USERS_TABLE", "financial-dashboard-users-dev")
    plaid_items_table: str = os.environ.get("PLAID_ITEMS_TABLE", "financial-dashboard-plaid-items-dev")
    accounts_table: str = os.environ.get("ACCOUNTS_TABLE", "financial-dashboard-accounts-dev")
    balances_table: str = os.environ.get("BALANCES_TABLE", "financial-dashboard-balances-dev")
    transactions_table: str = os.environ.get("TRANSACTIONS_TABLE", "financial-dashboard-transactions-dev")

    # Cognito
    user_pool_id: str = os.environ.get("USER_POOL_ID", "")
    cognito_client_id: str = os.environ.get("COGNITO_CLIENT_ID", "")

    # Runtime
    stage: str = os.environ.get("STAGE", "dev")
    plaid_env: str = os.environ.get("PLAID_ENV", "sandbox")

    # AWS region (Lambda sets this automatically)
    aws_region: str = os.environ.get("AWS_REGION", "us-east-1")

    # Secrets Manager secret names
    plaid_secret_name: str = "financial-dashboard/plaid"
    coinbase_secret_name: str = "financial-dashboard/coinbase"

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
