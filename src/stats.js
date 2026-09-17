/**
 * stats.js — per-listing engagement counters (views, contact clicks).
 *
 * Kept in their own file (data/stats.json) rather than on the listing
 * record, so a page view never rewrites listings.json and can't race a
 * seller's edit. Counts live in memory and flush to disk at most every
 * FLUSH_MS. Repeat hits from the same visitor on the same listing within
 * DEDUPE_MS count once, so refreshing a page doesn't inflate the numbers.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const store = require('./store');

const FILE = path.join(store.DATA_DIR, 'stats.json');
const FLUSH_MS = 3000;
const DEDUPE_MS = 30 * 60 * 1000;
const MAX_SEEN = 20000;

let data = null;
let flushTimer = null;
const seen = new Map();

function load() {
    if (data) return data;
    try { data = JSON.parse(fs.readFileSync(FILE, 'utf8')) || {}; } catch { data = {}; }
    return data;
}

function flush() {
    flushTimer = null;
    try {
        const tmp = `${FILE}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(data), 'utf8');
        fs.renameSync(tmp, FILE);
    } catch { /* stats are best-effort */ }
}

function schedule() {
    if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_MS);
}

function firstHit(kind, id, visitor) {
    const key = `${kind}:${id}:${visitor}`;
    const now = Date.now();
    const last = seen.get(key);
    if (last && now - last < DEDUPE_MS) return false;
    if (seen.size > MAX_SEEN) seen.clear();
    seen.set(key, now);
    return true;
}

/** Count one event ('views' | 'contacts') for a listing. */
function bump(id, kind, visitor) {
    if (!id || (kind !== 'views' && kind !== 'contacts')) return;
    if (!firstHit(kind, id, visitor || 'anon')) return;
    const all = load();
    const row = all[id] || (all[id] = { views: 0, contacts: 0 });
    row[kind] = (row[kind] || 0) + 1;
    schedule();
}

function get(id) {
    const row = load()[id];
    return { views: (row && row.views) || 0, contacts: (row && row.contacts) || 0 };
}

function totals() {
    return Object.values(load()).reduce((acc, r) => {
        acc.views += r.views || 0;
        acc.contacts += r.contacts || 0;
        return acc;
    }, { views: 0, contacts: 0 });
}

process.on('exit', () => { if (flushTimer) { clearTimeout(flushTimer); flush(); } });

module.exports = { bump, get, totals };
