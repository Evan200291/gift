/* =============================================================
   pages/home.js — marketplace home: categories, listings, sellers, blog
   ============================================================= */
(function () {
    'use strict';

    const {
        t, esc, api, site, siteText, games, gameName, gameById, gameIcon,
        ICONS, toast, skeletonCards, emptyState, applyTranslations,
        getLang, $, $$, debounce, shortDate, truncate,
    } = window.EX;

    const state = { page: 1, totalPages: 1, total: 0, q: '', game: '', sort: 'newest', minPrice: '', maxPrice: '', busy: false };

    /* ---------------- categories ---------------- */

    function renderCategories(counts) {
        const rail = $('#catRail');
        rail.innerHTML = games().map((g) => `
            <button type="button" class="cat-card${state.game === g.id ? ' active' : ''}"
                    data-game="${esc(g.id)}" style="--cat:${esc(g.accent || '#7c5cff')}">
                <span class="cat-glyph">${gameIcon(g.id)}</span>
                <span class="cat-meta">
                    <b>${esc(gameName(g.id))}</b>
                    <span>${(counts && counts[g.id]) || 0} ${esc(t('accountsAvailable'))}</span>
                </span>
            </button>`).join('');

        $$('.cat-card', rail).forEach((card) => {
            card.addEventListener('click', () => {
                state.game = state.game === card.dataset.game ? '' : card.dataset.game;
                $('#gameSelect').value = state.game;
                $$('.cat-card', rail).forEach((c) => c.classList.toggle('active', c.dataset.game === state.game));
                load(1, true);
            });
        });
    }

    function renderGameSelect() {
        const select = $('#gameSelect');
        select.innerHTML = `<option value="">${esc(t('allGames'))}</option>`
            + games().map((g) => `<option value="${esc(g.id)}">${esc(gameName(g.id))}</option>`).join('');
        select.value = state.game;
    }

    /* ---------------- listings ---------------- */

    function renderGrid(items) {
        const grid = $('#grid');
        if (!items.length) {
            grid.innerHTML = (state.q || state.game || state.minPrice || state.maxPrice)
                ? emptyState('noResultsTitle', 'noResultsBody', '🔍')
                : emptyState('emptyTitle', 'emptyBody', '🎮');
            return;
        }

        const cards = items.map((l) => window.UI.listingCard(l));
        // Slot the in-grid advertisement in after the first row so it reads as
        // part of the catalogue rather than an interruption.
        if (cards.length >= 4) {
            cards.splice(Math.min(6, cards.length), 0,
                '<div data-ad="home-inline" data-ad-variant="card"></div>');
        }
        grid.innerHTML = cards.join('');
        window.UI.wireCards(grid);
        window.UI.mountAds();
    }

    async function load(page, scrollTo) {
        if (state.busy) return;
        state.busy = true;
        state.page = page || 1;
        $('#grid').innerHTML = skeletonCards(6);
        $('#pagination').innerHTML = '';

        try {
            const params = new URLSearchParams();
            if (state.q) params.set('q', state.q);
            if (state.game) params.set('game', state.game);
            if (state.minPrice) params.set('minPrice', state.minPrice);
            if (state.maxPrice) params.set('maxPrice', state.maxPrice);
            if (state.sort !== 'newest') params.set('sort', state.sort);
            params.set('page', String(state.page));

            const data = await api(`/api/listings?${params}`);
            state.page = data.page;
            state.totalPages = data.totalPages;
            state.total = data.total;

            renderGrid(data.items || []);
            window.UI.pagination($('#pagination'), state, (p) => load(p, true));
            $('#resultCount').textContent = data.total ? `${data.total} ${t('resultsCount')}` : '';

            if (scrollTo) {
                const target = document.getElementById('listings');
                if (target) window.scrollTo({ top: target.offsetTop - 90, behavior: 'smooth' });
            }
        } catch {
            $('#grid').innerHTML = emptyState('errorTitle', 'errorBody', '⚠️');
        } finally {
            state.busy = false;
        }
    }

    /* ---------------- sellers + blog ---------------- */

    function hudSellerCard(s) {
        const accent = (gameById((s.games || [])[0]) || {}).accent || 'var(--neon-deep)';
        const av = s.avatar
            ? `<img src="${esc(s.avatar)}" alt="">`
            : esc((s.displayName || s.username || '?').charAt(0).toUpperCase());
        return `<a class="hud-sel" href="/store/${esc(s.username)}">
            <div class="hud-sel-top">
                <span class="hud-av" style="background:${esc(accent)}">${av}</span>
                <span>
                    <span class="hud-name">${esc(truncate(s.displayName || s.username, 16))}${s.verified ? ` ${ICONS.verified}` : ''}</span>
                    <span class="hud-game">${esc(gameName((s.games || [])[0]) || '')}</span>
                </span>
            </div>
            <div class="hud-sel-bot"><span><b>${s.listingCount || 0}</b> ${esc(t('sellerListings'))}</span><span class="go">${esc(t('viewDetails'))} →</span></div>
        </a>`;
    }

    function renderHeroHud(rows) {
        const grid = $('#heroHudGrid');
        if (!grid) return;
        const updated = $('#heroHudUpdated');
        if (updated) updated.textContent = t('updatedNow') || '';
        grid.innerHTML = rows.length
            ? rows.slice(0, 4).map(hudSellerCard).join('')
            : `<div class="hud-empty" style="grid-column:1/-1;">${esc(t('emptyTitle'))}</div>`;
    }

    async function loadSellers() {
        try {
            const data = await api('/api/sellers');
            const rows = data.items || [];
            $('#sellerGrid').innerHTML = rows.slice(0, 6).length
                ? rows.slice(0, 6).map(window.UI.sellerCard).join('')
                : emptyState('emptyTitle', 'emptyBody', '🛡️');
            $('#statSellers').textContent = String(data.total || 0);
            renderHeroHud(rows);
        } catch {
            $('#sellerGrid').innerHTML = '';
            renderHeroHud([]);
        }
    }

    function postCard(post) {
        const title = window.EX.field(post, 'title');
        const excerpt = window.EX.field(post, 'excerpt');
        return `<a class="post-card" href="/blog/${esc(post.slug)}">
            <div class="post-cover">${post.cover
                ? `<img src="${esc(post.cover)}" alt="" loading="lazy">`
                : '<div class="fallback">📰</div>'}</div>
            <div class="post-body">
                <h3${getLang() === 'mm' ? ' lang="my" class="mm"' : ''}>${esc(title)}</h3>
                ${excerpt ? `<p>${esc(truncate(excerpt, 140))}</p>` : ''}
                <div class="post-meta">
                    ${post.tag ? `<span class="tag-chip">${esc(post.tag)}</span>` : '<span></span>'}
                    <span>${esc(shortDate(post.publishedAt))}</span>
                </div>
            </div>
        </a>`;
    }

    async function loadPosts() {
        try {
            const data = await api('/api/posts?limit=3');
            const rows = data.items || [];
            if (!rows.length) return;
            $('#blogSection').hidden = false;
            $('#postGrid').innerHTML = rows.map(postCard).join('');
        } catch { /* blog is optional */ }
    }

    async function loadCatalogue() {
        try {
            const data = await api('/api/catalogue');
            renderCategories(data.counts);
            $('#statAccounts').textContent = String(data.total || 0);
            $('#statGames').textContent = String((data.games || games()).length);
        } catch {
            renderCategories({});
        }
    }

    /* ---------------- copy from settings ---------------- */

    function applyCopy() {
        const mm = getLang() === 'mm';
        const title = siteText('heroTitle', 'heroTitle');
        const sub = siteText('heroSubtitle', 'heroSubtitle');
        const h1 = $('#heroTitle');
        const p = $('#heroSub');
        h1.textContent = title;
        h1.classList.toggle('mm', mm);
        p.textContent = sub;
        p.classList.toggle('mm', mm);
        if (site().sellerPitch) $('#sellPitch').textContent = site().sellerPitch;
    }

    /* ---------------- toolbar ---------------- */

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

        $('#gameSelect').addEventListener('change', (e) => {
            state.game = e.target.value;
            $$('.cat-card').forEach((c) => c.classList.toggle('active', c.dataset.game === state.game));
            load(1);
        });

        $('#sortSelect').addEventListener('change', (e) => { state.sort = e.target.value; load(1); });
    }

    /* ---------------- boot ---------------- */

    (async function boot() {
        await window.UI.boot();
        applyCopy();
        renderGameSelect();
        initToolbar();

        await Promise.all([loadCatalogue(), loadSellers(), loadPosts()]);
        await load(1);

        document.addEventListener('langchange', () => {
            applyCopy();
            renderGameSelect();
            loadCatalogue();
            loadSellers();
            loadPosts();
            load(state.page);
            applyTranslations();
        });
    })();
})();
