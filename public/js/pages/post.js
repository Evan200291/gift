/* =============================================================
   pages/post.js — a single article
   ============================================================= */
(function () {
    'use strict';

    const { t, esc, api, field, shortDate, getLang, emptyState, $ } = window.EX;

    let payload = null;

    function slug() {
        const m = window.location.pathname.match(/\/blog\/([^/?#]+)/);
        return m ? decodeURIComponent(m[1]) : '';
    }

    function render() {
        const post = payload.post;
        const title = field(post, 'title');
        const body = field(post, 'body');
        const mm = getLang() === 'mm';

        $('#article').innerHTML = `
            ${post.cover ? `<div class="article-cover"><img src="${esc(post.cover)}" alt=""></div>` : ''}
            <h1 class="display${mm ? ' mm' : ''}"${mm ? ' lang="my"' : ''}>${esc(title)}</h1>
            <div class="article-meta">
                ${post.tag ? `<span class="tag-chip">${esc(post.tag)}</span>` : ''}
                <span>${esc(shortDate(post.publishedAt || post.createdAt))}</span>
            </div>
            <div class="prose${mm ? ' mm' : ''}"${mm ? ' lang="my"' : ''}>${esc(body)}</div>
            <p class="mt-24"><a class="btn btn-outline btn-sm" href="/blog">← ${esc(t('backToBlog'))}</a></p>`;

        $('#crumbTitle').textContent = title;
        document.title = `${title} — ${window.EX.site().brand || ''}`;

        const related = payload.related || [];
        if (related.length) {
            $('#relatedSection').hidden = false;
            $('#relatedGrid').innerHTML = related.map((p) => `
                <a class="post-card" href="/blog/${esc(p.slug)}">
                    <div class="post-cover">${p.cover
                        ? `<img src="${esc(p.cover)}" alt="" loading="lazy">`
                        : '<div class="fallback">📰</div>'}</div>
                    <div class="post-body"><h3>${esc(field(p, 'title'))}</h3></div>
                </a>`).join('');
        }
    }

    (async function boot() {
        await window.UI.boot();
        try {
            payload = await api('/api/posts/' + encodeURIComponent(slug()));
            render();
        } catch {
            $('#article').innerHTML = emptyState('notFoundTitle', 'notFoundBody', '📰',
                '<a class="btn btn-primary mt-24" href="/blog">' + esc(t('backToBlog')) + '</a>');
        }
        document.addEventListener('langchange', () => { if (payload) render(); });
    })();
})();
