/**
 * eFootball Account Reseller - Server
 * Handles static files, API for accounts CRUD, image uploads, admin auth,
 * site configuration, and pagination.
 */
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
// sharp is required so we can enforce a 16:9 aspect ratio on every upload.
// Fail fast at startup if it's missing rather than silently accepting any size.
let sharp;
try {
    sharp = require('sharp');
} catch (err) {
    console.error('\n[boot] ERROR: The "sharp" module is required for image uploads (16:9 validation).');
    console.error('       Run "npm install" on the server before starting the app.\n');
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Paths ----------
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const ADMIN_FILE = path.join(DATA_DIR, 'admin.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

[DATA_DIR, UPLOADS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ---------- Default site settings ----------
const DEFAULT_SETTINGS = {
    brand: 'eFootball Store',
    tagline: 'Premium Mobile Accounts',
    currency: 'USD',
    currencySymbol: '$',
    pageSize: 12,
    heroTitleEn: 'Buy & Sell eFootball Accounts',
    heroTitleMm: 'eFootball အကောင့်များ ဝယ်ယူ/ရောင်းချရန်',
    heroSubtitleEn: 'Browse premium eFootball mobile accounts with legendary players, top stats, and instant delivery. Bilingual listings in English & Burmese.',
    heroSubtitleMm: 'ထူးခြားကောင်းမွန်သော eFootball မိုဘိုင်းအကောင့်များကို ရှာဖွေဝယ်ယူပါ။ အင်္ဂလိပ်နှင့် မြန်မာ ဘာသာဖြင့် ဖော်ပြထားပါသည်။',
    contactInfo: '@yourTelegram',
};

// ---------- Initial JSON files ----------
if (!fs.existsSync(ACCOUNTS_FILE)) {
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(ADMIN_FILE)) {
    const defaultAdmin = {
        username: 'exabyte',
        passwordHash: crypto.createHash('sha256').update('exabyte').digest('hex'),
    };
    fs.writeFileSync(ADMIN_FILE, JSON.stringify(defaultAdmin, null, 2));
}
if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
}


// ---------- Middleware ----------
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(PUBLIC_DIR));

// ---------- Multer setup for image uploads ----------
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const unique = crypto.randomBytes(6).toString('hex');
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${unique}${ext}`);
    },
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 5 },
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) cb(null, true);
        else cb(new Error('Only image files (jpg, jpeg, png, webp, gif) are allowed!'));
    },
});

// Verify every uploaded file is exactly 16:9. If any file in the batch fails,
// the ENTIRE batch is rejected and all disk files are removed — the route
// handler will not commit any of them. We allow a 1% tolerance on the ratio
// so perfectly-cropped 16:9 images from most editors pass.
const ASPECT_TOLERANCE = 0.01; // 1% — ratio 1.7778 ± 0.0178
async function validateAndCleanupUploads(files) {
    const failures = [];
    for (const f of files || []) {
        const full = path.join(__dirname, f);
        try {
            const meta = await sharp(full).metadata();
            if (!meta.width || !meta.height) {
                failures.push({ file: f, reason: 'unreadable image' });
                continue;
            }
            const ratio = meta.width / meta.height;
            if (Math.abs(ratio - 16 / 9) > ASPECT_TOLERANCE) {
                failures.push({
                    file: f,
                    reason: `aspect ratio is ${meta.width}x${meta.height} (${ratio.toFixed(3)}), must be 16:9 (1.778 ± ${(ASPECT_TOLERANCE).toFixed(3)})`,
                });
            }
        } catch (err) {
            failures.push({ file: f, reason: `could not read image: ${err.message}` });
        }
    }
    // Only delete from disk if there's at least one failure. If the whole
    // batch passed validation, keep the files so the route handler can save
    // their paths to the database.
    if (failures.length > 0) {
        for (const f of files || []) {
            const full = path.join(__dirname, f);
            try { if (fs.existsSync(full)) fs.unlinkSync(full); } catch {}
        }
    }
    return failures;
}

// ---------- Helpers ----------
function readAccounts() {
    try { return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8')); }
    catch { return []; }
}
function writeAccounts(accounts) {
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
}
function readAdmin() {
    try { return JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf8')); }
    catch { return null; }
}
function writeAdmin(admin) {
    fs.writeFileSync(ADMIN_FILE, JSON.stringify(admin, null, 2));
}
function readSettings() {
    try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); }
    catch { return { ...DEFAULT_SETTINGS }; }
}
function writeSettings(s) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2));
}
function hashPassword(pw) {
    return crypto.createHash('sha256').update(pw).digest('hex');
}

const tokens = new Set();
function generateToken() {
    return crypto.randomBytes(24).toString('hex');
}
function authMiddleware(req, res, next) {
    const token = req.headers['x-admin-token'];
    if (!token || !tokens.has(token)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

// Pagination helper
function paginate(items, page, limit) {
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(Math.max(1, parseInt(page, 10) || 1), totalPages);
    const start = (safePage - 1) * limit;
    return {
        items: items.slice(start, start + limit),
        page: safePage,
        limit,
        total,
        totalPages,
    };
}

// ---------- API ROUTES ----------

// Public: site settings (brand, hero, page size)
app.get('/api/site', (req, res) => {
    res.json(readSettings());
});

// Public: list all accounts (with optional search/filter and pagination)
app.get('/api/accounts', (req, res) => {
    const accounts = readAccounts();
    const settings = readSettings();
    const { q, minPrice, maxPrice, page, limit } = req.query;
    let result = accounts.filter((a) => a.status !== 'sold');
    if (q) {
        const term = q.toLowerCase();
        result = result.filter((a) =>
            (a.title_en || '').toLowerCase().includes(term) ||
            (a.title_mm || '').includes(q) ||
            (a.description_en || '').toLowerCase().includes(term) ||
            (a.description_mm || '').includes(q)
        );
    }
    if (minPrice) result = result.filter((a) => a.price >= Number(minPrice));
    if (maxPrice) result = result.filter((a) => a.price <= Number(maxPrice));
    result.sort((a, b) => b.createdAt - a.createdAt);
    const useLimit = Math.min(60, Math.max(1, parseInt(limit, 10) || settings.pageSize || 12));
    res.json(paginate(result, page, useLimit));
});

// Public: get a single account
app.get('/api/accounts/:id', (req, res) => {
    const accounts = readAccounts();
    const acc = accounts.find((a) => a.id === req.params.id);
    if (!acc) return res.status(404).json({ error: 'Account not found' });
    res.json(acc);
});

// Admin login
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body || {};
    const admin = readAdmin();
    if (!admin) return res.status(500).json({ error: 'Admin not configured' });
    if (username !== admin.username || hashPassword(password) !== admin.passwordHash) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = generateToken();
    tokens.add(token);
    res.json({ token, username: admin.username, isSingleAdmin: true });
});

app.post('/api/admin/logout', authMiddleware, (req, res) => {
    const token = req.headers['x-admin-token'];
    tokens.delete(token);
    res.json({ ok: true });
});

app.get('/api/admin/me', authMiddleware, (req, res) => {
    const admin = readAdmin();
    res.json({ username: admin.username, isSingleAdmin: true });
});

// Admin: list ALL accounts (including sold), with pagination
app.get('/api/admin/accounts', authMiddleware, (req, res) => {
    const accounts = readAccounts();
    const settings = readSettings();
    accounts.sort((a, b) => b.createdAt - a.createdAt);
    const { page, limit, q, status } = req.query;
    let filtered = accounts;
    if (q) {
        const term = q.toLowerCase();
        filtered = filtered.filter((a) =>
            (a.title_en || '').toLowerCase().includes(term) ||
            (a.title_mm || '').includes(q)
        );
    }
    if (status) filtered = filtered.filter((a) => a.status === status);
    const useLimit = Math.min(60, Math.max(1, parseInt(limit, 10) || settings.pageSize || 12));
    res.json(paginate(filtered, page, useLimit));
});

// Admin: get full settings (including account username — no password)
app.get('/api/admin/settings', authMiddleware, (req, res) => {
    const admin = readAdmin();
    const settings = readSettings();
    res.json({
        ...settings,
        username: admin.username,
    });
});

// Admin: update site settings (brand, hero, page size, currency)
app.put('/api/admin/settings', authMiddleware, (req, res) => {
    const current = readSettings();
    const allowed = [
        'brand', 'tagline', 'currency', 'currencySymbol', 'pageSize',
        'heroTitleEn', 'heroTitleMm', 'heroSubtitleEn', 'heroSubtitleMm',
        'contactInfo',
    ];
    const next = { ...current };
    allowed.forEach((k) => {
        if (req.body[k] !== undefined) {
            if (k === 'pageSize') {
                const n = parseInt(req.body[k], 10);
                if (!isNaN(n) && n >= 3 && n <= 60) next[k] = n;
            } else if (typeof req.body[k] === 'string') {
                next[k] = String(req.body[k]).slice(0, 500);
            }
        }
    });
    writeSettings(next);
    res.json(next);
});

// Admin: change admin username and/or password
app.put('/api/admin/account', authMiddleware, (req, res) => {
    const admin = readAdmin();
    const { username, currentPassword, newPassword } = req.body || {};
    if (!currentPassword || hashPassword(currentPassword) !== admin.passwordHash) {
        return res.status(401).json({ error: 'Current password is incorrect' });
    }
    const next = { ...admin };
    if (username && typeof username === 'string' && username.trim().length >= 3) {
        next.username = username.trim().slice(0, 40);
    }
    if (newPassword && typeof newPassword === 'string') {
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }
        next.passwordHash = hashPassword(newPassword);
    }
    if (next.username === admin.username && next.passwordHash === admin.passwordHash) {
        return res.status(400).json({ error: 'No changes provided' });
    }
    writeAdmin(next);
    res.json({ username: next.username });
});

// Admin: create account (with up to 5 images, all must be 16:9)
app.post('/api/admin/accounts', authMiddleware, upload.array('images', 5), async (req, res) => {
    const files = (req.files || []).map((f) => `/uploads/${f.filename}`);
    if (files.length > 5) {
        for (const f of files) try { fs.unlinkSync(path.join(__dirname, f)); } catch {}
        return res.status(400).json({ error: 'Maximum 5 images allowed' });
    }
    // Enforce 16:9 aspect ratio on every uploaded image
    const failures = await validateAndCleanupUploads(files);
    if (failures.length > 0) {
        return res.status(400).json({
            error: 'All images must be 16:9 aspect ratio. Crop to 16:9 and re-upload.',
            details: failures,
        });
    }

    const {
        title_en = '', title_mm = '', description_en = '', description_mm = '',
        price = 0, status = 'available',
        featured_players = '', overall_rating = '', coins = '', contact_info = '',
    } = req.body || {};

    const accounts = readAccounts();
    const account = {
        id: crypto.randomBytes(8).toString('hex'),
        title_en: title_en.trim(),
        title_mm: title_mm.trim(),
        description_en: description_en.trim(),
        description_mm: description_mm.trim(),
        price: Number(price) || 0,
        status,
        featured_players, overall_rating, coins, contact_info,
        images: files,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    accounts.push(account);
    writeAccounts(accounts);
    res.json(account);
});

// Admin: update account (new images, if any, must be 16:9)
app.put('/api/admin/accounts/:id', authMiddleware, upload.array('images', 5), async (req, res) => {
    const accounts = readAccounts();
    const idx = accounts.findIndex((a) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Account not found' });

    const acc = accounts[idx];
    const fields = ['title_en', 'title_mm', 'description_en', 'description_mm',
        'status', 'featured_players', 'overall_rating', 'coins', 'contact_info'];
    fields.forEach((f) => {
        if (req.body[f] !== undefined) acc[f] = req.body[f];
    });
    if (req.body.price !== undefined) acc.price = Number(req.body.price) || 0;

    const newFiles = (req.files || []).map((f) => `/uploads/${f.filename}`);
    if (newFiles.length > 0) {
        // Validate first — if any are not 16:9, reject the whole update and clean up
        // the new files (and DON'T remove the old images yet).
        const failures = await validateAndCleanupUploads(newFiles);
        if (failures.length > 0) {
            return res.status(400).json({
                error: 'All new images must be 16:9 aspect ratio. Crop to 16:9 and re-upload.',
                details: failures,
            });
        }
        // Validation passed — now safe to delete the old images
        (acc.images || []).forEach((img) => {
            const fp = path.join(__dirname, img);
            if (img.startsWith('/uploads/') && fs.existsSync(fp)) {
                try { fs.unlinkSync(fp); } catch {}
            }
        });
        acc.images = newFiles.slice(0, 5);
    }
    acc.updatedAt = Date.now();
    accounts[idx] = acc;
    writeAccounts(accounts);
    res.json(acc);
});

// Admin: delete account
app.delete('/api/admin/accounts/:id', authMiddleware, (req, res) => {
    const accounts = readAccounts();
    const idx = accounts.findIndex((a) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Account not found' });
    const acc = accounts[idx];
    (acc.images || []).forEach((img) => {
        const fp = path.join(__dirname, img);
        if (img.startsWith('/uploads/') && fs.existsSync(fp)) {
            try { fs.unlinkSync(fp); } catch {}
        }
    });
    accounts.splice(idx, 1);
    writeAccounts(accounts);
    res.json({ ok: true });
});

// ---------- Error handler ----------
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

// ---------- Fallback: serve index.html for any non-API GET ----------
app.get(/^(?!\/api|\/uploads).*/, (req, res) => {
    const requested = req.path === '/' ? '/index.html' : req.path;
    const filePath = path.join(PUBLIC_DIR, requested);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return res.sendFile(filePath);
    }
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n🎮 eFootball Account Reseller running at http://localhost:${PORT}`);
    console.log(`   Admin login: exabyte / exabyte\n   All uploaded images must be 16:9 aspect ratio.\n`);
});
