/* =============================================================
   pages/store.js — a single seller's public storefront.
   Reached at /store/<username>; the seller shares this link directly.
   ============================================================= */
(function () {
    'use strict';

    const {
        t, esc, api, gameName, ICONS, channelsFrom, channelList, field,
        toast, copyText, emptyState, skeletonCards, monthYear, $, $$,
    } = window.EX;

    let data = null;
    let game = '';
    let sort = 'newest';

    function username() {
        const m = window.location.pathname.match(/\/store\/([^/?#]+)/);
        return m ? decodeURIComponent(m[1]) : (new URLSearchParams(window.location.search).get('u') || '');
    }

    function renderHead() {
        const s = data.seller;
        const channels = channelsFrom(s.contacts);
        const bio = field(s, 'bio');

        $('#storeHead').innerHTML = `<div class="store-head">
            <span class="avatar" style="width:68px;height:68px;font-size:1.7rem;border-radius:18px;">${esc((s.displayName || s.username).charAt(0).toUpperCase())}</span>
            <div class="store-head-meta">
                <h1 class="display">${esc(s.displayName || s.username)}
                    ${s.verified ? `<span class="verified" title="${esc(t('verifiedSeller'))}">${ICONS.verified}</span>` : ''}</h1>
                <p>${bio ? esc(bio) : ''}</p>
                <p class="dim" style="font-size:.8rem;">${esc(t('memberSince'))} ${esc(monthYear(s.createdAt))} · ${data.stats.total} ${esc(t('sellerListings'))}</p>
            </div>
            <div class="store-head-actions">
                <button type="button" class="btn btn-outline btn-sm" id="copyStore">${ICONS.copy} ${esc(t('copyLink'))}</button>
            </div>
        </div>
        ${channels.length ? `<div class="panel" style="margin-bottom:22px;">
            <h3>${esc(t('contactSeller'))}</h3>${channelList(channels)}</div>` : ''}`;

        $('#crumbName').textContent = s.displayName || s.username;
        document.title = `${s.displayName || s.username} — ${window.EX.site().brand || ''}`;

        $('#copyStore').addEventListener('click', async () => {
            const ok = await copyText(window.location.origin + '/store/' + s.username);
            toast(ok ? t('shareCopied') : 'Copy failed', ok ? 'success' : 'error');
        });
    }

    function renderChips() {
        const host = $('#gameChips');
        const present = data.stats.games || [];
        host.innerHTML = `<button type="button" class="chip${game ? '' : ' active'}" data-game="">${esc(t('allGames'))}</button>`
            + present.map((g) => `<button type="button" class="chip${game === g ? ' active' : ''}" data-game="${esc(g)}">${esc(gameName(g))}</button>`).join('');

        $$('.chip', host).forEach((chip) => {
            chip.addEventListener('click', () => {
                game = chip.dataset.game;
                $$('.chip', host).forEach((c) => c.classList.toggle('active', c === chip));
                renderGrid();
            });
        });
    }

    function renderGrid() {
        let items = data.items.slice();
        if (game) items = items.filter((l) => l.game === game);
        if (sort === 'price_asc') items.sort((a, b) => a.price - b.price);
        else if (sort === 'price_desc') items.sort((a, b) => b.price - a.price);
        else if (sort === 'oldest') items.sort((a, b) => a.createdAt - b.createdAt);
        else items.sort((a, b) => b.createdAt - a.createdAt);

        const grid = $('#grid');
        grid.innerHTML = items.length
            ? items.map((l) => window.UI.listingCard(l, { hideSeller: true })).join('')
            : emptyState('emptyTitle', 'emptyBody', '🎮');
        window.UI.wireCards(grid);
        $('#resultCount').textContent = items.length ? `${items.length} ${t('resultsCount')}` : '';
    }

    function renderAll() {
        renderHead();
        renderChips();
        renderGrid();
    }

    (async function boot() {
        await window.UI.boot();
        $('#sortSelect').addEventListener('change', (e) => { sort = e.target.value; renderGrid(); });
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
