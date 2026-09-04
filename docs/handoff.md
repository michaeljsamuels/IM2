# Handoff: Michael → Mark (September 2026)

Goal: Mark owns an independent copy of this site with his own GitHub repo, his
own AWS Amplify app, and his own Claude Code sessions, using the same
Centris key. Total setup is under an hour.

## 0. What Mark needs before starting

- A GitHub account (free). The repo must be **private**.
- An AWS account (Amplify Hosting free tier covers this site).
- Node.js 22 and git installed. `gh` CLI optional but handy.
- Claude Code installed and logged in (`claude` in a terminal).
- The `CENTRIS_API_KEY`, handed over through a password manager or another
  secure channel. **Not by email, text, or chat.**

## 1. Copy the code

Michael's repo is `github.com/michaeljsamuels/IM2` (private, branch `prod`).
Git history is clean of secrets (audited 2026-09-04), so a plain clone is fine.

```sh
git clone https://github.com/michaeljsamuels/IM2.git luxurymtl
cd luxurymtl
git remote remove origin
```

Create a new **private** repo on GitHub (say `luxurymtl`), then:

```sh
git remote add origin https://github.com/<mark>/luxurymtl.git
git push -u origin prod
```

Do not make the repo public: `content/centris/` contains licensed Centris data.

## 2. Add the Centris key as a GitHub Actions secret

GitHub → repo → Settings → Secrets and variables → Actions → New repository
secret → name `CENTRIS_API_KEY`, paste the key. That is the only secret the
pipeline needs. Actions → "Sync listings" will then run every 15 minutes and
commit refreshed listings when anything changes.

For local runs of `npm run sync` (rarely needed), keep the key in a file
outside the repo and load it into the shell for that command only, e.g.
`~/luxurymtl-secrets/credentials.env` containing `CENTRIS_API_KEY=...`, then
`set -a; source ~/luxurymtl-secrets/credentials.env; set +a; npm run sync`.
Never write it into the repo, `.env` in the repo, or any `VITE_` variable.

## 3. Create the Amplify app

AWS Console → Amplify → Create new app → GitHub → authorize → pick the repo
and branch `prod`. Amplify detects `amplify.yml` (`npm ci && npm run build`,
publish `dist/`). Leave environment variables empty; the build needs none.
First build takes a few minutes; you get a `*.amplifyapp.com` URL.

### 3b. Register your own practice domain

`luxurymtl2.com` stays with Michael (it is registered in his AWS account and
is not being transferred). Mark registers a fresh practice domain of his own,
e.g. `luxurymtl3.com`, in his own AWS account:

Route 53 → Registered domains → Register domain → search, buy (~US$15/yr),
keep auto-renew and privacy protection on. Then Amplify → your app →
Hosting → Custom domains → Add domain → pick it from the dropdown. Amplify
creates the DNS records and the certificate itself; it is live in
5–30 minutes. Update `content/site.json` → `domain` if you want canonical
URLs and sitemaps to point at the new host.

The real `luxurymtl.com` is at GoDaddy and belongs to the firm. Pointing it
at Mark's Amplify app is the eventual cutover, a business decision made with
the firm, not part of this setup.

## 4. Single consumer of the key

Once Mark's sync workflow is green, Michael **disables his workflow**
(GitHub → Actions → Sync listings → ⋯ → Disable workflow) or archives his
repo, so only one pipeline polls Centris. Two pipelines is well within the
rate limit, but one owner per key is the rule.

## 5. Claude Code

In the repo directory run `claude`. `CLAUDE.md` is read automatically; it
tells Claude it is working with Mark and lays out the Centris rules. Mark's
first prompt can simply be: "Read CLAUDE.md and docs/handoff.md, then confirm
the build passes with `npm run build`."

Useful habits for Mark:
- Ask Claude to explain before it changes anything.
- Make one change at a time, run `npm run build`, look at `npm run dev`.
- Push only when the change looks right; every push deploys.
- If Claude proposes any new call to the Centris API, say no and ask it to
  work from `content/centris/` instead.

## 6. Checklist

- [ ] Private GitHub repo created, `prod` pushed
- [ ] `CENTRIS_API_KEY` secret added; "Sync listings" workflow runs green
- [ ] Amplify app connected to the repo; first build green; site loads
- [ ] Own practice domain registered in Route 53 and attached in Amplify
- [ ] Michael's sync workflow disabled
- [ ] `claude` runs in the repo and reads CLAUDE.md
- [ ] Key stored only in the GitHub secret and a file outside the repo

## What was left behind on purpose

`docs/legacy-inventory.md` and `scripts/legacy-pull.sh` document the old
cPanel site (host IP and username, no passwords). That relationship is over
and the new site does not depend on it. Safe to delete once the migration is
considered closed.
