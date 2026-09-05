# Scarsdale Auto Repair, Inc. Website

Public company website for Scarsdale Auto Repair, Inc. with one internal Customer Service page for walk-in complaint workflow.

## Pages

- Home at `/`
- About Us at `/about`
- Services at `/services`
- Careers at `/careers`
- Customer Service at `/customer-service`
- Contact at `/contact`

## Features

- Sticky responsive navigation with active page highlighting
- Professional homepage calls to action and business summary cards
- Detailed services page with organized service cards
- Public Careers page with printable PERM-friendly job posting layout
- Contact form with client-side confirmation message
- Digital Customer Service workflow for staff
- Customer intake and work authorization
- Customer, vehicle, plate, VIN, mileage, service request, concern, and diagnostic fee capture
- VIN decoding through the public NHTSA decoder when a VIN is entered
- Plate lookup placeholder for a future licensed DMV/plate data provider integration
- Customer ticket list and status tracking
- Technician finding notes with bad-part photo/video uploads
- Office review screen to show customer the tech concern
- Car-ready status for office staff
- Invoice upload/preparation and paid closeout
- Vehicle History tab for office staff to search by saved plate or VIN
- Reports tab for daily/monthly customer visits, paid tickets, income received, and CSV export (America/New_York dates)
- Mark Paid records the actual amount received once; later estimate edits do not change past income. Older paid tickets with no recorded amount are flagged and excluded until their amount is entered.
- History results show visit date, mileage, complaint, tech findings, approved work, invoice total, ready date, and paid date
- Bad-part photo/video uploads
- SQLite database stored in `data/shop.sqlite3`
- Uploaded files stored in `data/uploads`

## Setup

```bash
npm install
```

```bash
python -m venv .venv
.\.venv\Scripts\pip install -r backend\requirements.txt
```

## Development

```bash
npm run dev
```

The development server will print a local URL, usually `http://localhost:5173`.

In a second terminal, start the backend:

```bash
.\.venv\Scripts\python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8001
```

Then open:

- Customer Service: `http://localhost:5173/customer-service`

## Production Build

```bash
npm run build
```

The static production files will be generated in the `dist` folder.

## Preview Production Build

```bash
npm run preview
```

## Deployment

This site deploys to GitHub Pages with the workflow in `.github/workflows/deploy.yml`.

For other static hosts, use:

- Build command: `npm run build`
- Publish directory: `dist`

Because the app has React routes, configure the host to route unknown paths back to `index.html` if required by the platform.

The backend should be deployed separately on a Python-capable host. For production, set `VITE_API_BASE` to the backend URL before building the frontend.
