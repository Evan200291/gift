/* =============================================================
   views/admin.js â€” control panel client-side controller.

   Loaded by views/admin.html at /<adminPath>/admin.js after
   /js/core.js, so window.EX (api, token, esc, money, t, toast,
   statusPill, ICONS, fieldLabel, gameName) is always available.

   The panel is reachable at a secret URL â€” the path is stored
   in settings.adminPath and the human-readable form is shown on
   the Security tab. The default path is /control-8f3a2c.

   This file replaces the original 70-line login stub. It owns
   the four tabs defined in admin.html (Listings Â· Sellers Â·
   Store & contact Â· Security). The admin API also covers
   plans, posts and ad slots, but exposing them needs more
   markup in admin.html â€” the endpoints are all in place and
   tested; only the UI for them is omitted here.
   ============================================================= */
(function () {
    'use strict';

    const EX = window.EX;
    const { api, token, esc, money, t, toast, statusPill, ICONS, fieldLabel, gameName, shortDate, truncate, productCode } = EX;
    const $ = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

    const BRAND_MARK_SVG = '<svg viewBox="0 0 83.12 86.58" fill="currentColor" aria-hidden="true">'
        + '<path d="M0 0h19.91v86.58H0Z"/>'
        + '<path d="M26.84 0h56.28L69.26 19.91H26.84Z"/>'
        + '<path d="M26.84 33.33h35.5L48.49 53.25H26.84Z"/>'
        + '<path d="M26.84 66.67h56.28L69.26 86.58H26.84Z"/>'
        + '</svg>';

    function paintBrand() {
        const site = EX.site ? EX.site() : null;
        const brand = (site && site.brand) || 'EXABYTE';
        const tagline = (site && site.tagline) || 'Digital Store';
        const initial = brand.trim().charAt(0).toUpperCase() || 'E';
        const markHtml = initial === 'E' ? BRAND_MARK_SVG : esc(initial);

        const authMark = $('[data-auth-mark]');
        if (authMark) authMark.innerHTML = markHtml;
        const authName = $('[data-auth-brand-name]');
        if (authName) authName.textContent = brand;
        const authTag = $('[data-auth-brand-tagline]');
        if (authTag) authTag.textContent = tagline;

        const mark = $('[data-brand-mark]');
        if (mark) mark.innerHTML = markHtml;
        const name = $('[data-brand-name]');
        if (name) name.textContent = brand;
        const tag = $('[data-brand-tagline]');
        if (tag) tag.textContent = tagline;
    }

    /* =============================================================
       Auth flow
       ============================================================= */

    async function tryAutoLogin() {
        if (!token.get()) return false;
        try {
            const { user } = await api('/api/auth/me');
            return user && user.role === 'admin' ? user : false;
        } catch {
            token.clear();
            return false;
        }
    }

    async function login(username, password) {
        const res = await api('/api/auth/login', {
            method: 'POST',
            json: { username, password },
        });
        if (res && res.token) token.set(res.token);
        return res && res.user;
    }

    function showLogin() {
        const auth = $('#authScreen');
        const shell = $('#adminShell');
        if (auth) auth.style.display = '';
        if (shell) shell.classList.remove('ready');
    }

    function showShell(user) {
        const auth = $('#authScreen');
        const shell = $('#adminShell');
        if (auth) auth.style.display = 'none';
        if (shell) shell.classList.add('ready');
        const who = $('#whoUser');
        if (who) who.textContent = user.displayName || user.username;

        paintBrand();
    }

    function bindLogin() {
        const form = $('#loginForm');
        if (!form) return;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = $('#loginUser').value.trim();
            const pass = $('#loginPass').value;
            const btn = $('#loginBtn');
            const original = btn.textContent;
            btn.disabled = true;
            btn.textContent = t('signIn') + 'â€¦';
            try {
                const u = await login(user, pass);
                if (!u || u.role !== 'admin') {
                    throw new Error('Administrator access required.');
                }
                showShell(u);
                await bootTabs();
            } catch (err) {
                toast(err.message || 'Sign in failed', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = original;
            }
        });
    }

    function bindLogout() {
        const btn = $('#logoutBtn');
        if (!btn) return;
        btn.addEventListener('click', async () => {
            try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
            token.clear();
            showLogin();
            const u = $('#loginUser'); if (u) u.value = '';
            const p = $('#loginPass'); if (p) p.value = '';
        });
    }

    /* =============================================================
       Tab navigation
       ============================================================= */

    function bindTabs() {
        $$('.tab, .admin-tabbar [data-tab]').forEach((btn) => {
            btn.addEventListener('click', () => activateTab(btn.dataset.tab));
        });
    }

    function activateTab(name) {
        $$('.tab, .admin-tabbar [data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
        $$('main > section').forEach((s) => {
            s.classList.toggle('hidden', s.id !== 'tab-' + name);
        });
        const handler = TAB_LOADERS[name];
        if (handler) handler();
    }

    const TAB_LOADERS = {
        listings: () => Listings.load(),
        sellers: () => Sellers.load(),
        posts: () => Posts.load(),
        store: () => Store.load(),
        security: () => Security.load(),
    };
    /* =============================================================
       Listings tab
       ============================================================= */
    const ListEntries = { q: '', status: '', sort: 'newest', page: 1, limit: 20, total: 0, totalPages: 1 };
    const ListEditor = { open: false, editing: null, files: [], removed: new Set(), existing: [], existingThumbs: [] };

    const Listings = {
        async load() {
            await Promise.all([Listings.loadTiles(), Listings.loadRows()]);
        },

        async loadTiles() {
            try {
                const o = await api('/api/admin/overview');
                const host = $('#tiles');
                if (!host) return;
                const l = o.listings || {};
                host.innerHTML = [
                    Listings.tile('Total listings', l.total || 0, 'accent'),
                    Listings.tile('Available', l.available || 0),
                    Listings.tile('Reserved', l.reserved || 0),
                    Listings.tile('Sold', l.sold || 0),
                ].join('');
            } catch (err) {
                toast(err.message || 'Could not load overview', 'error');
            }
        },

        tile(label, value, mod) {
            return '<div class="tile' + (mod ? ' ' + mod : '') + '">'
                + '<label>' + esc(label) + '</label>'
                + '<b>' + esc(String(value)) + '</b>'
                + '</div>';
        },

        async loadRows() {
            const host = $('#rows');
            if (!host) return;
            host.innerHTML = '<div class="rowcard"><div class="shot">⏳</div><div class="info"><div class="name">Loading…</div></div><div class="acts"></div></div>';
            try {
                const params = new URLSearchParams();
                if (ListEntries.q) params.set('q', ListEntries.q);
                if (ListEntries.status) params.set('status', ListEntries.status);
                if (ListEntries.sort && ListEntries.sort !== 'newest') params.set('sort', ListEntries.sort);
                params.set('page', String(ListEntries.page));
                params.set('limit', String(ListEntries.limit));
                const data = await api('/api/admin/listings?' + params.toString());
                ListEntries.total = data.total || 0;
                ListEntries.totalPages = data.totalPages || 1;
                const rows = data.items || [];
                host.innerHTML = rows.length
                    ? rows.map(Listings.rowCard).join('')
                    : '<div class="rowcard" style="grid-template-columns:1fr;"><div class="info" style="text-align:center;padding:32px;color:var(--text-3);">No listings match this filter yet. Sellers publish listings from their own portal.</div></div>';
                Listings.wireRows(host);
                Listings.renderPagination();
            } catch (err) {
                host.innerHTML = '<div class="rowcard" style="grid-template-columns:1fr;"><div class="info" style="padding:24px;color:var(--danger);">' + esc(err.message || 'Load failed') + '</div></div>';
            }
        },

        rowCard(l) {
            const thumb = (l.thumbs && l.thumbs[0]) || (l.images && l.images[0]) || '';
            const title = l.title_en || l.title_mm || ('Listing ' + l.id.slice(0, 6));
            const game = gameName(l.game);
            const meta = [
                '<span style="font-family:var(--font-mono);">' + esc(productCode(l.id)) + '</span>',
                '<span>·</span><span>' + esc(game) + '</span>',
                l.level ? '<span>·</span><span>' + esc(l.level) + '</span>' : '',
                l.currency_amount ? '<span>·</span><span>' + esc(l.currency_amount) + '</span>' : '',
                '<span>·</span><b>' + esc(money(l.price)) + '</b>',
            ].join('');
            return '<div class="rowcard" data-id="' + esc(l.id) + '">'
                + '<div class="shot">' + (thumb ? '<img src="' + esc(thumb) + '" alt="" loading="lazy">' : '🎮') + '</div>'
                + '<div class="info">'
                +   '<div class="name">' + esc(title) + '</div>'
                +   '<div class="meta">' + statusPill(l.status) + ' ' + meta + '</div>'
                + '</div>'
                + '<div class="acts">'
                +   '<button type="button" class="btn btn-ghost btn-sm" data-act="edit">Edit</button>'
                +   '<button type="button" class="btn btn-ghost btn-sm" data-act="del">Delete</button>'
                + '</div>'
                + '</div>';
        },

        wireRows(host) {
            $$('.rowcard', host).forEach((card) => {
                const id = card.dataset.id;
                const edit = card.querySelector('[data-act="edit"]');
                const del = card.querySelector('[data-act="del"]');
                if (edit) edit.addEventListener('click', () => Listings.openEditor(id));
                if (del) del.addEventListener('click', () => Listings.confirmDelete(id, card));
            });
        },

        renderPagination() {
            const host = $('#adminPagination');
            if (!host) return;
            const state = { page: ListEntries.page, totalPages: ListEntries.totalPages };
            const UI = window.UI;
            if (UI && UI.pagination) {
                UI.pagination(host, state, (p) => { ListEntries.page = p; Listings.loadRows(); });
            } else {
                host.innerHTML = '';
            }
        },

        bind() {
            if (Listings._bound) return;
            Listings._bound = true;

            const search = $('#adminSearch');
            const searchClear = $('#adminSearchClear');
            if (search) {
                let timer = null;
                const run = () => { ListEntries.q = search.value.trim(); ListEntries.page = 1; Listings.loadRows(); };
                search.addEventListener('input', () => {
                    if (searchClear) searchClear.style.display = search.value ? '' : 'none';
                    clearTimeout(timer);
                    timer = setTimeout(run, 250);
                });
                search.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        search.value = '';
                        if (searchClear) searchClear.style.display = 'none';
                        run();
                    }
                });
            }
            if (searchClear) {
                searchClear.innerHTML = ICONS.close;
                searchClear.addEventListener('click', () => {
                    if (search) search.value = '';
                    searchClear.style.display = 'none';
                    ListEntries.q = '';
                    ListEntries.page = 1;
                    Listings.loadRows();
                });
            }
            const status = $('#adminStatus');
            if (status) status.addEventListener('change', (e) => {
                ListEntries.status = e.target.value;
                ListEntries.page = 1;
                Listings.loadRows();
            });
            const sort = $('#adminSort');
            if (sort) sort.addEventListener('change', (e) => {
                ListEntries.sort = e.target.value;
                ListEntries.page = 1;
                Listings.loadRows();
            });
            const searchIcon = $('#adminSearchIcon');
            if (searchIcon) searchIcon.innerHTML = ICONS.search;

            Listings.bindEditor();
            Listings.bindConfirm();
        },

        /* ---- editor modal ---- */

        openEditor(id) {
            ListEditor.editing = id;
            ListEditor.files = [];
            ListEditor.removed = new Set();
            ListEditor.existing = [];
            ListEditor.existingThumbs = [];
            ListEditor.open = true;

            const form = $('#editorForm');
            if (form) form.reset();
            Listings.renderShots();

            const title = $('#editorTitle');
            if (title) title.textContent = 'Edit listing';

            Listings.ensureGameSelect();
            Listings.populateEditor(id);

            Listings.refreshGameLabels();
            Listings.refreshPriceSymbol();

            const scrim = $('#editor');
            if (scrim) scrim.classList.add('open');
        },

        async populateEditor(id) {
            try {
                const all = await api('/api/admin/listings?limit=100');
                const found = (all.items || []).find((l) => l.id === id);
                if (!found) { toast('Listing not found', 'error'); return; }
                Listings.setField('f_game', found.game || 'efootball');
                Listings.setField('f_title_en', found.title_en || '');
                Listings.setField('f_title_mm', found.title_mm || '');
                Listings.setField('f_price', found.price != null ? String(found.price) : '');
                Listings.setField('f_status', found.status || 'available');
                Listings.setField('f_overall_rating', found.level || '');
                Listings.setField('f_coins', found.currency_amount || '');
                Listings.setField('f_featured_players', found.highlights || '');
                Listings.setField('f_description_en', found.description_en || '');
                Listings.setField('f_description_mm', found.description_mm || '');
                Listings.setField('f_contact_info', found.contact_note || '');
                const feat = $('#f_featured'); if (feat) feat.checked = Boolean(found.featured);

                ListEditor.existing = (found.images || []).slice();
                ListEditor.existingThumbs = (found.thumbs || []).slice();
                Listings.renderShots();
                Listings.refreshGameLabels();
                Listings.refreshPriceSymbol();
            } catch (err) {
                toast(err.message || 'Could not load listing', 'error');
            }
        },

        ensureGameSelect() {
            let sel = $('#f_game');
            if (sel) return;
            const grid = $('.modal .form-grid');
            if (!grid) return;
            const field = document.createElement('div');
            field.className = 'field';
            field.innerHTML = '<label for="f_game">Game</label>'
                + '<select id="f_game" required></select>';
            grid.insertBefore(field, grid.firstChild);
            sel = $('#f_game');
            (EX.games() || []).forEach((g) => {
                const opt = document.createElement('option');
                opt.value = g.id;
                opt.textContent = g.name || g.short || g.id;
                sel.appendChild(opt);
            });
            sel.addEventListener('change', () => Listings.refreshGameLabels());
        },

        refreshGameLabels() {
            const game = ($('#f_game') && $('#f_game').value) || 'efootball';
            const lblL = $('#editorForm label[for="f_overall_rating"]');
            if (lblL) lblL.textContent = fieldLabel(game, 'level') || 'Level / rank';
            const lblC = $('#editorForm label[for="f_coins"]');
            if (lblC) lblC.textContent = fieldLabel(game, 'currency') || 'In-game currency';
            const lblH = $('#editorForm label[for="f_featured_players"]');
            if (lblH) lblH.textContent = fieldLabel(game, 'highlights') || 'Highlights';
        },

        refreshPriceSymbol() {
            const symbol = (EX.site() && EX.site().currencySymbol) || '$';
            const span = $('#priceSymbol');
            if (span) span.textContent = symbol;
        },

        setField(id, value) {
            const el = $('#' + id);
            if (!el) return;
            if (el.type === 'checkbox') el.checked = Boolean(value);
            else el.value = value == null ? '' : value;
        },

        getField(id) {
            const el = $('#' + id);
            if (!el) return '';
            return el.type === 'checkbox' ? el.checked : el.value;
        },

        renderShots() {
            const host = $('#shots');
            if (!host) return;
            const existing = ListEditor.existing || [];
            const removed = ListEditor.removed;
            const tiles = [];

            existing.forEach((url) => {
                const isGone = removed.has(url);
                tiles.push('<div class="shot-item" data-existing="' + esc(url) + '"' + (isGone ? ' style="opacity:.35;"' : '') + '>'
                    + '<img src="' + esc(url) + '" alt="">'
                    + '<button type="button" class="kill" data-rm-existing="' + esc(url) + '" title="Remove">×</button>'
                    + '</div>');
            });

            ListEditor.files.forEach((file, i) => {
                const preview = URL.createObjectURL(file);
                tiles.push('<div class="shot-item" data-new="' + i + '">'
                    + '<img src="' + esc(preview) + '" alt="">'
                    + '<button type="button" class="kill" data-rm-new="' + i + '" title="Remove">×</button>'
                    + '<span class="tag">NEW</span>'
                    + '</div>');
            });

            host.innerHTML = tiles.join('');
            $$('[data-rm-existing]', host).forEach((btn) => {
                btn.addEventListener('click', () => {
                    const url = btn.dataset.rmExisting;
                    if (ListEditor.removed.has(url)) ListEditor.removed.delete(url);
                    else ListEditor.removed.add(url);
                    Listings.renderShots();
                });
            });
            $$('[data-rm-new]', host).forEach((btn) => {
                btn.addEventListener('click', () => {
                    const i = Number(btn.dataset.rmNew);
                    ListEditor.files.splice(i, 1);
                    Listings.renderShots();
                });
            });
        },

        bindEditor() {
            const close = $('#editorClose');
            const cancel = $('#editorCancel');
            const scrim = $('#editor');
            if (close) close.addEventListener('click', Listings.closeEditor);
            if (cancel) cancel.addEventListener('click', Listings.closeEditor);
            if (scrim) scrim.addEventListener('click', (e) => { if (e.target === scrim) Listings.closeEditor(); });

            const dz = $('#dropzone');
            const input = $('#fileInput');
            if (dz && input) {
                dz.addEventListener('click', () => input.click());
                dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
                dz.addEventListener('dragleave', () => dz.classList.remove('over'));
                dz.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dz.classList.remove('over');
                    Listings.addFiles(e.dataTransfer.files);
                });
                input.addEventListener('change', (e) => {
                    Listings.addFiles(e.target.files);
                    input.value = '';
                });
            }

            const form = $('#editorForm');
            if (form) form.addEventListener('submit', Listings.saveEditor);
        },

        addFiles(fileList) {
            const keptExisting = (ListEditor.existing || []).filter((u) => !ListEditor.removed.has(u)).length;
            const remaining = 6 - (keptExisting + ListEditor.files.length);
            if (remaining <= 0) { toast('Maximum 6 images', 'error'); return; }
            const incoming = Array.from(fileList).slice(0, remaining);
            incoming.forEach((f) => {
                if (!/^image\//.test(f.type)) { toast('"' + f.name + '" is not an image', 'error'); return; }
                if (f.size > 8 * 1024 * 1024) { toast('"' + f.name + '" exceeds 8 MB', 'error'); return; }
                ListEditor.files.push(f);
            });
            Listings.renderShots();
        },

        closeEditor() {
            const scrim = $('#editor');
            if (scrim) scrim.classList.remove('open');
            ListEditor.open = false;
            ListEditor.editing = null;
            ListEditor.files = [];
            ListEditor.removed = new Set();
            ListEditor.existing = [];
            ListEditor.existingThumbs = [];
        },

        async saveEditor(e) {
            e.preventDefault();
            const id = ListEditor.editing;
            const btn = $('#editorSave');
            btn.disabled = true;
            const restore = btn.textContent;
            btn.textContent = 'Saving…';

            try {
                const fd = new FormData();
                fd.append('game', Listings.getField('f_game') || 'efootball');
                fd.append('title_en', Listings.getField('f_title_en'));
                fd.append('title_mm', Listings.getField('f_title_mm'));
                fd.append('description_en', Listings.getField('f_description_en'));
                fd.append('description_mm', Listings.getField('f_description_mm'));
                fd.append('price', Listings.getField('f_price') || '0');
                fd.append('status', Listings.getField('f_status') || 'available');
                fd.append('level', Listings.getField('f_overall_rating'));
                fd.append('currency_amount', Listings.getField('f_coins'));
                fd.append('highlights', Listings.getField('f_featured_players'));
                fd.append('contact_note', Listings.getField('f_contact_info'));
                if (Listings.getField('f_featured')) fd.append('featured', 'true');

                ListEditor.files.forEach((f) => fd.append('images', f, f.name));

                const existing = (ListEditor.existing || []).filter((u) => !ListEditor.removed.has(u));
                existing.forEach((u) => fd.append('keepImages', u));
                await api('/api/admin/listings/' + id, { method: 'PUT', body: fd });
                toast('Listing updated', 'success');
                Listings.closeEditor();
                await Listings.load();
            } catch (err) {
                toast(err.message || 'Save failed', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = restore;
            }
        },

        /* ---- delete confirm ---- */

        confirmDelete(id, cardEl) {
            const title = (cardEl && cardEl.querySelector('.name') || {}).textContent || 'this listing';
            const body = $('#confirmBody');
            if (body) body.textContent = '"' + title.trim() + '" will be removed permanently, including its images.';
            const scrim = $('#confirm');
            if (scrim) scrim.classList.add('open');
            const yes = $('#confirmYes');
            const no = $('#confirmNo');
            const off = () => { scrim.classList.remove('open'); yes.removeEventListener('click', onYes); no.removeEventListener('click', off); };
            const onYes = async () => {
                off();
                try {
                    await api('/api/admin/listings/' + id, { method: 'DELETE' });
                    toast('Listing deleted', 'success');
                    await Listings.load();
                } catch (err) {
                    toast(err.message || 'Delete failed', 'error');
                }
            };
            yes.addEventListener('click', onYes);
            no.addEventListener('click', off);
        },

        bindConfirm() {
            const scrim = $('#confirm');
            if (!scrim) return;
            scrim.addEventListener('click', (e) => { if (e.target === scrim) scrim.classList.remove('open'); });
        },
    };
    /* =============================================================
       Sellers tab
       =============================================================
       Backend exposes GET/POST/PUT/DELETE /api/admin/sellers,
       PUT /api/admin/sellers/:id/subscription,
       POST /api/admin/sellers/:id/payment,
       POST /api/admin/sellers/:id/extend.
       Plans are loaded once on first open and cached.
       ============================================================= */
    const SellerState = { q: '', status: '', sort: 'newest', page: 1, limit: 20, total: 0, totalPages: 1 };
    const SellerEditor = { open: false, editing: null, plans: null };

    const Sellers = {
        async load() {
            await Promise.all([Sellers.loadTiles(), Sellers.loadRows()]);
        },

        async loadTiles() {
            try {
                const o = await api('/api/admin/sellers?limit=999');
                const items = (o && o.items) || [];
                const now = Date.now();
                let active = 0, expiring = 0, expired = 0, suspended = 0;
                items.forEach((s) => {
                    if (s.status === 'suspended') { suspended++; return; }
                    const exp = Number(s.subscriptionState && s.subscriptionState.expiresAt) || 0;
                    if (!exp) return; // no plan yet
                    const days = Math.round((exp - now) / 86400000);
                    if (days < 0) expired++;
                    else if (days <= 7) expiring++;
                    else active++;
                });
                const host = $('#sellerTiles');
                if (!host) return;
                host.innerHTML = [
                    Sellers.tile('Total sellers', items.length, 'accent'),
                    Sellers.tile('Active', active),
                    Sellers.tile('Expiring (≤7d)', expiring),
                    Sellers.tile('Suspended', suspended),
                ].join('');
            } catch (err) {
                toast(err.message || 'Could not load sellers', 'error');
            }
        },

        tile(label, value, mod) {
            return '<div class="tile' + (mod ? ' ' + mod : '') + '">'
                + '<label>' + esc(label) + '</label>'
                + '<b>' + esc(String(value)) + '</b>'
                + '</div>';
        },

        async loadRows() {
            const host = $('#sellerRows');
            if (!host) return;
            host.innerHTML = '<div class="rowcard"><div class="avatar-lg">⏳</div><div class="info"><div class="name-en">Loading…</div></div><div class="acts"></div></div>';
            try {
                const params = new URLSearchParams({
                    q: SellerState.q,
                    state: SellerState.status,
                    sort: SellerState.sort,
                    page: String(SellerState.page),
                    limit: String(SellerState.limit),
                });
                const data = await api('/api/admin/sellers?' + params.toString());
                const items = data.items || [];
                SellerState.total = data.total || 0;
                SellerState.totalPages = data.totalPages || 1;
                if (!items.length) {
                    host.innerHTML = '<div class="rowcard"><div class="avatar-lg">🛡️</div><div class="info"><div class="name-en">No sellers yet</div><div class="name-sub">Click <b>+ New seller</b> above to add the first one.</div></div><div class="acts"></div></div>';
                } else {
                    host.innerHTML = items.map(Sellers.renderRow).join('');
                }
                Sellers.wireRows(host);
                Sellers.renderPagination();
            } catch (err) {
                host.innerHTML = '<div class="rowcard"><div class="avatar-lg">⚠️</div><div class="info"><div class="name-en">' + esc(err.message || 'Load failed') + '</div></div><div class="acts"></div></div>';
            }
        },

        renderRow(s) {
            const name = s.displayName || s.username;
            const initial = (name || '?').charAt(0).toUpperCase();
            const sub = s.subscriptionState || {};
            const plan = sub.planName || sub.planId || '';
            const days = sub.daysLeft;
            let expPill = '';
            if (s.status === 'suspended') {
                expPill = '<span class="exp-pill suspended">Suspended</span>';
            } else if (Number.isFinite(days)) {
                if (days < 0) {
                    expPill = '<span class="exp-pill expired">Expired ' + Math.abs(days) + 'd ago</span>';
                } else if (days === 0) {
                    expPill = '<span class="exp-pill expiring">Expires today</span>';
                } else if (days <= 7) {
                    expPill = '<span class="exp-pill expiring">' + days + 'd left</span>';
                } else {
                    expPill = '<span class="exp-pill">' + days + 'd left</span>';
                }
            } else if (plan) {
                expPill = '<span class="exp-pill lifetime">No expiry</span>';
            } else {
                expPill = '<span class="exp-pill suspended">No plan</span>';
            }
            const planBadge = plan
                ? '<span class="plan-badge">' + esc(plan) + '</span>'
                : '<span class="plan-badge none">No plan</span>';
            const verified = s.verified
                ? '<span class="plan-badge" style="color:#22d3ee;background:rgba(34,211,238,.1);border-color:rgba(34,211,238,.3);">✓ Verified</span>'
                : '';
            const listingCount = s.listingCount;
            const listingsBadge = Number.isFinite(listingCount)
                ? '<span class="plan-badge none">' + listingCount + ' listings</span>'
                : '';
            const avatarInner = s.avatar ? '<img src="' + esc(s.avatar) + '" alt="">' : esc(initial);
            return '<div class="rowcard" data-id="' + esc(s.id) + '">'
                + '<div class="avatar-lg">' + avatarInner + '</div>'
                + '<div class="info">'
                +   '<div class="name-en">' + esc(name) + '</div>'
                +   '<div class="name-sub">@' + esc(s.username) + ' · ' + planBadge + ' ' + verified + ' ' + expPill + ' ' + listingsBadge + '</div>'
                + '</div>'
                + '<div class="acts">'
                +   '<button type="button" class="btn btn-ghost btn-sm" data-act="edit">Edit</button>'
                +   '<button type="button" class="btn btn-ghost btn-sm" data-act="del">Delete</button>'
                + '</div>'
                + '</div>';
        },

        wireRows(host) {
            $$('.rowcard', host).forEach((card) => {
                const id = card.dataset.id;
                const edit = card.querySelector('[data-act="edit"]');
                const del = card.querySelector('[data-act="del"]');
                if (edit) edit.addEventListener('click', () => Sellers.openEditor(id));
                if (del) del.addEventListener('click', () => Sellers.confirmDelete(id, card));
            });
        },

        renderPagination() {
            const host = $('#sellerPagination');
            if (!host) return;
            const state = { page: SellerState.page, totalPages: SellerState.totalPages };
            const UI = window.UI;
            if (UI && UI.pagination) {
                UI.pagination(host, state, (p) => { SellerState.page = p; Sellers.loadRows(); });
            } else {
                host.innerHTML = '';
            }
        },

        bind() {
            if (Sellers._bound) return;
            Sellers._bound = true;

            const search = $('#sellerSearch');
            const searchClear = $('#sellerSearchClear');
            if (search) {
                let timer = null;
                const run = () => { SellerState.q = search.value.trim(); SellerState.page = 1; Sellers.loadRows(); };
                search.addEventListener('input', () => {
                    if (searchClear) searchClear.style.display = search.value ? '' : 'none';
                    clearTimeout(timer);
                    timer = setTimeout(run, 250);
                });
                search.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        search.value = '';
                        if (searchClear) searchClear.style.display = 'none';
                        run();
                    }
                });
            }
            if (searchClear) {
                searchClear.innerHTML = ICONS.close;
                searchClear.addEventListener('click', () => {
                    if (search) search.value = '';
                    searchClear.style.display = 'none';
                    SellerState.q = '';
                    SellerState.page = 1;
                    Sellers.loadRows();
                });
            }
            const status = $('#sellerStatus');
            if (status) status.addEventListener('change', (e) => {
                SellerState.status = e.target.value;
                SellerState.page = 1;
                Sellers.loadRows();
            });
            const sort = $('#sellerSort');
            if (sort) sort.addEventListener('change', (e) => {
                SellerState.sort = e.target.value;
                SellerState.page = 1;
                Sellers.loadRows();
            });
            const newBtn = $('#newSellerBtn');
            if (newBtn) newBtn.addEventListener('click', () => Sellers.openEditor(null));
            const searchIcon = $('#sellerSearchIcon');
            if (searchIcon) searchIcon.innerHTML = ICONS.search;

            Sellers.bindEditor();
            Sellers.bindConfirm();
            Sellers.bindInnerTabs();
        },

        /* ---- inner tabs inside the editor modal ---- */

        bindInnerTabs() {
            $$('.pane-tab').forEach((tab) => {
                tab.addEventListener('click', () => {
                    const name = tab.dataset.pane;
                    $$('.pane-tab').forEach((t) => t.classList.toggle('active', t === tab));
                    $$('.pane').forEach((p) => p.classList.toggle('active', p.dataset.pane === name));
                });
            });
        },

        activatePane(name) {
            const tab = $('.pane-tab[data-pane="' + name + '"]');
            if (tab) tab.click();
        },

        /* ---- editor modal ---- */

        bindEditor() {
            const close = $('#sellerEditorClose');
            const cancel = $('#sellerEditorCancel');
            const scrim = $('#sellerEditor');
            if (close) close.addEventListener('click', Sellers.closeEditor);
            if (cancel) cancel.addEventListener('click', Sellers.closeEditor);
            if (scrim) scrim.addEventListener('click', (e) => { if (e.target === scrim) Sellers.closeEditor(); });

            const form = $('#sellerForm');
            if (form) form.addEventListener('submit', Sellers.saveEditor);

            const extendBtn = $('#s_extendBtn');
            if (extendBtn) extendBtn.addEventListener('click', Sellers.extendSubscription);
        },

        async openEditor(id) {
            SellerEditor.editing = id;
            SellerEditor.open = true;

            const form = $('#sellerForm');
            if (form) form.reset();

            const title = $('#sellerEditorTitle');
            if (title) title.textContent = id ? 'Edit seller' : 'New seller';

            // Username is immutable once set.
            const u = $('#s_username');
            if (u) u.disabled = Boolean(id);

            // On create, password is required; on edit, it's optional (leave blank to keep current).
            const pw = $('#s_password');
            if (pw) pw.required = !id;
            const hint = $('#s_passwordHint');
            if (hint) hint.textContent = id
                ? 'Leave blank to keep the current password. Min 8 characters if changing.'
                : 'Min 8 characters with letters and numbers.';

            // Reset to Account pane.
            Sellers.activatePane('account');

            // Load plans into the select (cached after first call).
            await Sellers.loadPlans();

            if (id) {
                await Sellers.populateEditor(id);
            } else {
                // Defaults for new seller
                const setVal = (sid, v) => { const el = $('#' + sid); if (el) el.value = v; };
                setVal('s_status', 'active');
                const must = $('#s_mustChange'); if (must) must.checked = true;
                const ver = $('#s_verified'); if (ver) ver.checked = false;
                const feat = $('#s_featured'); if (feat) feat.checked = false;
                const paid = $('#s_paid'); if (paid) paid.checked = true;
                const ex = $('#s_expiresAt'); if (ex) ex.value = '';
            }

            const scrim = $('#sellerEditor');
            if (scrim) scrim.classList.add('open');
            // Focus the first editable field for keyboard users.
            setTimeout(() => { if (u && !u.disabled) u.focus(); else { const dn = $('#s_displayName'); if (dn) dn.focus(); } }, 50);
        },

        async populateEditor(id) {
            try {
                const all = await api('/api/admin/sellers?limit=999');
                const found = (all.items || []).find((s) => s.id === id);
                if (!found) { toast('Seller not found', 'error'); return; }

                const setVal = (sid, v) => { const el = $('#' + sid); if (el) el.value = v == null ? '' : v; };
                const setCheck = (sid, v) => { const el = $('#' + sid); if (el) el.checked = Boolean(v); };

                setVal('s_username', found.username || '');
                setVal('s_displayName', found.displayName || '');
                setVal('s_password', '');
                setCheck('s_mustChange', found.mustChangePassword);
                setVal('s_status', found.status || 'active');
                setCheck('s_verified', found.verified);
                setCheck('s_featured', found.featured);
                setVal('s_notes', found.notes || '');

                const sub = found.subscription || {};
                setVal('s_planId', sub.planId || '');
                setCheck('s_paid', sub.paid);
                setVal('s_subNote', sub.note || '');
                const ex = $('#s_expiresAt');
                if (ex) {
                    if (sub.expiresAt) {
                        const d = new Date(sub.expiresAt);
                        ex.value = d.toLocaleString();
                    } else {
                        ex.value = 'No expiry set';
                    }
                }
            } catch (err) {
                toast(err.message || 'Could not load seller', 'error');
            }
        },

        closeEditor() {
            const scrim = $('#sellerEditor');
            if (scrim) scrim.classList.remove('open');
            SellerEditor.open = false;
            SellerEditor.editing = null;
        },

        async saveEditor(e) {
            e.preventDefault();
            const id = SellerEditor.editing;
            const btn = $('#sellerEditorSave');
            if (!btn) return;
            btn.disabled = true;
            const restore = btn.textContent;
            btn.textContent = 'Saving…';

            const getVal = (sid) => { const el = $('#' + sid); return el ? (el.type === 'checkbox' ? el.checked : el.value) : ''; };

            const body = {
                displayName: getVal('s_displayName'),
                notes: getVal('s_notes'),
                status: getVal('s_status'),
                verified: getVal('s_verified'),
                featured: getVal('s_featured'),
                mustChangePassword: getVal('s_mustChange'),
                planId: getVal('s_planId'),
                paid: getVal('s_paid'),
                subscriptionNote: getVal('s_subNote'),
            };
            const password = getVal('s_password');
            if (password) body.password = password;
            if (!id) {
                body.username = getVal('s_username');
            }

            try {
                if (id) {
                    await api('/api/admin/sellers/' + id, { method: 'PUT', json: body });
                    toast('Seller updated', 'success');
                } else {
                    await api('/api/admin/sellers', { method: 'POST', json: body });
                    toast('Seller created', 'success');
                }
                Sellers.closeEditor();
                await Sellers.load();
            } catch (err) {
                toast(err.message || 'Save failed', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = restore;
            }
        },

        /* ---- subscription sub-actions (extend, mark paid) ---- */

        async loadPlans() {
            if (Array.isArray(SellerEditor.plans)) return;
            try {
                const r = await api('/api/admin/plans');
                SellerEditor.plans = (r && r.plans) || [];
            } catch {
                SellerEditor.plans = [];
            }
            const sel = $('#s_planId');
            if (!sel) return;
            const current = sel.value;
            sel.innerHTML = '<option value="">— No plan / no subscription —</option>'
                + SellerEditor.plans.map((p) => {
                    const price = (p.price != null) ? (' · ' + p.price + '/' + (p.interval || 'mo')) : '';
                    return '<option value="' + esc(p.id) + '">' + esc(p.name || p.id) + esc(price) + '</option>';
                }).join('');
            if (current) sel.value = current;
        },

        async extendSubscription() {
            if (!SellerEditor.editing) return;
            const days = parseInt((($('#s_extendDays') || {}).value || ''), 10);
            if (!Number.isFinite(days) || days < 1) {
                toast('Enter how many days to add (1–3650)', 'error');
                return;
            }
            const btn = $('#s_extendBtn');
            if (btn) btn.disabled = true;
            try {
                await api('/api/admin/sellers/' + SellerEditor.editing + '/extend', {
                    method: 'POST',
                    json: { days },
                });
                toast('Extended by ' + days + ' days', 'success');
                await Sellers.populateEditor(SellerEditor.editing);
                await Sellers.loadRows();
            } catch (err) {
                toast(err.message || 'Could not extend', 'error');
            } finally {
                if (btn) btn.disabled = false;
            }
        },

        /* ---- delete confirm (reuses #confirm modal) ---- */

        confirmDelete(id, cardEl) {
            const title = (cardEl && cardEl.querySelector('.name-en') || {}).textContent || 'this seller';
            const body = $('#confirmBody');
            if (body) body.textContent = '"' + title.trim() + '" and all of their listings will be removed permanently.';
            const headTitle = document.querySelector('#confirm .display');
            if (headTitle) headTitle.textContent = 'Delete seller?';
            const scrim = $('#confirm');
            if (scrim) scrim.classList.add('open');
            const yes = $('#confirmYes');
            const no = $('#confirmNo');
            const off = () => {
                scrim.classList.remove('open');
                yes.removeEventListener('click', onYes);
                no.removeEventListener('click', off);
            };
            const onYes = async () => {
                off();
                try {
                    const r = await api('/api/admin/sellers/' + id, { method: 'DELETE' });
                    const n = (r && r.listingsRemoved) || 0;
                    toast('Seller deleted' + (n ? ' · ' + n + ' listings removed' : ''), 'success');
                    await Sellers.load();
                } catch (err) {
                    toast(err.message || 'Delete failed', 'error');
                }
            };
            yes.addEventListener('click', onYes);
            no.addEventListener('click', off);
        },

        bindConfirm() {
            const scrim = $('#confirm');
            if (!scrim) return;
            scrim.addEventListener('click', (e) => { if (e.target === scrim) scrim.classList.remove('open'); });
        },
    };
    /* =============================================================
       Store & contact tab
       ============================================================= */
    const Store = {
        async load() {
            try {
                const data = await api('/api/admin/settings');
                Store.populate(data);
            } catch (err) {
                toast(err.message || 'Could not load settings', 'error');
            }
        },

        populate(s) {
            const fields = ['brand', 'tagline',
                'heroTitleEn', 'heroTitleMm', 'heroSubtitleEn', 'heroSubtitleMm',
                'contactTelegram', 'contactFacebook', 'contactEmail', 'contactPhone', 'contactViber',
                'adsContact', 'adsNote', 'sellerPitch', 'footerNote'];
            fields.forEach((id) => Store.setVal(id, s[id]));
        },

        setVal(id, value) {
            const el = $('#' + id);
            if (el) el.value = value == null ? '' : value;
        },

        getVal(id) {
            const el = $('#' + id);
            return el ? el.value : '';
        },

        bind() {
            if (Store._bound) return;
            Store._bound = true;
            const form = $('#storeForm');
            if (!form) return;
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const body = {
                    brand: Store.getVal('brand'),
                    tagline: Store.getVal('tagline'),
                    heroTitleEn: Store.getVal('heroTitleEn'),
                    heroTitleMm: Store.getVal('heroTitleMm'),
                    heroSubtitleEn: Store.getVal('heroSubtitleEn'),
                    heroSubtitleMm: Store.getVal('heroSubtitleMm'),
                    contactTelegram: Store.getVal('contactTelegram'),
                    contactFacebook: Store.getVal('contactFacebook'),
                    contactEmail: Store.getVal('contactEmail'),
                    contactPhone: Store.getVal('contactPhone'),
                    contactViber: Store.getVal('contactViber'),
                    adsContact: Store.getVal('adsContact'),
                    adsNote: Store.getVal('adsNote'),
                    sellerPitch: Store.getVal('sellerPitch'),
                    footerNote: Store.getVal('footerNote'),
                };
                try {
                    await api('/api/admin/settings', { method: 'PUT', json: body });
                    toast('Settings saved', 'success');
                } catch (err) {
                    toast(err.message || 'Save failed', 'error');
                }
            });
        },
    };

    /* =============================================================
       Security tab
       ============================================================= */
    const Security = {
        async load() {
            try {
                const s = await api('/api/admin/settings');
                const path = s.adminPath || '/control-8f3a2c';
                const url = window.location.origin + path;
                const urlEl = $('#adminUrl');
                if (urlEl) urlEl.textContent = url;
                const pathEl = $('#adminPath');
                if (pathEl) {
                    pathEl.value = path;
                    pathEl.disabled = Boolean(s.adminPathLocked);
                }
                const warn = $('#defaultCredsWarning');
                if (warn) warn.hidden = s.username !== 'exabyte';
            } catch (err) {
                toast(err.message || 'Could not load security settings', 'error');
            }
        },

        bind() {
            if (Security._bound) return;
            Security._bound = true;

            const copyBtn = $('#copyAdminUrl');
            if (copyBtn) {
                copyBtn.addEventListener('click', async () => {
                    const text = ($('#adminUrl') || {}).textContent || '';
                    const ok = await EX.copyText(text);
                    toast(ok ? 'Copied' : 'Copy failed', ok ? 'success' : 'error');
                });
            }

            const pathForm = $('#pathForm');
            if (pathForm) {
                pathForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const newPath = ($('#adminPath') || {}).value.trim();
                    if (!newPath) return;
                    const btn = $('#pathBtn');
                    if (btn) btn.disabled = true;
                    try {
                        await api('/api/admin/settings', { method: 'PUT', json: { adminPath: newPath } });
                        toast('Admin path updated — bookmark the new URL', 'success');
                        Security.load();
                    } catch (err) {
                        toast(err.message || 'Update failed', 'error');
                    } finally {
                        if (btn) btn.disabled = false;
                    }
                });
            }

            const credsForm = $('#credsForm');
            if (credsForm) {
                credsForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const username = ($('#newUsername') || {}).value.trim();
                    const current = ($('#currentPassword') || {}).value;
                    const next = ($('#newPassword') || {}).value;
                    if (!current) { toast('Enter your current password to confirm', 'error'); return; }
                    if (!username && !next) { toast('Nothing to change', 'error'); return; }
                    try {
                        const res = await api('/api/admin/account', {
                            method: 'PUT',
                            json: {
                                username: username || undefined,
                                currentPassword: current,
                                newPassword: next || undefined,
                            },
                        });
                        if (res && res.token) token.set(res.token);
                        toast('Credentials updated', 'success');
                        credsForm.reset();
                        Security.load();
                    } catch (err) {
                        toast(err.message || 'Update failed', 'error');
                    }
                });
            }
        },
    };

    /* =============================================================
       Blog / posts tab
       Backend exposes GET/POST/PUT/DELETE /api/admin/posts.
       ============================================================= */
    const PostState = { q: '', status: '', page: 1, limit: 20, total: 0, totalPages: 1 };
    const PostEditor = { open: false, editing: null, file: null, removeCover: false, existingCover: '' };

    const Posts = {
        async load() {
            await Posts.loadRows();
        },

        async loadRows() {
            const host = $('#postRows');
            if (!host) return;
            host.innerHTML = '<div class="rowcard"><div class="shot">⏳</div><div class="info"><div class="name">Loading…</div></div><div class="acts"></div></div>';
            try {
                const params = new URLSearchParams();
                params.set('page', String(PostState.page));
                params.set('limit', String(PostState.limit));
                const data = await api('/api/admin/posts?' + params.toString());
                let rows = data.items || [];
                if (PostState.status) rows = rows.filter((p) => p.status === PostState.status);
                if (PostState.q) {
                    const q = PostState.q.toLowerCase();
                    rows = rows.filter((p) => (p.title_en || '').toLowerCase().includes(q) || (p.title_mm || '').includes(PostState.q));
                }
                PostState.total = data.total || 0;
                PostState.totalPages = data.totalPages || 1;
                host.innerHTML = rows.length
                    ? rows.map(Posts.rowCard).join('')
                    : '<div class="rowcard" style="grid-template-columns:1fr;"><div class="info" style="text-align:center;padding:32px;color:var(--text-3);">No posts yet — click <b>+ New post</b> to add one.</div></div>';
                Posts.wireRows(host);
                Posts.renderPagination();
            } catch (err) {
                host.innerHTML = '<div class="rowcard" style="grid-template-columns:1fr;"><div class="info" style="padding:24px;color:var(--danger);">' + esc(err.message || 'Load failed') + '</div></div>';
            }
        },

        rowCard(p) {
            const title = p.title_en || p.title_mm || 'Untitled post';
            const statusBadge = '<span class="pill ' + (p.status === 'published' ? 'pill-available' : 'pill-reserved') + '">' + esc(p.status) + '</span>';
            const meta = [
                p.tag ? '<span>' + esc(p.tag) + '</span><span>·</span>' : '',
                '<span>' + esc(shortDate(p.publishedAt || p.createdAt)) + '</span>',
            ].join('');
            return '<div class="rowcard" data-id="' + esc(p.id) + '">'
                + '<div class="shot">' + (p.cover ? '<img src="' + esc(p.cover) + '" alt="" loading="lazy">' : '📰') + '</div>'
                + '<div class="info">'
                +   '<div class="name">' + esc(truncate(title, 60)) + '</div>'
                +   '<div class="meta">' + statusBadge + ' ' + meta + '</div>'
                + '</div>'
                + '<div class="acts">'
                +   '<button type="button" class="btn btn-ghost btn-sm" data-act="edit">Edit</button>'
                +   '<button type="button" class="btn btn-ghost btn-sm" data-act="del">Delete</button>'
                + '</div>'
                + '</div>';
        },

        wireRows(host) {
            $$('.rowcard', host).forEach((card) => {
                const id = card.dataset.id;
                const edit = card.querySelector('[data-act="edit"]');
                const del = card.querySelector('[data-act="del"]');
                if (edit) edit.addEventListener('click', () => Posts.openEditor(id));
                if (del) del.addEventListener('click', () => Posts.confirmDelete(id, card));
            });
        },

        renderPagination() {
            const host = $('#postPagination');
            if (!host) return;
            const state = { page: PostState.page, totalPages: PostState.totalPages };
            const UI = window.UI;
            if (UI && UI.pagination) {
                UI.pagination(host, state, (p) => { PostState.page = p; Posts.loadRows(); });
            } else {
                host.innerHTML = '';
            }
        },

        bind() {
            if (Posts._bound) return;
            Posts._bound = true;

            const search = $('#postSearch');
            const searchClear = $('#postSearchClear');
            if (search) {
                let timer = null;
                const run = () => { PostState.q = search.value.trim(); PostState.page = 1; Posts.loadRows(); };
                search.addEventListener('input', () => {
                    if (searchClear) searchClear.style.display = search.value ? '' : 'none';
                    clearTimeout(timer);
                    timer = setTimeout(run, 250);
                });
            }
            if (searchClear) {
                searchClear.innerHTML = ICONS.close;
                searchClear.addEventListener('click', () => {
                    if (search) search.value = '';
                    searchClear.style.display = 'none';
                    PostState.q = '';
                    PostState.page = 1;
                    Posts.loadRows();
                });
            }
            const searchIcon = $('#postSearchIcon');
            if (searchIcon) searchIcon.innerHTML = ICONS.search;

            const statusFilter = $('#postStatusFilter');
            if (statusFilter) statusFilter.addEventListener('change', (e) => {
                PostState.status = e.target.value;
                PostState.page = 1;
                Posts.loadRows();
            });

            const newBtn = $('#newPostBtn');
            if (newBtn) newBtn.addEventListener('click', () => Posts.openEditor(null));

            Posts.bindEditor();
            Posts.bindConfirm();
        },

        /* ---- editor modal ---- */

        openEditor(id) {
            PostEditor.editing = id;
            PostEditor.file = null;
            PostEditor.removeCover = false;
            PostEditor.existingCover = '';
            PostEditor.open = true;

            const form = $('#postForm');
            if (form) form.reset();
            Posts.renderCoverPreview();

            const title = $('#postEditorTitle');
            if (title) title.textContent = id ? 'Edit post' : 'New post';

            if (id) {
                Posts.populateEditor(id);
            } else {
                const status = $('#pt_status'); if (status) status.value = 'draft';
            }

            const scrim = $('#postEditor');
            if (scrim) scrim.classList.add('open');
        },

        async populateEditor(id) {
            try {
                const all = await api('/api/admin/posts?limit=999');
                const found = (all.items || []).find((p) => p.id === id);
                if (!found) { toast('Post not found', 'error'); Posts.closeEditor(); return; }
                const setVal = (fid, v) => { const el = $('#' + fid); if (el) el.value = v == null ? '' : v; };
                setVal('pt_title_en', found.title_en);
                setVal('pt_title_mm', found.title_mm);
                setVal('pt_slug', found.slug);
                setVal('pt_tag', found.tag);
                setVal('pt_status', found.status || 'draft');
                setVal('pt_excerpt_en', found.excerpt_en);
                setVal('pt_excerpt_mm', found.excerpt_mm);
                setVal('pt_body_en', found.body_en);
                setVal('pt_body_mm', found.body_mm);
                PostEditor.existingCover = found.cover || '';
                Posts.renderCoverPreview();
            } catch (err) {
                toast(err.message || 'Could not load post', 'error');
            }
        },

        closeEditor() {
            const scrim = $('#postEditor');
            if (scrim) scrim.classList.remove('open');
            PostEditor.open = false;
            PostEditor.editing = null;
            PostEditor.file = null;
            PostEditor.removeCover = false;
            PostEditor.existingCover = '';
        },

        renderCoverPreview() {
            const host = $('#postShots');
            if (!host) return;
            if (PostEditor.file) {
                const url = URL.createObjectURL(PostEditor.file);
                host.innerHTML = '<div class="shot-item" data-new="0"><img src="' + esc(url) + '" alt=""><button type="button" class="kill" data-rm-new title="Remove">×</button><span class="tag">NEW</span></div>';
            } else if (PostEditor.existingCover && !PostEditor.removeCover) {
                host.innerHTML = '<div class="shot-item" data-existing="' + esc(PostEditor.existingCover) + '"><img src="' + esc(PostEditor.existingCover) + '" alt=""><button type="button" class="kill" data-rm-existing title="Remove">×</button></div>';
            } else {
                host.innerHTML = '';
            }
            const rmNew = host.querySelector('[data-rm-new]');
            if (rmNew) rmNew.addEventListener('click', () => { PostEditor.file = null; Posts.renderCoverPreview(); });
            const rmExisting = host.querySelector('[data-rm-existing]');
            if (rmExisting) rmExisting.addEventListener('click', () => { PostEditor.removeCover = true; Posts.renderCoverPreview(); });
        },

        bindEditor() {
            const close = $('#postEditorClose');
            const cancel = $('#postEditorCancel');
            const scrim = $('#postEditor');
            if (close) close.addEventListener('click', Posts.closeEditor);
            if (cancel) cancel.addEventListener('click', Posts.closeEditor);
            if (scrim) scrim.addEventListener('click', (e) => { if (e.target === scrim) Posts.closeEditor(); });

            const dz = $('#postDropzone');
            const input = $('#postFileInput');
            if (dz && input) {
                dz.addEventListener('click', () => input.click());
                dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
                dz.addEventListener('dragleave', () => dz.classList.remove('over'));
                dz.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dz.classList.remove('over');
                    const f = (e.dataTransfer.files || [])[0];
                    if (f) { PostEditor.file = f; PostEditor.removeCover = false; Posts.renderCoverPreview(); }
                });
                input.addEventListener('change', (e) => {
                    const f = (e.target.files || [])[0];
                    if (f) { PostEditor.file = f; PostEditor.removeCover = false; Posts.renderCoverPreview(); }
                    input.value = '';
                });
            }

            const form = $('#postForm');
            if (form) form.addEventListener('submit', Posts.saveEditor);
        },

        async saveEditor(e) {
            e.preventDefault();
            const id = PostEditor.editing;
            const btn = $('#postEditorSave');
            btn.disabled = true;
            const restore = btn.textContent;
            btn.textContent = 'Saving…';

            try {
                const v = (fid) => { const el = $('#' + fid); return el ? el.value : ''; };
                const fd = new FormData();
                fd.append('title_en', v('pt_title_en'));
                fd.append('title_mm', v('pt_title_mm'));
                fd.append('slug', v('pt_slug'));
                fd.append('tag', v('pt_tag'));
                fd.append('status', v('pt_status') || 'draft');
                fd.append('excerpt_en', v('pt_excerpt_en'));
                fd.append('excerpt_mm', v('pt_excerpt_mm'));
                fd.append('body_en', v('pt_body_en'));
                fd.append('body_mm', v('pt_body_mm'));
                if (PostEditor.file) fd.append('cover', PostEditor.file, PostEditor.file.name);
                if (PostEditor.removeCover) fd.append('removeCover', 'true');

                if (id) {
                    await api('/api/admin/posts/' + id, { method: 'PUT', body: fd });
                    toast('Post updated', 'success');
                } else {
                    await api('/api/admin/posts', { method: 'POST', body: fd });
                    toast('Post created', 'success');
                }
                Posts.closeEditor();
                await Posts.load();
            } catch (err) {
                toast(err.message || 'Save failed', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = restore;
            }
        },

        confirmDelete(id, cardEl) {
            const title = (cardEl && cardEl.querySelector('.name') || {}).textContent || 'this post';
            const heading = $('#confirmTitle');
            if (heading) heading.textContent = 'Delete post?';
            const body = $('#confirmBody');
            if (body) body.textContent = '"' + title.trim() + '" will be removed permanently.';
            const scrim = $('#confirm');
            if (scrim) scrim.classList.add('open');
            const yes = $('#confirmYes');
            const no = $('#confirmNo');
            const off = () => { scrim.classList.remove('open'); yes.removeEventListener('click', onYes); no.removeEventListener('click', off); };
            const onYes = async () => {
                off();
                try {
                    await api('/api/admin/posts/' + id, { method: 'DELETE' });
                    toast('Post deleted', 'success');
                    await Posts.load();
                } catch (err) {
                    toast(err.message || 'Delete failed', 'error');
                }
            };
            yes.addEventListener('click', onYes);
            no.addEventListener('click', off);
        },

        bindConfirm() {
            const scrim = $('#confirm');
            if (!scrim) return;
            scrim.addEventListener('click', (e) => { if (e.target === scrim) scrim.classList.remove('open'); });
        },
    };

    /* =============================================================
       Boot
       ============================================================= */

    async function bootTabs() {
        Store.bind();
        Security.bind();
        Listings.bind();
        Sellers.bind();
        Posts.bind();
        await Listings.load(); // listings is the default tab
    }

    async function boot() {
        if (!window.EX) {
            const auth = $('#authScreen');
            if (auth) auth.innerHTML = '<div class="auth-card"><h1>Boot error</h1><p>window.EX is not loaded. Check that /js/core.js loads before this file.</p></div>';
            return;
        }

        bindLogin();
        bindLogout();
        bindTabs();

        if (EX.loadSite) { try { await EX.loadSite(); } catch { /* site defaults are fine */ } }
        paintBrand();

        // Try to skip the login screen if a valid token is already stored.
        const user = await tryAutoLogin();
        if (user) {
            showShell(user);
            await bootTabs();
        } else {
            showLogin();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
