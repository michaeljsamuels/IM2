# Legacy Site Inventory — luxurymtl.com / Immeubles Montria

Working document for the migration off the legacy Laravel site. Findings get
recorded here as we go, so the knowledge lives in the repo rather than in
anyone's head (or in a chat log).

**Status:** inventory phase. Nothing in production has been changed.

---

## 0. Ground rules — READ-ONLY PHASE

The legacy site is live and receives daily organic traffic (lawn-sign QR
codes, realtor.ca mirrors, direct search). It must keep serving throughout.

**Permitted:** viewing, listing, downloading, exporting, screenshotting.

**Forbidden until a verified cutover plan exists:**

| Do not touch | Why |
|---|---|
| Cron jobs (edit/disable/delete) | Almost certainly what keeps Centris listings current. Disabling silently staleness the whole site. |
| DNS at GoDaddy | Any record change can take the site or email down globally. |
| MultiPHP / PHP version selector | Legacy Laravel may not boot on a different PHP. Instant 500s site-wide. |
| `.htaccess`, `public/`, any app file | No staging environment exists. An edit *is* a production deploy. |
| Centris FTP credentials (rotating/changing) | Rotating them breaks the legacy feed before ours exists. |
| "Fix Permissions", Softaculous updates, cache purges | Unnecessary state changes on a working system. |
| Deleting the previous developer's access | We may still need them. Revisit after independence. |
| Email routing / MX records | Broker mail flows through here. |

**Credential handling:** passwords stay out of chat logs and out of this repo.
Keep them in a password manager, and if tooling needs them, in a file *outside*
the repo (e.g. `~/.im2-legacy.env`, chmod 600).

---

## 1. What we are hunting (priority order)

The end goal is to replicate the **upstream Centris connection** so the new
site can stop scraping the old one.

1. **The Centris ingestion path** — the crown jewels:
   - Cron entry that triggers the import (schedule + exact command)
   - Stored Centris credentials (Passerelle FTP host/user/pass), most likely in
     the Laravel `.env`
   - The import/parse code (likely `app/Console/Commands/*.php`)
   - Landing directory of downloaded feed files (CSV) — confirms format and cadence
   - Any Centris account/agency identifiers used in the connection
2. **Database schema** for listings/photos/agents — the shape their importer
   produced, useful to validate our own mapping.
3. **Hosting shape** — what else lives on this account (other domains, email,
   the `immeublesmontria.com` uploads we already know serve Instagram images).
