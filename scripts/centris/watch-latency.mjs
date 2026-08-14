/**
 * Measures how quickly a Centris Broker Loading edit becomes visible on the
 * Data Distribution API. Polls for any Property modified after a baseline
 * timestamp and reports when one appears.
 *
 * Usage: node scripts/centris/watch-latency.mjs [baselineISO] [minutes]
 */
import { CentrisClient } from './client.mjs';

const baseline = process.argv[2] ?? new Date(Date.now() - 3600e3).toISOString().replace(/\.\d+Z$/, 'Z');
const minutes = Number(process.argv[3] ?? 80);
const INTERVAL_MS = 120_000;

const client = new CentrisClient({ verbose: false });
const started = Date.now();

console.log(`watching for Property changes after ${baseline} (up to ${minutes} min)`);

const query = CentrisClient.query('Property', {
  select: 'ListingKey,ModificationTimestamp,ListPrice,RentPrice,MlsStatus',
  filter: `ModificationTimestamp gt ${baseline}`,
  orderby: 'ModificationTimestamp desc',
  top: 5,
});

while (Date.now() - started < minutes * 60_000) {
  const elapsed = Math.round((Date.now() - started) / 60_000);
  let rows = [];
  try {
    rows = (await client.get(query)).value ?? [];
  } catch (err) {
    console.log(`[+${elapsed}m] poll error: ${err.message}`);
  }

  if (rows.length) {
    console.log(`\n✓ CHANGE DETECTED after ${elapsed} minute(s) of polling:`);
    for (const r of rows) {
      const price = r.ListPrice ?? r.RentPrice;
      console.log(
        `   listing ${r.ListingKey}  modified ${r.ModificationTimestamp}  ` +
          `${r.MlsStatus ?? ''} ${price ? `$${Number(price).toLocaleString()}` : ''}`,
      );
    }
    const newest = rows[0].ModificationTimestamp;
    const lagMin = Math.round((Date.now() - Date.parse(newest)) / 60_000);
    console.log(`\n   newest change stamped ${newest} (${lagMin} min before detection)`);
    process.exit(0);
  }

  console.log(`[+${elapsed}m] no change yet`);
  await new Promise((r) => setTimeout(r, INTERVAL_MS));
}

console.log(`\nno change detected in ${minutes} minutes`);
