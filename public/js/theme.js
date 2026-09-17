/* =============================================================
   theme.js — light / dark / system colour theme.

   Loaded synchronously in <head> on every page (before the
   stylesheets paint) so the saved theme applies with no flash.
   "system" stamps nothing on <html> and lets the CSS follow
   prefers-color-scheme; "light"/"dark" stamp data-theme.
   ============================================================= */
(function () {
    'use strict';

    const KEY = 'ex_theme';
    const MODES = ['system', 'light', 'dark'];
    const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    function read() {
        try { const v = localStorage.getItem(KEY); return MODES.includes(v) ? v : 'system'; }
        catch (e) { return 'system'; }
    }

    function resolved(mode) {
        if (mode === 'light' || mode === 'dark') return mode;
        return media && media.matches ? 'dark' : 'light';
    }

    const ICONS = {
        system: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/></svg>',
        light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
        dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/></svg>',
    };
    const LABELS = {
        en: { system: 'Theme: system', light: 'Theme: light', dark: 'Theme: dark' },
        mm: { system: 'အရောင်: စနစ်အတိုင်း', light: 'အရောင်: အလင်း', dark: 'အရောင်: အမှောင်' },
    };

    function label(mode) {
        let lang = 'en';
        try { lang = localStorage.getItem('ex_lang') === 'mm' ? 'mm' : 'en'; } catch (e) { /* ignore */ }
        return LABELS[lang][mode];
    }

    function apply(mode) {
        const root = document.documentElement;
        if (mode === 'system') root.removeAttribute('data-theme');
        else root.setAttribute('data-theme', mode);
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', resolved(mode) === 'dark' ? '#0D0A17' : '#F6F4FC');
        document.querySelectorAll('[data-theme-toggle]').forEach(syncButton);
    }

    function syncButton(btn) {
        const mode = read();
        btn.innerHTML = ICONS[mode];
        btn.setAttribute('aria-label', label(mode));
        btn.title = label(mode);
        btn.dataset.mode = mode;
    }

    function set(mode) {
        try { if (mode === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, mode); }
        catch (e) { /* storage blocked: still apply for this page view */ }
        apply(mode);
    }

    function cycle() {
        const cur = read();
        set(MODES[(MODES.indexOf(cur) + 1) % MODES.length]);
    }

    function markup() {
        return '<button type="button" class="theme-toggle" data-theme-toggle></button>';
    }

    /** Wire every [data-theme-toggle] inside root (idempotent). */
    function bind(root) {
        (root || document).querySelectorAll('[data-theme-toggle]').forEach((btn) => {
            syncButton(btn);
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', cycle);
        });
    }

    apply(read());
    if (media && media.addEventListener) media.addEventListener('change', () => apply(read()));
    document.addEventListener('langchange', () => document.querySelectorAll('[data-theme-toggle]').forEach(syncButton));
    document.addEventListener('DOMContentLoaded', () => bind(document));

    window.EXTheme = { get: read, set, cycle, markup, bind, resolved: () => resolved(read()) };
})();
