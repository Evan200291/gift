/**
 * listings.js — the listing record: shape, validation and visibility.
 *
 * A listing is deliberately game-agnostic. Instead of eFootball-only fields
 * the record carries three generic slots that each game labels differently
 * in the UI:
 *
 *   level            eFootball → team overall   ·  MLBB → rank
 *                    PUBG      → tier           ·  Free Fire → level
 *   currency_amount  coins · diamonds · UC · diamonds
 *   highlights       star players · heroes/skins · weapon skins · bundles
 */
'use strict';

const store = require('./store');
const { text, bool, num } = require('./util');

const MAX_IMAGES = 6;

const TEXT_FIELDS = {
    title_en: 120,
    title_mm: 160,
    description_en: 4000,
    description_mm: 4000,
    level: 60,
    currency_amount: 60,
    highlights: 400,
    server: 60,
    contact_note: 160,
};

/** Fill in defaults and repair legacy records so callers never see undefined. */
function shape(listing) {
    const images = Array.isArray(listing.images) ? listing.images : [];
    const thumbs = Array.isArray(listing.thumbs) && listing.thumbs.length === images.length
        ? listing.thumbs
        : images;

    return {
        id: listing.id,
        sellerId: listing.sellerId || '',
        game: store.GAME_IDS.includes(listing.game) ? listing.game : 'efootball',
        title_en: listing.title_en || '',
        title_mm: listing.title_mm || '',
        description_en: listing.description_en || '',
        description_mm: listing.description_mm || '',
        price: num(listing.price, 0),
        status: store.LISTING_STATUSES.includes(listing.status) ? listing.status : 'available',
        featured: Boolean(listing.featured),
        level: listing.level || '',
        currency_amount: listing.currency_amount || '',
        highlights: listing.highlights || '',
        server: listing.server || '',
        contact_note: listing.contact_note || '',
        images,
        thumbs,
        createdAt: listing.createdAt || Date.now(),
        updatedAt: listing.updatedAt || listing.createdAt || Date.now(),
    };
}

/**
 * Merge a request body onto an existing record.
 * `allowFeatured` is false for resellers — only admins can pin listings.
 */
function applyBody(body, existing, options) {
    const opts = options || {};
    const next = { ...(existing || {}) };

    Object.keys(TEXT_FIELDS).forEach((field) => {
        if (body[field] !== undefined) next[field] = text(body[field], TEXT_FIELDS[field]);
    });

    if (body.price !== undefined) next.price = Math.max(0, Math.round(num(body.price, 0) * 100) / 100);
    if (body.game !== undefined && store.GAME_IDS.includes(body.game)) next.game = body.game;
    if (body.status !== undefined) {
        next.status = store.LISTING_STATUSES.includes(body.status) ? body.status : 'available';
    }
    if (opts.allowFeatured && body.featured !== undefined) next.featured = bool(body.featured);

    return next;
}

/** Reject obviously incomplete submissions before anything is written. */
function validate(listing) {
    if (!listing.title_en && !listing.title_mm) return 'A listing needs a title.';
    if (!store.GAME_IDS.includes(listing.game)) return 'Choose which game this account is for.';
    if (!(listing.price > 0)) return 'Set a price greater than zero.';
    return null;
}

/**
 * Attach the seller's public profile to a listing for the storefront.
 * Buyers never create accounts, so the seller's contacts travel with the item.
 */
function withSeller(listing, sellerById) {
    const seller = sellerById.get(listing.sellerId);
    return {
        ...listing,
        seller: seller
            ? {
                id: seller.id,
                displayName: seller.displayName || seller.username,
                username: seller.username,
                contacts: seller.contacts || {},
                bio_en: seller.bio_en || '',
                bio_mm: seller.bio_mm || '',
                since: seller.createdAt,
                verified: seller.role === 'admin' || Boolean(seller.verified),
            }
            : null,
    };
}

/**
 * Public listings are those whose seller currently has a live subscription.
 * Suspended sellers and lapsed subscriptions disappear from the storefront
 * without their data being touched.
 */
function publicListings(allListings, users) {
    const liveSellerIds = new Set(
        users.filter((u) => store.sellerIsPublic(u)).map((u) => u.id)
    );
    return allListings.map(shape).filter((l) => liveSellerIds.has(l.sellerId));
}

module.exports = {
    MAX_IMAGES,
    TEXT_FIELDS,
    shape,
    applyBody,
    validate,
    withSeller,
    publicListings,
};
