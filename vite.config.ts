import { defineConfig } from 'vite';
import { readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

// The site's pages are static HTML generated into the project root by
// scripts/build-content.mjs (index.html, en/**, fr/**). Collect them all as
// Rollup inputs so `vite build` emits every page, not just index.html.
const SKIP = new Set(['node_modules', 'dist', 'public', 'src', 'content', 'scripts', '.git']);

function htmlInputs(dir: string, acc: Record<string, string> = {}): Record<string, string> {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry) || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      htmlInputs(full, acc);
    } else if (entry.endsWith('.html')) {
      const key = full.slice(root.length + 1).replace(/[^a-z0-9]+/gi, '_');
      acc[key] = full;
    }
  }
  return acc;
}

export default defineConfig({
  appType: 'mpa',
  build: {
    rollupOptions: {
      input: htmlInputs(root),
    },
  },
});
