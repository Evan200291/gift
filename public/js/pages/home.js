/* =============================================================
   pages/home.js — marketplace home: categories, listings, sellers, blog
   ============================================================= */
(function () {
    'use strict';

    const {
        t, esc, api, site, siteText, games, gameName, gameById, gameIcon, gameLogo,
        ICONS, skeletonCards, emptyState, applyTranslations,
        getLang, $, $$, shortDate, truncate, debounce,
    } = window.EX;

    const state = { game: '', q: '', busy: false };
    const PREVIEW_LIMIT = 6;

    /* ---------------- categories ---------------- */

    function setGame(id) {
        state.game = state.game === id ? '' : id;
        $$('.cat-card').forEach((c) => c.classList.toggle('active', c.dataset.game === state.game));
        $$('#homeGameChips .chip').forEach((c) => c.classList.toggle('active', c.dataset.game === state.game));
        load();
    }

    function renderCategories(counts) {
        const rail = $('#catRail');
        rail.innerHTML = games().map((g) => {
            const logo = gameLogo(g.id);
            const glyph = logo
                ? `<img src="${esc(logo)}" alt="" loading="lazy">`
                : gameIcon(g.id);
            return `
            <button type="button" class="cat-card${state.game === g.id ? ' active' : ''}"
                    data-game="${esc(g.id)}" style="--cat:${esc(g.accent || '#7c5cff')}">
                <span class="cat-glyph">${glyph}</span>
                <span class="cat-meta">
                    <b>${esc(gameName(g.id))}</b>
                    <span>${(counts && counts[g.id]) || 0} ${esc(t('accountsAvailable'))}</span>
                </span>
                <span class="cat-go">${ICONS.arrow}</span>
            </button>`;
        }).join('');

        $$('.cat-card', rail).forEach((card) => {
            card.addEventListener('click', () => setGame(card.dataset.game));
        });
    }

    function renderChips() {
        const wrap = $('#homeGameChips');
        if (!wrap) return;
        const items = [{ id: '', label: t('allGames') }, ...games().map((g) => ({ id: g.id, label: gameName(g.id) }))];
        wrap.innerHTML = items.map((g) =>
            `<button type="button" class="chip${state.game === g.id ? ' active' : ''}" data-game="${esc(g.id)}">${esc(g.label)}</button>`
        ).join('');
        $$('.chip', wrap).forEach((chip) => {
            chip.addEventListener('click', () => setGame(chip.dataset.game));
        });
    }

    /* ---------------- listings ---------------- */

    function renderGrid(items) {
        const grid = $('#grid');
        if (!items.length) {
            grid.innerHTML = (state.game || state.q)
                ? emptyState('noResultsTitle', 'noResultsBody', '🔍')
                : emptyState('emptyTitle', 'emptyBody', '🎮');
            return;
        }

        const cards = items.map((l) => window.UI.listingCard(l));
        // Slot the in-grid advertisement in after the first row so it reads as
        // part of the catalogue rather than an interruption.
        if (cards.length >= 4) {
            cards.splice(Math.min(4, cards.length), 0,
                '<div data-ad="home-inline" data-ad-variant="card"></div>');
        }
        grid.innerHTML = cards.join('');
        window.UI.wireCards(grid);
        window.UI.mountAds();
    }

    function browseHref() {
        const params = new URLSearchParams();
        if (state.game) params.set('game', state.game);
        if (state.q) params.set('q', state.q);
        const qs = params.toString();
        return qs ? `/browse?${qs}` : '/browse';
    }

    async function load() {
        if (state.busy) return;
        state.busy = true;
        $('#grid').innerHTML = skeletonCards(PREVIEW_LIMIT);

        try {
            const params = new URLSearchParams();
            if (state.game) params.set('game', state.game);
            if (state.q) params.set('q', state.q);
            params.set('limit', String(PREVIEW_LIMIT));

            const data = await api(`/api/listings?${params}`);
            renderGrid(data.items || []);

            const more = $('#viewMoreBtn');
            if (more) more.href = browseHref();
        } catch {
            $('#grid').innerHTML = emptyState('errorTitle', 'errorBody', '⚠️');
        } finally {
            state.busy = false;
        }
    }

    function initSearch() {
        const wrap = $('#searchWrap');
        const input = $('#searchInput');
        const clear = $('#searchClear');
        if (!wrap || !input || !clear) return;

        $('#searchIcon').innerHTML = ICONS.search;
        clear.innerHTML = ICONS.close;

        const sync = () => wrap.classList.toggle('has-value', input.value.length > 0);
        const run = debounce(() => { state.q = input.value.trim(); load(); }, 320);

        input.addEventListener('input', () => { sync(); run(); });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); state.q = input.value.trim(); load(); }
            if (e.key === 'Escape') { input.value = ''; sync(); state.q = ''; load(); }
        });
        clear.addEventListener('click', () => {
            input.value = ''; sync(); state.q = ''; input.focus(); load();
        });
    }

    /* ---------------- sellers + blog ---------------- */

    function hudSellerCard(s) {
        const firstGame = (s.games || [])[0];
        const accent = (gameById(firstGame) || {}).accent || 'var(--neon-deep)';
        const av = s.avatar
            ? `<img src="${esc(s.avatar)}" alt="">`
            : esc((s.displayName || s.username || '?').charAt(0).toUpperCase());
        return `<a class="hud-sel" href="/store/${esc(s.username)}">
            <div class="hud-sel-top">
                <span class="hud-av" style="background:${esc(accent)}">${av}</span>
                <span>
                    <span class="hud-name">${esc(truncate(s.displayName || s.username, 16))}${s.verified ? ` ${ICONS.verified}` : ''}</span>
                    ${firstGame ? `<span class="hud-game">${esc(gameName(firstGame))}</span>` : ''}
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

    /* ---------------- boot ---------------- */

    (async function boot() {
        await window.UI.boot();
        applyCopy();
        renderChips();
        initSearch();

        await Promise.all([loadCatalogue(), loadSellers(), loadPosts()]);
        await load();

        document.addEventListener('langchange', () => {
            applyCopy();
            renderChips();
            loadCatalogue();
            loadSellers();
            loadPosts();
            load();
            applyTranslations();
        });
    })();
})();
