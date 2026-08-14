# Centris Data Distribution — Integration (SHIPPED 2026-08-14)

**Status: live.** luxurymtl2.com now pulls directly from Centris. The legacy
scraper (`scripts/sync-from-luxurymtl.mjs`) has been deleted and the site has
**no remaining dependency on the legacy site or server.**

Results of the initial replication and cutover:

| | |
|---|---|
| Listings | **68** (was 65 via scraper), incl. **4 sold** the legacy site never showed |
| Split | 32 for-sale · 32 for-rent · 4 sold |
| Photos | 1,884, ordered, with room labels |
| Agents | 13 referenced members (of 16,323 in Québec — see scoping note) |
| Lookups | 2,100 translated label records |
| API cost | Full pull ≈ 5 requests / 11s; hourly incremental ≈ 4 requests |
| Verification | Diffed against the scraper: **64/65 matched**. Legacy had one **stale price** (93 Ch. Dupuis: $3,900 vs Centris $3,400) and one **mis-parsed commercial lease rate** ($17/sq ft read as the price). Centris was correct in both cases. |

**Scoping note:** `Property` is scoped to the brokerage, but `Member` is **not** —
it returns every agent in Québec (16,323 records / 26 MB). `Member` is therefore
a *derived* resource: its key set comes from `ListAgentKey`/`CoListAgentKey` on
our own listings, so we store the 13 that matter (including co-listing agents
from other brokerages such as Sotheby's). Never replicate `Member` unscoped.

**URL change:** listing URLs now use the Centris MLS number
(`/en/listing/28891954/...`) instead of the legacy internal id. This is stable,
matches Centris, and supports the `centris-redirection/{mls}` deep-link pattern
the legacy site used — relevant when building the redirect map at cutover.

---

## Original plan (retained for reference)

Replaces the interim `sync-from-luxurymtl.mjs` scraper with a direct,
first-party connection to Centris. Once live, luxurymtl2.com has **no
dependency on the legacy site whatsoever**.

## What we actually got (better than the CSV feed we planned for)

Centris Data Distribution is a **RESO-certified Web API** using OData — not the
FTP/CSV Passerelle drop that earlier research suggested. Concretely:

| | |
|---|---|
| Production | `https://datadistributionqc.centris.ca/v1/odata/` |
| Staging | `https://stg-datadistributionqc.centristst.ca/` |
| Auth | `Authorization: Bearer <api_key>` (OIDC client-credentials also supported) |
| Protocol | OData: `$select`, `$filter`, `$orderby`, `$expand`, `$top`, `$skip`, `$count` |
| Pagination | Cursor via `@odata.nextLink` |
| Rate limits | **5 req/sec, 200 req/min**; `429` returns `Retry-After`, and `200`s carry `X-Rate-Limit-Remaining` |
| Schema | Self-describing: `GET /v1/odata/$metadata` (+ OpenAPI/Swagger/Scalar) |
| Languages | `$expand=Translations` returns EN **and** FR in one request |
| Webhooks | Available, but not yet scoped to own data — polling is the recommended path |

Resources relevant to us: `Property`, `Media`, `Member` (agents), `Office`,
`PropertyRooms`, `PropertyExpense`, `PropertyUnit`, `PropertyParking`,
`OpenHouse`, `Lookup`, `Neighborhood`, `CityOrTownship`, `StateRegion`.

### Three quality wins this unlocks immediately
1. **Real French.** `$expand=Translations` gives Centris' own FR copy. Today we
   fall back to English when the legacy site lacked a translation.
2. **Proper feature labels.** Fields like `ParkingFeatures` return *identifiers*
   (e.g. `"Heated Garage"`), not display text. The `Lookup` resource resolves
   them to translated labels — replacing our current raw `"Key: Value"` strings.
3. **Structured everything.** Rooms, expenses, taxes, units, open houses arrive
   as typed records instead of scraped HTML with `1.228k ft²` artifacts.

## Proposed interface

```
scripts/centris/
  client.mjs       # auth, rate-limit governor, retry/backoff, nextLink paging
  replicate.mjs    # per-resource incremental pull + daily reconciliation
  lookups.mjs      # Lookup cache → translated display labels
  map-listings.mjs # RESO → our content schema (pure, testable, no network)
content/centris/           # raw replicated records, committed (audit + rebuild)
content/.sync-state.json   # per-resource ModificationTimestamp cursors
```

**Design principle: separate replication from presentation.** `replicate.mjs`
only talks to the API and writes raw records. `map-listings.mjs` is pure —
it turns raw records into `content/listings.json` / `content/agents.json` with
no network access. That means we can re-shape the site's data model without
re-pulling from Centris, and mapping bugs are trivially testable offline.

Everything downstream is untouched: `build-content.mjs` validation, the static
build, Amplify deploy, broker profiles, maps, the mortgage calculator.

## Replication strategy (per Centris' documented recommendations)

1. **Initialize** — full pull per resource, following `@odata.nextLink`.
2. **Incremental** (hourly) — `$filter=ModificationTimestamp gt <cursor>`,
   tracking a **separate cursor per resource**, persisted in
   `content/.sync-state.json` (versioned in git, so state is transparent and
   recoverable). On error, resume from the last cursor — **never restart from
   zero**.
3. **Reconcile** (daily) — pull `$select=<Key>,ModificationTimestamp` for the
   full set and diff against ours. Centris flags this as *very important*: it
   is the only way to catch **removals** (listing expires, goes off-market, or
   an agent stops sharing data). Page size is 1,000 when selecting just
   key + timestamp, versus 100 with more fields — so reconciliation is cheap.
4. **Archive, don't delete.** Records that leave the feed move to
   `content/archive/` rather than vanishing — this is what finally powers the
   Sold / Rented pages the legacy site had and ours currently lacks.

Query shapes follow Centris' own guidance to split expansions:
```
/Property?$expand=ListAgentOffices,Translations
/Property?$select=ListingKey,ModificationTimestamp&$expand=Media
/Property?$select=ListingKey,ModificationTimestamp&$expand=Rooms(expand=Translations)
```

Rate-limit governor: cap at ~4 req/sec with a token bucket, honour
`Retry-After` on 429, and pre-emptively slow down as `X-Rate-Limit-Remaining`
falls. A full hourly incremental should be a handful of requests.

## Photos

`$expand=Media` yields Centris-hosted image URLs. Two options:
- **Hotlink** (what the legacy site and our scraper do today) — free, zero
  storage, but leaves us dependent on Centris' CDN and their terms.
- **Mirror to S3** — durable, faster, lets us resize/WebP, and survives feed
  changes. Costs pennies at this volume.

**Recommendation: mirror**, keyed by `ListingKey`/`MediaKey`, with hotlink as
the fallback until the bucket is warm. Confirm against the data-distribution
agreement first — some licences require hosting your own copies, others forbid
caching. This is a question for Centris ops, not a technical unknown.

## Cutover (no big-bang)

1. Build against **staging** first if credentials allow; otherwise use
   production with read-only queries (the API is read-only by nature).
2. Run the Centris replication **alongside** the existing scraper, writing to
   `content/listings.centris.json`.
3. **Diff the two** — listing count, per-listing price/address/beds/photos.
   Discrepancies are either mapping bugs or legacy data rot; both are worth
   knowing before we trust the feed.
4. When the diff is clean, promote Centris output to `content/listings.json`,
   delete `scripts/sync-from-luxurymtl.mjs` and its workflow, and remove the
   staleness guard that exists only to protect the scraper.
5. luxurymtl2.com is then **fully independent** of the legacy site and server.

## Open questions for Centris / the brokerage

1. **Scope of the key** — does it return only Immeubles Montria's listings, or
   a broader set we must filter? Determines whether we commit raw data and how
   we filter for the public site. (Answerable in one query once we have the key.)
2. **Staging credentials** — available? Preferred for development.
3. **Media terms** — may we mirror photos to our own storage?
4. **Contract/private documents** — Broker Loading includes contracts. We
   whitelist public fields explicitly; never publish the payload wholesale.

## Security

API key lives in **GitHub Actions secrets** (`CENTRIS_API_KEY`) and, for local
runs, `~/im2-legacy/`-style files outside the repo. Never committed, never
echoed in logs. The key is revocable by Centris if it ever leaks.
