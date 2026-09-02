/* =============================================================
   pages/listing.js — one listing: gallery, specs, seller contact, share
   ============================================================= */
(function () {
    'use strict';

    const {
        t, esc, api, money, statusPill, ICONS, gameName, fieldLabel,
        channelsFrom, channelList, toast, copyText, getLang, field,
        $, $$, monthYear,
    } = window.EX;

    let listing = null;
    let index = 0;

    /** The id can arrive as /listing/<id> or /listing?id=<id>. */
    function listingId() {
        const match = window.location.pathname.match(/\/listing\/([^/?#]+)/);
        if (match) return decodeURIComponent(match[1]);
        return new URLSearchParams(window.location.search).get('id') || '';
    }

    /* ---------------- fragments ---------------- */

    function notFound() {
        return `<div class="empty" style="margin:32px 0 80px;">
            <div class="glyph">🔍</div>
            <h3>${esc(t('notFoundTitle'))}</h3>
            <p>${esc(t('notFoundBody'))}</p>
            <a class="btn btn-primary mt-24" href="/">${esc(t('backHome'))}</a>
        </div>`;
    }

    function gallery() {
        const images = listing.images || [];
        const thumbs = listing.thumbs && listing.thumbs.length === images.length ? listing.thumbs : images;

        const stage = images.length
            ? `<img id="stageImg" src="${esc(images[index])}" alt="${esc(listing.title_en || gameName(listing.game))}" width="1600" height="900">`
            : '<div class="fallback">🎮</div>';

        const nav = images.length > 1
            ? `<button type="button" class="gallery-nav prev" id="galPrev" aria-label="Previous">${ICONS.chevronLeft}</button>
               <button type="button" class="gallery-nav next" id="galNext" aria-label="Next">${ICONS.chevronRight}</button>
               <span class="gallery-index"><span id="galIndex">${index + 1}</span> / ${images.length}</span>`
            : '';

        const rail = images.length > 1
            ? `<div class="thumbs" id="thumbRail">${images.map((src, i) => `
                <button type="button" class="thumb${i === index ? ' active' : ''}" data-idx="${i}" aria-label="Image ${i + 1}">
                    <img src="${esc(thumbs[i] || src)}" alt="" loading="lazy">
                </button>`).join('')}</div>`
            : '';

        return `<div class="gallery"><div class="gallery-stage">${stage}${nav}</div>${rail}</div>`;
    }

    function specs() {
        const rows = [];
        if (listing.level) {
            rows.push({ label: fieldLabel(listing.game, 'level'), value: listing.level });
        }
        if (listing.currency_amount) {
            rows.push({ label: fieldLabel(listing.game, 'currency'), value: listing.currency_amount });
        }
        if (listing.server) rows.push({ label: t('server'), value: listing.server });
        if (!rows.length) return '';

        return `<div class="panel">
            <h3>${esc(t('listingDetails'))}</h3>
            <div class="specs">${rows.map((r) => `
                <div class="spec-card">
                    <label>${esc(r.label)}</label>
                    <div class="val">${esc(r.value)}</div>
                </div>`).join('')}</div>
        </div>`;
    }

    function highlights() {
        if (!listing.highlights) return '';
        const tags = listing.highlights.split(',').map((s) => s.trim()).filter(Boolean);
        if (!tags.length) return '';
        return `<div class="panel">
            <h3>${esc(fieldLabel(listing.game, 'highlights'))}</h3>
            <div class="players">${tags.map((tag) => `<span class="player-tag">${esc(tag)}</span>`).join('')}</div>
        </div>`;
    }

    function description() {
        const blocks = [];
        if (listing.description_en) {
            blocks.push(`<div class="panel">
                <h3>${esc(t('description'))}<span class="lang-tag">EN</span></h3>
                <div class="prose">${esc(listing.description_en)}</div>
            </div>`);
        }
        if (listing.description_mm) {
            blocks.push(`<div class="panel">
                <h3>${esc(t('description'))}<span class="lang-tag">MM</span></h3>
                <div class="prose mm" lang="my">${esc(listing.description_mm)}</div>
            </div>`);
        }
        return blocks.join('');
    }

    function statusNotice() {
        if (listing.status === 'sold') {
            return `<div class="notice danger" style="margin-bottom:16px;">${esc(t('soldNotice'))}</div>`;
        }
        if (listing.status === 'reserved') {
            return `<div class="notice warn" style="margin-bottom:16px;">${esc(t('reservedNotice'))}</div>`;
        }
        return '';
    }

    function sellerPanel() {
        const seller = listing.seller;
        if (!seller) return '';

        const channels = channelsFrom(seller.contacts);
        const bio = field(seller, 'bio');

        return `<div class="panel">
            <h3>${esc(t('soldBy'))}</h3>
            <a class="seller-card" href="/store/${esc(seller.username)}" style="padding:0;border:0;background:none;">
                <span class="avatar lg">${esc((seller.displayName || '?').charAt(0).toUpperCase())}</span>
                <span class="seller-meta">
                    <b>${esc(seller.displayName)}${seller.verified ? `<span class="verified">${ICONS.verified}</span>` : ''}</b>
                    <span class="dim">${esc(t('memberSince'))} ${esc(monthYear(seller.since))}</span>
                </span>
            </a>
            ${bio ? `<p class="muted mt-16" style="font-size:.86rem;">${esc(bio)}</p>` : ''}

            <h3 class="mt-24">${esc(t('contactSeller'))}</h3>
            <p class="dim" style="font-size:.83rem;margin-bottom:12px;">${esc(t('contactSellerSub'))}</p>
            ${channels.length
                ? channelList(channels)
                : `<p class="dim">${esc(t('sellerNoContact'))}</p>`}
            ${listing.contact_note
                ? `<div class="notice info mt-16">${esc(listing.contact_note)}</div>` : ''}
        </div>`;
    }

    function buyPanel() {
        return `<div class="panel buy-panel">
            ${statusNotice()}
            <div class="row gap-8" style="flex-wrap:wrap;">
                <span class="pill pill-game" data-game="${esc(listing.game)}">${esc(gameName(listing.game))}</span>
                ${statusPill(listing.status)}
                ${listing.featured ? `<span class="pill pill-hot">${esc(t('featured'))}</span>` : ''}
            </div>

            ${listing.title_en ? `<h1 class="detail-title display mt-16">${esc(listing.title_en)}</h1>` : ''}
            ${listing.title_mm ? `<div class="detail-title-mm" lang="my">${esc(listing.title_mm)}</div>` : ''}

            <div class="price-block">
                <span class="amount">${esc(money(listing.price))}</span>
                <span class="cur">${esc(window.EX.site().currency || 'USD')}</span>
            </div>

            <div class="share-row">
                <button type="button" class="btn btn-outline btn-sm" id="copyLink">${ICONS.copy} ${esc(t('copyLink'))}</button>
                <button type="button" class="btn btn-outline btn-sm" id="shareBtn">${ICONS.share} ${esc(t('share'))}</button>
            </div>
        </div>`;
    }

    function render() {
        $('#content').innerHTML = `<div class="detail fade-up">
            <div>
                ${gallery()}
                <div class="mt-16">
                    ${specs()}
                    ${highlights()}
                    ${description()}
                </div>
            </div>
            <aside>
                ${buyPanel()}
                ${sellerPanel()}
                <div class="mt-16" data-ad="listing-sidebar" data-ad-variant="portrait"></div>
            </aside>
        </div>`;

        $('#crumbTitle').textContent = listing.title_en || listing.title_mm || t('navBrowse');
        const crumbGame = $('#crumbGame');
        crumbGame.textContent = gameName(listing.game);
        crumbGame.href = `/?game=${encodeURIComponent(listing.game)}#listings`;

        window.UI.mountAds();
        wire();
    }

    /* ---------------- interactions ---------------- */

    function show(next) {
        const images = listing.images || [];
        if (!images.length) return;
        index = (next + images.length) % images.length;
        const img = $('#stageImg');
        if (img) img.src = images[index];
        const label = $('#galIndex');
        if (label) label.textContent = String(index + 1);
        $$('#thumbRail .thumb').forEach((el, i) => el.classList.toggle('active', i === index));
    }

    function wire() {
        const prev = $('#galPrev');
        const next = $('#galNext');
        if (prev) prev.addEventListener('click', () => show(index - 1));
        if (next) next.addEventListener('click', () => show(index + 1));

        $$('#thumbRail .thumb').forEach((el) => {
            el.addEventListener('click', () => show(parseInt(el.dataset.idx, 10) || 0));
        });

        const stage = $('#stageImg');
        if (stage) {
            stage.addEventListener('click', () => {
                $('#lightboxImg').src = stage.src;
                $('#lightbox').classList.add('open');
                document.body.style.overflow = 'hidden';
            });
        }

        const url = window.location.origin + window.UI.listingHref(listing);

        $('#copyLink').addEventListener('click', async () => {
            const ok = await copyText(url);
            toast(ok ? t('shareCopied') : 'Copy failed', ok ? 'success' : 'error');
        });

        $('#shareBtn').addEventListener('click', async () => {
            const title = listing.title_en || listing.title_mm || gameName(listing.game);
            if (navigator.share) {
                try {
                    await navigator.share({ title, text: `${title} — ${money(listing.price)}`, url });
                    return;
                } catch { /* user dismissed the sheet */ }
            }
            const ok = await copyText(url);
            toast(ok ? t('shareCopied') : 'Copy failed', ok ? 'success' : 'error');
        });
    }

    function closeLightbox() {
        $('#lightbox').classList.remove('open');
        document.body.style.overflow = '';
    }

    document.addEventListener('keydown', (e) => {
        if (!listing) return;
        if (e.key === 'Escape' && $('#lightbox').classList.contains('open')) { closeLightbox(); return; }
        if ((listing.images || []).length < 2) return;
        if (e.key === 'ArrowLeft') show(index - 1);
        if (e.key === 'ArrowRight') show(index + 1);
    });

    /* ---------------- boot ---------------- */

    (async function boot() {
        await window.UI.boot();

        $('#lightboxClose').addEventListener('click', closeLightbox);
        $('#lightbox').addEventListener('click', (e) => { if (e.target.id === 'lightbox') closeLightbox(); });

        const id = listingId();
        if (!id) { $('#content').innerHTML = notFound(); return; }

        try {
            listing = await api(`/api/listings/${encodeURIComponent(id)}`);
            render();
            document.title = `${listing.title_en || listing.title_mm || t('navBrowse')} — ${window.EX.site().brand || ''}`;
        } catch {
            $('#content').innerHTML = notFound();
        }

        document.addEventListener('langchange', () => { if (listing) render(); });
    })();
})();
