# Scarsdale Auto Repair, Inc. Website

Standalone public company website for Scarsdale Auto Repair, Inc. This project is intentionally separate from any fleet, inventory, admin, login, or database-backed system.

## Pages

- Home
- About Us at `/about`
- Services at `/services`
- Careers at `/careers`
- Contact at `/contact`

The Careers page includes a formal, printable public job posting for a Systems Administrator position in Mount Vernon, NY.

## Setup

```bash
npm install
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

This is a static Vite site and can be deployed to common static hosting platforms, including:

- Netlify
- Vercel
- Cloudflare Pages
- GitHub Pages
- Any web server capable of serving static files from `dist`

For most hosts, use:

- Build command: `npm run build`
- Publish directory: `dist`

Because `/careers` is handled by the React static app, configure the host to route unknown paths back to `index.html` if required by the platform. Netlify and Vercel usually handle this automatically for Vite/SPA deployments when configured as a single-page app.

## Updating the Careers Posting

Edit `src/main.jsx` to update:

- Company email placeholder
- Phone placeholder
- Posting date
- Job duties
- Requirements
- Application instructions
