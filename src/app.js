/**
 * app.js — assembles the Express application.
 *
 * Order matters here:
 *   1. security headers        (every response)
 *   2. body parsers + CORS
 *   3. /uploads static
 *   4. secret admin panel      (before the public static mount, so the panel
 *                               HTML can never be reached by guessing a file)
 *   5. public static assets
 *   6. /api routers
 *   7. page routing + errors
 */
'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const multer = require('multer');

const store = require('./store');
const auth = require('./auth');
const adminPath = require('./adminPath');

const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const sellerRoutes = require('./routes/seller');
const adminRoutes = require('./routes/admin');

const PUBLIC_DIR = path.join(store.ROOT, 'public');
const VIEWS_DIR = path.join(store.ROOT, 'views');

/* ------------------------------------------------------------------ *
 * Public pages: clean URL -> file
 * ------------------------------------------------------------------ */
const PAGES = [
    { test: (p) => p === '/', file: 'index.html' },
    { test: (p) => p === '/listing' || p.startsWith('/listing/'), file: 'listing.html' },
    { test: (p) => p === '/store' || p.startsWith('/store/'), file: 'store.html' },
    { test: (p) => p === '/sellers', file: 'sellers.html' },
    { test: (p) => p === '/blog', file: 'blog.html' },
    { test: (p) => p.startsWith('/blog/'), file: 'post.html' },
    { test: (p) => p === '/sell', file: 'sell.html' },
    { test: (p) => p === '/advertise', file: 'advertise.html' },
    { test: (p) => p === '/seller' || p.startsWith('/seller/'), file: 'portal.html' },
];

function build() {
    const app = express();

    app.disable('x-powered-by');
    if (process.env.TRUST_PROXY !== '0') app.set('trust proxy', 1);

    /* ---- 1. security headers ---- */
    app.use((req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
        res.setHeader('Content-Security-Policy', [
            "default-src 'self'",
            "base-uri 'self'",
            "frame-ancestors 'self'",
            "img-src 'self' data: blob:",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com data:",
            "script-src 'self'",
            "connect-src 'self'",
            "form-action 'self'",
            "object-src 'none'",
        ].join('; '));
        if (req.secure || req.get('x-forwarded-proto') === 'https') {
            res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
        }
        next();
    });

    /* ---- 2. parsers ---- */
    app.use(cors({ origin: true }));
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true, limit: '1mb' }));
    app.use(auth.attachUser);

    /* ---- 3. uploads ---- */
    app.use('/uploads', express.static(store.UPLOADS_DIR, {
        maxAge: '30d',
        immutable: true,
        index: false,
        dotfiles: 'ignore',
    }));

    /* ---- 4. secret admin panel ---- */
    const adminHtml = fs.readFileSync(path.join(VIEWS_DIR, 'admin.html'), 'utf8');
    // admin.js is a separate client-side controller that the HTML loads via
    // <script src=".../admin.js">. It is not part of the public repo yet, so
    // read it defensively: if it's missing, serve a no-op so the panel still
    // boots (and the public site is unaffected).
    let adminJs = '';
    try {
        adminJs = fs.readFileSync(path.join(VIEWS_DIR, 'admin.js'), 'utf8');
    } catch (err) {
        if (err && err.code !== 'ENOENT') throw err;
    }

    app.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();

        const base = adminPath.current();
        const reqPath = req.path.replace(/\/+$/, '') || '/';
        if (reqPath !== base && reqPath !== `${base}/admin.js`) return next();

        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        res.setHeader('Cache-Control', 'no-store');

        if (reqPath === base) {
            res.type('html');
            return res.send(adminHtml.split('__ADMIN_BASE__').join(base));
        }
        res.type('application/javascript');
        return res.send(adminJs.split('__ADMIN_BASE__').join(base));
    });

    /* ---- 5. public assets ----
       CSS/JS/HTML change often during active development; always revalidate
       (a fast conditional GET / 304) instead of trusting a maxAge, or every
       edit is invisible to a returning visitor until they hard-reload.
       Uploaded images are content-hashed filenames, so those alone are safe
       to cache hard (see the /uploads mount above). */
    app.use(express.static(PUBLIC_DIR, {
        index: false,
        etag: true,
        lastModified: true,
        setHeaders: (res) => res.setHeader('Cache-Control', 'no-store'),
    }));

    /* ---- 6. API ---- */
    app.use('/api', publicRoutes);
    app.use('/api/auth', authRoutes.router);
    app.use('/api/seller', sellerRoutes.router);
    app.use('/api/admin', adminRoutes);

    /* ---- 7. page routing ---- */
    app.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();

        const clean = req.path.length > 1 ? req.path.replace(/\/+$/, '') : req.path;
        const page = PAGES.find((p) => p.test(clean));
        const file = page ? page.file : '404.html';

        res.status(page ? 200 : 404);
        return res.sendFile(path.join(PUBLIC_DIR, file));
    });

    app.use((req, res) => res.status(404).json({ error: 'Not found' }));

    /* ---- errors ---- */
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, _next) => {
        if (err instanceof multer.MulterError) {
            const messages = {
                LIMIT_FILE_SIZE: 'Each image must be 8 MB or smaller.',
                LIMIT_FILE_COUNT: 'Too many images in one upload.',
                LIMIT_UNEXPECTED_FILE: 'Unexpected file field.',
            };
            return res.status(400).json({ error: messages[err.code] || 'Upload failed.' });
        }
        const status = err.status || 500;
        if (status >= 500) console.error('[error]', err);
        return res.status(status).json({ error: status >= 500 ? 'Server error' : err.message });
    });

    return app;
}

module.exports = { build, PAGES };
