/* =============================================================
   pages/advertise.js — the ad placements and how to book one.

   Each placement shows its real geometry: upload size, what it renders
   at on desktop and phones, a scaled diagram of the artwork with the
   safe zone marked, and a live preview at (up to) its actual on-site
   width — the listing sidebar is ~480px wide there, so its preview is
   capped to that instead of stretching across the page.
   ============================================================= */
(function () {
    'use strict';

    const { esc, site, ICONS, $ } = window.EX;

    /*
     * Geometry (keep in sync with components.css .ad-* rules):
     * - Wide banners: 8:1 on desktop/tablet (~1156x145 at full width); on
     *   phones (<=720px) they show at 4:1 with object-fit: cover, so 400px
     *   is trimmed off each side of a 1600x200 upload. The "Advertisement"
     *   flag sits in the top-right corner.
     * - Listing sidebar: 4:3 everywhere, no crop (~480x360 desktop,
     *   ~350x260 phone).
     */
    const SLOTS = [
        {
            id: 'home-leaderboard', variant: 'wide', preview: 'full',
            name: 'Home — top banner',
            blurb: 'Full-width strip directly under the hero. The most visible slot on the site.',
            upload: '1600 × 200 px', desktop: '≈ 1156 × 145 px (8:1)', phone: '≈ 350 × 88 px (4:1, sides trimmed)',
            safe: { x: 400, y: 24, w: 800, h: 152, W: 1600, H: 200 }, safeLabel: 'Centre 800 × 152 px',
        },
        {
            id: 'home-inline', variant: 'wide', preview: 'full',
            name: 'Home — inside the listings grid',
            blurb: 'Full-width banner between rows of listings, right where buyers are browsing.',
            upload: '1600 × 200 px', desktop: '≈ 1156 × 145 px (8:1)', phone: '≈ 350 × 88 px (4:1, sides trimmed)',
            safe: { x: 400, y: 24, w: 800, h: 152, W: 1600, H: 200 }, safeLabel: 'Centre 800 × 152 px',
        },
        {
            id: 'listing-sidebar', variant: 'portrait', preview: 'sidebar',
            name: 'Listing page — sidebar',
            blurb: 'Sits under the seller contact panel on every listing page.',
            upload: '600 × 450 px', desktop: '≈ 480 × 360 px (4:3)', phone: '≈ 350 × 262 px (4:3, no crop)',
            safe: { x: 30, y: 44, w: 540, h: 376, W: 600, H: 450 }, safeLabel: 'Inner 540 × 376 px',
        },
        {
            id: 'footer', variant: 'wide', preview: 'full',
            name: 'Site-wide — footer banner',
            blurb: 'Shown above the footer on every page of the site.',
            upload: '1600 × 200 px', desktop: '≈ 1156 × 145 px (8:1)', phone: '≈ 350 × 88 px (4:1, sides trimmed)',
            safe: { x: 400, y: 24, w: 800, h: 152, W: 1600, H: 200 }, safeLabel: 'Centre 800 × 152 px',
        },
        {
            id: 'footer-brand', variant: 'mini', preview: 'mini',
            name: 'Site-wide — beside the footer logo',
            blurb: 'Compact spot right next to the EXABYTE logo in the footer of every page. Small on phones, so use a logo or 2–3 big words.',
            upload: '800 × 200 px', desktop: '≈ 300 × 75 px (4:1)', phone: '≈ 180 × 45 px (4:1, no crop)',
            safe: { x: 40, y: 30, w: 720, h: 140, W: 800, H: 200 }, safeLabel: 'Inner 720 × 140 px',
        },
    ];

    const pct = (v, of) => `${(v / of * 100).toFixed(2)}%`;

    function diagram(s) {
        const z = s.safe;
        return `<div class="sz-diagram" style="aspect-ratio:${z.W} / ${z.H}">
            <span class="sz-flag">AD</span>
            ${s.variant === 'wide' ? `<span class="sz-trim sz-trim-l" style="width:${pct(400, z.W)}"></span><span class="sz-trim sz-trim-r" style="width:${pct(400, z.W)}"></span>` : ''}
            <span class="sz-safe" style="left:${pct(z.x, z.W)};top:${pct(z.y, z.H)};width:${pct(z.w, z.W)};height:${pct(z.h, z.H)}"><em>SAFE</em></span>
        </div>`;
    }

    function slotRow(s) {
        return `<article class="ad-slot">
            <header class="ad-slot-head">
                <div>
                    <h3>${esc(s.name)}</h3>
                    <p>${esc(s.blurb)}</p>
                </div>
            </header>
            <div class="ad-slot-body">
                <div class="ad-spec">
                    <dl>
                        <div><dt>Upload</dt><dd>${esc(s.upload)}</dd></div>
                        <div><dt>Desktop</dt><dd>${esc(s.desktop)}</dd></div>
                        <div><dt>Phone</dt><dd>${esc(s.phone)}</dd></div>
                        <div><dt>Safe zone</dt><dd>${esc(s.safeLabel)}</dd></div>
                    </dl>
                    ${diagram(s)}
                    <ul class="ad-notes">
                        ${s.variant === 'wide'
                            ? '<li><i class="sw-trim"></i>Hidden on phones — keep text and logos out of these side bands.</li>'
                            : '<li><i class="sw-trim"></i>Shown in full on every screen size.</li>'}
                        <li><i class="sw-safe"></i>Put all text, logos and prices inside the safe zone.</li>
                        <li><i class="sw-flag"></i>The “Advertisement” label covers the top-right corner.</li>
                    </ul>
                </div>
                <div class="ad-preview ad-preview-${s.preview}">
                    <span class="ad-preview-label">Live preview</span>
                    <div data-ad="${esc(s.id)}" data-ad-variant="${esc(s.variant)}"></div>
                </div>
            </div>
        </article>`;
    }

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
