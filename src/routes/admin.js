/**
 * routes/admin.js — the platform control panel API.
 * Mounted at /api/admin (every route requires an administrator).
 */
'use strict';

const express = require('express');

const store = require('../store');
const auth = require('../auth');
const images = require('../images');
const listings = require('../listings');
const { mergeImages } = require('./seller');
const {
    text, bool, num, intIn, slugify, uniqueSlug,
    paginate, sortListings, matches, wrap,
} = require('../util');

const router = express.Router();

router.use(auth.requireAdmin);

const CONTACT_KEYS = ['telegram', 'facebook', 'email', 'phone', 'viber'];

/* ================================================================== *
 * Dashboard
 * ================================================================== */
router.get('/overview', (req, res) => {
    const users = store.readUsers();
    const all = store.readListings().map(listings.shape);
    const resellers = users.filter((u) => u.role === 'reseller');

    const subs = resellers.map((u) => store.subscriptionState(u));
    const byGame = {};
    store.GAME_IDS.forEach((id) => { byGame[id] = 0; });
    all.forEach((l) => { byGame[l.game] = (byGame[l.game] || 0) + 1; });

    res.json({
        sellers: {
            total: resellers.length,
            active: subs.filter((s) => s.active).length,
            unpaid: subs.filter((s) => !s.paid && !s.expired).length,
            expired: subs.filter((s) => s.expired).length,
            expiringSoon: subs.filter((s) => s.expiringSoon).length,
            suspended: resellers.filter((u) => u.status !== 'active').length,
        },
        listings: {
            total: all.length,
            available: all.filter((l) => l.status === 'available').length,
            reserved: all.filter((l) => l.status === 'reserved').length,
            sold: all.filter((l) => l.status === 'sold').length,
            byGame,
        },
        posts: {
            total: store.readPosts().length,
            published: store.readPosts().filter((p) => p.status === 'published').length,
        },
        ads: {
            total: store.AD_SLOTS.length,
            filled: Object.values(store.readAds()).filter((a) => a.enabled && (a.image || a.title)).length,
        },
        mrr: resellers.reduce((sum, u) => {
            const state = store.subscriptionState(u);
            if (!state.active) return sum;
            const plan = store.readPlans().find((p) => p.id === state.plan);
            if (!plan || !plan.days) return sum;
            return sum + (num(plan.price, 0) * 30) / plan.days;
        }, 0),
        games: store.GAMES,
    });
});

/* ================================================================== *
 * Resellers
 * ================================================================== */
router.get('/sellers', (req, res) => {
    const { q, state, sort, page, limit } = req.query;
    const all = store.readListings().map(listings.shape);

    let rows = store.readUsers()
        .filter((u) => u.role === 'reseller')
        .map((u) => {
            const mine = all.filter((l) => l.sellerId === u.id);
            return {
                ...store.adminUser(u),
                listingCount: mine.length,
                activeCount: mine.filter((l) => l.status !== 'sold').length,
            };
        });

    if (q) {
        const raw = String(q).trim();
        const lower = raw.toLowerCase();
        rows = rows.filter((u) => matches(u.username, lower, raw) || matches(u.displayName, lower, raw));
    }
    if (state === 'active') rows = rows.filter((u) => u.subscriptionState.active);
    if (state === 'unpaid') rows = rows.filter((u) => !u.subscriptionState.paid);
    if (state === 'expiring') rows = rows.filter((u) => u.subscriptionState.expiringSoon);
    if (state === 'expired') rows = rows.filter((u) => u.subscriptionState.expired);
    if (state === 'suspended') rows = rows.filter((u) => u.status !== 'active');

    const sorters = {
        newest: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
        name: (a, b) => (a.displayName || a.username).localeCompare(b.displayName || b.username),
        expiresSoon: (a, b) => (a.subscriptionState.daysLeft || 0) - (b.subscriptionState.daysLeft || 0),
        listings: (a, b) => b.listingCount - a.listingCount,
    };
    rows.sort(sorters[sort] || sorters.expiresSoon);

    res.json(paginate(rows, page, intIn(limit, 5, 60, 20)));
});

