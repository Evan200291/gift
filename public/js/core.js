/* =============================================================
   core.js — shared runtime: language, formatting, API client,
   icons, contact channels, toasts and small DOM helpers.

   Loaded on every page (after i18n.js) and exposed as `window.EX`.
   No inline scripts anywhere — the CSP is script-src 'self'.
   ============================================================= */
(function () {
    'use strict';

    const LANG_KEY = 'ex_lang';
    const TOKEN_KEY = 'ex_token';

    /* ================= language ================= */

    function getLang() {
        const saved = localStorage.getItem(LANG_KEY);
        return saved === 'mm' ? 'mm' : 'en';
    }

    function t(key, replacement) {
        const dict = window.I18N || {};
        const lang = getLang();
        let value = (dict[lang] && dict[lang][key]) || (dict.en && dict.en[key]) || key;
        if (replacement !== undefined) value = value.replace('%d', replacement).replace('%s', replacement);
        return value;
    }

    function applyTranslations(root) {
        const scope = root || document;
        scope.querySelectorAll('[data-i18n]').forEach((el) => {
            el.textContent = t(el.getAttribute('data-i18n'));
        });
        scope.querySelectorAll('[data-i18n-ph]').forEach((el) => {
            el.placeholder = t(el.getAttribute('data-i18n-ph'));
        });
        scope.querySelectorAll('[data-i18n-aria]').forEach((el) => {
            el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
        });
    }

    function setLang(lang) {
        const next = lang === 'mm' ? 'mm' : 'en';
        localStorage.setItem(LANG_KEY, next);
        document.documentElement.lang = next === 'mm' ? 'my' : 'en';
        document.body.classList.toggle('lang-mm', next === 'mm');
        document.body.classList.toggle('lang-en', next === 'en');
        applyTranslations();
        document.querySelectorAll('.lang-switch button').forEach((b) => {
            b.classList.toggle('active', b.dataset.lang === next);
        });
        document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: next } }));
    }

    /** Choose the field for the active language, falling back to the other. */
    function pick(en, mm) {
        return getLang() === 'mm' ? (mm || en || '') : (en || mm || '');
    }

    function field(record, name) {
        return pick(record[`${name}_en`], record[`${name}_mm`]);
    }

    /* ================= escaping & formatting ================= */

    const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

    function esc(value) {
        if (value === null || value === undefined) return '';
        return String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
    }

    function truncate(value, max) {
        const s = String(value || '');
        return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
    }

    let SITE = {};
    const site = () => SITE;

    function money(value) {
        const n = Number(value) || 0;
        const sym = SITE.currencySymbol || 'Ks';
        const decimals = sym === 'Ks' || SITE.currency === 'MMK' ? 0 : 2;
        return sym + ' ' + n.toLocaleString('en-US', { maximumFractionDigits: decimals });
    }

    function shortDate(ts) {
        if (!ts) return '';
        return new Date(Number(ts)).toLocaleDateString(getLang() === 'mm' ? 'my-MM' : 'en-GB', {
            year: 'numeric', month: 'short', day: 'numeric',
        });
    }

    function monthYear(ts) {
        if (!ts) return '';
        return new Date(Number(ts)).toLocaleDateString('en-GB', { year: 'numeric', month: 'short' });
    }

    /* ================= games ================= */

    const GAME_FALLBACK = [
        { id: 'efootball', short: 'eFootball', icon: '⚽', accent: '#22d3ee' },
        { id: 'mlbb', short: 'Mobile Legends', icon: '🛡️', accent: '#7c5cff' },
        { id: 'pubg', short: 'PUBG Mobile', icon: '🎯', accent: '#ffb020' },
        { id: 'freefire', short: 'Free Fire', icon: '🔥', accent: '#ff5f6d' },
    ];

    const games = () => (SITE.games && SITE.games.length ? SITE.games : GAME_FALLBACK);
    const gameById = (id) => games().find((g) => g.id === id) || games()[0];

    const GAME_LOGO = {
        efootball: '/img/games/efootball.svg',
        mlbb: '/img/games/mlbb.svg',
        pubg: '/img/games/pubg.png',
        freefire: '/img/games/freefire.png',
    };
    function gameLogo(id) { return GAME_LOGO[id] || ''; }

    const GAME_KEY = {
        efootball: 'Efootball', mlbb: 'Mlbb', pubg: 'Pubg', freefire: 'Freefire',
    };

    function gameName(id) {
        const key = GAME_KEY[id];
        return key ? t(`game${key}`) : (gameById(id).short || id);
    }

    /* Custom line-icon glyphs per game — not trademarked logo art, just a
       shield / ball / crosshair / flame in each game's own accent. Swap the
       markup here (or override .game-glyph[data-game] background-image in
       CSS) if licensed logo art becomes available. */
    const GAME_ICON_SVG = {
        efootball: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7.5 15.8 10l-1.4 4.5H9.6L8.2 10Z"/><path d="M12 3v4.5M4.8 8.2l3.4 1.8M19.2 8.2l-3.4 1.8M7.5 20l2.1-5.5M16.5 20l-2.1-5.5"/></svg>',
        mlbb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V5z"/><path d="m9 12.5 2 2 4-4.5"/></svg>',
        pubg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".7" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
        freefire: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2c1 3-2 4-2 7a4 4 0 0 0 8 0c0-1.5-.8-2.3-1.3-3 .6 2-.7 3-1.7 3 .6-1.6-.3-2.8-1-4-.8-1.4-1.3-2-2-3Z"/><path d="M8.5 13a6 6 0 1 0 11.8-1.6C19.6 16 17 19 12 20c-4 .8-7-1.6-7-5 0-1.3.5-2.3 1-3 .3 1 1.3 1.6 2.5 1Z"/></svg>',
    };
    function gameIcon(gameId) { return GAME_ICON_SVG[gameId] || GAME_ICON_SVG.efootball; }

    /** Field labels change per game: "Team overall" vs "Rank" vs "Tier". */
    function fieldLabel(gameId, slot) {
        const key = GAME_KEY[gameId];
        const map = { level: 'level', currency: 'currency', highlights: 'highlights' };
        const base = map[slot];
        if (!base) return '';
        return key ? t(base + key) : t(`${base}Generic`);
    }

    /* ================= icons ================= */

    const ICONS = {
        search: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
        close: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
        arrow: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
        chevronLeft: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>',
        chevronRight: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
        copy: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
        share: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="M8.4 10.8 15.6 6.6M8.4 13.2l7.2 4.2"/></svg>',
        check: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7"/></svg>',
        menu: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
        home: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 10.5 8-6.5 8 6.5"/><path d="M6 9.5V20h12V9.5"/></svg>',
        grid: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="7"/><rect x="13.5" y="3.5" width="7" height="7"/><rect x="3.5" y="13.5" width="7" height="7"/><rect x="13.5" y="13.5" width="7" height="7"/></svg>',
        users: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.4"/><path d="M2.8 19c.9-3.4 3.3-5.2 6.2-5.2s5.3 1.8 6.2 5.2"/><path d="M15.8 5.2A3.4 3.4 0 0 1 16.5 12M18.3 13.8c2.2.6 3.7 2.2 4.3 4.6"/></svg>',
        tag: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.6 3.4h6v6L8.4 19.6a1.5 1.5 0 0 1-2.1 0l-3.9-3.9a1.5 1.5 0 0 1 0-2.1z"/><circle cx="16.6" cy="7.4" r="1.3" fill="currentColor" stroke="none"/></svg>',
        verified: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="m12 1.8 2.5 2 3.2-.3 1 3 2.6 1.9-1.2 3 1.2 3-2.6 1.9-1 3-3.2-.3-2.5 2-2.5-2-3.2.3-1-3L3.7 18.3l1.2-3-1.2-3L6.3 6.5l1-3 3.2.3z"/><path d="m10.6 15.4-2.9-2.9 1.3-1.3 1.6 1.6 4-4 1.3 1.3z" fill="#07080d"/></svg>',
        telegram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3 18.7 19.5c-.24 1.06-.87 1.32-1.76.82l-4.86-3.58-2.35 2.26c-.26.26-.48.48-.98.48l.35-4.94 9-8.13c.39-.35-.09-.54-.6-.19L6.4 13.1 1.6 11.6c-1.04-.33-1.06-1.04.22-1.54L20.55 2.8c.87-.32 1.63.2 1.35 1.5z"/></svg>',
        facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94z"/></svg>',
        email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="m3 7 8.2 5.5a1.5 1.5 0 0 0 1.6 0L21 7"/></svg>',
        phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6.6 3h-.9A2.7 2.7 0 0 0 3 5.7C3 14.15 9.85 21 18.3 21a2.7 2.7 0 0 0 2.7-2.7v-.9a1.2 1.2 0 0 0-.9-1.16l-3.3-.83a1.2 1.2 0 0 0-1.25.46l-.86 1.15a13.6 13.6 0 0 1-5.71-5.71l1.15-.86a1.2 1.2 0 0 0 .46-1.25l-.83-3.3A1.2 1.2 0 0 0 8.6 3z"/></svg>',
        viber: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.5c-3.4 0-6.1.5-7.9 2.3C2.6 5.3 2 7.7 2 11v.6c0 3.3.6 5.7 2.1 7.2.5.5 1.1.9 1.9 1.2v2.4c0 .5.6.8 1 .5l2.2-2c.9.1 1.8.1 2.8.1 3.4 0 6.1-.5 7.9-2.3 1.5-1.5 2.1-3.9 2.1-7.2V11c0-3.3-.6-5.7-2.1-7.2C18.1 2 15.4 1.5 12 1.5m4.6 14.3c-.3.6-1 1.2-1.7 1.3-.5.1-1 .2-3.4-.8-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8 0-1.3.7-2 .9-2.2.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.4-.3.3c-.1.1-.2.3-.1.5.1.2.6 1.1 1.4 1.8 1 .9 1.8 1.2 2 1.3.2.1.4.1.5-.1l.6-.7c.2-.2.3-.2.6-.1l1.9.9c.3.1.4.2.5.3.1.3.1.7-.1 1.2"/></svg>',
    };

    /* ================= contact channels ================= */

    function telegramUrl(handle) {
        const v = String(handle || '').trim();
        if (!v) return '';
        if (/^https?:\/\//i.test(v)) return v;
        const clean = v.replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '');
        return clean ? `https://t.me/${clean}` : '';
    }

    function facebookUrl(value) {
        const v = String(value || '').trim();
        if (!v) return '';
        if (/^https?:\/\//i.test(v)) return v;
        if (/^(m\.me|fb\.com|facebook\.com)\//i.test(v)) return `https://${v}`;
        return `https://facebook.com/${v.replace(/^@/, '')}`;
    }

    function viberUrl(value) {
        const v = String(value || '').trim();
        if (!v) return '';
        if (/^(viber:|https?:)/i.test(v)) return v;
        const digits = v.replace(/[^\d+]/g, '');
        return digits ? `viber://chat?number=${encodeURIComponent(digits)}` : '';
    }

    const CHANNELS = [
        { key: 'telegram', cls: 'ch-telegram', icon: 'telegram', url: telegramUrl, label: () => 'Telegram', display: (v) => v.replace(/^https?:\/\/(t\.me\/)?/i, '@').replace(/^@@/, '@') },
        { key: 'facebook', cls: 'ch-facebook', icon: 'facebook', url: facebookUrl, label: () => 'Facebook', display: (v) => v.replace(/^https?:\/\/(www\.)?/i, '') },
        { key: 'email', cls: 'ch-email', icon: 'email', url: (v) => `mailto:${v}`, label: () => 'Email', display: (v) => v },
        { key: 'phone', cls: 'ch-phone', icon: 'phone', url: (v) => `tel:${String(v).replace(/[^\d+]/g, '')}`, label: () => 'Phone', display: (v) => v },
        { key: 'viber', cls: 'ch-viber', icon: 'viber', url: viberUrl, label: () => 'Viber', display: (v) => v },
    ];

    /**
     * Turn a contacts object into a renderable list.
     * Accepts either `{ telegram, facebook, … }` (sellers) or the flat
     * `contactTelegram, contactFacebook, …` shape used by site settings.
     */
    function channelsFrom(source) {
        if (!source) return [];
        const out = [];
        CHANNELS.forEach((def) => {
            const raw = source[def.key]
                || source[`contact${def.key.charAt(0).toUpperCase()}${def.key.slice(1)}`];
            if (!raw) return;
            const href = def.url(raw);
            if (!href) return;
            out.push({
                key: def.key,
                cls: def.cls,
                icon: ICONS[def.icon],
                label: def.label(),
                value: def.display(String(raw)),
                href,
            });
        });
        return out;
    }

    function channelList(list, options) {
        const opts = options || {};
        if (!list.length) return '';
        return `<div class="channels${opts.compact ? ' compact' : ''}">${list.map((c) => `
            <a class="channel ${c.cls}" href="${esc(c.href)}" target="_blank" rel="noopener noreferrer">
                <span class="ico">${c.icon}</span>
                <span class="meta"><b>${esc(c.label)}</b><span>${esc(c.value)}</span></span>
                <span class="go">${ICONS.arrow}</span>
            </a>`).join('')}</div>`;
    }

    /* ================= status pills ================= */

    function statusPill(status) {
        const map = {
            available: ['pill-available', 'statusAvailable'],
            reserved: ['pill-reserved', 'statusReserved'],
            sold: ['pill-sold', 'statusSold'],
        };
        const [cls, key] = map[status] || map.available;
        return `<span class="pill ${cls}"><span class="dot"></span>${esc(t(key))}</span>`;
    }

    /* ================= API client ================= */

    const token = {
        get: () => localStorage.getItem(TOKEN_KEY) || '',
        set: (value) => localStorage.setItem(TOKEN_KEY, value),
        clear: () => localStorage.removeItem(TOKEN_KEY),
    };

    async function api(path, options) {
        const opts = options || {};
        const headers = Object.assign({}, opts.headers);
        const auth = token.get();
        if (auth) headers['x-auth-token'] = auth;

        const isForm = opts.body instanceof FormData;
        if (opts.json !== undefined) {
            headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(opts.json);
        }
        if (isForm) delete headers['Content-Type'];

        const res = await fetch(path, { method: opts.method || 'GET', headers, body: opts.body });
        let data = null;
        try { data = await res.json(); } catch { /* empty body */ }

        if (!res.ok) {
            const err = new Error((data && data.error) || `Request failed (${res.status})`);
            err.status = res.status;
            err.data = data;
            throw err;
        }
        return data;
    }

    /* ================= toasts ================= */

    function toastStack() {
        let el = document.querySelector('.toast-stack');
        if (!el) {
            el = document.createElement('div');
            el.className = 'toast-stack';
            el.setAttribute('role', 'status');
            el.setAttribute('aria-live', 'polite');
            document.body.appendChild(el);
        }
        return el;
    }

    function toast(message, type) {
        const kind = type || 'info';
        const el = document.createElement('div');
        el.className = `toast ${kind}`;
        el.innerHTML = `<span class="glyph">${kind === 'success' ? '✓' : (kind === 'error' ? '!' : 'i')}</span><span></span>`;
        el.lastElementChild.textContent = message;
        toastStack().appendChild(el);
        setTimeout(() => {
            el.classList.add('leaving');
            setTimeout(() => el.remove(), 260);
        }, 3800);
    }

    async function copyText(value) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(value);
            } else {
                const ta = document.createElement('textarea');
                ta.value = value;
                ta.style.cssText = 'position:fixed;opacity:0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
            }
            return true;
        } catch {
            return false;
        }
    }

    /* ================= site settings ================= */

    async function loadSite() {
        try {
            SITE = await api('/api/site');
        } catch {
            SITE = {};
        }
        return SITE;
    }

    /** Admin-editable copy with a translated fallback. */
    function siteText(key, fallbackKey) {
        const suffix = getLang() === 'mm' ? 'Mm' : 'En';
        const other = getLang() === 'mm' ? 'En' : 'Mm';
        return SITE[key + suffix] || SITE[key + other] || (fallbackKey ? t(fallbackKey) : '');
    }

    /* ================= DOM helpers ================= */

    const $ = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

    function el(tag, className, html) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (html !== undefined) node.innerHTML = html;
        return node;
    }

    function debounce(fn, wait) {
        let timer = null;
        return function debounced() {
            const args = arguments;
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(null, args), wait);
        };
    }

    function skeletonCards(count) {
        let out = '';
        for (let i = 0; i < count; i += 1) {
            out += '<div class="skeleton"><div class="sk-media"></div><div class="sk-line"></div><div class="sk-line short"></div></div>';
        }
        return out;
    }

    function emptyState(titleKey, bodyKey, glyph, actionHtml) {
        return `<div class="empty">
            <div class="glyph">${glyph || '🎮'}</div>
            <h3>${esc(t(titleKey))}</h3>
            <p>${esc(t(bodyKey))}</p>
            ${actionHtml || ''}
        </div>`;
    }

    window.EX = {
        // language
        t, getLang, setLang, pick, field, applyTranslations,
        // formatting
        esc, truncate, money, shortDate, monthYear,
        // games
        games, gameById, gameName, fieldLabel, gameIcon, gameLogo,
        // ui
        ICONS, statusPill, channelsFrom, channelList,
        toast, copyText, skeletonCards, emptyState,
        // data
        api, token, loadSite, site, siteText,
        // dom
        $, $$, el, debounce,
    };
})();
