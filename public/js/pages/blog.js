/* =============================================================
   pages/blog.js — article index
   ============================================================= */
(function () {
    'use strict';

    const { t, esc, api, field, truncate, shortDate, getLang, emptyState, $ } = window.EX;

    const state = { page: 1, totalPages: 1 };

    function card(post) {
        const title = field(post, 'title');
        const excerpt = field(post, 'excerpt');
        return `<a class="post-card" href="/blog/${esc(post.slug)}">
            <div class="post-cover">${post.cover
                ? `<img src="${esc(post.cover)}" alt="" loading="lazy">`
                : '<div class="fallback">📰</div>'}</div>
            <div class="post-body">
                <h3${getLang() === 'mm' ? ' lang="my" class="mm"' : ''}>${esc(title)}</h3>
                ${excerpt ? `<p>${esc(truncate(excerpt, 150))}</p>` : ''}
                <div class="post-meta">
                    ${post.tag ? `<span class="tag-chip">${esc(post.tag)}</span>` : '<span></span>'}
                    <span>${esc(shortDate(post.publishedAt))}</span>
                </div>
            </div>
        </a>`;
    }

    async function load(page) {
        state.page = page || 1;
        const host = $('#postGrid');
        host.innerHTML = window.EX.skeletonCards(3);
        try {
            const data = await api('/api/posts?page=' + state.page);
            state.totalPages = data.totalPages;
            host.innerHTML = (data.items || []).length
                ? data.items.map(card).join('')
                : emptyState('noPosts', 'blogSub', '📰');
            window.UI.pagination($('#pagination'), state, load);
        } catch {
            host.innerHTML = emptyState('errorTitle', 'errorBody', '⚠️');
        }
    }

    (async function boot() {
        await window.UI.boot();
        await load(1);
        document.addEventListener('langchange', () => load(state.page));
    })();
})();
