/**
 * routes/public.js — everything the storefront reads. No authentication.
 * Mounted at /api
 */
'use strict';

const express = require('express');

const store = require('../store');
const listings = require('../listings');
const stats = require('../stats');
const { paginate, sortListings, matches, intIn, text } = require('../util');

const router = express.Router();

/* ------------------------------------------------------------------ *
 * Site configuration
 * ------------------------------------------------------------------ */
router.get('/site', (req, res) => {
    const settings = store.readSettings();
    const out = {};
    store.PUBLIC_SETTING_KEYS.forEach((key) => { out[key] = settings[key]; });

    out.games = store.GAMES;
    out.adSlots = store.AD_SLOTS.map((s) => ({ id: s.id, ratio: s.ratio }));
    res.json(out);
});

router.get('/health', (req, res) => res.json({ ok: true, uptime: Math.round(process.uptime()) }));

/* ------------------------------------------------------------------ *
 * Listings
 * ------------------------------------------------------------------ */
function liveCatalogue() {
    const users = store.readUsers();
    const sellerById = new Map(users.map((u) => [u.id, u]));
    const live = listings.publicListings(store.readListings(), users);
    return { live, sellerById };
}

router.get('/listings', (req, res) => {
    const settings = store.readSettings();
    const { q, game, status, sort, minPrice, maxPrice, seller, page, limit } = req.query;
    const { live, sellerById } = liveCatalogue();

    let result = live;

    if (game && store.GAME_IDS.includes(game)) result = result.filter((l) => l.game === game);

    if (status && store.LISTING_STATUSES.includes(status)) {
        result = result.filter((l) => l.status === status);
    } else {
        result = result.filter((l) => l.status !== 'sold');
    }

    if (seller) {
        const target = String(seller).toLowerCase();
        result = result.filter((l) => {
            const s = sellerById.get(l.sellerId);
            return s && (s.username.toLowerCase() === target || s.id === seller);
        });
    }

    if (q) {
        const raw = String(q).trim();
        const lower = raw.toLowerCase();
        result = result.filter((l) =>
            matches(l.title_en, lower, raw)
            || matches(l.title_mm, lower, raw)
            || matches(l.highlights, lower, raw)
            || matches(l.description_en, lower, raw)
            || matches(l.description_mm, lower, raw));
    }

    if (minPrice) result = result.filter((l) => l.price >= Number(minPrice));
    if (maxPrice) result = result.filter((l) => l.price <= Number(maxPrice));

    result = sortListings(result, sort);

    const perPage = intIn(limit, 3, 48, settings.pageSize || 12);
    const paged = paginate(result, page, perPage);
    paged.items = paged.items.map((l) => listings.withSeller(l, sellerById));
    res.json(paged);
});

router.get('/listings/:id', (req, res) => {
    const { live, sellerById } = liveCatalogue();
    const found = live.find((l) => l.id === req.params.id);
    if (!found) return res.status(404).json({ error: 'Listing not found' });
    stats.bump(found.id, 'views', req.ip);
    const out = listings.withSeller(found, sellerById);
    if (out.seller) out.seller.listingCount = live.filter((l) => l.sellerId === found.sellerId && l.status !== 'sold').length;
    return res.json(out);
});

/** A buyer tapped one of the seller's contact buttons on a listing. */
router.post('/listings/:id/contact', (req, res) => {
    const { live } = liveCatalogue();
    if (live.some((l) => l.id === req.params.id)) stats.bump(req.params.id, 'contacts', req.ip);
    res.status(204).end();
});

/* ------------------------------------------------------------------ *
 * Suggestions — the "recommend something" box on the guide page.
 * Read by admins in the panel. Anonymous, so keep it cheap to abuse-proof:
 * a hidden honeypot field and a per-IP hourly cap.
 * ------------------------------------------------------------------ */
const SUGGESTION_TOPICS = ['feature', 'game', 'payment', 'problem', 'other'];
const SUGGESTION_LIMIT = 5;
const suggestionHits = new Map();

router.post('/suggestions', (req, res) => {
    const body = req.body || {};
    if (text(body.website, 50)) return res.status(204).end(); // bots fill every field

    const now = Date.now();
    const key = req.ip || 'unknown';
    const hit = suggestionHits.get(key);
    if (hit && now < hit.resetAt && hit.count >= SUGGESTION_LIMIT) {
        return res.status(429).json({ error: 'Too many messages. Please try again later.' });
    }

    const message = text(body.message, 1000);
    if (message.length < 5) return res.status(400).json({ error: 'Please write a little more.' });

    if (!hit || now >= hit.resetAt) suggestionHits.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
    else hit.count += 1;
    if (suggestionHits.size > 5000) suggestionHits.clear();

    const list = store.readSuggestions();
    list.unshift({
        id: store.newId(),
        topic: SUGGESTION_TOPICS.includes(body.topic) ? body.topic : 'other',
        message,
        name: text(body.name, 60),
        contact: text(body.contact, 100),
        lang: body.lang === 'mm' ? 'mm' : 'en',
        read: false,
        createdAt: now,
    });
    store.writeSuggestions(list.slice(0, 2000));
    return res.status(201).json({ ok: true });
});

