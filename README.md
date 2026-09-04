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
- `public/images/` — team portraits, logo, hero. Listing photos are hotlinked
  from Centris.

## Commands

```sh
npm install
npm run dev       # local dev server (http://localhost:5173/)
npm run build     # tsc + vite build → dist/
npm run preview   # serve the production build locally
```

## Deployment

Handoff and setup-from-scratch: see `docs/handoff.md`.


AWS Amplify Hosting watches the GitHub repo: push to `prod` → Amplify runs
`amplify.yml` (`npm ci && npm run build`) → deploys `dist/`. Same pipeline as
SceneSnap.

## Roadmap

1. ~~Front-end first pass~~ (this)
2. ~~**Centris sync**~~ — live since 2026-08-14. `.github/workflows/sync-listings.yml`
   replicates the Centris Data Distribution API into `content/centris/`
   every 15 minutes and rewrites `content/listings.json`. Read the Centris
   section of `CLAUDE.md` before touching anything under `scripts/centris/`.
3. Forms backend (SES via a small Lambda), redirects from old URLs, analytics,
   privacy policy + OACIQ notice finalization, domain cutover.
