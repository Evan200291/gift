/**
 * routes/seller.js — the reseller portal API.
 * Mounted at /api/seller (every route requires a signed-in user).
 *
 * Resellers manage only their own listings. Subscription state gates
 * publishing, not reading: an expired seller can still see and edit their
 * catalogue, it simply stops appearing on the storefront until they renew.
 */
'use strict';

const express = require('express');

const store = require('../store');
const auth = require('../auth');
const images = require('../images');
const listings = require('../listings');
const { text, paginate, sortListings, matches, intIn, wrap } = require('../util');

const router = express.Router();

router.use(auth.requireUser);

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */
function myListings(userId) {
    return store.readListings().map(listings.shape).filter((l) => l.sellerId === userId);
}

function listingLimitFor(user) {
    if (user.role === 'admin') return 0; // unlimited
    const state = store.subscriptionState(user);
    return Number(state.listingLimit) || 0; // 0 = unlimited
}

/** Public URL of a listing, so the seller can copy/share it. */
function shareUrl(req, listing) {
    const proto = req.get('x-forwarded-proto') || req.protocol;
    return `${proto}://${req.get('host')}/listing/${listing.id}`;
}

/* ------------------------------------------------------------------ *
 * Overview
 * ------------------------------------------------------------------ */
router.get('/overview', (req, res) => {
    const mine = myListings(req.user.id);
    const subscription = store.subscriptionState(req.user);
    const limit = listingLimitFor(req.user);

    const byGame = {};
    store.GAME_IDS.forEach((id) => { byGame[id] = 0; });
    mine.forEach((l) => { byGame[l.game] = (byGame[l.game] || 0) + 1; });

    const proto = req.get('x-forwarded-proto') || req.protocol;

    res.json({
        subscription,
        plans: store.readPlans(),
        games: store.GAMES,
        storeUrl: `${proto}://${req.get('host')}/store/${req.user.username}`,
        limit,
        counts: {
            total: mine.length,
            available: mine.filter((l) => l.status === 'available').length,
            reserved: mine.filter((l) => l.status === 'reserved').length,
            sold: mine.filter((l) => l.status === 'sold').length,
            byGame,
            remaining: limit ? Math.max(0, limit - mine.filter((l) => l.status !== 'sold').length) : null,
        },
        revenue: mine.filter((l) => l.status === 'sold').reduce((n, l) => n + l.price, 0),
        stockValue: mine.filter((l) => l.status !== 'sold').reduce((n, l) => n + l.price, 0),
    });
});

/* ------------------------------------------------------------------ *
 * Listings — the seller's own catalogue, filterable by every category
 * ------------------------------------------------------------------ */
router.get('/listings', (req, res) => {
    const { q, game, status, sort, page, limit } = req.query;
    let mine = myListings(req.user.id);

    if (game && store.GAME_IDS.includes(game)) mine = mine.filter((l) => l.game === game);
    if (status && store.LISTING_STATUSES.includes(status)) mine = mine.filter((l) => l.status === status);

    if (q) {
        const raw = String(q).trim();
        const lower = raw.toLowerCase();
        mine = mine.filter((l) =>
            matches(l.title_en, lower, raw)
            || matches(l.title_mm, lower, raw)
            || matches(l.highlights, lower, raw));
    }

    mine = sortListings(mine, sort);
    const paged = paginate(mine, page, intIn(limit, 3, 48, 12));
    paged.items = paged.items.map((l) => ({ ...l, shareUrl: shareUrl(req, l) }));
    res.json(paged);
});