/** Counts per game, used by the storefront category rail. */
router.get('/catalogue', (req, res) => {
    const { live } = liveCatalogue();
    const open = live.filter((l) => l.status !== 'sold');
    const counts = {};
    store.GAME_IDS.forEach((id) => { counts[id] = 0; });
    open.forEach((l) => { counts[l.game] = (counts[l.game] || 0) + 1; });

    res.json({
        total: open.length,
        counts,
        sellers: store.readUsers().filter((u) => u.role === 'reseller' && store.sellerIsPublic(u)).length,
        games: store.GAMES,
    });
});

/* ------------------------------------------------------------------ *
 * Sellers — public storefronts (shareable links)
 * ------------------------------------------------------------------ */
router.get('/sellers', (req, res) => {
    const users = store.readUsers();
    const all = listings.publicListings(store.readListings(), users);

    const rows = users
        .filter((u) => u.role === 'reseller' && store.sellerIsPublic(u))
        .map((u) => {
            const mine = all.filter((l) => l.sellerId === u.id && l.status !== 'sold');
            const games = [...new Set(mine.map((l) => l.game))];
            return { ...store.publicUser(u), listingCount: mine.length, games };
        })
        .sort((a, b) => (b.featured - a.featured) || (b.listingCount - a.listingCount));

    res.json({ items: rows, total: rows.length });
});

router.get('/sellers/:username', (req, res) => {
    const users = store.readUsers();
    const target = String(req.params.username).toLowerCase();
    const seller = users.find((u) => u.username.toLowerCase() === target && store.sellerIsPublic(u));
    if (!seller) return res.status(404).json({ error: 'Seller not found' });

    const mine = listings.publicListings(store.readListings(), users)
        .filter((l) => l.sellerId === seller.id);

    return res.json({
        seller: store.publicUser(seller),
        stats: {
            total: mine.filter((l) => l.status !== 'sold').length,
            sold: mine.filter((l) => l.status === 'sold').length,
            games: [...new Set(mine.map((l) => l.game))],
        },
        items: sortListings(mine.filter((l) => l.status !== 'sold'), req.query.sort),
    });
});

/* ------------------------------------------------------------------ *
 * Blog
 * ------------------------------------------------------------------ */
function publishedPosts() {
    return store.readPosts()
        .filter((p) => p.status === 'published')
        .sort((a, b) => (b.publishedAt || b.createdAt) - (a.publishedAt || a.createdAt));
}

router.get('/posts', (req, res) => {
    const perPage = intIn(req.query.limit, 3, 24, 9);
    const list = publishedPosts().map((p) => ({
        id: p.id,
        slug: p.slug,
        title_en: p.title_en,
        title_mm: p.title_mm,
        excerpt_en: p.excerpt_en,
        excerpt_mm: p.excerpt_mm,
        cover: p.cover,
        tag: p.tag,
        publishedAt: p.publishedAt || p.createdAt,
    }));
    res.json(paginate(list, req.query.page, perPage));
});

router.get('/posts/:slug', (req, res) => {
    const post = publishedPosts().find((p) => p.slug === req.params.slug);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const related = publishedPosts()
        .filter((p) => p.slug !== post.slug)
        .slice(0, 3)
        .map((p) => ({ slug: p.slug, title_en: p.title_en, title_mm: p.title_mm, cover: p.cover }));

    return res.json({ post, related });
});

/* ------------------------------------------------------------------ *
 * Advertising slots
 * ------------------------------------------------------------------ */
router.get('/ads', (req, res) => {
    const ads = store.readAds();
    const settings = store.readSettings();
    const out = {};

    store.AD_SLOTS.forEach((slot) => {
        const ad = ads[slot.id];
        // A slot with no active campaign still renders — as an invitation to
        // advertise — so the layout never collapses and the space keeps selling.
        out[slot.id] = ad && ad.enabled && (ad.image || ad.title)
            ? { filled: true, title: ad.title, subtitle: ad.subtitle, image: ad.image, link: ad.link }
            : { filled: false };
    });

    res.json({ slots: out, contact: settings.adsContact, note: settings.adsNote });
});

/* ------------------------------------------------------------------ *
 * Subscription plans (shown on the "sell with us" page)
 * ------------------------------------------------------------------ */
router.get('/plans', (req, res) => {
    const settings = store.readSettings();
    res.json({
        plans: store.readPlans(),
        currencySymbol: settings.currencySymbol,
        currency: settings.currency,
        pitch: settings.sellerPitch,
    });
});

module.exports = router;
