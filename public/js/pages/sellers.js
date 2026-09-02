/* =============================================================
   pages/sellers.js — directory of subscribed sellers
   ============================================================= */
(function () {
    'use strict';

    const { api, esc, gameName, emptyState, ICONS, $ } = window.EX;

    let ALL = [];
    let q = '';

    function render() {
        const host = $('#sellerGrid');
        const lower = q.trim().toLowerCase();
        const rows = lower
            ? ALL.filter((s) => (s.displayName || s.username || '').toLowerCase().includes(lower)
                || (s.username || '').toLowerCase().includes(lower)
                || (s.games || []).some((g) => gameName(g).toLowerCase().includes(lower)))
            : ALL;
        host.innerHTML = rows.length
            ? rows.map(window.UI.sellerCard).join('')
            : emptyState(lower ? 'noResultsTitle' : 'emptyTitle', lower ? 'noResultsBody' : 'emptyBody', lower ? '🔍' : '🛡️');
    }

    async function load() {
        const host = $('#sellerGrid');
        host.innerHTML = '<div class="skeleton" style="height:96px"></div>'.repeat(4);
        try {
            const data = await api('/api/sellers');
            ALL = data.items || [];
            render();
        } catch {
            host.innerHTML = emptyState('errorTitle', 'errorBody', '⚠️');
        }
    }

    function bindSearch() {
        const wrap = $('#searchWrap');
        const input = $('#sellerSearch');
        const clear = $('#searchClear');
        if (!input) return;
        $('#searchIcon').innerHTML = ICONS.search;
        clear.innerHTML = ICONS.close;
        const sync = () => wrap.classList.toggle('has-value', input.value.length > 0);
        input.addEventListener('input', () => { sync(); q = input.value; render(); });
        clear.addEventListener('click', () => { input.value = ''; sync(); q = ''; input.focus(); render(); });
    }

    (async function boot() {
        await window.UI.boot();
        bindSearch();
        await load();
        document.addEventListener('langchange', load);
    })();
})();
