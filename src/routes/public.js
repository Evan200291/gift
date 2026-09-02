/**
 * routes/public.js — everything the storefront reads. No authentication.
 * Mounted at /api
 */
'use strict';

const express = require('express');

const store = require('../store');
const listings = require('../listings');
const { paginate, sortListings, matches, intIn } = require('../util');

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
    return res.json(listings.withSeller(found, sellerById));
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
