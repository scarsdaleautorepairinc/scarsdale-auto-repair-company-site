import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/scarsdale-auto-repair-company-site/' : '/'
});
