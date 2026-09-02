/**
 * store.js — flat-file persistence layer.
 *
 * Every collection is a JSON file under data/. Writes are atomic
 * (temp file + rename) so a crash mid-write cannot corrupt a file.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const UPLOADS_DIR = path.join(ROOT, 'uploads');
const LOGS_DIR = path.join(ROOT, 'logs');

[DATA_DIR, UPLOADS_DIR, LOGS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const FILES = {
    users: path.join(DATA_DIR, 'users.json'),
    listings: path.join(DATA_DIR, 'listings.json'),
    plans: path.join(DATA_DIR, 'plans.json'),
    posts: path.join(DATA_DIR, 'posts.json'),
    ads: path.join(DATA_DIR, 'ads.json'),
    settings: path.join(DATA_DIR, 'settings.json'),
};

/* ------------------------------------------------------------------ *
 * Catalogue constants
 * ------------------------------------------------------------------ */
const GAMES = [
    { id: 'efootball', name: 'eFootball', short: 'eFootball', icon: '⚽', accent: '#22d3ee' },
    { id: 'mlbb', name: 'Mobile Legends: Bang Bang', short: 'Mobile Legends', icon: '🛡️', accent: '#7c5cff' },
    { id: 'pubg', name: 'PUBG Mobile', short: 'PUBG Mobile', icon: '🎯', accent: '#ffb020' },
    { id: 'freefire', name: 'Free Fire', short: 'Free Fire', icon: '🔥', accent: '#ff5f6d' },
];
const GAME_IDS = GAMES.map((g) => g.id);

const AD_SLOTS = [
    {
        id: 'home-leaderboard',
        name: 'Home — top banner',
        blurb: 'Full-width strip directly under the hero. The most visible slot on the site.',
        ratio: '6 / 1',
        recommended: '1440 × 240',
    },
    {
        id: 'home-inline',
        name: 'Home — inside the listings grid',
        blurb: 'Appears between listing rows, styled like a card so it reads as part of the grid.',
        ratio: '16 / 9',
        recommended: '1280 × 720',
    },
    {
        id: 'listing-sidebar',
        name: 'Listing page — sidebar',
        blurb: 'Sits under the seller contact panel on every listing page.',
        ratio: '4 / 3',
        recommended: '600 × 450',
    },
    {
        id: 'footer',
        name: 'Site-wide — footer banner',
        blurb: 'Shown above the footer on every page of the site.',
        ratio: '6 / 1',
        recommended: '1440 × 240',
    },
];
const AD_SLOT_IDS = AD_SLOTS.map((s) => s.id);

const LISTING_STATUSES = ['available', 'reserved', 'sold'];
const USER_ROLES = ['admin', 'reseller'];
const USER_STATUSES = ['active', 'suspended'];
const POST_STATUSES = ['draft', 'published'];

const DEFAULT_ADMIN_PATH = '/control-8f3a2c';

const DEFAULT_SETTINGS = {
    brand: 'EXABYTE',
    tagline: 'Game Account Marketplace',
    currency: 'MMK',
    currencySymbol: 'Ks',
    pageSize: 12,

    heroTitleEn: 'Buy Game Accounts From Verified Sellers',
    heroTitleMm: 'စိစစ်ပြီး ရောင်းသူများထံမှ ဂိမ်းအကောင့်များ ဝယ်ယူပါ',
    heroSubtitleEn: 'eFootball, Mobile Legends, PUBG Mobile and Free Fire accounts listed by subscribed resellers. Contact any seller directly — no customer sign-up needed.',
    heroSubtitleMm: 'eFootball, Mobile Legends, PUBG Mobile နှင့် Free Fire အကောင့်များကို စာရင်းသွင်းထားသော ရောင်းသူများထံမှ တိုက်ရိုက်ဝယ်ယူနိုင်ပါသည်။ ဝယ်သူများ အကောင့်ဖွင့်ရန် မလိုအပ်ပါ။',

    // Platform-level contacts (shown in the footer and on the "sell with us" page)
    contactTelegram: '',
    contactFacebook: '',
    contactEmail: '',
    contactPhone: '',
    contactViber: '',

    // Advertising enquiries
    adsContact: '@snowowlwithlongleg',
    adsNote: 'Reach thousands of mobile gamers every week. Message us on Telegram for rates and availability.',

    // Seller onboarding
    sellerPitch: 'Already reselling accounts? List them here, reach more buyers, and keep 100% of every sale — you only pay a flat monthly subscription.',

    footerNote: '',
    adminPath: DEFAULT_ADMIN_PATH,
};