router.post('/sellers', (req, res) => {
    const users = store.readUsers();
    const body = req.body || {};

    const username = text(body.username, 40).toLowerCase().replace(/[^a-z0-9._-]/g, '');
    if (username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters (letters, numbers, . _ -).' });
    }
    if (users.some((u) => u.username.toLowerCase() === username)) {
        return res.status(409).json({ error: 'That username is already taken.' });
    }

    const problem = auth.passwordProblem(body.password);
    if (problem) return res.status(400).json({ error: problem });

    const contacts = {};
    CONTACT_KEYS.forEach((key) => { contacts[key] = text(body[key], 200); });

    const user = {
        id: store.newId(),
        role: 'reseller',
        username,
        displayName: text(body.displayName, 60) || username,
        password: auth.hashPassword(body.password),
        status: 'active',
        tokenVersion: 1,
        verified: bool(body.verified),
        featured: bool(body.featured),
        bio_en: text(body.bio_en, 400),
        bio_mm: text(body.bio_mm, 400),
        contacts,
        subscription: buildSubscription(body, null),
        notes: text(body.notes, 500),
        createdAt: Date.now(),
        mustChangePassword: bool(body.mustChangePassword),
    };

    users.push(user);
    store.writeUsers(users);
    return res.status(201).json(store.adminUser(user));
});

router.put('/sellers/:id', (req, res) => {
    const users = store.readUsers();
    const idx = users.findIndex((u) => u.id === req.params.id && u.role === 'reseller');
    if (idx === -1) return res.status(404).json({ error: 'Seller not found' });

    const user = users[idx];
    const body = req.body || {};

    if (body.displayName !== undefined) user.displayName = text(body.displayName, 60) || user.username;
    if (body.bio_en !== undefined) user.bio_en = text(body.bio_en, 400);
    if (body.bio_mm !== undefined) user.bio_mm = text(body.bio_mm, 400);
    if (body.notes !== undefined) user.notes = text(body.notes, 500);
    if (body.verified !== undefined) user.verified = bool(body.verified);
    if (body.featured !== undefined) user.featured = bool(body.featured);
    if (body.mustChangePassword !== undefined) user.mustChangePassword = bool(body.mustChangePassword);
    if (body.status !== undefined && store.USER_STATUSES.includes(body.status)) {
        user.status = body.status;
        if (body.status !== 'active') user.tokenVersion = (user.tokenVersion || 1) + 1;
    }

    user.contacts = user.contacts || {};
    CONTACT_KEYS.forEach((key) => {
        if (body[key] !== undefined) user.contacts[key] = text(body[key], 200);
    });

    // Subscription fields ride along on the main save. Only reassign (and
    // reset the billing period) when the plan itself is actually changing;
    // a paid/note-only edit should never silently reset a seller's expiry.
    const planKey = body.plan !== undefined ? body.plan : body.planId;
    const noteVal = body.note !== undefined ? body.note : body.subscriptionNote;
    const currentPlan = (user.subscription && user.subscription.plan) || null;
    const planChanged = planKey !== undefined && (planKey || null) !== currentPlan;

    if (planChanged) {
        user.subscription = buildSubscription({ ...body, plan: planKey }, user.subscription);
    } else if (body.paid !== undefined || noteVal !== undefined) {
        const sub = user.subscription || {};
        if (body.paid !== undefined) {
            sub.paid = bool(body.paid);
            if (sub.paid) sub.lastPaymentAt = Date.now();
        }
        if (noteVal !== undefined) sub.note = text(noteVal, 300);
        user.subscription = sub;
    }

    if (body.password) {
        const problem = auth.passwordProblem(body.password);
        if (problem) return res.status(400).json({ error: problem });
        user.password = auth.hashPassword(body.password);
        user.tokenVersion = (user.tokenVersion || 1) + 1;
        user.mustChangePassword = true;
    }

    users[idx] = user;
    store.writeUsers(users);
    return res.json(store.adminUser(user));
});