router.post(
    '/listings',
    auth.requireActiveSubscription,
    images.uploader.array('images', listings.MAX_IMAGES),
    wrap(async (req, res) => {
        const mine = myListings(req.user.id);
        const limit = listingLimitFor(req.user);
        if (limit && mine.filter((l) => l.status !== 'sold').length >= limit) {
            return res.status(403).json({
                error: `Your plan allows ${limit} active listings. Mark one as sold or upgrade your plan.`,
            });
        }

        const draft = listings.shape({
            ...listings.applyBody(req.body || {}, null, { allowFeatured: false }),
            id: store.newId(),
            sellerId: req.user.id,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        const problem = listings.validate(draft);
        if (problem) return res.status(400).json({ error: problem });

        const stored = await images.storeMany(req.files, 'listing');
        draft.images = stored.map((i) => i.full);
        draft.thumbs = stored.map((i) => i.thumb);

        const all = store.readListings();
        all.push(draft);
        store.writeListings(all);

        return res.status(201).json({ ...draft, shareUrl: shareUrl(req, draft) });
    })
);

router.put(
    '/listings/:id',
    images.uploader.array('images', listings.MAX_IMAGES),
    wrap(async (req, res) => {
        const all = store.readListings();
        const idx = all.findIndex((l) => l.id === req.params.id && l.sellerId === req.user.id);
        if (idx === -1) return res.status(404).json({ error: 'Listing not found' });

        const current = listings.shape(all[idx]);
        const updated = listings.shape({
            ...listings.applyBody(req.body || {}, current, { allowFeatured: false }),
            id: current.id,
            sellerId: current.sellerId,
            featured: current.featured,
            createdAt: current.createdAt,
        });

        const problem = listings.validate(updated);
        if (problem) return res.status(400).json({ error: problem });

        const merged = await mergeImages(req, current, updated);
        merged.updatedAt = Date.now();

        all[idx] = merged;
        store.writeListings(all);
        return res.json({ ...merged, shareUrl: shareUrl(req, merged) });
    })
);

router.delete('/listings/:id', wrap(async (req, res) => {
    const all = store.readListings();
    const idx = all.findIndex((l) => l.id === req.params.id && l.sellerId === req.user.id);
    if (idx === -1) return res.status(404).json({ error: 'Listing not found' });

    const removed = listings.shape(all[idx]);
    all.splice(idx, 1);
    store.writeListings(all);
    await images.remove(removed.images.concat(removed.thumbs));
    return res.json({ ok: true });
}));

/**
 * Reconcile the image set: keep what the client sent back in `keepImages`,
 * append freshly uploaded files, and delete whatever fell out.
 * Shared by the seller and admin listing editors.
 */
async function mergeImages(req, current, updated) {
    let keep = req.body ? req.body.keepImages : undefined;
    if (keep === undefined) keep = current.images;
    if (!Array.isArray(keep)) keep = [keep];
    keep = keep.filter((url) => current.images.includes(url));

    const dropped = current.images.filter((url) => !keep.includes(url));
    const droppedThumbs = dropped
        .map((url) => current.thumbs[current.images.indexOf(url)])
        .filter((url) => url && !keep.includes(url));

    const keptThumbs = keep.map((url) => current.thumbs[current.images.indexOf(url)] || url);
    const stored = await images.storeMany(req.files, 'listing');

    const next = { ...updated };
    next.images = keep.concat(stored.map((i) => i.full)).slice(0, listings.MAX_IMAGES);
    next.thumbs = keptThumbs.concat(stored.map((i) => i.thumb)).slice(0, listings.MAX_IMAGES);

    await images.remove(dropped.concat(droppedThumbs));
    return next;
}

/* ------------------------------------------------------------------ *
 * Profile — the contact details buyers see on every listing
 * ------------------------------------------------------------------ */
router.put('/profile', (req, res) => {
    const users = store.readUsers();
    const idx = users.findIndex((u) => u.id === req.user.id);
    if (idx === -1) return res.status(404).json({ error: 'Account not found' });

    const user = users[idx];
    const body = req.body || {};

    if (body.displayName !== undefined) {
        const name = text(body.displayName, 60);
        if (name.length < 2) return res.status(400).json({ error: 'Display name is too short.' });
        user.displayName = name;
    }
    if (body.bio_en !== undefined) user.bio_en = text(body.bio_en, 400);
    if (body.bio_mm !== undefined) user.bio_mm = text(body.bio_mm, 400);

    user.contacts = user.contacts || {};
    ['telegram', 'facebook', 'email', 'phone', 'viber'].forEach((key) => {
        if (body[key] !== undefined) user.contacts[key] = text(body[key], 200);
    });

    const hasContact = Object.values(user.contacts).some((v) => v);
    if (!hasContact) {
        return res.status(400).json({ error: 'Add at least one contact channel — buyers reach you directly.' });
    }

    users[idx] = user;
    store.writeUsers(users);
    return res.json({ user: store.publicUser(user) });
});

router.put('/password', (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    const users = store.readUsers();
    const idx = users.findIndex((u) => u.id === req.user.id);
    if (idx === -1) return res.status(404).json({ error: 'Account not found' });

    if (!auth.verifyPassword(currentPassword, users[idx].password)) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    const problem = auth.passwordProblem(newPassword);
    if (problem) return res.status(400).json({ error: problem });

    users[idx].password = auth.hashPassword(newPassword);
    users[idx].tokenVersion = (users[idx].tokenVersion || 1) + 1;
    users[idx].mustChangePassword = false;
    store.writeUsers(users);

    const { token, expiresAt } = auth.signToken(users[idx]);
    return res.json({ token, expiresAt });
});

module.exports = { router, mergeImages };
