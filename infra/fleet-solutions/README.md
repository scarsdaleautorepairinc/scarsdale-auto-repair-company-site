# Fleet Solutions Deployment

Deployed September 5, 2026 through Fleet's `Deploy Scarsdale Repair Shop` workflow. Workspace: https://fleettsolutions.com/repair-shop/customer-service. Initial backend release: `036f379b5c880c6dac87bc778775a4fd7b969805`.

The Fleet Solutions repository (`mountvernonautoclinic-crypto/fleetsolutions`) deploys through `.github/workflows/deploy.yml` using `DROPLET_IP`, `DROPLET_USER`, `SSH_PRIVATE_KEY`, and `DOPPLER_TOKEN` repository secrets. These secrets are available to authorized Actions workflows; they cannot be downloaded through GitHub CLI. No secret values belong in this repository.

## Separate Shop Service

The existing Fleet server now runs a separate container on loopback port 8091, frontend release symlink `/var/www/repair-shop`, and persistent directory `/var/lib/fleet-solutions/repair-shop` (owned by UID 10001). This uses the tested SQLite database in a dedicated folder. It does NOT connect to, modify, or migrate Fleet's PostgreSQL database. A shared PostgreSQL schema would require a separate database migration and PostgreSQL tests before enabling it.

Build the backend from the repository root with `docker build -f backend/Dockerfile .`. Publish with an immutable tag and set `SHOP_IMAGE` to that tag before using `compose.yml`. Install and validate `nginx-locations.conf` inside Fleet's existing HTTPS server block, preserving its existing locations. Keep the nginx include in the Fleet repository too, so later Fleet deployments do not overwrite it. Check `nginx -t` before reloading; retain the old configuration for rollback.

For the Fleet-hosted frontend, build with `VITE_API_BASE=/repair-shop` and `npm run build -- --base=/repair-shop/`. Serve that build under `/var/www/repair-shop`; the workspace route is `/repair-shop/customer-service`. Do not overwrite Fleet's existing `/var/www/html` frontend.

The backend delegates authentication to Fleet's existing `/api/me` endpoint using the HttpOnly Fleet session cookie. Login remains at Fleet Solutions. Fleet ADMIN accounts administer shop access; every other account needs an explicit shop membership, keyed by the verified Fleet account ID. Memberships and their change history live only in the shop SQLite database. Existing Fleet roles, permissions, registration, login routing, and PostgreSQL are unchanged. Unsafe requests require a matching Origin and the custom request header. The development clear-data endpoint is disabled in production.

## Shop Staff Onboarding

1. Staff sign in through the existing Fleet portal, then bookmark/open https://fleettsolutions.com/repair-shop/customer-service. There is no new automatic redirect or registration flow.
2. Unassigned accounts see Access pending and their Fleet account ID. They give that ID to an administrator through a trusted channel.
3. A Fleet ADMIN opens the shop's Staff Access tab and assigns Shop Mechanic or Shop Office Staff to that ID. Verify the account owner before granting access.
4. Staff refresh the workspace. Mechanics land on Tech Findings; office staff have intake, tech, invoice, history, and report tabs. Mechanics cannot create intake, approve work, upload invoices, record payments, manage memberships, or view income reports. Backend checks enforce these restrictions even for direct API calls.
5. Administrators can change or revoke shop membership immediately. Each change is retained in shop_membership_events. This does not revoke or change any access Fleet itself grants that account.

The public Scarsdale build no longer links to this workspace. VITE_CUSTOMER_SERVICE_URL is no longer used. The Fleet-hosted build still uses VITE_API_BASE=/repair-shop. Local development bypasses authentication and must never be exposed publicly; production requires SHOP_ENV=production.

## Required Deployment Checks

- Run the 10 workflow tests, regression test, and production access tests; build the frontend.
- Check backend health on port 8091 and verify unauthenticated orders/files return 401.
- Sign in as Fleet staff and verify intake, both findings, photos, approval, invoice download, and history through nginx.
- Add backups for the separate SQLite database and uploads. Fleet's existing PostgreSQL dump does not include this folder. Use SQLite's backup API for a consistent database snapshot; do not copy an actively written database file as a backup.
- Preserve the previous container tag and frontend release for rollback. Do not import local test/customer records automatically.

The deployment added the isolated shop container and nginx path. Existing Fleet application containers, PostgreSQL tables, and customer records were not changed. The general Fleet deployment triggered by the infrastructure commit was cancelled after backend tests passed, before its application deployment; the dedicated shop workflow performed the production change.

## Verified Live

The dedicated deployment workflow passed all 14 tests, built the release, deployed the service, and completed nginx and health checks. HTTPS health and workspace requests returned 200; unauthenticated orders and file requests returned 401. Browser checks confirmed that the production office tab prompts for Fleet sign-in. No authenticated production customer workflow or real payment was performed. The separate folder is not yet included in Fleet's existing PostgreSQL offsite backup job.
