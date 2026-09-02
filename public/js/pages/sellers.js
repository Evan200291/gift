/* =============================================================
   pages/sellers.js — directory of subscribed sellers
   ============================================================= */
(function () {
    'use strict';

    const { api, emptyState, $ } = window.EX;

    async function load() {
        const host = $('#sellerGrid');
        host.innerHTML = '<div class="skeleton" style="height:96px"></div>'.repeat(4);
        try {
            const data = await api('/api/sellers');
            const rows = data.items || [];
            host.innerHTML = rows.length
                ? rows.map(window.UI.sellerCard).join('')
                : emptyState('emptyTitle', 'emptyBody', '🛡️');
        } catch {
            host.innerHTML = emptyState('errorTitle', 'errorBody', '⚠️');
        }
    }

    (async function boot() {
        await window.UI.boot();
        await load();
        document.addEventListener('langchange', load);
    })();
})();
