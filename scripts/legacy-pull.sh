#!/usr/bin/env bash
#
# Read-only retrieval of the legacy site's source over SFTP.
#
# SAFETY: this script only ever downloads. It uses `lftp mirror` in the
# default (remote -> local) direction. It never uses `mirror -R`, `put`,
# `rm`, or `chmod`, so it cannot alter the production server. The legacy
# site must keep serving throughout the migration.
#
# Credentials live OUTSIDE this repo. Create ~/im2-legacy/credentials.env:
#
#   LEGACY_HOST=174.142.205.9
#   LEGACY_USER=immeublesmontria
#   LEGACY_PASS='...'
#
#   chmod 600 ~/im2-legacy/credentials.env
#
# Usage:
#   scripts/legacy-pull.sh critical   # small high-value config/code files
#   scripts/legacy-pull.sh source     # full app source, excluding bulk
#   scripts/legacy-pull.sh tree       # remote directory listing only
set -euo pipefail

CRED="$HOME/im2-legacy/credentials.env"
DEST="$HOME/im2-legacy/source"
LOGDIR="$HOME/im2-legacy/logs"

[ -f "$CRED" ] || { echo "✗ missing $CRED (see header of this script)"; exit 1; }
# shellcheck disable=SC1090
source "$CRED"
: "${LEGACY_HOST:?}" "${LEGACY_USER:?}" "${LEGACY_PASS:?}"

mkdir -p "$DEST" "$LOGDIR"
MODE="${1:-critical}"

# lftp settings: verify nothing, follow no symlinks off-tree, be gentle on a
# live production host (limited parallelism).
COMMON="set sftp:auto-confirm yes;
set net:timeout 20;
set net:max-retries 2;
set mirror:parallel-transfer-count 2;
set xfer:clobber on;
open -u \"\$LEGACY_USER\",\"\$LEGACY_PASS\" sftp://\$LEGACY_HOST;"

run_lftp() {
  lftp -c "set sftp:auto-confirm yes;
set net:timeout 20;
set net:max-retries 2;
set mirror:parallel-transfer-count 2;
open -u '${LEGACY_USER}','${LEGACY_PASS}' sftp://${LEGACY_HOST};
$1"
}

case "$MODE" in
  tree)
    echo "→ remote listing (depth 2)"
    run_lftp "cls -l /home/${LEGACY_USER}/;
              echo '--- public_html:';
              cls -l /home/${LEGACY_USER}/public_html/;
              echo '--- public_html/app:';
              cls -l /home/${LEGACY_USER}/public_html/app/;"
    ;;

  critical)
    # The files that explain the Centris connection and the app's shape.
    # Small, fast, and the whole point of the exercise.
    echo "→ pulling critical config/code into $DEST"
    run_lftp "
      lcd $DEST;
      cd /home/${LEGACY_USER}/public_html;
      mget -O $DEST .env composer.json composer.lock artisan || true;
      mirror --no-perms --verbose app/Console      $DEST/app/Console;
      mirror --no-perms --verbose routes           $DEST/routes;
      mirror --no-perms --verbose config           $DEST/config;
      mirror --no-perms --verbose app/Models       $DEST/app/Models  || true;
      mirror --no-perms --verbose database/migrations $DEST/database/migrations || true;
    " 2>&1 | tee "$LOGDIR/critical.log"
    ;;

  source)
    # Full application source minus dependency trees, caches, and the
    # multi-gigabyte image directories (we already serve Centris photos
    # directly, so local copies of them are not needed for study).
    echo "→ mirroring app source into $DEST (excluding bulk)"
    run_lftp "
      mirror --no-perms --continue --verbose \
        --exclude-glob vendor/ \
        --exclude-glob node_modules/ \
        --exclude-glob .git/ \
        --exclude-glob storage/framework/ \
        --exclude-glob storage/debugbar/ \
        --exclude-glob images/ \
        --exclude-glob public/images/ \
        --exclude-glob '*.zip' --exclude-glob '*.tar.gz' --exclude-glob '*.sql' \
        /home/${LEGACY_USER}/public_html $DEST/public_html;
    " 2>&1 | tee "$LOGDIR/source.log"
    ;;

  logs)
    echo "→ pulling Laravel logs (diagnoses the two 500-ing listings)"
    run_lftp "
      mirror --no-perms --verbose \
        /home/${LEGACY_USER}/public_html/storage/logs $DEST/storage-logs;
    " 2>&1 | tee "$LOGDIR/applogs.log"
    ;;

  *)
    echo "usage: $0 {tree|critical|source|logs}"; exit 2;;
esac

echo "✓ done — files under $DEST (never committed; see .gitignore)"
