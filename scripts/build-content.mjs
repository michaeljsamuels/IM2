/**
 * Compiles the content catalog (content/) into the static HTML pages Vite
 * builds and serves:
 *   - /index.html            root redirect to /en/
 *   - /en/** and /fr/**      one directory-with-index.html per page
 *
 * Runs automatically before dev/build (npm pre-scripts). Fails the build on
 * catalog errors so broken content can't ship. This is also the seam where
 * the Centris sync (phase 2) plugs in: it only ever rewrites content/*.json.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LOCALES, ROUTES, listingUrl, agentUrl, makeCtx } from './templates/helpers.mjs';
import { layout } from './templates/layout.mjs';
import { homePage } from './templates/home.mjs';
import { listingsPage } from './templates/listings.mjs';
import { listingPage } from './templates/listing.mjs';
import { teamPage, agentPage, contactPage } from './templates/pages.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

const site = read('content/site.json');
const strings = read('content/strings.json');
const listings = read('content/listings.json');
const agents = read('content/agents.json');
const hoods = read('content/neighbourhoods.json');

// ---- validate ----
const errors = [];
const agentIds = new Set(agents.map((a) => a.id));
const hoodIds = new Set(hoods.map((h) => h.id));
const seenListingIds = new Set();

for (const l of listings) {
  const ctx = `listings: #${l.id} (${l.address})`;
  if (seenListingIds.has(l.id)) errors.push(`${ctx} duplicate id`);
  seenListingIds.add(l.id);
  for (const field of ['status', 'type', 'price', 'address', 'city', 'description', 'photos'])
    if (l[field] == null) errors.push(`${ctx} missing "${field}"`);
  if (l.agentId && !agentIds.has(l.agentId)) errors.push(`${ctx} unknown agent "${l.agentId}"`);
  if (l.neighbourhood && !hoodIds.has(l.neighbourhood)) errors.push(`${ctx} unknown neighbourhood "${l.neighbourhood}"`);
  if (!['for-sale', 'for-rent', 'sold', 'rented'].includes(l.status)) errors.push(`${ctx} bad status "${l.status}"`);
  if (!l.photos?.length) errors.push(`${ctx} needs at least one photo`);
  for (const p of l.photos ?? [])
    if (!p.startsWith('http') && !existsSync(join(root, 'public', p)))
      errors.push(`${ctx} photo file missing: public${p}`);
}
for (const a of agents)
  if (!existsSync(join(root, 'public', a.photo))) errors.push(`agents: "${a.id}" photo missing: public${a.photo}`);
for (const [key, entry] of Object.entries(strings))
  for (const loc of LOCALES)
    if (typeof entry[loc] !== 'string') errors.push(`strings: "${key}" missing "${loc}"`);

if (errors.length) {
  console.error(`✗ content errors:\n  - ${errors.join('\n  - ')}`);
  process.exit(1);
}

// ---- generate ----
for (const stale of ['index.html', 'en', 'fr']) rmSync(join(root, stale), { recursive: true, force: true });

let pageCount = 0;
function emit(urlPath, html) {
  const dir = join(root, urlPath.slice(1));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
  pageCount++;
}

for (const locale of LOCALES) {
  const ctx = makeCtx({ locale, site, strings, listings, agents, hoods });
  const other = locale === 'en' ? 'fr' : 'en';
  const T = ctx.T;
  const brandTitle = `${site.brand} — ${T('hero.eyebrow')}`;

  const staticPages = [
    ['home', () => homePage(ctx), brandTitle, T('hero.eyebrow'), true],
    ['sale', () => listingsPage(ctx, { status: 'for-sale', title: T('listings.sale.title') }), `${T('listings.sale.title')} — ${site.brand}`, T('hero.eyebrow'), false],
    ['rent', () => listingsPage(ctx, { status: 'for-rent', title: T('listings.rent.title') }), `${T('listings.rent.title')} — ${site.brand}`, T('hero.eyebrow'), false],
    ['team', () => teamPage(ctx), `${T('team.title')} — ${site.brand}`, T('about.serif'), false],
    ['contact', () => contactPage(ctx), `${T('contact.title')} — ${site.brand}`, T('contactband.serif'), false],
  ];

  for (const [route, render, title, description, hasHero] of staticPages) {
    emit(
      ROUTES[route][locale],
      layout(ctx, { title, description, path: ROUTES[route][locale], altPath: ROUTES[route][other], body: render(), hasHero }),
    );
  }

  for (const a of agents) {
    emit(
      agentUrl(a, locale),
      layout(ctx, {
        title: `${a.name} — ${site.brand}`,
        description: a.title[locale],
        path: agentUrl(a, locale),
        altPath: agentUrl(a, other),
        body: agentPage(ctx, a),
        hasHero: false,
      }),
    );
  }

  for (const l of listings) {
    if (l.partial) continue; // "listing light": card only, links to the broker profile
    emit(
      listingUrl(l, locale),
      layout(ctx, {
        title: `${l.address}, ${l.city} — ${site.brand}`,
        description: l.description[locale].slice(0, 155),
        path: listingUrl(l, locale),
        altPath: listingUrl(l, other),
        body: listingPage(ctx, l),
        hasHero: false,
      }),
    );
  }
}

// Root redirect: Amplify will get a proper 301 rule; this covers dev/preview.
writeFileSync(
  join(root, 'index.html'),
  `<!doctype html>
<html lang="en-CA">
<head>
  <meta charset="utf-8" />
  <title>Luxury MTL</title>
  <meta http-equiv="refresh" content="0; url=/en/" />
  <link rel="canonical" href="${site.domain}/en/" />
</head>
<body><p><a href="/en/">English</a> · <a href="/fr/">Français</a></p></body>
</html>
`,
);
pageCount++;

console.log(`✓ content ok — generated ${pageCount} pages (${listings.length} listings × ${LOCALES.length} locales + static pages)`);
