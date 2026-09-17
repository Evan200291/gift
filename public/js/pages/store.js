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
        window.UI.avatarColor(src).then((c) => {
            const cover = $('.profile-cover');
            if (!c || !cover) return;
            cover.style.setProperty('--cover-a', c);
            cover.classList.add('has-photo-colour');
        });
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
