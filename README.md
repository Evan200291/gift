# ? eFootball Account Reseller

A bilingual (Burmese + English) account-reselling website for eFootball mobile accounts, with an admin panel, 16:9 image uploads, mobile-phone-frame previews, search, and instant contact links.

## ? Features

- **Public storefront** with hero, search bar, and card grid
- **Account detail page** with a slideable mobile-phone-frame image carousel, bilingual fields, and a one-tap Telegram deep link
- **Admin panel** (password-protected) for creating, editing, and deleting listings
- **Bilingual UI** (English + ??????) with a single `I18N` object and language persistence
- **16:9 image enforcement** — every uploaded image is checked server-side (via `sharp`) and client-side before it can be saved. Non-16:9 images are rejected with a clear error.
- **Dark gaming theme** with custom CSS (no framework dependencies)
- **JSON-file persistence** in `data/` — no database required
- **In-memory admin token store** with SHA-256 hashed password

## ?? Tech stack

- **Backend:** Node.js + Express + Multer + sharp (image validation)
- **Frontend:** Vanilla HTML / CSS / JavaScript (no build step)
- **Storage:** `data/accounts.json`, `data/admin.json`, `uploads/*`
- **Process manager:** PM2 (ecosystem config included)

## ?? Quick start (local development)

```bash
cd gift_website
npm install
npm start
```

Then open <http://localhost:3000>.

> Default admin credentials: **username `exabyte`** / **password `exabyte`**

To change the password, go to the **Admin Account** tab in the admin panel, or PUT `/api/admin/account` with `{ currentPassword, newPassword, username }`.

## ??? Deploying to a VPS with PM2

```bash
# 1. Copy the project (without data/ and uploads/) to the VPS
scp -r . user@your-vps:/srv/efootball

# 2. SSH in and install dependencies (one-time)
ssh user@your-vps
cd /srv/efootball
npm install --omit=dev

# 3. Start with PM2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup           # follow the printed command to enable boot autostart
pm2 logs efootball-reseller   # tail logs
```

The ecosystem file (`ecosystem.config.cjs`) configures:
- Auto-restart on crash (up to 10 restarts, 2 s delay, 10 s min uptime)
- Memory cap at 300 MB (process restarts if exceeded)
- Logs to `./logs/out.log` and `./logs/err.log`
- `NODE_ENV=production`, `PORT=3000` (override via env if needed)

Common PM2 commands:
```bash
npm run pm2:restart   # restart the app after a code deploy
npm run pm2:stop      # stop the app
npm run pm2:logs      # tail logs
```

### Reverse proxy (optional)

For HTTPS, run behind nginx and proxy to port 3000. Example `/etc/nginx/sites-available/efootball`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    client_max_body_size 10M;   # match upload limit

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then `certbot --nginx -d your-domain.com` for free TLS.

## ??? Project layout

```
gift_website/
+-- server.js                # Express server (auth, CRUD, 16:9 upload validation)
+-- ecosystem.config.cjs     # PM2 process config
+-- package.json
+-- data/                    # JSON storage (auto-created on first run, gitignored)
¦   +-- accounts.json
¦   +-- admin.json
¦   +-- settings.json
+-- uploads/                 # User-uploaded images (auto-created, gitignored)
¦   +-- .gitkeep
+-- logs/                    # PM2 logs (auto-created, gitignored)
+-- public/                  # Static site served at /
    +-- index.html           # Home / grid
    +-- account.html         # Detail page
    +-- admin.html           # Login + admin panel
    +-- css/style.css        # Dark-gaming theme
    +-- js/app.js            # Shared i18n, helpers, adminFetch
```

## ?? Pages

| Path | Purpose |
|------|---------|
| `/` | Home — hero, search, listing grid |
| `/account.html?id=<id>` | Detail page — phone-frame image carousel, copy contact, Telegram deep link |
| `/admin.html` | Admin login + listing management |

## ?? API reference

All admin endpoints require an `x-admin-token` header obtained from `/api/admin/login`.

