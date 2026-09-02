#!/usr/bin/env bash
# vps-deploy.sh — run on the VPS as a non-root user with sudo.
#
# What it does:
#   1. Pulls the latest code from origin/main.
#   2. Installs Node deps (npm ci --omit=dev).
#   3. Ensures data/ and uploads/ exist (both gitignored).
#   4. Restarts the app under pm2, using ecosystem.config.cjs (or server.js).
#   5. Waits for HTTP 200 on /api/health and the storefront /, then prints the URLs.
#
# Usage:
#   APP_DIR=/var/www/gift_website ./deploy/vps-deploy.sh
#   APP_DIR=/var/www/gift_website BRANCH=main ./deploy/vps-deploy.sh
#
# Requirements:
#   - git, node (>= 18), npm, pm2 (installed globally on the VPS).
#   - User has passwordless sudo OR run as root.
#   - Repo is already cloned at $APP_DIR with a configured `origin` remote.

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/gift_website}"
BRANCH="${BRANCH:-main}"
APP_NAME="${APP_NAME:-gift-storefront}"
PORT="${PORT:-3000}"
HOST="${HOST:-0.0.0.0}"
HEALTH_URL="http://127.0.0.1:${PORT}/api/health"
HOME_URL="http://127.0.0.1:${PORT}/"

log() { printf '\033[1;36m[deploy]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[fail]\033[0m %s\n' "$*" >&2; exit 1; }

command -v git  >/dev/null 2>&1 || die 'git is required'
command -v node >/dev/null 2>&1 || die 'node is required (>= 18)'
command -v npm  >/dev/null 2>&1 || die 'npm is required'
command -v pm2  >/dev/null 2>&1 || die 'pm2 is required (npm i -g pm2)'

[ -d "$APP_DIR" ] || die "APP_DIR does not exist: $APP_DIR (clone the repo there first)"
cd "$APP_DIR"

log "checking out $BRANCH"
# Stash any local-only edits the operator made (e.g. .env, data/) before pulling.
git stash --include-untracked --keep-index --quiet || true
git fetch --prune origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

log "seeding runtime dirs"
mkdir -p data uploads
[ -f uploads/.gitkeep ] || :   # we don't need it; just don't blow up

log "installing deps (production only)"
# If package-lock.json is present, prefer ci for reproducible builds.
if [ -f package-lock.json ]; then
    npm ci --omit=dev
else
    npm install --omit=dev
fi

log "starting app under pm2"
# pm2 ecosystem: prefer the committed ecosystem file if present.
if [ -f ecosystem.config.cjs ] || [ -f ecosystem.config.js ]; then
    pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
    pm2 start ecosystem.config.cjs 2>/dev/null \
        || pm2 start ecosystem.config.js
    # The ecosystem file may declare its own `name:`; if so, that's what pm2
    # actually launched under, not $APP_NAME. Save the dump either way.
else
    pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
    PORT="$PORT" HOST="$HOST" pm2 start server.js --name "$APP_NAME" \
        --time --max-memory-restart 512M
fi

pm2 save >/dev/null

log "waiting for $HEALTH_URL"
for i in $(seq 1 30); do
    if curl -fsS -o /dev/null "$HEALTH_URL"; then
        log "/api/health OK (attempt $i)"
        break
    fi
    sleep 1
    if [ "$i" = 30 ]; then
        pm2 logs "$APP_NAME" --lines 40 --nostream --raw || true
        die "app did not come up within 30s"
    fi
done

log "checking storefront"
code=$(curl -s -o /dev/null -w '%{http_code}' "$HOME_URL")
log "storefront HTTP $code"

log "done"
pm2 status "$APP_NAME" || true
echo
echo "  Storefront     $HOME_URL"
echo "  Seller portal  $HOME_URL"seller
echo "  Control panel  see the brand console message (run: pm2 logs $APP_NAME --lines 5 --nostream)"