router.delete('/sellers/:id', wrap(async (req, res) => {
    const users = store.readUsers();
    const idx = users.findIndex((u) => u.id === req.params.id && u.role === 'reseller');
    if (idx === -1) return res.status(404).json({ error: 'Seller not found' });

    const removeListings = req.query.withListings !== 'false';
    const all = store.readListings();
    const theirs = all.filter((l) => l.sellerId === req.params.id).map(listings.shape);

    if (removeListings) {
        store.writeListings(all.filter((l) => l.sellerId !== req.params.id));
        await images.remove(theirs.flatMap((l) => l.images.concat(l.thumbs)));
    }

    users.splice(idx, 1);
    store.writeUsers(users);
    return res.json({ ok: true, removedListings: removeListings ? theirs.length : 0 });
}));

/* ---------------- subscriptions ---------------- */

/**
 * Build a subscription object from an admin request body.
 * Accepts either `plan`/`note` or the `planId`/`subscriptionNote` names the
 * seller-editor form sends. `planId: ''` explicitly clears the plan; the key
 * being absent entirely leaves whatever plan is already assigned untouched.
 */
function buildSubscription(body, existing) {
    const plans = store.readPlans();
    const base = existing || {};

    const planProvided = body.plan !== undefined || body.planId !== undefined;
    const planKey = body.plan !== undefined ? body.plan : body.planId;
    const plan = planKey ? (plans.find((p) => p.id === planKey) || null) : null;

    const days = body.days !== undefined
        ? intIn(body.days, 0, 3650, plan ? plan.days : 30)
        : (plan ? plan.days : 30);

    const startedAt = Date.now();
    const expiresAt = body.expiresAt !== undefined
        ? num(body.expiresAt, 0)
        : startedAt + days * store.DAY_MS;

    const noteVal = body.note !== undefined ? body.note : body.subscriptionNote;

    return {
        plan: planProvided ? (plan ? plan.id : null) : (base.plan || null),
        planName: planProvided ? (plan ? plan.name : '') : (base.planName || ''),
        listingLimit: planProvided ? (plan ? num(plan.listingLimit, 0) : 0) : num(base.listingLimit, 0),
        price: planProvided ? (plan ? num(plan.price, 0) : 0) : num(base.price, 0),
        paid: body.paid !== undefined ? bool(body.paid) : Boolean(base.paid),
        startedAt,
        expiresAt,
        lastPaymentAt: body.paid !== undefined && bool(body.paid) ? Date.now() : (base.lastPaymentAt || 0),
        note: noteVal !== undefined ? text(noteVal, 300) : (base.note || ''),
    };
}

/** Assign or replace a seller's plan. */
router.put('/sellers/:id/subscription', (req, res) => {
    const users = store.readUsers();
    const idx = users.findIndex((u) => u.id === req.params.id && u.role === 'reseller');
    if (idx === -1) return res.status(404).json({ error: 'Seller not found' });

    users[idx].subscription = buildSubscription(req.body || {}, users[idx].subscription);
    store.writeUsers(users);
    return res.json(store.adminUser(users[idx]));
});

/** Mark paid / unpaid without touching the dates. */
router.post('/sellers/:id/payment', (req, res) => {
    const users = store.readUsers();
    const idx = users.findIndex((u) => u.id === req.params.id && u.role === 'reseller');
    if (idx === -1) return res.status(404).json({ error: 'Seller not found' });

    const sub = users[idx].subscription || {};
    sub.paid = req.body && req.body.paid !== undefined ? bool(req.body.paid) : true;
    if (sub.paid) sub.lastPaymentAt = Date.now();
    if (req.body && req.body.note !== undefined) sub.note = text(req.body.note, 300);

    users[idx].subscription = sub;
    store.writeUsers(users);
    return res.json(store.adminUser(users[idx]));
});

