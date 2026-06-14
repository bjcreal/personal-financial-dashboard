"""Plaid Link token creation and token exchange."""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.services import dynamodb as db, plaid

router = APIRouter()


class ExchangeTokenRequest(BaseModel):
    public_token: str


# ── POST /api/plaid/create-link-token ────────────────────────────────────────

@router.post("/create-link-token")
def create_link_token(user_id: str = Depends(get_current_user)):
    link_token = plaid.create_link_token(user_id)
    return {"link_token": link_token}


# ── POST /api/plaid/exchange-token ───────────────────────────────────────────

@router.post("/exchange-token")
def exchange_token(body: ExchangeTokenRequest, user_id: str = Depends(get_current_user)):
    access_token, item_id = plaid.exchange_public_token(body.public_token)
    institution_id, institution = plaid.get_institution_details(access_token)
    logo = plaid.format_logo_url(institution.get("logo"), institution_id)

    existing_item = db.get_plaid_item_by_institution(user_id, institution_id)
    plaid_accounts = plaid.get_accounts(access_token)

    if existing_item:
        # Update access token and institution metadata
        db.update_plaid_item(user_id, existing_item["itemId"], {
            "accessToken": access_token,
            "institutionName": institution.get("name"),
            "institutionLogo": logo,
        })

        existing_accounts = db.get_accounts(user_id)
        existing_accounts = [a for a in existing_accounts if a.get("itemId") == existing_item["itemId"]]
        processed_ids = set()

        for plaid_account in plaid_accounts:
            # Match by mask + type + subtype
            match = next(
                (a for a in existing_accounts
                 if plaid_account.get("mask") and a.get("mask") == plaid_account["mask"]
                 and a.get("type") == plaid_account["type"]
                 and a.get("subtype") == plaid_account.get("subtype")),
                None,
            )
            if match:
                processed_ids.add(match["accountId"])
                db.update_account(user_id, match["accountId"], {
                    "plaidId": plaid_account["account_id"],
                    "name": plaid_account["name"],
                    "type": plaid_account["type"],
                    "subtype": plaid_account.get("subtype"),
                    "mask": plaid_account.get("mask"),
                })
                db.put_balance(
                    match["accountId"],
                    float(plaid_account["balances"].get("current") or 0),
                    plaid_account["balances"].get("available"),
                    plaid_account["balances"].get("limit"),
                )
            else:
                new_account = db.put_account(user_id, {
                    "plaid_id": plaid_account["account_id"],
                    "name": plaid_account["name"],
                    "type": plaid_account["type"],
                    "subtype": plaid_account.get("subtype"),
                    "mask": plaid_account.get("mask"),
                    "item_id": existing_item["itemId"],
                })
                processed_ids.add(new_account["accountId"])
                db.put_balance(
                    new_account["accountId"],
                    float(plaid_account["balances"].get("current") or 0),
                    plaid_account["balances"].get("available"),
                    plaid_account["balances"].get("limit"),
                )

        # Hide accounts no longer returned by Plaid
        for account in existing_accounts:
            if account["accountId"] not in processed_ids:
                db.update_account(user_id, account["accountId"], {"hidden": True})

        return {"success": True, "message": "Updated existing institution", "institution": institution.get("name")}

    else:
        new_item = db.put_plaid_item(user_id, {
            "item_id": item_id,
            "access_token": access_token,
            "provider": "plaid",
            "institution_id": institution_id,
            "institution_name": institution.get("name"),
            "institution_logo": logo,
        })
        for plaid_account in plaid_accounts:
            new_account = db.put_account(user_id, {
                "plaid_id": plaid_account["account_id"],
                "name": plaid_account["name"],
                "type": plaid_account["type"],
                "subtype": plaid_account.get("subtype"),
                "mask": plaid_account.get("mask"),
                "item_id": new_item["itemId"],
            })
            db.put_balance(
                new_account["accountId"],
                float(plaid_account["balances"].get("current") or 0),
                plaid_account["balances"].get("available"),
                plaid_account["balances"].get("limit"),
            )
        return {"success": True, "message": "Created new institution", "institution": institution.get("name")}


# ── POST /api/plaid/refresh-institutions ─────────────────────────────────────

@router.post("/refresh-institutions")
def refresh_institutions(user_id: str = Depends(get_current_user)):
    items = [i for i in db.get_plaid_items(user_id) if i.get("provider") == "plaid"]
    updated = 0
    for item in items:
        try:
            updates = plaid.refresh_institution(item["accessToken"])
            if updates:
                db.update_plaid_item(user_id, item["itemId"], updates)
                updated += 1
        except Exception as e:
            print(f"Failed to refresh institution {item.get('itemId')}: {e}")
    return {"success": True, "updated": updated}
