# Repair Shop Workflow Test Report

Date: September 5, 2026

Result: 10 fictional API workflow scenarios passed, plus the existing finding/photo migration regression test. Production frontend build passed. Tests used temporary databases and upload directories, with no fictional records added to customer storage.

## Scenarios

| Case | First concern | Additional concern | Result |
| --- | --- | --- | --- |
| 1 | Coolant reservoir | Left caliper | Pass |
| 2 | Spark plugs | Ignition coil | Pass |
| 3 | Front struts | Tie rod end | Pass |
| 4 | Valve cover gasket | Oil pan gasket | Pass |
| 5 | Battery | Alternator | Pass |
| 6 | AC condenser | AC hose | Pass |
| 7 | Front tires | Wheel alignment | Pass |
| 8 | Headlight bulb | Wiper blades | Pass |
| 9 | Exhaust pipe | Muffler | Pass |
| 10 | Multiline coolant hose notes | Multiline brake hose notes | Pass |

Each scenario exercises intake, authorization storage, two separate findings, linked photos, rejecting an invalid finding ID, retrieving attachments, adding and approving work, invoice totals, in-progress and ready status, invoice upload/download, paid status, customer-code retrieval, plate/VIN history search, mileage, both findings in history, stable ready dates, and a return visit. Invalid searches and simulated VIN decoder success/failure are also checked. The original regression test checks migration preservation and rejection of a photo linked to another ticket's finding.

## Fixes Made During Testing

- Vehicle History now includes all findings and photos, rather than only the latest finding.
- A dedicated ready timestamp keeps subsequent invoice/payment actions from changing the ready date. Previous ready dates that were never recorded remain unknown.
- Added In Progress and Car Ready controls to the technician tab.
- History uses ticket ID to break ties when visits have the same creation timestamp.

## Browser Checks

Verified the technician controls and both existing coolant/caliper findings in the running app. Searched the existing plate in Vehicle History and confirmed both findings and existing photos are visible. Existing customer records were read only during browser checks.

## Limits

These are software test fixtures, not model training. The 10 scenarios ran through FastAPI's HTTP test client, not 10 full manual browser sessions. Fixture files verify upload/download persistence, not PDF rendering or every photo/video format. External VIN responses were simulated. Plate-to-VIN lookup uses saved shop records; a live external plate provider was not tested. Mark Paid records payment status; no payment processor was tested. Browser mobile layouts, simultaneous staff edits, access controls, and production deployment were not part of this test run. Passing these cases does not establish that every possible workflow or invalid state is handled.

## Repeat

With FastAPI and httpx installed in the chosen Python environment:

```powershell
python -m unittest backend.test_workflow backend.test_finding_history -v
npm run build
```
