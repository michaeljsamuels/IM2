/**
 * Interim Centris datafeed: scrapes the firm's own current site
 * (luxurymtl.com) and rewrites content/listings.json. The old site already
 * syncs with Centris, so its public pages are a faithful mirror of the
 * firm's active listings — photos are hotlinked straight from
 * mediaserver.centris.ca, exactly as the old site does.
 *
 * Runs hourly via .github/workflows/sync-listings.yml; a push of the
 * refreshed JSON triggers the Amplify build. Replace this with a real
 * Centris feed (QPAREB data feed / vendor API) in phase 2 — only this file
 * and the workflow need to change.
 *
 * Safety: if the scrape looks broken (too few listings parsed), the script
 * exits non-zero WITHOUT touching listings.json, so a bad scrape can never
 * wipe the live site.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://luxurymtl.com';
const MIN_EXPECTED_LISTINGS = 5;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const agents = JSON.parse(readFileSync(join(root, 'content/agents.json'), 'utf8'));

const HOOD_MAP = [
  ['Notre-Dame-de-Grâce', 'ndg'],
  ['Westmount', 'westmount'],
  ['Vieux-Montréal', 'vieux-montreal'],
  ['Old Montreal', 'vieux-montreal'],
  ['Ville-Marie', 'centre-ville'],
  ['Centre-Ville', 'centre-ville'],
  ['Downtown', 'centre-ville'],
  ['Le Sud-Ouest', 'le-sud-ouest'],
  ['Sud-Ouest', 'le-sud-ouest'],
  ['Plateau', 'plateau-mont-royal'],
  ['Outremont', 'outremont'],
];

async function fetchText(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (IM2 site sync; contact info@luxurymtl.com)' },
  });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return (await res.text()).replace(/\s+/g, ' ');
}

const decode = (s) =>
  s
    .replaceAll('&amp;', '&')
    .replaceAll('&#039;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .trim();

const cleanText = (html) =>
  decode(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/ ?\n ?/g, '\n'),
  ).trim();

const money = (s) => {
  const m = s?.match(/\$\s*([\d.,\s]+)/);
  return m ? Number(m[1].replace(/[^\d]/g, '')) : null;
};

function parseArea(val) {
  // "5.237k ft<sup>2</sup>" | "100.3 m<sup>2</sup>"
  const m = val.match(/([\d.,]+)\s*(k?)\s*(ft|m)/i);
  if (!m) return null;
  let value = Number(m[1].replace(',', ''));
  if (m[2].toLowerCase() === 'k') value *= 1000;
  return { value: Math.round(value * 10) / 10, unit: m[3].toLowerCase() === 'm' ? 'm²' : 'ft²' };
}

function agentIdFor(email) {
  if (!email) return null;
  const exact = agents.find((a) => a.email.toLowerCase() === email.toLowerCase());
  if (exact) return exact.id;
  const local = email.split('@')[0].toLowerCase();
  const byName = agents.find((a) => a.name.toLowerCase().split(/\s+/).some((part) => part.startsWith(local) || local.startsWith(part)));
  return byName ? byName.id : null;
}

function parseDetail(html, { id, status }) {
  // Header block: <h5 class="subtitle-margin">TYPE for sale</h5> <h3>ADDRESS <br>Borough (City), POSTAL <br><br> <b>MLS # 12345678</b>...</h3>
  // The page repeats this block; only the main one carries borough + MLS,
  // so prefer a match containing "MLS", falling back to the longest.
  const heads = [...html.matchAll(/<h5 class="subtitle-margin">\s*([^<]+?)\s*<\/h5>\s*<h3>(.*?)<\/h3>/g)];
  if (!heads.length) throw new Error('no header block');
  const head = heads.find((m) => /MLS\s*#/.test(m[2])) ?? heads.sort((a, b) => b[2].length - a[2].length)[0];
  const typeRaw = decode(head[1]).replace(/\s*(for sale|for rent|à vendre|à louer)\s*$/i, '').trim();
  const h3Parts = head[2].split(/<br\s*\/?>/i).map((p) => cleanText(p)).filter(Boolean);
  const address = h3Parts[0] ?? '';
  const locLine = h3Parts[1] ?? '';
  const locMatch = locLine.match(/^(.*?)\s*\(([^)]+)\)\s*,?\s*([A-Z]\d[A-Z]\s?\d[A-Z]\d)?/);
  const borough = locMatch ? locMatch[1].trim() : locLine;
  const city = locMatch?.[2]?.trim() || 'Montréal';
  const postalCode = locMatch?.[3]?.replace(/([A-Z]\d[A-Z])\s?(\d[A-Z]\d)/, '$1 $2') ?? '';
  const centrisId = head[2].match(/MLS\s*#\s*(\d+)/)?.[1] ?? null;

  const price = money(html.match(/gallery-slide-desc-price[^>]*>([^<]*)</)?.[1] ?? html.match(/\$\s*[\d,]{6,}/)?.[0]);
  const descHtml = html.match(/<p style="margin-top: 15px;">(.*?)<\/p>/)?.[1] ?? '';
  const description = cleanText(descHtml);

  const params = {};
  for (const m of html.matchAll(/details-parameters-name">([^<]+)<\/div>\s*<div class="details-parameters-val">(.*?)<\/div>/g))
    params[decode(m[1]).toLowerCase()] = decode(m[2].replace(/<[^>]+>/g, ''));

  const featurePairs = [];
  for (const m of html.matchAll(/<li>([^:<]{2,60}):\s*<span style="font-weight:\s*normal">([^<]+)<\/span>\s*<\/li>/g))
    featurePairs.push([decode(m[1]), decode(m[2])]);

  const findPair = (label) => featurePairs.find(([k]) => k.toLowerCase().includes(label))?.[1];

  const photos = [...new Set([...html.matchAll(/https:\/\/mediaserver\.centris\.ca\/media\.ashx\?id=[A-F0-9]+(?:&(?:amp;)?t=pi&(?:amp;)?f=I)/g)].map((m) => decode(m[0])))];

  const agentEmail = html.match(/name="agent_email"[^>]*value="([^"]+)"/)?.[1] ?? null;
  const hood = HOOD_MAP.find(([needle]) => `${borough} ${locLine}`.toLowerCase().includes(needle.toLowerCase()))?.[1];

  return {
    id,
    centrisId,
    status,
    featured: false,
    type: { en: typeRaw ? typeRaw[0].toUpperCase() + typeRaw.slice(1) : 'Property', fr: null },
    price,
    address,
    postalCode,
    city,
    borough,
    ...(hood ? { neighbourhood: hood } : {}),
    beds: params['bedrooms'] ? Number(params['bedrooms']) : null,
    baths: params['bathrooms'] ? Number(params['bathrooms']) : null,
    powderRooms: params['powder rooms'] ? Number(params['powder rooms']) : 0,
    livingArea: params['living area'] ? parseArea(params['living area']) : null,
    yearBuilt: findPair('year built') ? Number(findPair('year built').replace(/\D/g, '')) || null : null,
    parking: findPair('parking') ? { en: findPair('parking'), fr: findPair('parking') } : null,
    listedDate: null,
    agentId: agentIdFor(agentEmail),
    description: { en: description, fr: null },
    features: { en: featurePairs.map(([k, v]) => `${k}: ${v}`), fr: null },
    rooms: [],
    condoFees: null,
    taxes:
      findPair('municipal tax') || findPair('school tax')
        ? { municipal: money(findPair('municipal tax') ?? ''), school: money(findPair('school tax') ?? '') }
        : null,
    inclusions: null,
    exclusions: null,
    photos,
  };
}

async function main() {
  const indexes = [
    { path: '/en/listings/sale', status: 'for-sale' },
    { path: '/en/listings/rent', status: 'for-rent' },
  ];

  const targets = [];
  for (const { path, status } of indexes) {
    const html = await fetchText(path);
    const urls = [...new Set([...html.matchAll(/href="(\/en\/listing\/(\d+)\/[^"]+)"/g)].map((m) => JSON.stringify({ url: m[1], id: Number(m[2]), status })))];
    targets.push(...urls.map((s) => JSON.parse(s)));
    console.log(`${path}: ${urls.length} listings`);
  }

  const listings = [];
  const failures = [];
  for (const t of targets) {
    try {
      const html = await fetchText(t.url);
      const listing = parseDetail(html, t);
      // French description/type from the FR mirror page (best-effort)
      try {
        const frHtml = await fetchText(t.url.replace('/en/listing/', '/fr/annonce/'));
        const fr = parseDetail(frHtml, t);
        listing.description.fr = fr.description.en || null;
        listing.type.fr = fr.type.en;
        listing.features.fr = fr.features.en;
        if (fr.parking && listing.parking) listing.parking.fr = fr.parking.en;
      } catch {
        /* FR page missing — EN fallback below */
      }
      listing.description.fr ??= listing.description.en;
      listing.type.fr ??= listing.type.en;
      listing.features.fr = listing.features.fr?.length ? listing.features.fr : listing.features.en;
      if (!listing.price || !listing.address || !listing.photos.length) throw new Error('incomplete parse');
      listings.push(listing);
    } catch (e) {
      failures.push(`${t.url}: ${e.message}`);
    }
  }

  if (failures.length) console.warn(`skipped ${failures.length}:\n  - ${failures.join('\n  - ')}`);
  if (listings.length < MIN_EXPECTED_LISTINGS) {
    console.error(`✗ only ${listings.length} listings parsed (< ${MIN_EXPECTED_LISTINGS}) — refusing to overwrite listings.json`);
    process.exit(1);
  }

  // Feature the six priciest sale listings on the homepage
  listings
    .filter((l) => l.status === 'for-sale')
    .sort((a, b) => b.price - a.price)
    .slice(0, 6)
    .forEach((l) => (l.featured = true));

  listings.sort((a, b) => b.id - a.id);
  writeFileSync(join(root, 'content/listings.json'), JSON.stringify(listings, null, 2) + '\n');
  console.log(`✓ wrote ${listings.length} listings (${listings.filter((l) => l.status === 'for-sale').length} sale, ${listings.filter((l) => l.status === 'for-rent').length} rent)`);
}

await main();
