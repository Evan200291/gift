/* =============================================================
   pages/browse.js — full account listings: search, price range,
   game filter, sort, pagination. The home page only ever shows a
   6-item preview; this page is where "View all" sends people.
   ============================================================= */
(function () {
    'use strict';

    const {
        t, esc, api, games, gameName, ICONS, skeletonCards, emptyState,
        applyTranslations, $, $$, debounce,
    } = window.EX;

    const params = new URLSearchParams(window.location.search);
    const state = {
        page: 1, totalPages: 1, total: 0,
        q: '', game: params.get('game') || '', sort: 'newest',
        minPrice: '', maxPrice: '', busy: false,
    };

    function renderGameSelect() {
        const select = $('#gameSelect');
        select.innerHTML = `<option value="">${esc(t('allGames'))}</option>`
            + games().map((g) => `<option value="${esc(g.id)}">${esc(gameName(g.id))}</option>`).join('');
        select.value = state.game;
    }

    function renderGrid(items) {
        const grid = $('#grid');
        if (!items.length) {
            grid.innerHTML = (state.q || state.game || state.minPrice || state.maxPrice)
                ? emptyState('noResultsTitle', 'noResultsBody', '🔍')
                : emptyState('emptyTitle', 'emptyBody', '🎮');
            return;
        }
        grid.innerHTML = items.map((l) => window.UI.listingCard(l)).join('');
        window.UI.wireCards(grid);
    }

    async function load(page, scrollTo) {
        if (state.busy) return;
        state.busy = true;
        state.page = page || 1;
        $('#grid').innerHTML = skeletonCards(6);
        $('#pagination').innerHTML = '';

        try {
            const p = new URLSearchParams();
            if (state.q) p.set('q', state.q);
            if (state.game) p.set('game', state.game);
            if (state.minPrice) p.set('minPrice', state.minPrice);
            if (state.maxPrice) p.set('maxPrice', state.maxPrice);
            if (state.sort !== 'newest') p.set('sort', state.sort);
            p.set('page', String(state.page));

            const data = await api(`/api/listings?${p}`);
            state.page = data.page;
            state.totalPages = data.totalPages;
            state.total = data.total;

            renderGrid(data.items || []);
            window.UI.pagination($('#pagination'), state, (pg) => load(pg, true));
            $('#resultCount').textContent = data.total ? `${data.total} ${t('resultsCount')}` : '';

            if (scrollTo) window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch {
            $('#grid').innerHTML = emptyState('errorTitle', 'errorBody', '⚠️');
        } finally {
            state.busy = false;
        }
    }

    function initToolbar() {
        const wrap = $('#searchWrap');
        const input = $('#searchInput');
        const clear = $('#searchClear');

        $('#searchIcon').innerHTML = ICONS.search;
        clear.innerHTML = ICONS.close;

        const sync = () => wrap.classList.toggle('has-value', input.value.length > 0);
        const run = debounce(() => { state.q = input.value.trim(); load(1); }, 320);

        input.addEventListener('input', () => { sync(); run(); });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); state.q = input.value.trim(); load(1); }
            if (e.key === 'Escape') { input.value = ''; sync(); state.q = ''; load(1); }
        });
        clear.addEventListener('click', () => {
            input.value = ''; sync(); state.q = ''; input.focus(); load(1);
        });

        const priceMin = $('#priceMin');
        const priceMax = $('#priceMax');
        const runPrice = debounce(() => {
            state.minPrice = priceMin.value.trim();
            state.maxPrice = priceMax.value.trim();
            load(1);
        }, 400);
        [priceMin, priceMax].forEach((el) => {
            el.addEventListener('input', runPrice);
            el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runPrice(); } });
        });

        $('#gameSelect').addEventListener('change', (e) => { state.game = e.target.value; load(1); });
        $('#sortSelect').addEventListener('change', (e) => { state.sort = e.target.value; load(1); });
    }

    (async function boot() {
        await window.UI.boot();
        renderGameSelect();
        initToolbar();
        await load(1);

        document.addEventListener('langchange', () => {
            renderGameSelect();
            load(state.page);
            applyTranslations();
        });
    })();
})();
