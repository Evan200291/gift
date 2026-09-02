/* =============================================================
   pages/sell.js — subscription plans + how to become a seller
   ============================================================= */
(function () {
    'use strict';

    const { t, esc, api, site, ICONS, channelsFrom, channelList, emptyState, $ } = window.EX;

    function planCard(plan, symbol, featured) {
        const limit = plan.listingLimit
            ? `${plan.listingLimit} ${t('listingsIncluded')}`
            : t('unlimitedListings');

        return `<div class="plan${featured ? ' featured' : ''}">
            ${featured ? `<span class="plan-flag">★</span>` : ''}
            <h3 class="display">${esc(plan.name)}</h3>
            <div class="plan-price">
                <b>${esc(symbol)}${esc(String(plan.price))}</b>
                <span>${esc(t('perDays', plan.days))}</span>
            </div>
            <ul>
                <li>${ICONS.check}<span>${esc(limit)}</span></li>
                <li>${ICONS.check}<span>${esc(t('myStoreLink'))}</span></li>
                <li>${ICONS.check}<span>${esc(t('contactSeller'))}</span></li>
                ${plan.blurb ? `<li>${ICONS.check}<span>${esc(plan.blurb)}</span></li>` : ''}
            </ul>
            <a class="btn ${featured ? 'btn-primary' : 'btn-outline'}" href="#contact-admin" data-i18n="planCta">${esc(t('planCta'))}</a>
        </div>`;
    }

    async function loadPlans() {
        try {
            const data = await api('/api/plans');
            const plans = data.plans || [];
            if (data.pitch) $('#sellPitch').textContent = data.pitch;
            const mid = Math.min(1, plans.length - 1);
            $('#plansGrid').innerHTML = plans.length
                ? plans.map((p, i) => planCard(p, data.currencySymbol || '$', i === mid)).join('')
                : emptyState('emptyTitle', 'emptyBody', '💠');
        } catch {
            $('#plansGrid').innerHTML = emptyState('errorTitle', 'errorBody', '⚠️');
        }
    }

    function renderContacts() {
        const host = $('#adminContacts');
        host.id = 'adminContacts';
        const channels = channelsFrom(site());
        host.innerHTML = channels.length
            ? channelList(channels)
            : `<p class="dim">${esc(t('noContact'))}</p>`;
        host.closest('.panel').id = 'contact-admin';
    }

    (async function boot() {
        await window.UI.boot();
        renderContacts();
        await loadPlans();
        document.addEventListener('langchange', () => { renderContacts(); loadPlans(); });
    })();
})();
