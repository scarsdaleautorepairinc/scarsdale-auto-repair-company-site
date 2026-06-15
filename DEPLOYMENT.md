# Deployment

This repository is configured to deploy automatically to GitHub Pages with GitHub Actions.

## Step 1: Push Repository To GitHub

Push changes to the `main` branch.

```bash
git push origin main
```

The workflow at `.github/workflows/deploy.yml` will install dependencies, build the Vite site, add static route fallbacks, and publish the `dist` folder to GitHub Pages.

## Step 2: Enable GitHub Pages

In GitHub:

1. Open repository settings.
2. Go to `Settings -> Pages`.
3. Set `Source` to `GitHub Actions`.

## Step 3: DNS Setup In GoDaddy

Add these A records:

| Type | Host | Value | TTL |
| --- | --- | --- | --- |
| A | @ | 185.199.108.153 | Default |
| A | @ | 185.199.109.153 | Default |
| A | @ | 185.199.110.153 | Default |
| A | @ | 185.199.111.153 | Default |

Add this CNAME record:

| Type | Host | Points To | TTL |
| --- | --- | --- | --- |
| CNAME | www | scarsdaleautorepairinc.github.io | Default |

The repository includes `public/CNAME` with:

```text
scarsdale-auto-repair.com
```

This configures the apex domain. The `www.scarsdale-auto-repair.com` host should point to the GitHub Pages host with the DNS CNAME above.

## Step 4: Wait For DNS Propagation

DNS changes can take time to propagate. GoDaddy and GitHub may show the domain as pending until DNS is visible.

## Step 5: Verify

Open:

https://scarsdale-auto-repair.com

Also verify:

- https://scarsdale-auto-repair.com/services
- https://scarsdale-auto-repair.com/careers
- https://scarsdale-auto-repair.com/contact
- https://www.scarsdale-auto-repair.com

## Step 6: Enable HTTPS

After DNS checks pass, return to `Settings -> Pages` in GitHub and enable `Enforce HTTPS`.

## Production Checklist

- Home page works.
- Services page works.
- Careers page works.
- Contact page works.
- Mobile and tablet layouts remain responsive.
- Direct URL refreshes work for `/about`, `/services`, `/careers`, and `/contact`.
- Custom domain file is included in the production build.
