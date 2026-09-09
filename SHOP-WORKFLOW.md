# Repair Shop Workflow

This release changes only the standalone repair-shop service and frontend. Fleet's main application, registration, login, and PostgreSQL schema are not modified.

## Daily Use

1. **New Visit:** record the customer, vehicle, concern, requested services, and intake authorization. The diagnostic fee is a quote, not an automatic payment or approved estimate line.
2. **Work Orders:** search customer, plate, VIN, or order number. Filter active visits, repair status, pending approvals, new updates, or assignments to the signed-in user.
3. **Inspection:** assign a technician and promised completion time. Technicians appear after their first successful shop sign-in. Add each finding separately, choose a priority, and upload its photos. Earlier findings remain attached to the visit. The signed-in identity is recorded automatically.
4. **Estimate & Approval:** add parts, labor hours/rates, services, or fees. Select rows and record the customer's approval or refusal, name, communication method, and evidence note. This records an office conversation; it is not a customer electronic-signature portal. Revisions reset that line's approval and invalidate the checked invoice total. Prior approval snapshots remain in Activity.
5. **Inspection:** move approved work through Working or Waiting for Parts, then Vehicle Ready. All lines must have a decision first. All-declined visits can be marked ready for pickup without starting repairs.
6. **Checkout:** upload the externally prepared invoice, check its total, and record a verification note explaining any difference from the approved estimate. View/download invoice attachments. Record money actually received, including method and receipt reference. Partial receipts leave a balance; a retry of the same payment request does not duplicate it. This does not charge a card. Never enter full card details.
7. **Vehicle History:** search by plate or VIN and open prior visits, findings, approved work, dates, mileage, and invoice downloads. The ticket code remains a staff lookup reference, not public authorization to access customer records.
8. **Reports:** daily/monthly receipts use New York dates. Money is attributed to the actual receipt date, not the repair date. Customer visits and paying visits are separate counts; this is receipts reporting, not profit/accounting. Export CSV as needed.

Payments lock prices and invoices. Additional repairs on a closed visit require a new visit. Zero-dollar invoices have a separate no-charge closeout. The three badges for repair, approval, and payment are independent.

## Updates and Access

The work list refreshes every 20 seconds while the page is visible. New findings, photo uploads, and repair-state changes create office alerts. Open the ticket or use Refresh Ticket to retrieve details, then acknowledge reviewed updates. A stale acknowledgment or edit is rejected instead of silently overwriting a newer change. Alerts are in-app only, not SMS/email messages.

Mechanics can inspect and update repair progress, but cannot edit pricing, approve work, record payments, upload invoices, access reports, or access recovery backups. Office staff handle these operations except backups. Only administrators can create/download backups. All production APIs still require a valid Fleet session and permitted shop role; unsafe requests also require same-origin checks.

## Recovery

Production automatically creates a verified local database-and-uploads archive when the last archive is over 24 hours old. An administrator can also create/download one from **Backups**. SQLite backup snapshots, attachment checksums, and database integrity are checked before the archive is published. Missing attachments fail backup verification rather than silently creating an incomplete archive.

Local archives are under the shop data folder's `backups/` directory. They are separate from Fleet PostgreSQL backups. Creation checks for workspace space plus a 1 GB reserve before writing an archive. Offsite copying and storage retention are not configured: an operator must securely store downloaded copies offsite and monitor disk capacity. Archives contain customer information and must be access-controlled. Production backup creation needs verification by a signed-in administrator after deployment.

To restore, stop only the shop service, preserve the current shop data directory, verify an archive, extract its `shop.sqlite3` and `uploads/` into a new shop data directory, restore the container's UID 10001 ownership, and restart the same shop release against that directory. Do not extract over a running database or into Fleet's database directory. Test the restored copy before switching production. The automated tests restore an archive into temporary storage and compare records and attachment bytes.

## Verification and Boundaries

- Run `.venv\Scripts\python.exe -m unittest discover -s backend -p "test_*.py"`.
- Ten legacy scenarios and ten modern fictional repair scenarios use temporary databases. Additional tests cover roles, CSRF, stale revisions, refused work, no-charge visits, concurrent duplicate receipts, backup restoration, reports, and history downloads.
- `scripts/test-shop-ui.cjs` uses Playwright with headless Edge against QA-only ports 5178/8012. Start the backend with a fresh `SHOP_DATA_DIR` and `SHOP_ALLOWED_ORIGINS=http://127.0.0.1:5178`, and Vite with `VITE_API_BASE=http://127.0.0.1:8012`. It creates fictional visits only on those local servers and saves desktop/mobile screenshots under ignored `data/ui-qa/`.
- Production build: `VITE_API_BASE=/repair-shop npm run build -- --base=/repair-shop/` (set the environment variable using the shell's syntax).
- Publish the exact tested commit through the existing Fleet **Deploy Scarsdale Repair Shop** workflow. No Fleet main-system build or source change is needed.
- No new customer portal, SMS/email provider, offsite destination, parts-ordering integration, payment processor, refund workflow, or automatic tax calculation is introduced. Existing plate/VIN lookup capabilities remain unchanged.
