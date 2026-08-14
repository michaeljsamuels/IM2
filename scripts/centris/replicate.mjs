/**
 * Replicates Centris resources into content/centris/*.json.
 *
 * Follows Centris' documented strategy:
 *   - Track a SEPARATE ModificationTimestamp cursor per resource
 *     (content/.sync-state.json, versioned in git so state is transparent).
 *   - Incremental pulls filter on `ModificationTimestamp gt <cursor>`.
 *   - On error, resume from the last cursor — never restart from zero.
 *   - Reconciliation compares the full key+timestamp set to catch REMOVALS
 *     (expired/off-market listings, agents who stop sharing). Centris flags
 *     this as essential; nothing else detects deletions.
 *
 * Writes raw records only. Mapping to the site's schema is a separate, pure
 * step (map-listings.mjs) so we can reshape presentation without re-pulling.
 *
 * Usage:
 *   node scripts/centris/replicate.mjs            # incremental (+ daily reconcile)
 *   node scripts/centris/replicate.mjs --full     # ignore cursors, pull everything
 *   node scripts/centris/replicate.mjs --reconcile
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CentrisClient } from './client.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA_DIR = join(root, 'content/centris');
const STATE_FILE = join(root, 'content/.sync-state.json');

/**
 * Resources we replicate. `expand` follows Centris' guidance to split heavy
 * expansions across requests rather than requesting everything at once.
 */
const RESOURCES = {
  Property: {
    key: 'ListingKey',
    // Split into passes: the base record + translations, then media, then
    // rooms/expenses. Merged by key after fetching.
    passes: [
      { name: 'core', expand: 'Translations' },
      { name: 'media', select: 'ListingKey,ModificationTimestamp', expand: 'Media' },
      { name: 'rooms', select: 'ListingKey,ModificationTimestamp', expand: 'Rooms(expand=Translations)' },
      { name: 'expenses', select: 'ListingKey,ModificationTimestamp', expand: 'Expenses(expand=Translations)' },
      // Unit mix for revenue properties (Québec notation: 4½, 6½ …)
      { name: 'units', select: 'ListingKey,ModificationTimestamp', expand: 'Units(expand=Translations)' },
    ],
  },
  // Member is NOT scoped to our brokerage — the API returns every agent in
  // Québec (16k+ records, 26MB). We only want the handful actually referenced
  // by our listings, including co-listing agents from other offices. So this
  // resource derives its key set from Property rather than pulling the
  // collection.
  Member: {
    key: 'MemberKey',
    passes: [{ name: 'core', expand: 'Translations,Media' }],
    deriveKeys: () => {
      const props = readJson(join(DATA_DIR, 'Property.json'), []);
      const keys = new Set();
      for (const p of props) {
        for (const f of ['ListAgentKey', 'CoListAgentKey']) {
          if (p[f]) keys.add(String(p[f]));
        }
      }
      return [...keys];
    },
  },
  Lookup: { key: 'LookupKey', passes: [{ name: 'core', expand: 'Translations' }] },
};

const readJson = (p, fallback) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
};

function loadState() {
  return readJson(STATE_FILE, { cursors: {}, lastReconcile: {} });
}

function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

function loadResource(name) {
  const records = readJson(join(DATA_DIR, `${name}.json`), []);
  return new Map(records.map((r) => [String(r[RESOURCES[name].key]), r]));
}

function saveResource(name, map) {
  mkdirSync(DATA_DIR, { recursive: true });
  const key = RESOURCES[name].key;
  const rows = [...map.values()].sort((a, b) => String(a[key]).localeCompare(String(b[key])));
  writeFileSync(join(DATA_DIR, `${name}.json`), JSON.stringify(rows, null, 2) + '\n');
  return rows.length;
}

/** Most recent ModificationTimestamp across a set of records. */
function maxTimestamp(records, current) {
  let max = current ?? null;
  for (const r of records) {
    const t = r.ModificationTimestamp;
    if (t && (!max || t > max)) max = t;
  }
  return max;
}

