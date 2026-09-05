# Fleet Solutions Deployment Preparation

Status: prepared locally, NOT deployed. Website push is blocked by GitHub permissions.

The Fleet Solutions repository (`mountvernonautoclinic-crypto/fleetsolutions`) deploys through `.github/workflows/deploy.yml` using `DROPLET_IP`, `DROPLET_USER`, `SSH_PRIVATE_KEY`, and `DOPPLER_TOKEN` repository secrets. These secrets are available to authorized Actions workflows; they cannot be downloaded through GitHub CLI. No secret values belong in this repository.

## Separate Shop Service

Use the existing Fleet server, adding a separate container on loopback port 8091, frontend directory `/var/www/repair-shop`, and persistent directory `/var/lib/fleet-solutions/repair-shop` (owned by UID 10001). This uses the tested SQLite database in a dedicated folder. It does NOT connect to, modify, or migrate Fleet's PostgreSQL database. A shared PostgreSQL schema would require a separate database migration and PostgreSQL tests before enabling it.

Build the backend from the repository root with `docker build -f backend/Dockerfile .`. Publish with an immutable tag and set `SHOP_IMAGE` to that tag before using `compose.yml`. Install and validate `nginx-locations.conf` inside Fleet's existing HTTPS server block, preserving its existing locations. Keep the nginx include in the Fleet repository too, so later Fleet deployments do not overwrite it. Check `nginx -t` before reloading; retain the old configuration for rollback.

For the Fleet-hosted frontend, build with `VITE_API_BASE=/repair-shop` and `npm run build -- --base=/repair-shop/`. Serve that build under `/var/www/repair-shop`; the workspace route is `/repair-shop/customer-service`. Do not overwrite Fleet's existing `/var/www/html` frontend.

The backend delegates authentication to Fleet's existing `/api/me` endpoint using the HttpOnly Fleet session cookie. Login remains at Fleet Solutions. External DSP accounts are denied. Unsafe requests require a matching Origin and the custom request header. Approvals and payments require an office role. The development clear-data endpoint is disabled in production. The frontend and backend must be on the same Fleet origin for this cookie-based setup.

## Enable Website Entry

After the protected service has been deployed and checked, set the Scarsdale repository variable `VITE_CUSTOMER_SERVICE_URL` to `https://fleettsolutions.com/repair-shop/customer-service`, then deploy the website. The website build deliberately has no localhost API fallback in production and displays an unavailable notice until this connection is configured.

## Required Deployment Checks

- Run the 10 workflow tests, regression test, and production access tests; build the frontend.
- Check backend health on port 8091 and verify unauthenticated orders/files return 401.
- Sign in as Fleet staff and verify intake, both findings, photos, approval, invoice download, and history through nginx.
- Add backups for the separate SQLite database and uploads. Fleet's existing PostgreSQL dump does not include this folder. Use SQLite's backup API for a consistent database snapshot; do not copy an actively written database file as a backup.
- Preserve the previous container tag and frontend release for rollback. Do not import local test/customer records automatically.

Existing Fleet containers, PostgreSQL tables, and customer records have not been changed by this preparation.
