#!/usr/bin/env bash
# vps-bootstrap.sh — one-time setup on a fresh VPS. Run as root or with sudo.
#
# What it does:
#   1. Installs Node 20.x (via NodeSource), nginx (reverse proxy + static
#      caching for /css /js /img), and pm2 (global npm).
#   2. Creates an unprivileged `app` user, sets up /var/www/gift_website owned
#      by that user.
#   3. Clones the repo from $REPO_URL.
#   4. Configures nginx as a reverse proxy to 127.0.0.1:3000 with HTTPS-ready
#      server block (TLS certs are still YOUR job — `certbot --nginx`).
#   5. Configures pm2 to start on boot.
#
# Usage (as root):
#   REPO_URL=https://github.com/Evan200291/gift.git \
#   DOMAIN=shop.example.com \
#   ./deploy/vps-bootstrap.sh
#
# Re-run safely: it skips steps that are already in place.

set -euo pipefail

REPO_URL="${REPO_URL:?REPO_URL is required, e.g. https://github.com/Evan200291/gift.git}"
DOMAIN="${DOMAIN:-localhost}"
APP_USER="${APP_USER:-app}"
APP_DIR="/var/www/gift_website"
NODE_MAJOR="${NODE_MAJOR:-20}"

log()  { printf '\033[1;36m[bootstrap]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[fail]\033[0m %s\n' "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

[ "$(id -u)" = "0" ] || die 'must run as root (or via sudo)'

# ---- 1. system packages ----
log "apt update + base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git ca-certificates gnupg ufw >/dev/null

if ! have node; then
    log "installing Node ${NODE_MAJOR}.x"
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null
    apt-get install -y -qq nodejs >/dev/null
else
    log "node already present: $(node -v)"
fi

if ! have npm; then die 'npm missing after node install — check nodesource output' ; fi

if ! have pm2; then
    log "installing pm2 globally"
    npm install -g pm2 >/dev/null
else
    log "pm2 already present: $(pm2 -v)"
fi

if ! have nginx; then
    log "installing nginx"
    apt-get install -y -qq nginx >/dev/null
    systemctl enable --now nginx
else
    log "nginx already present: $(nginx -v 2>&1)"
fi

# ---- 2. app user + directory ----
if ! id "$APP_USER" >/dev/null 2>&1; then
    log "creating user $APP_USER"
    adduser --system --group --shell /bin/bash "$APP_USER"
fi
mkdir -p "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# ---- 3. clone the repo ----
if [ ! -d "$APP_DIR/.git" ]; then
    log "cloning $REPO_URL into $APP_DIR"
    sudo -u "$APP_USER" git clone "$REPO_URL" "$APP_DIR"
else
    log "repo already cloned at $APP_DIR"
fi

# ---- 4. nginx reverse proxy ----
NGINX_SITE="/etc/nginx/sites-available/gift-storefront"
if [ ! -f "$NGINX_SITE" ]; then
    log "writing nginx site config for $DOMAIN"
    cat > "$NGINX_SITE" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    # Static asset caching
    location ~* \.(?:css|js|jpg|jpeg|png|webp|avif|svg|ico|woff2?)$ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade           \$http_upgrade;
        proxy_set_header Connection        "upgrade";
        proxy_read_timeout 60s;
    }
}
NGINX
    ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/gift-storefront
    # Disable the default site if present.
    rm -f /etc/nginx/sites-enabled/default
    nginx -t
    systemctl reload nginx
else
    log "nginx site already configured"
fi

# ---- 5. firewall (optional, best-effort) ----
if have ufw; then
    ufw allow OpenSSH  >/dev/null || true
    ufw allow 'Nginx Full' >/dev/null || true
    ufw --force enable >/dev/null || true
fi

# ---- 6. first deploy + pm2 startup ----
log "running initial deploy as $APP_USER"
sudo -u "$APP_USER" APP_DIR="$APP_DIR" bash "$APP_DIR/deploy/vps-deploy.sh" || \
    log "first deploy failed — finish manually after reviewing logs"

log "configuring pm2 startup"
# `pm2 startup` prints the systemd unit to enable; capture & run it.
STARTUP_CMD=$(pm2 startup systemd -u "$APP_USER" --hp "/var/$APP_USER" 2>&1 | grep -E '^sudo ' | tail -1 || true)
if [ -n "$STARTUP_CMD" ]; then
    eval "$STARTUP_CMD" || log "could not auto-enable pm2 startup; run: $STARTUP_CMD"
fi
pm2 save >/dev/null

log "done"
echo
echo "  Next steps:"
echo "  - Point DNS A record for $DOMAIN at this server's IP"
echo "  - Run: sudo certbot --nginx -d $DOMAIN  (if you want HTTPS)"
echo "  - Re-deploy any time: APP_DIR=$APP_DIR $APP_DIR/deploy/vps-deploy.sh"
echo "  - Tail logs:         pm2 logs gift-storefront"
