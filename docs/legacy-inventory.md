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

### Centris connection
- _unknown — primary objective_

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
