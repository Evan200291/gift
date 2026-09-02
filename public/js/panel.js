/* =============================================================
   panel.js — small helpers shared by the seller and admin panels.

   Most page-specific code lives in /js/pages/<page>.js. This file
   is for cross-panel utilities that both the seller portal and
   the admin console use (currency-symbol sync, game label refresh,
   contact-channel rendering, plan-name lookup, etc.). The seller
   portal only consumes a small subset — the rest is here so the
   admin panel can share it later.
   ============================================================= */
(function () {
    'use strict';

    if (!window.EX) return;

    const { site, gameName, money, fieldLabel, $, $$ } = window.EX;

    /* Sync the price-symbol prefix in editor forms with the site currency. */
    function refreshPriceSymbol() {
        const sym = (site() && site().currencySymbol) || '$';
        const host = $('#priceSymbol');
        if (host) host.textContent = sym;
    }

    /**
     * Three form fields swap their visible label based on the game pick.
     * Uses EX.fieldLabel (which is i18n-aware) for parity with the
     * storefront; falls back to a generic label if the game is unknown.
     */
    function refreshGameLabels() {
        const sel = $('#f_game');
        if (!sel) return;
        const id = sel.value || 'efootball';
        const setText = (id2, slot) => {
            const el = $('#' + id2);
            if (el) {
                const text = fieldLabel(id, slot) || ({
                    level: 'Level', currency: 'In-game currency', highlights: 'Highlights',
                }[slot] || '');
                el.textContent = text;
            }
        };
        setText('lbl_level',      'level');
        setText('lbl_currency',   'currency');
        setText('lbl_highlights', 'highlights');
    }

    /**
     * Quick "which plan name should I show for this planId?"
     * Loads the plans once and caches them in memory; the cache is
     * reset on every page load (no stale data across reloads).
     */
    let PLANS_CACHE = null;
    function lookupPlanName(planId, plans) {
        if (!planId) return '';
        const list = plans || PLANS_CACHE || [];
        const found = list.find((p) => p.id === planId);
        return found ? (found.name || planId) : planId;
    }

    function setPlansCache(plans) { PLANS_CACHE = Array.isArray(plans) ? plans : []; }

    /* Render a contact-channel list, copying clickable links when possible. */
    function channelList(contacts) {
        if (!contacts) return '';
        const items = [];
        if (contacts.telegram) items.push({ label: 'Telegram',  value: contacts.telegram,  href: /^https?:/i.test(contacts.telegram)  ? contacts.telegram  : ('https://t.me/' + contacts.telegram.replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '')) });
        if (contacts.facebook) items.push({ label: 'Facebook',  value: contacts.facebook,  href: /^https?:/i.test(contacts.facebook)  ? contacts.facebook  : ('https://' + contacts.facebook.replace(/^https?:\/\//i, '')) });
        if (contacts.email)    items.push({ label: 'Email',     value: contacts.email,     href: 'mailto:' + contacts.email });
        if (contacts.phone)    items.push({ label: 'Phone',     value: contacts.phone,     href: 'tel:' + contacts.phone.replace(/[^\d+]/g, '') });
        if (contacts.viber)    items.push({ label: 'Viber',     value: contacts.viber,     href: 'viber://contact?number=' + encodeURIComponent(contacts.viber.replace(/[^\d+]/g, '')) });
        if (!items.length) return '';
        return items.map((c) =>
            `<a class="ch" href="${window.EX.esc(c.href)}" target="_blank" rel="noopener noreferrer">`
            + `<b>${window.EX.esc(c.label)}</b><span>${window.EX.esc(c.value)}</span></a>`
        ).join('');
    }

    window.Panel = {
        refreshPriceSymbol,
        refreshGameLabels,
        lookupPlanName,
        setPlansCache,
        channelList,
    };
})();