### Public

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/site` | Site settings (brand, hero, page size, currency) |
| `GET`  | `/api/accounts` | List accounts (supports `?q=`, `?minPrice=`, `?maxPrice=`, `?page=`, `?limit=`) |
| `GET`  | `/api/accounts/:id` | Get a single account |

### Admin

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/admin/login` | Body `{ username, password }` ? `{ token, username }` |
| `POST` | `/api/admin/logout` | Invalidate current token |
| `GET`  | `/api/admin/me` | Current admin username |
| `GET`  | `/api/admin/accounts` | List all accounts (admin view, pagination) |
| `POST` | `/api/admin/accounts` | Create account (multipart with `images[]` files; **must be 16:9**) |
| `PUT`  | `/api/admin/accounts/:id` | Update account (JSON or multipart) |
| `DELETE` | `/api/admin/accounts/:id` | Delete account and its images |
| `GET`  | `/api/admin/settings` | Get site settings + admin username |
| `PUT`  | `/api/admin/settings` | Update site settings |
| `PUT`  | `/api/admin/account` | Change admin username and/or password |

### Account fields

`title_en`, `title_mm`, `description_en`, `description_mm`, `price` (number), `status` (`available` | `reserved` | `sold`), `featured_players`, `overall_rating`, `coins`, `contact_info`.

### Image requirements

- **Aspect ratio:** 16:9 (e.g. 1920×1080, 1280×720, 1280×800 — anything within 1 % of 1.778:1 is accepted)
- **Max size:** 5 MB per file
- **Formats:** JPG, PNG, WebP, GIF
- **Max count:** 5 images per account

Non-16:9 images are rejected with HTTP 400 and the files are removed from disk before the response is sent.

## ?? Verifying it works

```bash
# 1. Start the server
npm start

# 2. Login (from another terminal)
curl -X POST http://localhost:3000/api/admin/login \
     -H "Content-Type: application/json" \
     -d "{\"username\":\"exabyte\",\"password\":\"exabyte\"}"
# ? {"token":"...","username":"exabyte","isSingleAdmin":true}

# 3. Use the token
curl http://localhost:3000/api/admin/accounts -H "x-admin-token: <token>"

# 4. Public listing
curl http://localhost:3000/api/accounts
```

## ?? Internationalization

`public/js/app.js` exports a single `I18N` object with `en` and `mm` keys. Burmese text uses the **Myanmar Text / Pyidaungsu** web-safe fonts (declared in `css/style.css`). The selected language is stored in `localStorage` under `ef_lang` and a `langchange` event is dispatched so dynamic content re-renders on switch.

## ??? Security notes

- The admin password is stored as a SHA-256 hash in `data/admin.json`.
- Tokens are in-memory only (re-login required after server restart).
- Image uploads are validated by file extension **and** aspect ratio (16:9, server-side via `sharp`).
- For production, place this behind HTTPS (nginx + Let's Encrypt) and consider replacing the in-memory token store with JWTs or session cookies.


## ?? Deploying to a VPS

Two scripts in `deploy/`. Both are idempotent and safe to re-run.

### One-time bootstrap (fresh VPS, run as root)

```bash
# 1. SSH in as root
ssh root@your.server

# 2. Upload the project somewhere first, then run:
REPO_URL=https://github.com/Evan200291/gift.git \
DOMAIN=shop.example.com \
bash ./deploy/vps-bootstrap.sh
```

What it does:
- Installs Node 20.x, nginx, pm2, and ufw.
- Creates an unprivileged `app` user.
- Clones the repo into `/var/www/gift_website`.
- Writes an nginx site that reverse-proxies `127.0.0.1:3000` and caches static assets.
- Configures `pm2 startup` so the app comes back on reboot.
- Opens SSH + HTTP(S) in ufw.

### Every deploy after that

```bash
# As the `app` user (or with sudo):
APP_DIR=/var/www/gift_website ./deploy/vps-deploy.sh
```

What it does:
- `git pull --ff-only origin main`
- `npm ci --omit=dev`
- `pm2 start ecosystem.config.cjs` (or `server.js` if no ecosystem file)
- Polls `/api/health` until 200, then prints the URLs.

### Useful pm2 commands

```bash
pm2 status                          # process list
pm2 logs gift-storefront            # tail logs
pm2 logs gift-storefront --lines 200 --nostream  # snapshot
pm2 restart gift-storefront         # restart without redeploy
pm2 stop gift-storefront            # stop
pm2 monit                           # live CPU / RAM
```

### TLS

After DNS is pointed at the server:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d shop.example.com
```

### Environment variables

Create `/etc/gift-storefront.env` and source it before deploy, or pass inline:

```bash
PORT=3000 HOST=0.0.0.0 APP_DIR=/var/www/gift_website \
  ./deploy/vps-deploy.sh
```

The store auto-seeds on first run, so no DB is needed.
