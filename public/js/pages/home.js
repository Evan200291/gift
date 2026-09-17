/* =============================================================
   pages/home.js — marketplace home: categories, listings, sellers, blog
   ============================================================= */
(function () {
    'use strict';

    const {
        t, esc, api, games, gameName, gameById, gameIcon, gameLogo,
        ICONS, skeletonCards, emptyState, applyTranslations,
        getLang, $, $$, shortDate, truncate, debounce,
    } = window.EX;

    const state = { game: '', q: '', busy: false, counts: {}, total: 0 };
    const PREVIEW_LIMIT = 6;
    // Chips kept visible on phones ("All" + this many games); the rest fold
    // into the "More" menu. Desktop shows every chip regardless.
    const VISIBLE_GAME_CHIPS = 2;

    /* ---------------- categories ---------------- */

    function applyGame(id) {
        state.game = id;
        $$('.cat-card').forEach((c) => c.classList.toggle('active', c.dataset.game === state.game));
        renderChips();
        load();
    }

    function setGame(id) {
        applyGame(state.game === id ? '' : id);
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
                    data-game="${esc(g.id)}">
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

    function menuGlyph(g) {
        if (!g) return ICONS.grid;
        const logo = gameLogo(g.id);
        return logo ? `<img src="${esc(logo)}" alt="" loading="lazy">` : gameIcon(g.id);
    }

    function renderChips() {
        const wrap = $('#homeGameChips');
        if (!wrap) return;
        wrap.classList.add('game-filter');

        const list = games();
        const overflowIds = list.slice(VISIBLE_GAME_CHIPS).map((g) => g.id);
        const activeHidden = overflowIds.includes(state.game);
        const moreLabel = activeHidden ? gameName(state.game) : t('moreGames');

        const chip = (id, label, extra) =>
            `<button type="button" class="chip${extra || ''}${state.game === id ? ' active' : ''}" data-game="${esc(id)}" data-tone="${esc(id || 'all')}">${esc(label)}</button>`;

        const options = [{ id: '', name: t('allGames'), count: state.total, g: null }]
            .concat(list.map((g) => ({ id: g.id, name: gameName(g.id), count: state.counts[g.id] || 0, g })));

        wrap.innerHTML = chip('', t('allGames'))
            + list.map((g, i) => chip(g.id, gameName(g.id), i >= VISIBLE_GAME_CHIPS ? ' chip-overflow' : '')).join('')
            + `<button type="button" class="chip chip-more${activeHidden ? ' active' : ''}" data-tone="${esc(activeHidden ? state.game : 'more')}" aria-haspopup="listbox"
                       aria-expanded="false" aria-controls="gameMenu">
                   <span class="chip-more-label">${esc(moreLabel)}</span><span class="chev">${ICONS.chevronDown}</span>
               </button>`
            + `<div class="game-menu" id="gameMenu" role="listbox" aria-label="${esc(t('allGames'))}" hidden>
                   ${options.map((o) => `
                   <button type="button" class="game-menu-opt" role="option" data-game="${esc(o.id)}"
                           aria-selected="${state.game === o.id}">
                       <span class="gm-glyph">${menuGlyph(o.g)}</span>
                       <span class="gm-name">${esc(o.name)}</span>
                       <span class="gm-count tabular">${o.count}</span>
                       <span class="gm-check">${ICONS.check}</span>
                   </button>`).join('')}
               </div>`;

        $$('.chip[data-game]', wrap).forEach((c) => c.addEventListener('click', () => setGame(c.dataset.game)));
        $('.chip-more', wrap).addEventListener('click', () => toggleGameMenu());
        $$('.game-menu-opt', wrap).forEach((opt) => opt.addEventListener('click', () => {
            toggleGameMenu(false);
            applyGame(opt.dataset.game);
        }));
    }

    function toggleGameMenu(force) {
        const btn = $('#homeGameChips .chip-more');
        const menu = $('#gameMenu');
        if (!btn || !menu) return;
        const open = typeof force === 'boolean' ? force : menu.hidden;
        menu.hidden = !open;
        btn.setAttribute('aria-expanded', String(open));
        if (open) {
            const current = $('.game-menu-opt[aria-selected="true"]', menu) || $('.game-menu-opt', menu);
            if (current) current.focus({ preventScroll: true });
        }
    }

    function initGameMenuDismiss() {
        document.addEventListener('click', (e) => {
            const menu = $('#gameMenu');
            if (menu && !menu.hidden && !e.target.closest('#homeGameChips')) toggleGameMenu(false);
        });
        document.addEventListener('keydown', (e) => {
            const menu = $('#gameMenu');
            if (e.key !== 'Escape' || !menu || menu.hidden) return;
            toggleGameMenu(false);
            const btn = $('#homeGameChips .chip-more');
            if (btn) btn.focus();
        });
    }

    /* ---------------- hero banner carousel ---------------- */

    function initHeroCarousel() {
        const banner = $('#heroBanner');
        const track = $('#heroTrack');
        const dotsWrap = $('#heroDots');
        if (!banner || !track || !dotsWrap) return;
        const slides = [...track.children];
        if (slides.length < 2) return;

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const INTERVAL = 5000;
        let index = 0;
        let timer = null;

        dotsWrap.innerHTML = slides.map((_, i) =>
            `<button type="button" class="hero-dot" role="tab" aria-label="${i + 1} / ${slides.length}"></button>`
        ).join('');
        const dots = [...dotsWrap.children];

        const go = (i) => {
            index = (i + slides.length) % slides.length;
            track.style.transform = `translateX(-${index * 100}%)`;
            dots.forEach((d, n) => d.setAttribute('aria-selected', String(n === index)));
            slides.forEach((s, n) => s.setAttribute('aria-hidden', String(n !== index)));
        };
        const stop = () => { clearInterval(timer); timer = null; };
        const start = () => {
            stop();
            if (reduceMotion || document.hidden) return;
            timer = setInterval(() => go(index + 1), INTERVAL);
        };

        dots.forEach((d, i) => d.addEventListener('click', () => { go(i); start(); }));

        // pointerType check: on touch devices the browser also fires emulated
        // mouse enter events after a tap, which would pause rotation for good.
        banner.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') stop(); });
        banner.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') start(); });

        let startX = null;
        banner.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; stop(); }, { passive: true });
        banner.addEventListener('touchend', (e) => {
            if (startX !== null) {
                const dx = e.changedTouches[0].clientX - startX;
                if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
            }
            startX = null;
            start();
        });

        document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

        go(0);
        start();
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
        // part of the catalogue rather than an interruption. It now spans the
        // full grid row (style.css `.grid > [data-ad]`), so use the same
        // "wide" 8:1 banner shape as the page's other ad slots (leaderboard,
        // footer) instead of the 16:9 "card" shape sized for a single column
        // — at full width that used to render much taller than every other
        // ad on the page.
        if (cards.length >= 4) {
            cards.splice(Math.min(4, cards.length), 0,
                '<div data-ad="home-inline" data-ad-variant="wide"></div>');
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
        const av = s.avatar
            ? `<img src="${esc(s.avatar)}" alt="">`
            : esc((s.displayName || s.username || '?').charAt(0).toUpperCase());
        return `<a class="ts-item" href="/store/${esc(s.username)}">
            <span class="ts-av" data-game="${esc(firstGame || '')}">${av}</span>
            <span class="ts-info">
                <span class="ts-name"><span class="ts-name-text">${esc(s.displayName || s.username)}</span>${s.verified ? ICONS.verified : ''}</span>
                <span class="ts-meta"><b>${s.listingCount || 0}</b> ${esc(t('sellerListings'))}</span>
            </span>
        </a>`;
    }

    function renderHeroHud(rows) {
        const grid = $('#heroHudGrid');
        if (!grid) return;
        grid.innerHTML = rows.length
            ? rows.slice(0, 4).map(hudSellerCard).join('')
            : `<div class="ts-empty">${esc(t('emptyTitle'))}</div>`;
    }

    async function loadSellers() {
        try {
            const data = await api('/api/sellers');
            // /api/sellers already sorts featured-first then by listing count
            // descending, so the top slice is naturally "most active sellers".
            const rows = data.items || [];
            $('#sellerGrid').innerHTML = rows.slice(0, 4).length
                ? rows.slice(0, 4).map(window.UI.sellerCard).join('')
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
            state.counts = data.counts || {};
            state.total = data.total || 0;
            renderCategories(data.counts);
            renderChips();
            $('#statAccounts').textContent = String(data.total || 0);
            $('#statGames').textContent = String((data.games || games()).length);
        } catch {
            renderCategories({});
        }
    }

    /* ---------------- boot ---------------- */

    (async function boot() {
        await window.UI.boot();
        initHeroCarousel();
        renderChips();
        initGameMenuDismiss();
        initSearch();

        await Promise.all([loadCatalogue(), loadSellers(), loadPosts()]);
        await load();

        document.addEventListener('langchange', () => {
            renderChips();
            loadCatalogue();
            loadSellers();
            loadPosts();
            load();
            applyTranslations();
        });
    })();
})();