const PUBLIC_SETTING_KEYS = [
    'brand', 'tagline', 'currency', 'currencySymbol', 'pageSize',
    'heroTitleEn', 'heroTitleMm', 'heroSubtitleEn', 'heroSubtitleMm',
    'contactTelegram', 'contactFacebook', 'contactEmail', 'contactPhone', 'contactViber',
    'adsContact', 'adsNote', 'sellerPitch', 'footerNote',
];

const DEFAULT_PLANS = [
    {
        id: 'starter',
        name: 'Starter',
        days: 30,
        price: 10,
        listingLimit: 10,
        blurb: 'For sellers just getting started.',
        order: 1,
    },
    {
        id: 'pro',
        name: 'Pro',
        days: 30,
        price: 25,
        listingLimit: 40,
        blurb: 'For active resellers with steady stock.',
        order: 2,
    },
    {
        id: 'elite',
        name: 'Elite',
        days: 90,
        price: 60,
        listingLimit: 0,
        blurb: 'Unlimited listings, billed quarterly.',
        order: 3,
    },
];

/* ------------------------------------------------------------------ *
 * Atomic JSON helpers
 * ------------------------------------------------------------------ */
function readFile(file, fallback) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return fallback;
    }
}

function writeFile(file, value) {
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(tmp, file);
}

const readList = (key) => {
    const list = readFile(FILES[key], []);
    return Array.isArray(list) ? list : [];
};
const writeList = (key, list) => writeFile(FILES[key], list);

const readUsers = () => readList('users');
const writeUsers = (l) => writeList('users', l);
const readListings = () => readList('listings');
const writeListings = (l) => writeList('listings', l);
const readPosts = () => readList('posts');
const writePosts = (l) => writeList('posts', l);
const readPlans = () => {
    const list = readList('plans');
    return list.length ? list.slice().sort((a, b) => (a.order || 0) - (b.order || 0)) : DEFAULT_PLANS;
};
const writePlans = (l) => writeList('plans', l);

const readSettings = () => ({ ...DEFAULT_SETTINGS, ...readFile(FILES.settings, {}) });
const writeSettings = (s) => writeFile(FILES.settings, s);

function readAds() {
    const stored = readFile(FILES.ads, {});
    const out = {};
    AD_SLOTS.forEach((slot) => {
        const saved = (stored && stored[slot.id]) || {};
        out[slot.id] = {
            enabled: Boolean(saved.enabled),
            title: saved.title || '',
            subtitle: saved.subtitle || '',
            image: saved.image || '',
            link: saved.link || '',
            updatedAt: saved.updatedAt || 0,
        };
    });
    return out;
}
function writeAds(ads) { writeFile(FILES.ads, ads); }

const newId = (bytes) => crypto.randomBytes(bytes || 8).toString('hex');

/* ------------------------------------------------------------------ *
 * Subscription helpers
 * ------------------------------------------------------------------ */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Derive live subscription state for a user.
 * Admins are always "active" and never expire.
 */
function subscriptionState(user) {
    if (!user) return { active: false, daysLeft: 0, expired: true, paid: false, plan: null };
    if (user.role === 'admin') {
        return { active: true, daysLeft: Infinity, expired: false, paid: true, plan: null, unlimited: true };
    }

    const sub = user.subscription || {};
    const expiresAt = Number(sub.expiresAt) || 0;
    const paid = Boolean(sub.paid);
    const now = Date.now();
    const msLeft = expiresAt - now;
    const daysLeft = expiresAt ? Math.max(0, Math.ceil(msLeft / DAY_MS)) : 0;
    const expired = !expiresAt || msLeft <= 0;

    return {
        plan: sub.plan || null,
        planName: sub.planName || '',
        paid,
        expiresAt,
        startedAt: Number(sub.startedAt) || 0,
        daysLeft,
        expired,
        expiringSoon: !expired && daysLeft <= 5,
        listingLimit: Number(sub.listingLimit) || 0,
        active: paid && !expired && user.status === 'active',
    };
}

/** A seller's listings are only public while their subscription is active. */
function sellerIsPublic(user) {
    if (!user) return false;
    if (user.role === 'admin') return user.status === 'active';
    return subscriptionState(user).active;
}

