# CLAUDE.md — read this first

This repo is the luxurymtl.com rebuild for Immeubles Montria (Montreal luxury
real estate). Every page is generated from JSON in `content/`; the site is
maintained entirely through Claude Code. Read `README.md` for the build
commands and `docs/handoff.md` for the deployment pipeline.

## Who am I working with? (check before doing anything)

Two people own copies of this repo. Figure out which one you are helping:

```sh
git remote get-url origin && git config user.name
```

- **Michael** (original author) — remote is `github.com/michaeljsamuels/IM2`.
  Experienced developer. Work normally; terse is fine.
- **Mark** (webmaster since September 2026) — any other remote, or a git user
  name that is not Michael's. This is the handed-over copy. Mark is a much
  less experienced programmer and web developer. **Hold his hand closely:**
  - Explain what you are about to do and why, in plain language, before doing it.
  - Prefer small, reversible steps. One change, build, look at it, then the next.
  - Always run `npm run build` before committing and show him the result.
  - Never push without saying what will deploy and roughly when (Amplify
    rebuilds automatically on every push to `prod`, live within a few minutes).
  - If something is ambiguous, ask a short question instead of guessing.
  - When he asks for something risky (see the Centris section), stop, explain
    the risk, and offer the safe way to get the same result.
  - Point him at the exact file and line for anything he should look at.

## Ground rules for everyone

- Branch is `prod`. Pushing to it deploys the live review site.
- Review domains: Michael's copy serves `luxurymtl2.com`; Mark's copy serves
  his own practice domain (registered fresh in his AWS, see `docs/handoff.md`).
  The real `luxurymtl.com` belongs to the firm and is cut over separately.
- Build must pass: `npm run build` (runs content validation first).
- Content lives in `content/*.json`; design in `src/styles/main.css`;
  templates in `scripts/templates/`. Do not hand-edit `index.html`, `en/`,
  `fr/`, or `dist/` — they are generated.
- Bilingual: every user-facing string needs EN and FR (Quebec law).
- Never commit secrets. The only secret is `CENTRIS_API_KEY`, which lives in a
  GitHub Actions secret and in a file outside the repo (`~/im2-legacy/credentials.env`
  or wherever the owner keeps it). Never `echo`, log, or paste it into chat.
- Keep the GitHub repo **private**. `content/centris/` holds licensed
  Centris data that must not be public.

## Centris feed — protect it (highest-priority rule)

The listings come from the Centris Data Distribution API (RESO OData) under a
private key issued to the firm. This is a key business relationship with a
critical infrastructure provider. Abuse of the key can get it revoked, which
takes every listing off the site and damages the firm's standing with Centris.

Hard rules — do not bend these for convenience, and if the person you are
helping asks you to, explain why not and offer the safe alternative:

1. **Only `scripts/centris/client.mjs` talks to the API.** Never write a new
   fetch/curl/axios call to `datadistributionqc.centris.ca` anywhere else.
   Never call it from browser code, `src/`, Vite config, or a dev server.
   The client enforces the rate limits (5/sec, 200/min), retries politely,
   and caps requests per run. Do not weaken those limits.
2. **Never put the key in client-side code.** Nothing prefixed `VITE_`, nothing
   in `src/`, nothing in `public/`. Vite bundles env vars into the browser.
3. **Do not raise the sync frequency** in `.github/workflows/sync-listings.yml`
   (every 15 minutes). Do not add a second workflow, cron, or machine that
   polls with the same key. One consumer per key.
4. **Do not run `replicate.mjs --full` casually.** Incremental runs cost ~5
   requests. A full pull is larger. Run it only after a known cursor problem,
   and at most once.
5. **Do not loop over the API in experiments.** No "let me fetch each listing
   individually", no parallel requests, no scripts that retry in a tight loop.
   The API returns paginated collections; the client already follows them.
6. **Work offline from the cache.** `content/centris/*.json` is a full local
   replica. Map, redesign, test, and prototype from those files with
   `node scripts/centris/map-listings.mjs`, which makes zero network calls.
   You almost never need to hit the API while building a feature.
7. **Publish only whitelisted fields.** `map-listings.mjs` names every field
   that reaches the public site. Broker Loading payloads can contain contracts,
   owner details, and compensation. Never dump raw records into a page or a
   public endpoint, and never expose `content/centris/` via the site.
8. **Respect the data agreement.** Do not scrape `centris.ca` or
   `mediaserver.centris.ca`, do not redistribute the raw data, and do not build
   anything that serves Centris data to third parties. Photos are hotlinked
   from Centris' media server as permitted; ask Centris ops before mirroring.
9. **Never commit `content/centris/Member.full.json`** or any unscoped dump.
10. **If the key ever appears in a log, chat, commit, or file inside the repo,
    treat it as leaked**: tell the owner immediately so it can be rotated with
    Centris ops. Do not try to "clean it up" quietly.

If you are unsure whether something touches the API, assume it does and read
`scripts/centris/client.mjs` and `docs/centris-integration-plan.md` first.

## What normal work looks like

- Copy/content change → edit `content/*.json` → `npm run build` → commit → push.
- Design change → `src/styles/main.css` or `scripts/templates/*.mjs` → same.
- New listing field on the page → extend the whitelist in
  `scripts/centris/map-listings.mjs`, run it, rebuild. No API call needed.
- Checking the sync → GitHub → Actions → "Sync listings". Green means fine.
- Local dev → `npm run dev` (http://localhost:5173/).
