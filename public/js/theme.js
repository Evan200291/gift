/* =============================================================
   theme.js — light / dark theme + the page loading screen.

   Loaded synchronously in <head> on every page, before anything
   paints, so the saved theme applies with no flash.

   Theme: with nothing saved the site follows the device setting
   (no data-theme stamped, CSS uses prefers-color-scheme). The
   toggle is a plain light <-> dark switch; the first press saves
   the opposite of whatever is showing.

   Loader: if a page hasn't finished booting after LOADER_DELAY ms
   (slow network, API trouble), a full-screen loader with the brand
   mark and spinning rings fades in. Pages call EXLoader.done() once
   their chrome is ready. If boot drags past SLOW_AFTER ms the loader
   adds a "still connecting" line; it never hides a broken page.
   ============================================================= */
(function () {
    'use strict';

    const KEY = 'ex_theme';
    const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    function saved() {
        try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : ''; }
        catch (e) { return ''; }
    }

    /** The theme actually showing: saved choice, else the device setting. */
    function current() {
        return saved() || (media && media.matches ? 'dark' : 'light');
    }

    const ICONS = {
        light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
        dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/></svg>',
    };

    function mm() {
        try { return localStorage.getItem('ex_lang') === 'mm'; } catch (e) { return false; }
    }

    function label(mode) {
        // Describes what pressing the button does.
        if (mm()) return mode === 'dark' ? 'အလင်းမုဒ်သို့ ပြောင်းရန်' : 'အမှောင်မုဒ်သို့ ပြောင်းရန်';
        return mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    }

    function syncButton(btn) {
        const mode = current();
        btn.innerHTML = ICONS[mode];
        btn.setAttribute('aria-label', label(mode));
        btn.title = label(mode);
        btn.dataset.mode = mode;
    }

    function apply() {
        const root = document.documentElement;
        const s = saved();
        if (s) root.setAttribute('data-theme', s); else root.removeAttribute('data-theme');
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', current() === 'dark' ? '#0D0A17' : '#F6F4FC');
        document.querySelectorAll('[data-theme-toggle]').forEach(syncButton);
    }

    function set(mode) {
        try { localStorage.setItem(KEY, mode === 'dark' ? 'dark' : 'light'); }
        catch (e) { /* storage blocked: still apply for this page view */ }
        const root = document.documentElement;
        root.setAttribute('data-theme', mode === 'dark' ? 'dark' : 'light');
        apply();
    }

    function toggle() { set(current() === 'dark' ? 'light' : 'dark'); }

    function markup() {
        return '<button type="button" class="theme-toggle" data-theme-toggle></button>';
    }

    /** Wire every [data-theme-toggle] inside root (idempotent). */
    function bind(root) {
        (root || document).querySelectorAll('[data-theme-toggle]').forEach((btn) => {
            syncButton(btn);
            if (btn.dataset.bound) return;
            btn.dataset.bound = '1';
            btn.addEventListener('click', toggle);
        });
    }

    apply();
    if (media && media.addEventListener) media.addEventListener('change', apply);
    document.addEventListener('langchange', () => document.querySelectorAll('[data-theme-toggle]').forEach(syncButton));
    document.addEventListener('DOMContentLoaded', () => bind(document));

    window.EXTheme = { get: current, set, toggle, markup, bind };

    /* ================= loading screen ================= */

    const LOADER_DELAY = 450;
    const SLOW_AFTER = 8000;
    const MARK = '<path d="M0 0h19.91v86.58H0Z"/><path d="M26.84 0h56.28L69.26 19.91H26.84Z"/><path d="M26.84 33.33h35.5L48.49 53.25H26.84Z"/><path d="M26.84 66.67h56.28L69.26 86.58H26.84Z"/>';

    let finished = false;
    let el = null;

    function show() {
        if (finished || el || !document.body) return;
        el = document.createElement('div');
        el.className = 'ex-loader';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.innerHTML = `
            <div class="ex-loader-core">
                <svg class="ex-loader-rings" viewBox="0 0 120 120" aria-hidden="true">
                    <defs><linearGradient id="exLoaderGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stop-color="#C77DFF"/><stop offset="1" stop-color="#F0359A" stop-opacity="0"/>
                    </linearGradient></defs>
                    <circle class="ex-ring-track" cx="60" cy="60" r="52"/>
                    <circle class="ex-ring-arc" cx="60" cy="60" r="52"/>
                    <circle class="ex-ring-dash" cx="60" cy="60" r="42"/>
                </svg>
                <span class="ex-loader-mark"><svg viewBox="0 0 83.12 86.58" fill="currentColor" aria-hidden="true">${MARK}</svg></span>
            </div>
            <p class="ex-loader-text">${mm() ? 'ဖွင့်နေသည်…' : 'Loading…'}</p>`;
        document.body.appendChild(el);
        requestAnimationFrame(() => el && el.classList.add('is-in'));
    }

    const showTimer = setTimeout(show, LOADER_DELAY);
    const slowTimer = setTimeout(() => {
        if (finished) return;
        show();
        const text = el && el.querySelector('.ex-loader-text');
        if (text) text.textContent = mm() ? 'ချိတ်ဆက်နေဆဲ… ခဏစောင့်ပါ' : 'Still connecting… hang tight';
    }, SLOW_AFTER);

    function done() {
        if (finished) return;
        finished = true;
        clearTimeout(showTimer);
        clearTimeout(slowTimer);
        if (!el) return;
        const node = el;
        el = null;
        node.classList.remove('is-in');
        node.classList.add('is-out');
        setTimeout(() => node.remove(), 320);
    }

    window.EXLoader = { done, show };
})();
