# Luxury MTL 🏙

Ground-up rebuild of [luxurymtl.com](https://luxurymtl.com) for Immeubles Montria —
a bilingual (EN/FR) luxury real estate site styled as a white-canvas, big-type
editorial front end. Maintained entirely through Claude Code: every page is
generated from JSON content files, so design and content changes are file edits.

## How it works

- `content/*.json` — the source of truth: listings, agents, neighbourhoods,
  site info, and every UI string in both languages.
- `scripts/build-content.mjs` — validates the content and generates all static
  HTML pages (`/index.html`, `/en/**`, `/fr/**`) from the template functions in
  `scripts/templates/`. Runs automatically before `dev`/`build`; fails the
  build on catalog errors so broken content can't ship.
- `src/` — one stylesheet (design system) + one TypeScript module
  (header, menu, filters, tabs, lightbox).
- `public/images/` — currently SVG placeholders; swap in real photography as
  it becomes available.

## Commands

```sh
npm install
npm run dev       # local dev server (http://localhost:5173/)
npm run build     # tsc + vite build → dist/
npm run preview   # serve the production build locally
```

## Deployment

AWS Amplify Hosting watches the GitHub repo: push to `main` → Amplify runs
`amplify.yml` (`npm ci && npm run build`) → deploys `dist/`. Same pipeline as
SceneSnap.

## Roadmap

1. ~~Front-end first pass~~ (this)
2. **Centris sync** — a scheduled job that pulls the firm's listings from the
   Centris data feed, rewrites `content/listings.json` (+ mirrors photos), and
   pushes — which auto-triggers a rebuild and deploy. The current
   `listings.json` holds one real listing (#1575) and seven **sample**
   listings for design purposes; replace before launch.
3. Forms backend (SES via a small Lambda), redirects from old URLs, analytics,
   privacy policy + OACIQ notice finalization, domain cutover.
