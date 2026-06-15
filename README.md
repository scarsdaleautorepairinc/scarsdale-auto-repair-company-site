# Scarsdale Auto Repair, Inc. Website

Standalone public company website for Scarsdale Auto Repair, Inc. This project is intentionally separate from any fleet, inventory, admin, login, or database-backed system.

## Pages

- Home at `/`
- About Us at `/about`
- Services at `/services`
- Careers at `/careers`
- Contact at `/contact`

The Careers page includes a formal, printable public job posting for a Systems Administrator position in Mount Vernon, NY.

## Features

- Sticky responsive navigation with active page highlighting
- Professional homepage calls to action and business summary cards
- Detailed services page with organized service cards
- Public Careers page with printable PERM-friendly job posting layout
- Contact form with client-side confirmation message
- FAQ, testimonials, SEO metadata, favicon, robots.txt, sitemap.xml, and GitHub Pages deployment workflow

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

The development server will print a local URL, usually `http://localhost:5173`.

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

Because `/careers` is handled by the React static app, configure the host to route unknown paths back to `index.html` if required by the platform.

## Updating the Careers Posting

Edit `src/main.jsx` to update:

- Company email placeholder
- Phone placeholder
- Posting date
- Job duties
- Requirements
- Application instructions