/** Extend the current period by N days (renewals). */
router.post('/sellers/:id/extend', (req, res) => {
    const users = store.readUsers();
    const idx = users.findIndex((u) => u.id === req.params.id && u.role === 'reseller');
    if (idx === -1) return res.status(404).json({ error: 'Seller not found' });

    const days = intIn(req.body && req.body.days, 1, 3650, 30);
    const sub = users[idx].subscription || {};
    const from = Math.max(Date.now(), num(sub.expiresAt, 0));

    sub.expiresAt = from + days * store.DAY_MS;
    sub.paid = true;
    sub.lastPaymentAt = Date.now();
    if (!sub.startedAt) sub.startedAt = Date.now();

    users[idx].subscription = sub;
    store.writeUsers(users);
    return res.json(store.adminUser(users[idx]));
});

/* ================================================================== *
 * Listings (every seller)
 * ================================================================== */
router.get('/listings', (req, res) => {
    const { q, game, status, seller, sort, page, limit } = req.query;
    const users = store.readUsers();
    const sellerById = new Map(users.map((u) => [u.id, u]));

    let all = store.readListings().map(listings.shape);

    if (game && store.GAME_IDS.includes(game)) all = all.filter((l) => l.game === game);
    if (status && store.LISTING_STATUSES.includes(status)) all = all.filter((l) => l.status === status);
    if (seller) all = all.filter((l) => l.sellerId === seller);
    if (q) {
        const raw = String(q).trim();
        const lower = raw.toLowerCase();
        all = all.filter((l) => matches(l.title_en, lower, raw) || matches(l.title_mm, lower, raw));
    }

    all = sortListings(all, sort);
    const paged = paginate(all, page, intIn(limit, 5, 60, 15));
    paged.items = paged.items.map((l) => {
        const s = sellerById.get(l.sellerId);
        return {
            ...l,
            sellerName: s ? (s.displayName || s.username) : 'Unknown seller',
            sellerUsername: s ? s.username : '',
            sellerLive: s ? store.sellerIsPublic(s) : false,
        };
    });
    res.json(paged);
});

