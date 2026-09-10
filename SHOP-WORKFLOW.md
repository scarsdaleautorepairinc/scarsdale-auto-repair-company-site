# Repair Shop Workflow

This release changes only the standalone repair-shop service and frontend. Fleet's main application, registration, login, and PostgreSQL schema are not modified.

## Daily Use

### Signed Check-In

New visits now use **Review & Sign** followed by **Save Signed Visit**. Staff can take/upload optional photos categorized as Arrival Condition or Customer Concern, select the vehicle area, and add captions. The arrival checklist indicates photographed areas. Customer signatures use a touch/mouse signature pad; the customer reviews the details, fee, photos, and inspection-only permission first. Editing reviewed details requires signing again. Additional repair approval remains separate.

Saving atomically stores the visit, categorized photos, original signature image, signed details/wording, staff identity, server timestamp, and a fixed authorization PDF. Retrying the same submission does not duplicate the visit. A failed request retains the current form, photos, and signature; a browser reload does not retain an unfinished intake. The PDF and photo records are available in the office and vehicle history; mechanics see the categorized check-in photos separately from their findings. Old visits remain legacy records and are not presented as newly signed documents. The legacy unsigned intake API is retired in production.

Photos: up to 10 JPG/PNG/WebP/GIF images, 20 MB each, 24 MB total. Camera capture depends on the device/browser. These are in-person drawn signatures, not identity verification or a certification of legal compliance. The shop should review the wording against its policies and applicable requirements. The distinction between initial permission and additional repair approval is consistent with [NY DMV's consumer guidance](https://dmv.ny.gov/know-your-rights-in-auto-repair).

Tests include ten synthetic signed visits, request retries, stale terms, blank signatures, bad-photo/PDF rollback, permissions, backup verification, mobile signing, PDF download, and history. `scripts/test-checkin-ui.cjs` targets isolated local ports 5180/8014; `scripts/test-shop-ui.cjs` accepts `SHOP_QA_URL` for the same isolated frontend. PDF QA artifacts are under ignored `data/checkin-ui/`.

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

### Mechanic Screen

### Visual Parts and ASL Messages

The existing inspection, estimate, approval, checkout, history, and reporting workflow remains in place. Mechanics default to **Pictures** and can switch back to **Text**. The 100 named illustrative parts are grouped into four picture categories. Choose a part, location, quantity, and action; add photos or an MP4/WebM ASL message and send. **Part not listed** and **Need help** avoid forcing an incorrect identification. No diagnosis or ASL translation is inferred. Earlier visual findings and videos remain attached to their individual findings and appear in vehicle history.

Office staff can add **Visual Inspection Requests**, with a part picture, location, photos, and an optional ASL instruction video. An instruction video requires the staff member to confirm review by an ASL-fluent person; the system records this assertion, not a certification. No pre-recorded or automatically generated ASL instruction library is shipped. Mechanics can select **Report This Part** from a request to start a matching finding. Requests authorize inspection only and do not create approved repair work.

In the existing estimate editor, use **Link Part Picture** and choose a location to explicitly link the image to the line being priced and approved. Approved line pictures appear to the mechanic with the approved description and quantity, without prices. Picture choices never approve a repair. The existing customer-decision and work-status checks still apply, including reapproval after a line revision.

Office instructions accept up to five photos and one video. Mechanic findings accept up to ten photos and one video. Each submission has a 24 MB combined limit. Camera/video recording depends on the device browser; desktop users can upload files. Videos are stored as staff-only attachments, not interpreted. Generic generated illustrations are not vehicle-specific and must be reviewed with the mechanic; they cannot determine fitment or be used to order parts. Sign-language comprehension and actual-device usability still require an in-person pilot.

`backend/test_visual.py` checks all 100 assets, ten visual findings, retries, roles, validation, history, and approval gates. `scripts/test-visual-ui.cjs` targets isolated ports 5181/8015 and checks every picture, office requests, image/video attachments, no-typing findings, mobile layout, linked approvals, and completion. It uses synthetic media, not customer records or real signed instructions.

Mechanics now have **My Jobs** (assigned jobs sorted first) and one inspection screen. Customer concern is visible at the top. Enter a finding in the large notes field, optionally add multiline parts and recommended work, and attach photos using **Take Photo** or **Add Photos**. Preview or remove attachments before **Send to Office**. Up to 10 photos are accepted (20 MB each, 24 MB total, matching the existing upload proxy limit).

Notes and photos publish in one transaction. Failed requests retain the draft and selected files; retrying an identical submission cannot create another finding, even if the first response was lost after saving. Drafts survive tab changes in the same page session but not a full browser reload. Previous findings include photo previews and a New/Office reviewed indicator tied to office acknowledgment. Approved work is visible without prices. The mechanic screen has no Activity tab or payment/estimate controls; office audit history remains unchanged. Camera capture depends on the phone/browser's file picker support.

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
