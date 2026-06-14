from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from app.routers import accounts, plaid, crypto, health

app = FastAPI(
    title="Financial Dashboard API",
    description="Personal financial dashboard — Plaid + Coinbase on AWS Lambda",
    version="2.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(accounts.router, prefix="/api/accounts", tags=["accounts"])
app.include_router(plaid.router, prefix="/api/plaid", tags=["plaid"])
app.include_router(crypto.router, prefix="/api/crypto", tags=["crypto"])

# Mangum wraps the ASGI app for Lambda + API Gateway
handler = Mangum(app, lifespan="off")
