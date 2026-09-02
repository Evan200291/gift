/**
 * adminPath.js — resolves the secret URL the control panel lives at.
 *
 * The path is stored in settings so it can be rotated from the panel itself,
 * but an ADMIN_PATH environment variable always wins (useful when the panel
 * address is managed by deployment config rather than by the app).
 */
'use strict';

const store = require('./store');

const DEFAULT = store.DEFAULT_ADMIN_PATH;

/** Paths the public site already owns — never hand these to the panel. */
const RESERVED = new Set([
    '/api', '/uploads', '/css', '/js', '/img', '/store', '/listing',
    '/blog', '/seller', '/sell', '/sellers', '/robots.txt', '/favicon.ico',
]);

function normalize(value) {
    let path = String(value || '').trim();
    if (!path) return DEFAULT;
    if (!path.startsWith('/')) path = `/${path}`;
    path = path.replace(/\/+$/, '');

    if (!/^\/[A-Za-z0-9._~-]{3,60}$/.test(path)) return DEFAULT;
    if (RESERVED.has(path.toLowerCase())) return DEFAULT;
    return path;
}

/** Current admin base path, re-read each call so changes apply live. */
function current() {
    if (process.env.ADMIN_PATH) return normalize(process.env.ADMIN_PATH);
    return normalize(store.readSettings().adminPath);
}

const isLocked = () => Boolean(process.env.ADMIN_PATH);

module.exports = { DEFAULT, normalize, current, isLocked };