async function replicateResource(client, name, { full = false } = {}) {
  const cfg = RESOURCES[name];
  const state = loadState();
  const cursor = full ? null : state.cursors[name];
  const store = full ? new Map() : loadResource(name);

  // Derived resources fetch only the keys referenced elsewhere, in batches,
  // instead of walking a collection that isn't scoped to us.
  const derivedKeys = cfg.deriveKeys ? cfg.deriveKeys() : null;
  if (derivedKeys) {
    console.log(`\n▶ ${name} (derived: ${derivedKeys.length} key(s) referenced by our listings)`);
    let fetched = 0;
    for (let i = 0; i < derivedKeys.length; i += 30) {
      const list = derivedKeys.slice(i, i + 30).map((k) => `'${k}'`).join(',');
      for (const pass of cfg.passes) {
        const rows = await client.getAll(
          CentrisClient.query(name, {
            select: pass.select,
            expand: pass.expand,
            filter: `${cfg.key} in (${list})`,
          }),
        );
        for (const row of rows) {
          const k = String(row[cfg.key]);
          store.set(k, { ...(store.get(k) ?? {}), ...row });
        }
        fetched += rows.length;
      }
    }
    // Drop anything no longer referenced by a live listing.
    for (const k of [...store.keys()]) {
      if (!derivedKeys.includes(k)) store.delete(k);
    }
    const count = saveResource(name, store);
    const s = loadState();
    s.cursors[name] = maxTimestamp([...store.values()], null);
    s.lastReconcile[name] = new Date().toISOString();
    saveState(s);
    console.log(`  → ${count} records stored (${fetched} fetched)`);
    return { fetched, count };
  }

  console.log(`\n▶ ${name}${cursor ? ` (since ${cursor})` : ' (full)'}`);

  let fetched = 0;
  for (const pass of cfg.passes) {
    const filter = cursor ? `ModificationTimestamp gt ${cursor}` : null;
    const path = CentrisClient.query(name, {
      select: pass.select,
      expand: pass.expand,
      filter,
    });

    const rows = await client.getAll(path, {
      onPage: (batch, { page }) => {
        if (batch.length) process.stdout.write(`  ${pass.name}: page ${page} (+${batch.length})\r`);
      },
    });

    // Merge this pass into the store keyed by resource key.
    for (const row of rows) {
      const k = String(row[cfg.key]);
      store.set(k, { ...(store.get(k) ?? {}), ...row });
    }
    fetched += rows.length;
    process.stdout.write(`  ${pass.name}: ${rows.length} records fetched\n`);
  }

  const newCursor = maxTimestamp([...store.values()], cursor);
  const count = saveResource(name, store);

  // Only advance the cursor after a successful write.
  const s = loadState();
  if (newCursor) s.cursors[name] = newCursor;
  saveState(s);

  console.log(`  → ${count} total records stored${newCursor ? `, cursor ${newCursor}` : ''}`);
  return { fetched, count };
}

/**
 * Compare the full key+timestamp set against ours. Detects records that
 * disappeared from the feed (sold, expired, withdrawn) and any we missed.
 * Cheap: selecting only key + timestamp returns 1,000 records per page.
 */
async function reconcileResource(client, name) {
  if (RESOURCES[name].deriveKeys) return { skipped: true }; // derived resources reconcile during replication
  const cfg = RESOURCES[name];
  const store = loadResource(name);

  const remote = await client.getAll(
    CentrisClient.query(name, { select: `${cfg.key},ModificationTimestamp` }),
  );
  const remoteMap = new Map(remote.map((r) => [String(r[cfg.key]), r.ModificationTimestamp]));

  const missing = [...remoteMap.keys()].filter((k) => !store.has(k));
  const removed = [...store.keys()].filter((k) => !remoteMap.has(k));
  const stale = [...remoteMap.entries()]
    .filter(([k, t]) => store.has(k) && store.get(k).ModificationTimestamp !== t)
    .map(([k]) => k);

  console.log(
    `\n⟳ reconcile ${name}: remote ${remoteMap.size}, local ${store.size} — ` +
      `missing ${missing.length}, stale ${stale.length}, removed ${removed.length}`,
  );

  // Fetch anything missing or out of date, in key batches.
  const needed = [...missing, ...stale];
  if (needed.length) {
    for (let i = 0; i < needed.length; i += 40) {
      const batch = needed.slice(i, i + 40);
      const list = batch.map((k) => `'${k}'`).join(',');
      for (const pass of cfg.passes) {
        const rows = await client.getAll(
          CentrisClient.query(name, {
            select: pass.select,
            expand: pass.expand,
            filter: `${cfg.key} in (${list})`,
          }),
        );
        for (const row of rows) {
          const k = String(row[cfg.key]);
          store.set(k, { ...(store.get(k) ?? {}), ...row });
        }
      }
    }
  }

  // Records that left the feed are archived, never silently dropped — this is
  // what powers the Sold / Rented pages.
  if (removed.length) {
    const archivePath = join(DATA_DIR, `${name}.archived.json`);
    const archive = readJson(archivePath, []);
    const archiveKeys = new Set(archive.map((r) => String(r[cfg.key])));
    for (const k of removed) {
      if (!archiveKeys.has(k)) archive.push({ ...store.get(k), _archivedAt: new Date().toISOString() });
      store.delete(k);
    }
    writeFileSync(archivePath, JSON.stringify(archive, null, 2) + '\n');
    console.log(`  archived ${removed.length} record(s) that left the feed`);
  }

  saveResource(name, store);
  const s = loadState();
  s.lastReconcile[name] = new Date().toISOString();
  saveState(s);
  return { missing: missing.length, stale: stale.length, removed: removed.length };
}

async function main() {
  const args = process.argv.slice(2);
  const full = args.includes('--full');
  const reconcileOnly = args.includes('--reconcile');
  const only = args.find((a) => a.startsWith('--resource='))?.split('=')[1];

  const client = new CentrisClient();
  const names = only ? [only] : Object.keys(RESOURCES);

  mkdirSync(DATA_DIR, { recursive: true });
  const started = Date.now();

  for (const name of names) {
    if (reconcileOnly) {
      await reconcileResource(client, name);
    } else {
      await replicateResource(client, name, { full });
      // Reconcile at most once a day per resource.
      const last = loadState().lastReconcile[name];
      const dueForReconcile =
        !last || Date.now() - Date.parse(last) > 20 * 3600 * 1000;
      if (dueForReconcile) await reconcileResource(client, name);
    }
  }

  console.log(
    `\n✓ replication complete in ${((Date.now() - started) / 1000).toFixed(1)}s ` +
      `(${client.requestCount} API requests)`,
  );
}

await main();
