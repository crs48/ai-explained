// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';

// Project page: served from https://<user>.github.io/ai-explained/
// `base` MUST equal the repo name. Override both via env for a user page or
// custom domain (see docs/explorations/0001).
const site = process.env.SITE_URL ?? 'https://example.github.io';
const base = process.env.BASE_PATH ?? '/ai-explained';

// https://astro.build/config
export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  integrations: [react(), mdx()],
  vite: {
    plugins: [tailwindcss()],
  },
});
