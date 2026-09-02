/**
 * server.js — process entry point.
 *
 * Everything interesting lives in src/. This file only seeds storage,
 * starts the HTTP listener and handles a clean shutdown for PM2.
 *
 *   src/store.js        flat-file persistence + domain constants
 *   src/auth.js         passwords, sessions, route guards
 *   src/images.js       upload handling (sharp)
 *   src/listings.js     the listing record
 *   src/adminPath.js    secret control-panel URL
 *   src/app.js          Express wiring
 *   src/routes/*        public · auth · seller · admin APIs
 */
'use strict';

const store = require('./src/store');
const auth = require('./src/auth');
const adminPath = require('./src/adminPath');
const { build } = require('./src/app');

store.seed(auth.hashPassword);

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const app = build();
const server = app.listen(PORT, HOST, () => {
    const settings = store.readSettings();
    console.log('');
    console.log(`  ${settings.brand} — marketplace online`);
    console.log(`  Storefront     http://localhost:${PORT}/`);
    console.log(`  Seller portal  http://localhost:${PORT}/seller`);
    console.log(`  Control panel  http://localhost:${PORT}${adminPath.current()}`);
    console.log('  The control-panel address is never linked from the public site.');
    console.log('');
});

function shutdown(signal) {
    console.log(`[${signal}] shutting down...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 8000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason));
