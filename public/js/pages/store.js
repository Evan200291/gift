/* =============================================================
   pages/store.js — a single seller's public storefront.
   Reached at /store/<username>; the seller shares this link directly.

   Layout: a profile card (gradient cover, avatar, name, bio, three
   stat tiles, game tags, contact buttons) above the seller's live
   listings, newest first. No filter/sort form — a single seller's
   stock is small enough to scan.
   ============================================================= */
(function () {
    'use strict';

    const {
        t, esc, api, gameName, gameById, ICONS, channelsFrom, field,
        toast, copyText, emptyState, skeletonCards, monthYear, $,
    } = window.EX;

    let data = null;

    function username() {
        const m = window.location.pathname.match(/\/store\/([^/?#]+)/);
        return m ? decodeURIComponent(m[1]) : (new URLSearchParams(window.location.search).get('u') || '');
    }

    function contactButtons(channels) {
        return channels.map((c) => `
            <a class="pcontact ${esc(c.cls)}" href="${esc(c.href)}" target="_blank" rel="noopener noreferrer">
                <span class="pcontact-ico">${c.icon}</span>
                <span class="pcontact-meta"><b>${esc(c.label)}</b><span>${esc(c.value)}</span></span>
                <span class="pcontact-go">${ICONS.arrow}</span>
            </a>`).join('');
    }

    /**
     * Pick the profile cover colours from the avatar: sample it on a tiny
     * canvas, bucket pixels by hue weighted by how vivid they are, and use
     * the strongest bucket's average colour. Greyscale photos fall back to
     * their overall average. Leaves the brand gradient if anything fails.
     */
    function applyCoverFromAvatar(src) {
        const cover = $('.profile-cover');
        if (!src || !cover) return;
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
            try {
                const N = 40;
                const canvas = document.createElement('canvas');
                canvas.width = N; canvas.height = N;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(img, 0, 0, N, N);
                const px = ctx.getImageData(0, 0, N, N).data;
                const bins = Array.from({ length: 12 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
                let ar = 0; let ag = 0; let ab = 0; let an = 0;
                for (let i = 0; i < px.length; i += 4) {
                    if (px[i + 3] < 128) continue;
                    const r = px[i]; const g = px[i + 1]; const b = px[i + 2];
                    ar += r; ag += g; ab += b; an += 1;
                    const max = Math.max(r, g, b); const min = Math.min(r, g, b);
                    const l = (max + min) / 510;
                    const d = (max - min) / 255;
                    if (d < 0.12 || l < 0.12 || l > 0.92) continue;
                    const sat = d / (1 - Math.abs(2 * l - 1));
                    let h;
                    if (max === r) h = ((g - b) / (max - min)) % 6;
                    else if (max === g) h = (b - r) / (max - min) + 2;
                    else h = (r - g) / (max - min) + 4;
                    const bin = bins[((Math.round(h * 2) % 12) + 12) % 12];
                    const w = sat * (1 - Math.abs(l - 0.5));
                    bin.w += w; bin.r += r * w; bin.g += g * w; bin.b += b * w;
                }
                if (!an) return;
                const best = bins.reduce((a, c) => (c.w > a.w ? c : a));
                const rgb = best.w > an * 0.04
                    ? [best.r / best.w, best.g / best.w, best.b / best.w]
                    : [ar / an, ag / an, ab / an];
                const [r, g, b] = rgb.map((v) => Math.round(v));
                cover.style.setProperty('--cover-a', `rgb(${r}, ${g}, ${b})`);
                cover.classList.add('has-photo-colour');
            } catch { /* tainted canvas or decode error: keep brand gradient */ }
        };
        img.src = src;
    }

    function renderHead() {
        const s = data.seller;
        const name = s.displayName || s.username;
        const channels = channelsFrom(s.contacts);
        const bio = field(s, 'bio');
        const games = (s.games && s.games.length ? s.games : data.stats.games) || [];
        const avatar = s.avatar
            ? `<img src="${esc(s.avatar)}" alt="">`
            : esc(name.charAt(0).toUpperCase());

        $('#storeHead').innerHTML = `<section class="profile">
            <div class="profile-cover" aria-hidden="true">
                <span class="profile-cover-bars">${games.map((g) => `<i data-game="${esc(g)}"></i>`).join('')}</span>
            </div>
            <div class="shell profile-body">
                <div class="profile-top">
                    <span class="profile-av"><span class="profile-av-inner">${avatar}</span></span>
                    <div class="profile-id">
                        <h1>${esc(name)}${s.verified ? `<span class="verified" title="${esc(t('verifiedSeller'))}">${ICONS.verified}</span>` : ''}</h1>
                        <span class="profile-handle">@${esc(s.username)}${s.verified ? ` · <span class="profile-verified" data-i18n="verifiedSeller">${esc(t('verifiedSeller'))}</span>` : ''}</span>
                    </div>
                    <button type="button" class="profile-share" id="copyStore" aria-label="${esc(t('copyLink'))}" title="${esc(t('copyLink'))}">${ICONS.copy}</button>
                </div>
                ${bio ? `<p class="profile-bio">${esc(bio)}</p>` : ''}

                <div class="profile-stats">
                    <div class="pstat"><b class="tabular">${data.stats.total}</b><span data-i18n="sellerListings">${esc(t('sellerListings'))}</span></div>
                    <div class="pstat"><b class="tabular">${games.length}</b><span data-i18n="storeGames">${esc(t('storeGames'))}</span></div>
                    <div class="pstat"><b>${esc(monthYear(s.createdAt))}</b><span data-i18n="storeSince">${esc(t('storeSince'))}</span></div>
                </div>

                ${games.length ? `<div class="profile-games">${games.map((g) =>
                    `<span class="pill pill-game" data-game="${esc(g)}">${esc(gameById(g).short || gameName(g))}</span>`).join('')}</div>` : ''}

                ${channels.length ? `<div class="profile-contact">
                    <span class="profile-label" data-i18n="contactSeller">${esc(t('contactSeller'))}</span>
                    <div class="pcontacts">${contactButtons(channels)}</div>
                </div>` : ''}
            </div>
        </section>`;

        applyCoverFromAvatar(s.avatar);
        document.title = `${name} — ${window.EX.site().brand || ''}`;

        $('#copyStore').addEventListener('click', async () => {
            const ok = await copyText(window.location.origin + '/store/' + s.username);
            toast(ok ? t('shareCopied') : 'Copy failed', ok ? 'success' : 'error');
        });
    }

    function renderGrid() {
        const items = data.items.slice().sort((a, b) => b.createdAt - a.createdAt);
        const grid = $('#grid');
        grid.innerHTML = items.length
            ? items.map((l) => window.UI.listingCard(l, { hideSeller: true })).join('')
            : emptyState('emptyTitle', 'emptyBody', '🎮');
        window.UI.wireCards(grid);
        $('#storeListingsHead').hidden = false;
        $('#resultCount').textContent = items.length ? String(items.length) : '';
    }

    function renderAll() {
        renderHead();
        renderGrid();
    }

    (async function boot() {
        await window.UI.boot();
        $('#grid').innerHTML = skeletonCards(6);

        try {
            data = await api('/api/sellers/' + encodeURIComponent(username()));
            renderAll();
        } catch {
            $('#storeHead').innerHTML = '';
            $('#grid').innerHTML = emptyState('notFoundTitle', 'notFoundBody', '🔍');
        }

        document.addEventListener('langchange', () => { if (data) renderAll(); });
    })();
})();
