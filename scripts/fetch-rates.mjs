/**
 * Pulls the Bank of Canada's posted 5-year conventional mortgage rate and
 * writes it to content/rates.json for the mortgage calculator.
 *
 * Build-time rather than client-side on purpose: no runtime dependency on a
 * third-party API, no CORS surface, and the rate is versioned in git so a
 * bad upstream day can't silently change what visitors see.
 *
 * Source: Bank of Canada Valet API, series V80691335 (free, no key).
 * Docs: https://www.bankofcanada.ca/valet/docs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERIES = 'V80691335';
const URL = `https://www.bankofcanada.ca/valet/observations/${SERIES}/json?recent=1`;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'content/rates.json');

// Sanity band: the posted 5-year rate has never sat outside this range.
// Anything beyond it means the series changed meaning — keep the old value.
const MIN = 0.5;
const MAX = 25;

const res = await fetch(URL, { headers: { Accept: 'application/json' } });
if (!res.ok) throw new Error(`Valet API ${res.status}`);
const json = await res.json();

const obs = json.observations?.at(-1);
const value = Number(obs?.[SERIES]?.v);
const date = obs?.d;

if (!Number.isFinite(value) || value < MIN || value > MAX || !date) {
  console.error(`✗ implausible rate from Valet (${obs?.[SERIES]?.v} on ${date}) — keeping existing rates.json`);
  process.exit(1);
}

const payload = {
  mortgage5yr: value,
  asOf: date,
  label: json.seriesDetail?.[SERIES]?.label ?? 'Conventional mortgage: 5-year',
  source: 'Bank of Canada',
  sourceUrl: 'https://www.bankofcanada.ca/rates/interest-rates/canadian-interest-rates/',
};

let previous = null;
try {
  previous = JSON.parse(readFileSync(out, 'utf8'));
} catch {
  /* first run */
}

writeFileSync(out, JSON.stringify(payload, null, 2) + '\n');
console.log(
  previous?.mortgage5yr === value
    ? `✓ rate unchanged: ${value}% (as of ${date})`
    : `✓ rate ${previous ? `${previous.mortgage5yr}% → ` : ''}${value}% (as of ${date})`,
);
