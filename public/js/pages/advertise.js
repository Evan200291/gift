/* =============================================================
   pages/advertise.js — the four placements and how to book one
   ============================================================= */
(function () {
    'use strict';

    const { t, esc, api, site, ICONS, $ } = window.EX;

    const VARIANT = {
        'home-leaderboard': 'wide',
        'home-inline': 'card',
        'listing-sidebar': 'portrait',
        footer: 'wide',
    };

    function slotRow(slot) {
        return `<div class="panel">
            <div class="row gap-12" style="justify-content:space-between;flex-wrap:wrap;margin-bottom:14px;">
                <div>
                    <h3 style="margin-bottom:4px;">${esc(slot.name)}</h3>
                    <p class="dim" style="font-size:.85rem;">${esc(slot.blurb)}</p>
                </div>
                <span class="spec">${esc(slot.recommended)}</span>
            </div>
            <div data-ad="${esc(slot.id)}" data-ad-variant="${esc(VARIANT[slot.id] || 'card')}"></div>
        </div>`;
    }

    /* The slot catalogue lives on the server; the ad payload is fetched by ui.js. */
    const SLOTS = [
        { id: 'home-leaderboard', name: 'Home — top banner', blurb: 'Full-width strip directly under the hero. The most visible slot on the site.', recommended: '1440 × 240' },
        { id: 'home-inline', name: 'Home — inside the listings grid', blurb: 'Appears between listing rows, styled like a card so it reads as part of the grid.', recommended: '1280 × 720' },
        { id: 'listing-sidebar', name: 'Listing page — sidebar', blurb: 'Sits under the seller contact panel on every listing page.', recommended: '600 × 450' },
        { id: 'footer', name: 'Site-wide — footer banner', blurb: 'Shown above the footer on every page of the site.', recommended: '1440 × 240' },
    ];

    (async function boot() {
        await window.UI.boot();

        const note = site().adsNote;
        if (note) $('#adsNote').textContent = note;

        const url = window.UI.adTelegramUrl();
        const handle = site().adsContact || '';
        $('#adsCta').innerHTML = url
            ? `<a class="btn btn-primary btn-lg" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${ICONS.telegram} ${esc(handle)}</a>`
            : '';

        $('#slotList').innerHTML = SLOTS.map(slotRow).join('');
        window.UI.mountAds();

        document.addEventListener('langchange', () => window.UI.mountAds());
    })();
})();
