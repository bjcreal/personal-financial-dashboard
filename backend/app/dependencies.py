"""
FastAPI dependencies for auth and AWS clients.

In production (Lambda + API Gateway), the Cognito Authorizer validates the JWT
and passes the decoded claims via requestContext.authorizer.claims. We extract
the user's `sub` from those claims — no need to verify the token ourselves.

For local dev (running with uvicorn), pass `X-User-Id: <your-sub>` to bypass auth.
"""
import os
import boto3
from functools import lru_cache
from fastapi import Depends, HTTPException, Request
from app.config import Settings, get_settings


def get_current_user(request: Request) -> str:
    """Return the Cognito sub (userId) for the authenticated caller."""
    # Lambda context: claims injected by API Gateway Cognito Authorizer
    aws_event = request.scope.get("aws.event", {})
    claims = (
        aws_event
        .get("requestContext", {})
        .get("authorizer", {})
        .get("claims", {})
    )
    user_id = claims.get("sub")

    # Local dev fallback
    if not user_id:
        user_id = request.headers.get("X-User-Id")

    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    return user_id


@lru_cache
def get_dynamodb_resource():
    return boto3.resource("dynamodb")


@lru_cache
def get_secrets_client():
    return boto3.client("secretsmanager")


def get_db(settings: Settings = Depends(get_settings)):
    return get_dynamodb_resource()
