/* =============================================================
   ui.js — shared chrome and components for the public site.

   Every page ships an empty <div data-header> / <div data-footer>;
   this module fills them, so navigation and the footer are defined
   once. It also owns the listing card, pagination and ad slots.
   ============================================================= */
(function () {
    'use strict';

    const {
        t, esc, money, truncate, statusPill, ICONS, gameName, site, siteText,
        channelsFrom, channelList, api, setLang, getLang, applyTranslations,
        $, $$, monthYear,
    } = window.EX;

    /* ================= header ================= */

    const NAV = [
        { href: '/', key: 'navHome', match: (p) => p === '/' },
        { href: '/browse', key: 'navBrowse', match: (p) => p === '/browse' },
        { href: '/sellers', key: 'navSellers', match: (p) => p.startsWith('/sellers') || p.startsWith('/store') },
        { href: '/blog', key: 'navBlog', match: (p) => p.startsWith('/blog') },
        { href: '/sell', key: 'navSell', match: (p) => p === '/sell' },
        { href: '/advertise', key: 'navAdvertise', match: (p) => p === '/advertise' },
    ];

    function brandBlock() {
        const brand = site().brand || 'EXABYTE';
        const tagline = site().tagline || 'Digital Store';
        return `<a class="brand" href="/">
            <span class="brand-mark">${esc(brand.trim().charAt(0).toUpperCase() || 'E')}</span>
            <span class="brand-div"></span>
            <span class="brand-name"><b>${esc(brand)}</b><span>${esc(tagline)}</span></span>
        </a>`;
    }

    function headerMarkup() {
        const path = window.location.pathname.replace(/\/+$/, '') || '/';
        const links = NAV.map((item) =>
            `<a href="${item.href}" class="${item.match(path) ? 'active' : ''}" data-i18n="${item.key}">${esc(t(item.key))}</a>`
        ).join('');

        return `<div class="shell nav">
            ${brandBlock()}
            <span class="nav-spacer"></span>
            <nav class="nav-links">${links}</nav>
            <div class="nav-tools">
                <div class="lang-switch" role="group" aria-label="Language">
                    <button type="button" data-lang="en" class="${getLang() === 'en' ? 'active' : ''}">EN</button>
                    <button type="button" data-lang="mm" class="${getLang() === 'mm' ? 'active' : ''}">မြန်မာ</button>
                </div>
                <a class="btn btn-outline btn-sm nav-portal" href="/seller" data-i18n="navSellerLogin">${esc(t('navSellerLogin'))}</a>
                <button type="button" class="btn btn-ghost btn-icon nav-burger" data-i18n-aria="menu" aria-label="Menu">${ICONS.menu}</button>
            </div>
        </div>
        <div class="mobile-nav" hidden>
            <div class="shell">
                ${NAV.map((i) => `<a href="${i.href}" data-i18n="${i.key}">${esc(t(i.key))}</a>`).join('')}
                <a href="/seller" data-i18n="navSellerLogin">${esc(t('navSellerLogin'))}</a>
            </div>
        </div>`;
    }

    /* ================= mobile tab bar ================= */

    const TABBAR = [
        { href: '/', key: 'navHome', icon: 'home', match: (p) => p === '/' },
        { href: '/browse', key: 'navBrowse', icon: 'grid', match: (p) => p === '/browse' },
        { href: '/sellers', key: 'navSellers', icon: 'users', match: (p) => p.startsWith('/sellers') || p.startsWith('/store') },
        { href: '/sell', key: 'navSell', icon: 'tag', match: (p) => p === '/sell' },
    ];

    function mountTabbar() {
        if (document.querySelector('.mtabbar')) return;
        const path = window.location.pathname.replace(/\/+$/, '') || '/';
        const bar = document.createElement('nav');
        bar.className = 'mtabbar';
        bar.setAttribute('aria-label', 'Primary');
        bar.innerHTML = TABBAR.map((item) => `<a href="${item.href}" class="${item.match(path) ? 'active' : ''}">
                <span class="ico">${ICONS[item.icon]}</span>
                <span data-i18n="${item.key}">${esc(t(item.key))}</span>
            </a>`).join('');
        document.body.appendChild(bar);
    }

    function mountHeader() {
        const host = $('[data-header]');
        if (!host) return;
        host.className = 'site-header';
        host.innerHTML = headerMarkup();
        mountTabbar();

        $$('.lang-switch button', host).forEach((b) => {
            b.addEventListener('click', () => setLang(b.dataset.lang));
        });

        const burger = $('.nav-burger', host);
        const drawer = $('.mobile-nav', host);
        if (burger && drawer) {
            burger.addEventListener('click', () => { drawer.hidden = !drawer.hidden; });
            $$('a', drawer).forEach((a) => a.addEventListener('click', () => { drawer.hidden = true; }));
        }

        const onScroll = () => host.classList.toggle('is-stuck', window.scrollY > 8);
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    /* ================= footer ================= */

    function footerMarkup() {
        const channels = channelsFrom(site());
        const contactRows = channels.length
            ? channels.map((c) => `<a href="${esc(c.href)}" target="_blank" rel="noopener noreferrer">${esc(c.label)} · ${esc(c.value)}</a>`).join('')
            : `<span class="dim">${esc(t('noContact'))}</span>`;

        const note = site().footerNote
            ? `<p class="mt-16 dim">${esc(site().footerNote)}</p>` : '';

        return `<div class="shell footer-grid">
            <div class="footer-about">
                ${brandBlock()}
                <p data-i18n="footerAboutBody">${esc(t('footerAboutBody'))}</p>
                ${note}
            </div>
            <div>
                <h4 data-i18n="footerMarketplace">${esc(t('footerMarketplace'))}</h4>
                <div class="footer-list">
                    <a href="/browse" data-i18n="navBrowse">${esc(t('navBrowse'))}</a>
                    <a href="/sellers" data-i18n="navSellers">${esc(t('navSellers'))}</a>
                    <a href="/blog" data-i18n="navBlog">${esc(t('navBlog'))}</a>
                </div>
            </div>
            <div>
                <h4 data-i18n="footerCompany">${esc(t('footerCompany'))}</h4>
                <div class="footer-list">
                    <a href="/sell" data-i18n="navSell">${esc(t('navSell'))}</a>
                    <a href="/advertise" data-i18n="navAdvertise">${esc(t('navAdvertise'))}</a>
                    <a href="/seller" data-i18n="navSellerLogin">${esc(t('navSellerLogin'))}</a>
                </div>
            </div>
            <div>
                <h4 data-i18n="footerContact">${esc(t('footerContact'))}</h4>
                <div class="footer-list">${contactRows}</div>
            </div>
        </div>
        <div class="shell footer-bottom">
            <span>© ${new Date().getFullYear()} ${esc(site().brand || 'EXABYTE')}. <span data-i18n="rights">${esc(t('rights'))}</span></span>
            <span class="dim">${esc(site().tagline || '')}</span>
        </div>`;
    }

    function mountFooter() {
        const host = $('[data-footer]');
        if (!host) return;
        host.className = 'site-footer';
        host.innerHTML = footerMarkup();
    }

    /* ================= ads ================= */

    let ADS = null;

    async function loadAds() {
        try {
            ADS = await api('/api/ads');
        } catch {
            ADS = { slots: {}, contact: '', note: '' };
        }
        return ADS;
    }

    function adTelegramUrl() {
        const handle = String((ADS && ADS.contact) || site().adsContact || '').trim();
        if (!handle) return '';
        if (/^https?:\/\//i.test(handle)) return handle;
        const clean = handle.replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '');
        return clean ? `https://t.me/${clean}` : '';
    }

    /**
     * Render one ad slot. An unsold slot still renders — as a tasteful
     * "advertise here" card — so the layout is stable and the space sells itself.
     */
    function adMarkup(slotId, variant) {
        const data = (ADS && ADS.slots && ADS.slots[slotId]) || { filled: false };
        const shape = variant || 'wide';

        if (data.filled) {
            const inner = `
                ${data.image ? `<img src="${esc(data.image)}" alt="${esc(data.title || 'Advertisement')}" loading="lazy">` : ''}
                ${(data.title || data.subtitle) ? `<div class="ad-copy">
                    ${data.title ? `<b>${esc(data.title)}</b>` : ''}
                    ${data.subtitle ? `<span>${esc(data.subtitle)}</span>` : ''}
                </div>` : ''}
                <span class="ad-flag" data-i18n="adLabel">${esc(t('adLabel'))}</span>`;

            return data.link
                ? `<a class="ad ad-${shape} is-filled" href="${esc(data.link)}" target="_blank" rel="noopener noreferrer sponsored">${inner}</a>`
                : `<div class="ad ad-${shape} is-filled">${inner}</div>`;
        }

        const url = adTelegramUrl();
        const handle = (ADS && ADS.contact) || site().adsContact || '';
        return `<div class="ad ad-${shape} is-empty">
            <div class="ad-empty">
                <span class="ad-flag" data-i18n="adLabel">${esc(t('adLabel'))}</span>
                <b data-i18n="adEmptyTitle">${esc(t('adEmptyTitle'))}</b>
                <span data-i18n="adEmptyBody">${esc(t('adEmptyBody'))}</span>
                ${url ? `<a class="btn btn-primary btn-sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">
                    ${ICONS.telegram} ${esc(handle)}
                </a>` : ''}
            </div>
        </div>`;
    }

    /** Fill every <div data-ad="slot-id" data-ad-variant="wide|card|portrait"> on the page. */
    function mountAds() {
        $$('[data-ad]').forEach((host) => {
            host.innerHTML = adMarkup(host.dataset.ad, host.dataset.adVariant);
        });
    }

    /* ================= listing card ================= */

    function listingHref(listing) {
        return `/listing/${encodeURIComponent(listing.id)}`;
    }

    function listingCard(listing, options) {
        const opts = options || {};
        const thumb = (listing.thumbs && listing.thumbs[0]) || (listing.images && listing.images[0]) || '';
        const count = (listing.images || []).length;
        const game = gameName(listing.game);

        const media = thumb
            ? `<img src="${esc(thumb)}" alt="${esc(listing.title_en || game)}" loading="lazy" decoding="async" width="640" height="360">`
            : '<div class="fallback">🎮</div>';

        const specs = [];
        if (listing.level) specs.push(`<span class="spec"><i>🏆</i><b>${esc(truncate(listing.level, 18))}</b></span>`);
        if (listing.currency_amount) specs.push(`<span class="spec"><i>💎</i><b>${esc(truncate(listing.currency_amount, 14))}</b></span>`);
        if (listing.highlights) {
            const first = listing.highlights.split(',')[0].trim();
            if (first) specs.push(`<span class="spec"><i>⭐</i><b>${esc(truncate(first, 18))}</b></span>`);
        }

        const sellerRow = !opts.hideSeller && listing.seller
            ? `<a class="card-seller" href="/store/${esc(listing.seller.username)}">
                   <span class="avatar">${listing.seller.avatar ? `<img src="${esc(listing.seller.avatar)}" alt="">` : esc((listing.seller.displayName || '?').charAt(0).toUpperCase())}</span>
                   <span class="name">${esc(truncate(listing.seller.displayName, 22))}</span>
                   ${listing.seller.verified ? `<span class="verified" title="${esc(t('verifiedSeller'))}">${ICONS.verified}</span>` : ''}
               </a>`
            : '';

        return `<article class="card${listing.status === 'sold' ? ' is-sold' : ''}" data-href="${esc(listingHref(listing))}" tabindex="0" role="link">
            <div class="card-media">
                ${media}
                <div class="media-top">
                    <span class="pill pill-game" data-game="${esc(listing.game)}">${esc(game)}</span>
                    ${count > 1 ? `<span class="pill pill-count">${count} ${esc(t('images'))}</span>` : ''}
                </div>
                <div class="media-bottom">
                    ${statusPill(listing.status)}
                    <span class="price-tag">${esc(money(listing.price))}</span>
                </div>
            </div>
            <div class="card-body">
                ${listing.title_en ? `<div class="card-title">${esc(listing.title_en)}</div>` : ''}
                ${listing.title_mm ? `<div class="card-title-mm" lang="my">${esc(listing.title_mm)}</div>` : ''}
                ${specs.length ? `<div class="spec-row">${specs.join('')}</div>` : ''}
                <div class="card-foot">
                    ${sellerRow || '<span></span>'}
                    <span class="card-cta">${esc(t('viewDetails'))} ${ICONS.arrow}</span>
                </div>
            </div>
        </article>`;
    }

    /** Make rendered cards clickable (and keyboard-operable). */
    function wireCards(root) {
        $$('.card[data-href]', root).forEach((card) => {
            const go = (e) => {
                if (e.target.closest('a')) return; // let the seller link win
                window.location.href = card.dataset.href;
            };
            card.addEventListener('click', go);
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(e); }
            });
        });
    }

    /* ================= pagination ================= */

    function pagination(host, state, onGo) {
        if (!host) return;
        if (!state.totalPages || state.totalPages <= 1) { host.innerHTML = ''; return; }

        const btn = (label, page, opts) => {
            const o = opts || {};
            return `<button type="button" class="pg${o.active ? ' active' : ''}"${o.disabled ? ' disabled' : ''} data-page="${page}">${label}</button>`;
        };

        const parts = [btn(ICONS.chevronLeft, state.page - 1, { disabled: state.page <= 1 })];
        const start = Math.max(1, state.page - 1);
        const end = Math.min(state.totalPages, state.page + 1);

        if (start > 1) {
            parts.push(btn('1', 1));
            if (start > 2) parts.push('<span class="pg-gap">…</span>');
        }
        for (let p = start; p <= end; p += 1) parts.push(btn(String(p), p, { active: p === state.page }));
        if (end < state.totalPages) {
            if (end < state.totalPages - 1) parts.push('<span class="pg-gap">…</span>');
            parts.push(btn(String(state.totalPages), state.totalPages));
        }
        parts.push(btn(ICONS.chevronRight, state.page + 1, { disabled: state.page >= state.totalPages }));

        host.innerHTML = parts.join('');
        $$('.pg', host).forEach((b) => {
            b.addEventListener('click', () => {
                const p = parseInt(b.dataset.page, 10);
                if (!Number.isNaN(p) && p !== state.page) onGo(p);
            });
        });
    }

    /* ================= seller card ================= */

    function sellerCard(seller) {
        const games = (seller.games || []).map((g) => `<span class="spec">${esc(gameName(g))}</span>`).join('');
        return `<a class="seller-card" href="/store/${esc(seller.username)}">
            <span class="avatar lg">${seller.avatar ? `<img src="${esc(seller.avatar)}" alt="">` : esc((seller.displayName || seller.username || '?').charAt(0).toUpperCase())}</span>
            <span class="seller-meta">
                <b>${esc(seller.displayName || seller.username)}
                   ${seller.verified ? `<span class="verified">${ICONS.verified}</span>` : ''}</b>
                <span class="dim">${esc(t('memberSince'))} ${esc(monthYear(seller.createdAt))}</span>
                ${games ? `<span class="spec-row">${games}</span>` : ''}
            </span>
            <span class="seller-count"><b>${seller.listingCount || 0}</b><span>${esc(t('sellerListings'))}</span></span>
        </a>`;
    }

    /* ================= page bootstrap ================= */

    /**
     * Every page calls this first. It loads site settings and ads, mounts the
     * shared chrome, applies the saved language, then hands control back.
     */
    async function boot(options) {
        const opts = options || {};
        await Promise.all([window.EX.loadSite(), opts.ads === false ? Promise.resolve() : loadAds()]);

        mountHeader();
        mountFooter();
        if (opts.ads !== false) mountAds();
        setLang(getLang());

        const brand = site().brand || 'EXABYTE';
        const template = document.documentElement.getAttribute('data-title') || '%s';
        document.title = template.replace('%s', brand);

        document.addEventListener('langchange', () => {
            mountHeader();
            mountFooter();
            if (opts.ads !== false) mountAds();
            applyTranslations();
        });
    }

    window.UI = {
        boot, mountHeader, mountFooter, mountAds, loadAds, adMarkup, adTelegramUrl,
        listingCard, listingHref, wireCards, pagination, sellerCard, brandBlock,
    };
})();