/** Strip secrets before a user object leaves the server. */
function publicUser(user) {
    if (!user) return null;
    return {
        id: user.id,
        username: user.username,
        displayName: user.displayName || user.username,
        role: user.role,
        status: user.status,
        bio_en: user.bio_en || '',
        bio_mm: user.bio_mm || '',
        contacts: user.contacts || {},
        avatar: user.avatar || null,
        verified: Boolean(user.verified),
        featured: Boolean(user.featured),
        createdAt: user.createdAt,
    };
}

/** Admin view: everything except the password hash. */
function adminUser(user) {
    if (!user) return null;
    const { password, ...rest } = user;
    return { ...rest, subscriptionState: subscriptionState(user) };
}

/* ------------------------------------------------------------------ *
 * Seeding + migration
 * ------------------------------------------------------------------ */
function seed(hashPassword) {
    if (!fs.existsSync(FILES.settings)) writeSettings({ ...DEFAULT_SETTINGS });
    if (!fs.existsSync(FILES.plans)) writePlans(DEFAULT_PLANS);
    if (!fs.existsSync(FILES.posts)) writePosts([]);
    if (!fs.existsSync(FILES.ads)) writeAds(readAds());
    if (!fs.existsSync(FILES.listings)) writeListings([]);

    let users = readUsers();
    if (!users.some((u) => u.role === 'admin')) {
        users.push({
            id: newId(),
            role: 'admin',
            username: process.env.ADMIN_USER || 'exabyte',
            displayName: 'Administrator',
            password: hashPassword(process.env.ADMIN_PASS || 'exabyte'),
            status: 'active',
            tokenVersion: 1,
            contacts: {},
            createdAt: Date.now(),
        });
        writeUsers(users);
    }

    migrateLegacyAccounts(users);
}

/**
 * Older single-seller builds stored listings in data/accounts.json and the
 * admin in data/admin.json. Fold both into the new collections once.
 */
function migrateLegacyAccounts(users) {
    const legacyFile = path.join(DATA_DIR, 'accounts.json');
    if (!fs.existsSync(legacyFile)) return;

    const legacy = readFile(legacyFile, []);
    if (!Array.isArray(legacy) || !legacy.length) {
        try { fs.renameSync(legacyFile, `${legacyFile}.migrated`); } catch { /* ignore */ }
        return;
    }

    const admin = users.find((u) => u.role === 'admin');
    const listings = readListings();
    const existing = new Set(listings.map((l) => l.id));

    legacy.forEach((old) => {
        if (existing.has(old.id)) return;
        const images = Array.isArray(old.images) ? old.images : [];
        listings.push({
            id: old.id || newId(),
            sellerId: admin ? admin.id : '',
            game: 'efootball',
            title_en: old.title_en || '',
            title_mm: old.title_mm || '',
            description_en: old.description_en || '',
            description_mm: old.description_mm || '',
            price: Number(old.price) || 0,
            status: LISTING_STATUSES.includes(old.status) ? old.status : 'available',
            featured: Boolean(old.featured),
            level: old.overall_rating || '',
            currency_amount: old.coins || '',
            highlights: old.featured_players || '',
            contact_note: old.contact_info || '',
            images,
            thumbs: Array.isArray(old.thumbs) && old.thumbs.length === images.length ? old.thumbs : images,
            createdAt: old.createdAt || Date.now(),
            updatedAt: old.updatedAt || Date.now(),
        });
    });

    writeListings(listings);
    try { fs.renameSync(legacyFile, `${legacyFile}.migrated`); } catch { /* ignore */ }
    console.log(`[migrate] imported ${legacy.length} legacy listing(s) into listings.json`);
}

module.exports = {
    ROOT, DATA_DIR, UPLOADS_DIR, LOGS_DIR, FILES,
    GAMES, GAME_IDS, AD_SLOTS, AD_SLOT_IDS,
    LISTING_STATUSES, USER_ROLES, USER_STATUSES, POST_STATUSES,
    DEFAULT_SETTINGS, PUBLIC_SETTING_KEYS, DEFAULT_PLANS, DEFAULT_ADMIN_PATH,
    DAY_MS,
    readUsers, writeUsers,
    readListings, writeListings,
    readPosts, writePosts,
    readPlans, writePlans,
    readSettings, writeSettings,
    readAds, writeAds,
    newId, seed,
    subscriptionState, sellerIsPublic, publicUser, adminUser,
};
