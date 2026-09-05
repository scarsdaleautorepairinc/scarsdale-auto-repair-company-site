"""Reuse Fleet's authenticated staff session when hosted alongside Fleet Solutions."""
import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

from fastapi import HTTPException, Request

PRODUCTION = os.getenv("SHOP_ENV") == "production"
FLEET_AUTH_URL = os.getenv("FLEET_AUTH_URL", "http://127.0.0.1:8080/api/me")
SHOP_ORIGIN = os.getenv("SHOP_ORIGIN", "https://fleettsolutions.com")
STAFF = {"ADMIN", "MANAGER", "HEAD_TECH", "SENIOR_TECH", "TECHNICIAN"}
OFFICE = {"ADMIN", "MANAGER", "HEAD_TECH", "SENIOR_TECH"}


def require_staff(request: Request):
    if not PRODUCTION or request.url.path == "/api/health":
        return
    if request.url.path.startswith("/api/dev/"):
        raise HTTPException(404, "Not found")
    cookie = request.headers.get("cookie", "")
    if not cookie:
        raise HTTPException(401, "Sign in to Fleet Solutions to open Customer Service.")
    try:
        with urlopen(UrlRequest(FLEET_AUTH_URL, headers={"Cookie": cookie}), timeout=5) as response:
            profile = json.load(response)
    except HTTPError as exc:
        if exc.code in {401, 403, 404}:
            raise HTTPException(401, "Your Fleet Solutions session has expired.") from exc
        raise HTTPException(503, "Staff sign-in is temporarily unavailable.") from exc
    except (URLError, TimeoutError, ValueError) as exc:
        raise HTTPException(503, "Staff sign-in is temporarily unavailable.") from exc
    if not isinstance(profile, dict) or profile.get("role") not in STAFF:
        raise HTTPException(403, "Customer Service is available to shop staff only.")
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        if request.headers.get("origin") != SHOP_ORIGIN or request.headers.get("x-shop-request") != "1":
            raise HTTPException(403, "Open Customer Service from the shop website to save changes.")
        office_action = request.url.path.endswith(("/estimate-items", "/approve", "/paid"))
        if office_action and profile["role"] not in OFFICE:
            raise HTTPException(403, "Office access is required for approvals and payments.")