router.post(
    '/listings',
    images.uploader.array('images', listings.MAX_IMAGES),
    wrap(async (req, res) => {
        const sellerId = text(req.body && req.body.sellerId, 40) || req.user.id;
        if (!store.readUsers().some((u) => u.id === sellerId)) {
            return res.status(400).json({ error: 'Choose a valid seller for this listing.' });
        }

        const draft = listings.shape({
            ...listings.applyBody(req.body || {}, null, { allowFeatured: true }),
            id: store.newId(),
            sellerId,
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
        return res.status(201).json(draft);
    })
);

router.put(
    '/listings/:id',
    images.uploader.array('images', listings.MAX_IMAGES),
    wrap(async (req, res) => {
        const all = store.readListings();
        const idx = all.findIndex((l) => l.id === req.params.id);
        if (idx === -1) return res.status(404).json({ error: 'Listing not found' });

        const current = listings.shape(all[idx]);
        const updated = listings.shape({
            ...listings.applyBody(req.body || {}, current, { allowFeatured: true }),
            id: current.id,
            sellerId: text(req.body && req.body.sellerId, 40) || current.sellerId,
            createdAt: current.createdAt,
        });

        const problem = listings.validate(updated);
        if (problem) return res.status(400).json({ error: problem });

        const merged = await mergeImages(req, current, updated);
        merged.updatedAt = Date.now();

        all[idx] = merged;
        store.writeListings(all);
        return res.json(merged);
    })
);

router.delete('/listings/:id', wrap(async (req, res) => {
    const all = store.readListings();
    const idx = all.findIndex((l) => l.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Listing not found' });

    const removed = listings.shape(all[idx]);
    all.splice(idx, 1);
    store.writeListings(all);
    await images.remove(removed.images.concat(removed.thumbs));
    return res.json({ ok: true });
}));

/* ================================================================== *
 * Subscription plans
 * ================================================================== */
router.get('/plans', (req, res) => res.json({ plans: store.readPlans() }));

router.put('/plans', (req, res) => {
    const incoming = Array.isArray(req.body && req.body.plans) ? req.body.plans : null;
    if (!incoming) return res.status(400).json({ error: 'Send a plans array.' });

    const cleaned = incoming.slice(0, 8).map((plan, i) => ({
        id: slugify(plan.id || plan.name || `plan-${i + 1}`),
        name: text(plan.name, 40) || `Plan ${i + 1}`,
        days: intIn(plan.days, 1, 3650, 30),
        price: Math.max(0, num(plan.price, 0)),
        listingLimit: intIn(plan.listingLimit, 0, 10000, 0),
        blurb: text(plan.blurb, 160),
        order: i + 1,
    }));

    store.writePlans(cleaned);
    return res.json({ plans: cleaned });
});

/* ================================================================== *
 * Blog
 * ================================================================== */
router.get('/posts', (req, res) => {
    const rows = store.readPosts()
        .slice()
        .sort((a, b) => (b.publishedAt || b.createdAt) - (a.publishedAt || a.createdAt));
    res.json(paginate(rows, req.query.page, intIn(req.query.limit, 5, 60, 20)));
});

router.post('/posts', images.uploader.single('cover'), wrap(async (req, res) => {
    const posts = store.readPosts();
    const body = req.body || {};

    const title = text(body.title_en, 160) || text(body.title_mm, 160);
    if (!title) return res.status(400).json({ error: 'Give the post a title.' });

    const taken = new Set(posts.map((p) => p.slug));
    const status = store.POST_STATUSES.includes(body.status) ? body.status : 'draft';

    const post = {
        id: store.newId(),
        slug: uniqueSlug(slugify(body.slug || title), taken),
        title_en: text(body.title_en, 160),
        title_mm: text(body.title_mm, 160),
        excerpt_en: text(body.excerpt_en, 300),
        excerpt_mm: text(body.excerpt_mm, 300),
        body_en: text(body.body_en, 20000),
        body_mm: text(body.body_mm, 20000),
        tag: text(body.tag, 40),
        cover: '',
        status,
        authorId: req.user.id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        publishedAt: status === 'published' ? Date.now() : 0,
    };

    if (req.file) {
        const stored = await images.store(req.file.buffer, 'cover');
        post.cover = stored.full;
    }

    posts.push(post);
    store.writePosts(posts);
    return res.status(201).json(post);
}));

router.put('/posts/:id', images.uploader.single('cover'), wrap(async (req, res) => {
    const posts = store.readPosts();
    const idx = posts.findIndex((p) => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Post not found' });

    const post = posts[idx];
    const body = req.body || {};

    ['title_en', 'title_mm'].forEach((k) => { if (body[k] !== undefined) post[k] = text(body[k], 160); });
    ['excerpt_en', 'excerpt_mm'].forEach((k) => { if (body[k] !== undefined) post[k] = text(body[k], 300); });
    ['body_en', 'body_mm'].forEach((k) => { if (body[k] !== undefined) post[k] = text(body[k], 20000); });
    if (body.tag !== undefined) post.tag = text(body.tag, 40);

    if (body.slug !== undefined && body.slug) {
        const taken = new Set(posts.filter((p) => p.id !== post.id).map((p) => p.slug));
        post.slug = uniqueSlug(slugify(body.slug), taken);
    }
    if (body.status !== undefined && store.POST_STATUSES.includes(body.status)) {
        if (body.status === 'published' && post.status !== 'published') post.publishedAt = Date.now();
        post.status = body.status;
    }

    if (req.file) {
        const old = post.cover;
        const stored = await images.store(req.file.buffer, 'cover');
        post.cover = stored.full;
        await images.remove([old]);
    } else if (body.removeCover === 'true' && post.cover) {
        await images.remove([post.cover]);
        post.cover = '';
    }

    post.updatedAt = Date.now();
    posts[idx] = post;
    store.writePosts(posts);
    return res.json(post);
}));

router.delete('/posts/:id', wrap(async (req, res) => {
    const posts = store.readPosts();
    const idx = posts.findIndex((p) => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Post not found' });

    const [removed] = posts.splice(idx, 1);
    store.writePosts(posts);
    if (removed.cover) await images.remove([removed.cover]);
    return res.json({ ok: true });
}));

/* ================================================================== *
 * Advertising slots
 * ================================================================== */
router.get('/ads', (req, res) => {
    res.json({ slots: store.AD_SLOTS, ads: store.readAds() });
});

router.put('/ads/:slot', images.uploader.single('image'), wrap(async (req, res) => {
    const slot = store.AD_SLOTS.find((s) => s.id === req.params.slot);
    if (!slot) return res.status(404).json({ error: 'Unknown ad slot' });

    const ads = store.readAds();
    const ad = ads[slot.id];
    const body = req.body || {};

    if (body.title !== undefined) ad.title = text(body.title, 80);
    if (body.subtitle !== undefined) ad.subtitle = text(body.subtitle, 160);
    if (body.link !== undefined) ad.link = text(body.link, 400);
    if (body.enabled !== undefined) ad.enabled = bool(body.enabled);

    if (req.file) {
        const preset = slot.ratio === '6 / 1' ? 'ad-wide' : (slot.ratio === '4 / 3' ? 'ad-portrait' : 'ad-card');
        const old = ad.image;
        const stored = await images.store(req.file.buffer, preset);
        ad.image = stored.full;
        await images.remove([old]);
    } else if (body.removeImage === 'true' && ad.image) {
        await images.remove([ad.image]);
        ad.image = '';
    }

    ad.updatedAt = Date.now();
    ads[slot.id] = ad;
    store.writeAds(ads);
    return res.json({ slot: slot.id, ad });
}));

/* ================================================================== *
 * Settings + admin account
 * ================================================================== */
const ADMIN_PATH_KEY = 'adminPath';

router.get('/settings', (req, res) => {
    res.json({
        ...store.readSettings(),
        adminPathLocked: Boolean(process.env.ADMIN_PATH),
        username: req.user.username,
    });
});

router.put('/settings', (req, res) => {
    const next = { ...store.readSettings() };
    const body = req.body || {};

    store.PUBLIC_SETTING_KEYS.forEach((key) => {
        if (body[key] === undefined) return;
        if (key === 'pageSize') next.pageSize = intIn(body[key], 3, 48, next.pageSize);
        else next[key] = text(body[key], 500);
    });

    if (body[ADMIN_PATH_KEY] !== undefined && !process.env.ADMIN_PATH) {
        next.adminPath = require('../adminPath').normalize(body[ADMIN_PATH_KEY]);
    }

    store.writeSettings(next);
    return res.json({ ...next, adminPathLocked: Boolean(process.env.ADMIN_PATH) });
});

router.put('/account', (req, res) => {
    const users = store.readUsers();
    const idx = users.findIndex((u) => u.id === req.user.id);
    if (idx === -1) return res.status(404).json({ error: 'Account not found' });

    const user = users[idx];
    const { username, currentPassword, newPassword } = req.body || {};

    if (!auth.verifyPassword(currentPassword, user.password)) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    let changed = false;
    if (username) {
        const clean = text(username, 40).toLowerCase().replace(/[^a-z0-9._-]/g, '');
        if (clean.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters.' });
        if (users.some((u) => u.id !== user.id && u.username.toLowerCase() === clean)) {
            return res.status(409).json({ error: 'That username is already taken.' });
        }
        if (clean !== user.username) { user.username = clean; changed = true; }
    }
    if (newPassword) {
        const problem = auth.passwordProblem(newPassword);
        if (problem) return res.status(400).json({ error: problem });
        user.password = auth.hashPassword(newPassword);
        changed = true;
    }
    if (!changed) return res.status(400).json({ error: 'Nothing to change.' });

    user.tokenVersion = (user.tokenVersion || 1) + 1;
    user.mustChangePassword = false;
    users[idx] = user;
    store.writeUsers(users);

    const { token, expiresAt } = auth.signToken(user);
    return res.json({ username: user.username, token, expiresAt });
});

module.exports = router;