4. **DNS + TLS inventory** — everything we must reproduce before cutover.
5. **SEO baseline** — current URL set and traffic, so redirects are complete.
6. **The two broken listings** (#1553, #1569) — with DB access we can learn why
   they 500 and recover their real data.

---

## 2. Capture checklist

### A. Account & hosting shape
- [ ] cPanel home: hosting provider/brand, server hostname, cPanel version
- [ ] **Disk usage / quota** (check BEFORE generating any backup)
- [ ] PHP version in use (note it; do not change it)
- [ ] Domains list: primary, addon, subdomains, parked, and their document roots

### B. Cron jobs — HIGHEST VALUE
`cPanel → Advanced → Cron Jobs`
- [ ] Screenshot / copy the full table verbatim (schedule + command, every row)
- [ ] Note the cron email address (where failure output goes)

Look for: `php artisan <something>`, `wget`/`curl`/`lftp` against a Centris
host, or a shell script under `/home/immeublesmontria/`.

### C. Application source
`cPanel → Files → File Manager`, or SFTP
- [ ] Tree listing of `/home/immeublesmontria/` (top 2–3 levels)
- [ ] Identify the Laravel app root (contains `artisan`, `composer.json`, `app/`)
- [ ] Full download of the app source (excluding `vendor/`, `node_modules/`)
- [ ] `composer.json` + `composer.lock` (framework/PHP versions, packages)
- [ ] `app/Console/Commands/` — the import command(s)
- [ ] `routes/web.php` — full URL map for redirect planning
- [ ] Any `*.sh` scripts, and `storage/logs/laravel.log` (recent errors — will
      likely explain #1553/#1569)

### D. Credentials & config
- [ ] `.env` at the app root — **the single most important file**
      (DB creds, Centris FTP creds, mail, API keys)
- [ ] `config/` directory
- [ ] Record every third-party credential found, and who owns it

### E. Database
`cPanel → Databases → phpMyAdmin` / `MySQL Databases`
- [ ] Database name(s), users, sizes
- [ ] Table list with row counts
- [ ] Schema export (structure only) for listings/photos/agents tables
- [ ] Full logical export (structure + data) as a snapshot artifact
- [ ] Inspect rows for listings 1553 and 1569 (what's malformed?)
- [ ] Look for a sync/import log table (timestamps prove feed cadence)

### F. Domains, DNS, email
- [ ] `cPanel → Domains → Zone Editor`: export/screenshot all records
- [ ] GoDaddy: full DNS record export for luxurymtl.com (+ immeublesmontria.com)
- [ ] Registrar of record + expiry dates for both domains
- [ ] `cPanel → Email Accounts`: list of mailboxes and forwarders
- [ ] Confirm whether email is hosted here or elsewhere (MX)

### G. SEO / traffic baseline
- [ ] `cPanel → Metrics → Visitors / Awstats / Raw Access Logs`
- [ ] Download raw access logs (a month if available) — reveals real traffic,
      top URLs, and which QR/realtor.ca entry points matter
- [ ] Confirm the live URL inventory to redirect (we have the listing/team/blog
      patterns already)

### H. TLS / certificates
- [ ] Current certificate issuer + expiry, and whether AutoSSL is managing it

### I. Snapshot artifacts (do this early)
- [ ] Full account backup **downloaded off-server** (check disk space first)
- [ ] Database dump downloaded
- [ ] Store both outside this repo (they contain secrets)

---

## 3. Findings

_(fill in as captured)_

### Hosting
- cPanel: `https://174.142.205.9:2083`, user `immeublesmontria`
- SFTP: `174.142.205.9`, user `immeublesmontria`
- DNS managed at GoDaddy
- Previous webmaster: Brahm Morganstein (credentials handed over; no further
  support expected)

### Hosting details confirmed (2026-08-12)
- cPanel 134.0.49; PHP **8.3** via `/usr/local/bin/ea-php83`
- Laravel app root is **`/home/immeublesmontria/public_html`** — the app lives
  *directly in the webroot* (non-standard; only `public/` should be exposed).
  Verified NOT publicly readable: `/.env`, `/artisan`, `/composer.json`,
  `/storage/logs/laravel.log`, `/app/Console/Kernel.php`, `/.git/config` all
  return Laravel's own 404 page, so requests are routed through the framework
  rather than served from disk. **Fragile, not broken:** a single `.htaccess`
  regression would expose `.env` and every credential in it. Argues for the
  migration; do not "tidy" it on the live host.
- Other top-level dirs of interest: `public_ftp/`, `mail/`, `logs/`, `ssl/`,
  `.ssh/` (mtime 2026-08-10, same as `public_html` — likely the handover)

### ⚠️ HEADLINE FINDING: there is no automated Centris integration (2026-08-12)

The legacy site does **not** pull from Centris. It never did. Listings are
typed in by hand through a Laravel admin panel. Evidence:

| Evidence | Detail |
|---|---|
| No credentials | `.env` has **zero** Centris/FTP/Passerelle keys — only DB, mail, and unused AWS/Pusher/Redis placeholders |
| No FTP disk | `league/flysystem-ftp` is in `composer.json` but `config/filesystems.php` defines only `local` and `public` |
| Empty scheduler | `Kernel::schedule()` is empty (stock Laravel 10 skeleton). `app/Console/Commands/` does not exist |
| No import command | `routes/console.php` contains only two *newsletter email* prototypes (`OptNewListings`, `OptNewListings2`) that mail to the dev agency |
| Full manual CRUD | `/admin/listings/{index,edit,request,delete}` → `ListingController::adminRequest` reads **121 form fields** via `$request->input()`, with cascading region → municipality → neighbourhood dropdowns. New listings start at `mls = 0`; the broker types the MLS number |
| Human-paced edits | Our scrape diff caught a listing's `livingArea` going `null` → `1400 ft²` on 2026-08-11 01:43 — someone filling in a blank field |
| Sequential IDs | Internal listing IDs run ~138→1575 over years, consistent with hand creation, not feed keys |

**The `Centris*` models are taxonomy, not feed data.** `CentrisQuartier`,
`CentrisNeighbourhood`, `CentrisGenrePropriete`, `CentrisTypeCaracteristique`,
`CentrisSousTypeCaracteristique`, `CentrisValeursFixes`, `Municipality`,
`Region` are lookup tables that make the admin form's dropdowns mirror Centris
vocabulary. Photos are hotlinked to `mediaserver.centris.ca` because a human
pastes those URLs in.

**No sabotage by the previous developer.** The empty `schedule()` plus
`$this->load(__DIR__.'/Commands')` is verbatim Laravel 10's default skeleton
(a missing `Commands` dir is handled gracefully), and a per-minute
`schedule:run` cron is boilerplate. The Aug 10 16:34 mtimes on `.env`,
`config/`, `routes/`, `Kernel.php` look like routine handover prep, not
removal. Worth a diff against `.env.example` for completeness, but nothing
here suggests a pipe was cut.

**Consequences for the migration:**
1. There is **nothing upstream to replicate**. The premise that the site
   "auto-updates from Centris" does not hold — it is a people process.
2. Our scraper is reading **hand-entered data**, which explains the quality
   quirks we already hit (mixed ft²/m², null areas, untranslated FR text, and
   probably the two 500-erroring listings).
3. The new site cannot retire the legacy one until it offers **either** a
   broker-facing admin for listing entry (like-for-like) **or** the real
   Passerelle Centris feed (a genuine upgrade that removes 121-field manual
   entry). The Passerelle plan is now clearly the right ambition rather than a
   reconstruction job.
4. The true dependency on the legacy system is **brokers' daily admin usage**,
   not a technical integration. Retiring it changes their workflow.

**Still to verify in the DB:** `listings.updated_at` distribution (confirm
human cadence), whether `Centris*` lookup tables were populated once or
refreshed, and who holds `/admin` logins (`users` table, `/admin/users/*`).

### ⚠️ CORRECTION — the Centris importer EXISTS, but not in the assets we received (2026-08-12)

An earlier note in this file concluded "there is no automated Centris
integration." **That was wrong in an important way.** There is no integration
*in the cPanel account we were given*. But something is writing listings into
the database from outside the web application.

Access-log forensics (Jul + Aug 2026 SSL logs, ~750k requests):

| Evidence | Finding |
|---|---|
| New listing IDs first requested | 1575 → **Aug 4**, 1576 → **Aug 6**, 1577 → **Aug 7**, 1578 → Aug 10 |
| `POST /admin/listings/request` in all of August | **11 requests, all on Aug 10, 20:27–21:18, from one IP**, after a login at 20:16 — Brahm fixing #1553/#1569 on handover day |
| `POST /admin/listings/request` in all of July | **zero**. Also zero admin POSTs and zero logins all month |
| July's 1,746 `GET /admin` hits | Bot noise: 247 distinct IPs, 1,169 × 404 + 432 × 401 |

So listings 1575–1577 appeared **days before anyone touched the admin**. They
were not typed in. Combined with: no import code in the app, no Centris
credentials in `.env`, empty scheduler, only a `schedule:run` cron, MySQL
`DB_HOST=localhost` with port 3306 firewalled externally, and no shell history
of manual runs — the importer must run **on the server but outside this
account**, most plausibly under another cPanel account owned by the agency
(port 2087/WHM is open, consistent with MEG being the reseller), or as a
server-level task.

**Consequences:**
1. The brokerage **does** have a working Centris pipeline. It is an asset we did
   **not** receive and cannot read from this account.
2. It will very likely **stop** when MEG's involvement ends — silently. Our
   scraper would keep succeeding while serving frozen data.
3. Any Passerelle/data-transfer agreement is probably registered with **MEG as
   recipient**, not the brokerage directly. That is the thing to reclaim.

**Highest-value action: one targeted question to Brahm.** Not a general
handover request — a single specific question we can now ask precisely:
*"Where does the Centris import run? New listings appear in the database with no
admin activity, and there's no import code or cron in the account you gave us.
Is it a script under another account, or a server-level job? And is there a
Centris Passerelle data-transfer agreement — who is the registered recipient?"*

**Mitigation shipped:** the sync workflow now fails loudly if the legacy
listing set stops changing (see `.github/workflows/sync-listings.yml`), so a
silent upstream death cannot masquerade as a healthy site.

### Workflow model (2026-08-12, per client)

The brokerage's real workflow is **Centris Broker Loading**: the broker creates
the listing in Centris's own broker platform — ~10 pages of data plus photo and
contract uploads. **Centris is the source of truth and that does not change.**

The legacy website was therefore never an integration; it was a **manual
double-entry bridge**. Someone re-typed each listing into the site's 121-field
admin form after the broker had already entered it in Centris.

Verified mechanics of that bridge:
- `resources/views/admin/listings-edit.blade.php` (44 KB) is the hand-entry form;
  `/admin/upload` is an **iframe file-uploader** writing to `/images/uploads/`
- Photo `src` values are echoed raw from the DB, so the pictures column holds
  *either* local upload paths *or* full `mediaserver.centris.ca` URLs
- The Centris URLs in the DB were therefore populated from outside this
  codebase (no server-side fetcher exists) — most plausibly by the agency
  using their own local tooling
- Latitude/longitude has a "Fetch" button (geocoding), which is where the
  coordinates we harvested come from
- `ListingHelper::format_number()` divides by 1000 and appends "k" without
  rounding — the source of the site's "1.228k ft²" values

**Open question, highest operational priority: WHO performs the double entry?**
Evidence points to MEG Interactive / Brahm (he fixed listings #1553 and #1569
immediately before handover, and `admin/users-*.blade.php` was modified at
17:25 that day). If it is the agency we are replacing, then **listing updates
stop when that relationship ends**, the legacy site goes stale, and our scraper
silently inherits the staleness. Must be confirmed with the client.

### Assumption corrections

| Earlier assumption | Reality |
|---|---|
| Site auto-updates from Centris when an agent gets a listing | False. A human re-types it. The site only *looks* Centris-connected |
| We must replicate an upstream integration | There is nothing to replicate. The Passerelle feed is a **new capability**, not a reconstruction |
| A broker admin panel recreates their workflow | No — it would add a **third** place to type the same data. Brokers already do full entry in Centris |
| Recreating parity means rebuilding the 121-field form | No. That form is an artifact of the double-entry hack, not of the brokerage's workflow |

**Therefore the Passerelle feed is the critical path**, and it is the only thing
that "intercepts the workflow seamlessly": broker fills Centris → feed → our
site. No double entry, no transcription lag, no manual photo wrangling.

**Privacy constraint:** Broker Loading includes **contract uploads**. Feed
mapping must whitelist public fields explicitly; never publish the feed
wholesale.

### Residual scope for a thin admin (NOT listing data entry)
Things the Centris feed cannot supply, which still need an editor eventually:
featured/homepage selection, exclusive & off-market listings not on Centris,
agent bios and portraits, testimonials, marketing copy overrides, and
curation of the sold/rented archives.

### Cron / scheduling
- **Only one cron job exists**, running every minute:
  `/usr/local/bin/ea-php83 /home/immeublesmontria/public_html/artisan schedule:run >> /dev/null 2>&1`
- This is the generic **Laravel scheduler** entry, not the import itself. The
  real schedule (what runs, how often) is defined in code — `app/Console/Kernel.php`
  (or `routes/console.php`) — with the work in `app/Console/Commands/`.
  **Next target.**
- Output is discarded to `/dev/null`, so failures have been silent for years.
  This is very likely why nobody noticed listings #1553/#1569 breaking.
- Credentials expected in `public_html/.env`.

### Database
- _unknown_

### Domains / DNS
- _unknown_

---

## 4. Decision gates before touching production

1. Centris connection fully understood **and** independently reproduced from
   our side (either the handed-over credentials work for us, or Centris has
   issued us our own Passerelle access).
2. New site verified against the legacy site: listing-for-listing parity,
   including the two currently-broken properties.
3. Redirect map covering every live legacy URL, tested.
4. Forms delivering to the right brokers, tested end to end.
5. Rollback plan written: exact DNS values to restore, TTLs pre-lowered.
6. Only then: DNS cutover, with the legacy server left running untouched as
   a fallback for a defined observation window.
