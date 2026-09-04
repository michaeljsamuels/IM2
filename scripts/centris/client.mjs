/**
 * Centris Data Distribution API client.
 *
 * RESO-certified OData Web API. Read-only by nature — this module never
 * issues anything but GET.
 *
 * Handles the three things every caller would otherwise get wrong:
 *   1. Rate limiting (documented: 5 req/sec, 200 req/min) via a token bucket,
 *      plus honouring `Retry-After` on 429 and slowing down as the
 *      `X-Rate-Limit-Remaining` header falls.
 *   2. Cursor pagination by following `@odata.nextLink` to completion.
 *   3. Transient failures — retry 429/5xx with backoff, never silently
 *      truncating a result set.
 *
 * Docs: https://docs.datadistributionqc.centris.ca/getting-started/
 */

const PROD = 'https://datadistributionqc.centris.ca/v1/odata';
const STAGING = 'https://stg-datadistributionqc.centristst.ca/v1/odata';

// Stay under the documented 5/sec with headroom; the minute budget is the
// binding constraint in practice.
const MAX_PER_SECOND = 4;
const MIN_INTERVAL_MS = Math.ceil(1000 / MAX_PER_SECOND);
const MAX_PER_MINUTE = 150; // documented ceiling is 200; keep real headroom
const SLOW_DOWN_BELOW = 25; // requests left in window before we throttle hard

// Hard cap per process. A normal incremental sync is ~5 requests and a full
// pull is a few dozen, so anything near this number is a bug or a runaway
// experiment, not legitimate work. Fail loudly rather than drain the key's
// budget. Override only deliberately: CENTRIS_MAX_REQUESTS=500.
const MAX_REQUESTS_PER_RUN = Number(process.env.CENTRIS_MAX_REQUESTS) || 300;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class CentrisClient {
  constructor({ apiKey, baseUrl, verbose = true } = {}) {
    this.apiKey = apiKey ?? process.env.CENTRIS_API_KEY;
    if (!this.apiKey) throw new Error('CENTRIS_API_KEY is not set');
    this.baseUrl = baseUrl ?? (process.env.CENTRIS_ENV === 'staging' ? STAGING : PROD);
    this.verbose = verbose;
    this.lastRequestAt = 0;
    this.requestCount = 0;
    this.recent = []; // timestamps of requests in the last 60s
  }

  log(...args) {
    if (this.verbose) console.log(...args);
  }

  async #throttle() {
    if (this.requestCount >= MAX_REQUESTS_PER_RUN) {
      throw new Error(
        `Centris client: refusing request #${this.requestCount + 1} — per-run cap of ` +
          `${MAX_REQUESTS_PER_RUN} reached. This protects the API key. If this is a ` +
          `deliberate large pull, rerun with CENTRIS_MAX_REQUESTS set higher.`,
      );
    }
    // Sliding one-minute window, in addition to the per-second spacing.
    const now = Date.now();
    this.recent = this.recent.filter((t) => now - t < 60_000);
    if (this.recent.length >= MAX_PER_MINUTE) {
      const wait = 60_000 - (now - this.recent[0]) + 50;
      this.log(`  minute budget reached (${MAX_PER_MINUTE}); pausing ${Math.ceil(wait / 1000)}s`);
      await sleep(wait);
    }
    const spacing = this.lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (spacing > 0) await sleep(spacing);
    this.lastRequestAt = Date.now();
    this.recent.push(this.lastRequestAt);
  }

  /** Single GET with rate limiting and retry. Returns parsed JSON. */
  async get(pathOrUrl, { attempt = 0 } = {}) {
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${this.baseUrl}/${pathOrUrl.replace(/^\//, '')}`;
    await this.#throttle();

    let res;
    try {
      res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
        },
      });
    } catch (err) {
      // Network-level failure: retry a few times before giving up.
      if (attempt < 4) {
        const backoff = 2 ** attempt * 1000;
        this.log(`  network error (${err.message}); retrying in ${backoff}ms`);
        await sleep(backoff);
        return this.get(url, { attempt: attempt + 1 });
      }
      throw err;
    }

    this.requestCount++;

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after')) || 30;
      this.log(`  rate limited; waiting ${retryAfter}s`);
      await sleep((retryAfter + 1) * 1000);
      return this.get(url, { attempt });
    }

    if (res.status >= 500) {
      if (attempt < 4) {
        const backoff = 2 ** attempt * 2000;
        this.log(`  ${res.status} from API; retrying in ${backoff}ms`);
        await sleep(backoff);
        return this.get(url, { attempt: attempt + 1 });
      }
      throw new Error(`Centris ${res.status} after retries: ${url}`);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Centris ${res.status}: ${url}\n${body.slice(0, 400)}`);
    }

    // Pre-emptively slow down when the remaining budget gets thin.
    const remaining = Number(res.headers.get('x-rate-limit-remaining'));
    if (Number.isFinite(remaining) && remaining < SLOW_DOWN_BELOW) {
      this.log(`  rate budget low (${remaining} left); easing off`);
      await sleep(2000);
    }

    return res.json();
  }

  /**
   * Follow @odata.nextLink until the result set is exhausted.
   * `onPage` is called with each page's records so callers can stream.
   */
  async getAll(path, { onPage, max = Infinity } = {}) {
    const out = [];
    let url = path;
    let page = 0;

    while (url) {
      const json = await this.get(url);
      const rows = json.value ?? [];
      page++;
      out.push(...rows);
      if (onPage) await onPage(rows, { page, total: json['@odata.count'] });
      if (out.length >= max) break;
      url = json['@odata.nextLink'] ?? null;
    }
    return out;
  }

  /** Convenience: build an OData query string from an options object. */
  static query(resource, opts = {}) {
    const parts = [];
    if (opts.select) parts.push(`$select=${opts.select}`);
    if (opts.filter) parts.push(`$filter=${opts.filter}`);
    if (opts.expand) parts.push(`$expand=${opts.expand}`);
    if (opts.orderby) parts.push(`$orderby=${opts.orderby}`);
    if (opts.top) parts.push(`$top=${opts.top}`);
    if (opts.count) parts.push('$count=true');
    return parts.length ? `${resource}?${parts.join('&')}` : resource;
  }
}

export { PROD, STAGING };
