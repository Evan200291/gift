/**
 * util.js — small shared helpers used across the route modules.
 */
'use strict';

/** Trim + hard-cap a value coming from a request body. */
function text(value, max) {
    return String(value === undefined || value === null ? '' : value).trim().slice(0, max || 200);
}

function bool(value) {
    return value === true || value === 'true' || value === '1' || value === 1 || value === 'on';
}

function num(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : (fallback || 0);
}

function intIn(value, min, max, fallback) {
    const n = parseInt(value, 10);
    if (Number.isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

/** URL-safe slug used for blog posts. */
function slugify(value) {
    const base = String(value || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
    return base || `post-${Date.now().toString(36)}`;
}

function uniqueSlug(slug, taken) {
    if (!taken.has(slug)) return slug;
    let i = 2;
    while (taken.has(`${slug}-${i}`)) i += 1;
    return `${slug}-${i}`;
}

function paginate(items, page, limit) {
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(Math.max(1, parseInt(page, 10) || 1), totalPages);
    const start = (safePage - 1) * limit;
    return { items: items.slice(start, start + limit), page: safePage, limit, total, totalPages };
}

const SORTS = {
    newest: (a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.createdAt - a.createdAt,
    oldest: (a, b) => a.createdAt - b.createdAt,
    price_asc: (a, b) => a.price - b.price,
    price_desc: (a, b) => b.price - a.price,
};

function sortListings(list, sort) {
    return list.slice().sort(SORTS[sort] || SORTS.newest);
}

/** Case-insensitive contains that also works for Burmese (no lowercasing). */
function matches(haystack, termLower, termRaw) {
    const value = String(haystack || '');
    return value.toLowerCase().includes(termLower) || value.includes(termRaw);
}

/** Wrap an async route handler so rejections reach the error middleware. */
function wrap(handler) {
    return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

module.exports = {
    text, bool, num, intIn,
    slugify, uniqueSlug,
    paginate, sortListings, matches,
    wrap,
};
