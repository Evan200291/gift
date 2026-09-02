/**
 * auth.js — password hashing, stateless sessions, route guards.
 *
 * Passwords use scrypt with a per-user salt. Sessions are HMAC-signed
 * tokens (no server-side session table) carrying the user id, role and a
 * tokenVersion; bumping a user's tokenVersion invalidates every token they
 * hold, which is how "sign out everywhere" and password changes work.
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const store = require('./store');

const SCRYPT_KEYLEN = 64;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

/* ------------------------------------------------------------------ *
 * Signing key — persisted so restarts do not sign everyone out
 * ------------------------------------------------------------------ */
const SECRET_FILE = path.join(store.DATA_DIR, 'session.key');
if (!fs.existsSync(SECRET_FILE)) {
    fs.writeFileSync(SECRET_FILE, crypto.randomBytes(48).toString('hex'), { mode: 0o600 });
}
const SESSION_SECRET = process.env.SESSION_SECRET || fs.readFileSync(SECRET_FILE, 'utf8').trim();

/* ------------------------------------------------------------------ *
 * Passwords
 * ------------------------------------------------------------------ */
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const key = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN).toString('hex');
    return `scrypt:${salt}:${key}`;
}

function verifyPassword(password, stored) {
    if (!stored || password === undefined || password === null) return false;
    try {
        const value = String(stored);
        if (value.startsWith('scrypt:')) {
            const [, salt, key] = value.split(':');
            const derived = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN);
            const expected = Buffer.from(key, 'hex');
            return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
        }
        // Legacy bare sha256 hex from the first single-seller build.
        const legacy = crypto.createHash('sha256').update(String(password)).digest();
        const expected = Buffer.from(value, 'hex');
        return legacy.length === expected.length && crypto.timingSafeEqual(legacy, expected);
    } catch {
        return false;
    }
}

function isLegacyHash(stored) {
    return Boolean(stored) && !String(stored).startsWith('scrypt:');
}

/** Basic strength gate for anything the platform creates. */
function passwordProblem(password) {
    const value = String(password || '');
    if (value.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
        return 'Password must contain both letters and numbers.';
    }
    return null;
}

/* ------------------------------------------------------------------ *
 * Tokens
 * ------------------------------------------------------------------ */
const revoked = new Set();

function b64url(input) {
    return Buffer.from(input).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function signToken(user) {
    const payload = {
        s: user.id,
        r: user.role,
        v: user.tokenVersion || 1,
        iat: Date.now(),
        exp: Date.now() + SESSION_TTL_MS,
    };
    const body = b64url(JSON.stringify(payload));
    const sig = b64url(crypto.createHmac('sha256', SESSION_SECRET).update(body).digest());
    return { token: `${body}.${sig}`, expiresAt: payload.exp };
}

function verifyToken(token) {
    if (typeof token !== 'string' || !token.includes('.')) return null;
    if (revoked.has(token)) return null;

    const [body, sig] = token.split('.');
    if (!body || !sig) return null;

    const expected = b64url(crypto.createHmac('sha256', SESSION_SECRET).update(body).digest());
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    let payload;
    try {
        payload = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    } catch {
        return null;
    }
    if (!payload || typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;

    const user = store.readUsers().find((u) => u.id === payload.s);
    if (!user) return null;
    if ((payload.v || 0) !== (user.tokenVersion || 1)) return null;
    if (user.status !== 'active') return null;

    return { user, payload };
}

function revokeToken(token) {
    revoked.add(token);
    if (revoked.size > 2000) revoked.clear();
}

/* ------------------------------------------------------------------ *
 * Guards
 * ------------------------------------------------------------------ */
function attachUser(req, res, next) {
    const token = req.get('x-auth-token') || '';
    const result = verifyToken(token);
    if (result) {
        req.user = result.user;
        req.token = token;
    }
    next();
}

function requireUser(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    return next();
}

function requireAdmin(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
    return next();
}

/**
 * Resellers may always read their own data, but writing new listings
 * requires a live subscription.
 */
function requireActiveSubscription(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    if (req.user.role === 'admin') return next();

    const state = store.subscriptionState(req.user);
    if (!state.active) {
        return res.status(402).json({
            error: state.expired
                ? 'Your subscription has expired. Renew it to publish listings.'
                : 'Your subscription is awaiting payment confirmation.',
            subscription: state,
        });
    }
    return next();
}

/* ------------------------------------------------------------------ *
 * Login throttling (per IP + username, in memory)
 * ------------------------------------------------------------------ */
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 8;
const attempts = new Map();

function attemptKey(req, username) {
    const ip = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
    return `${ip}|${String(username || '').toLowerCase()}`;
}

function throttleCheck(key) {
    const rec = attempts.get(key);
    if (!rec) return 0;
    if (Date.now() > rec.resetAt) {
        attempts.delete(key);
        return 0;
    }
    return rec.count >= LOGIN_MAX_FAILURES ? rec.resetAt - Date.now() : 0;
}

function throttleFail(key) {
    const now = Date.now();
    const rec = attempts.get(key);
    if (!rec || now > rec.resetAt) attempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    else rec.count += 1;
}

function throttleReset(key) {
    attempts.delete(key);
}

setInterval(() => {
    const now = Date.now();
    for (const [key, rec] of attempts) if (now > rec.resetAt) attempts.delete(key);
}, 5 * 60 * 1000).unref();

module.exports = {
    SESSION_TTL_MS,
    hashPassword, verifyPassword, isLegacyHash, passwordProblem,
    signToken, verifyToken, revokeToken,
    attachUser, requireUser, requireAdmin, requireActiveSubscription,
    attemptKey, throttleCheck, throttleFail, throttleReset,
};
