/* =============================================================
   views/admin.js â€” control panel client-side controller.

   Loaded by views/admin.html at /<adminPath>/admin.js after
   /js/core.js, so window.EX (api, token, esc, money, t, toast,
   statusPill, ICONS, fieldLabel, gameName) is always available.

   The panel is reachable at a secret URL â€” the path is stored
   in settings.adminPath and the human-readable form is shown on
   the Security tab. The default path is /control-8f3a2c.

   This file replaces the original 70-line login stub. It owns
   the three tabs defined in admin.html (Listings Â· Store &
   contact Â· Security). The admin API also covers sellers,
   plans, posts and ad slots, but exposing them needs more
   markup in admin.html â€” the endpoints are all in place and
   tested; only the UI for them is omitted here.
   ============================================================= */
(function () {
    'use strict';

    const EX = window.EX;
    const { api, token, esc, money, t, toast, statusPill, ICONS, fieldLabel, gameName } = EX;
    const $ = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

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

        const site = EX.site();
        if (site && site.brand) {
            const mark = $('[data-brand-mark]');
            const name = $('[data-brand-name]');
            const tag = $('[data-brand-tagline]');
            if (mark) mark.textContent = (site.brand || 'E').trim().charAt(0).toUpperCase();
            if (name) name.textContent = site.brand;
            if (tag) tag.textContent = site.tagline || '';
        }
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
        $$('.tab').forEach((btn) => {
            btn.addEventListener('click', () => activateTab(btn.dataset.tab));
        });
    }

    function activateTab(name) {
        $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
        $$('main > section').forEach((s) => {
            s.classList.toggle('hidden', s.id !== 'tab-' + name);
        });
        const handler = TAB_LOADERS[name];
        if (handler) handler();
    }

    const TAB_LOADERS = {
        listings: () => Listings.load(),
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
                    : '<div class="rowcard" style="grid-template-columns:1fr;"><div class="info" style="text-align:center;padding:32px;color:var(--text-3);">No listings yet — click <b>+ New listing</b> to add one.</div></div>';
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
                '<span>' + esc(game) + '</span>',
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
            const newBtn = $('#newBtn');
            if (newBtn) newBtn.addEventListener('click', () => Listings.openEditor(null));
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
            if (title) title.textContent = id ? 'Edit listing' : 'New listing';

            Listings.ensureGameSelect();

            if (id) {
                Listings.populateEditor(id);
            } else {
                Listings.setField('f_game', 'efootball');
                Listings.setField('f_status', 'available');
                Listings.setField('f_price', '');
                Listings.setField('f_title_en', '');
                Listings.setField('f_title_mm', '');
                Listings.setField('f_overall_rating', '');
                Listings.setField('f_coins', '');
                Listings.setField('f_featured_players', '');
                Listings.setField('f_description_en', '');
                Listings.setField('f_description_mm', '');
                Listings.setField('f_contact_info', '');
                const feat = $('#f_featured'); if (feat) feat.checked = false;
            }

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

                if (id) {
                    const existing = (ListEditor.existing || []).filter((u) => !ListEditor.removed.has(u));
                    existing.forEach((u) => fd.append('keepImages', u));
                    await api('/api/admin/listings/' + id, { method: 'PUT', body: fd });
                    toast('Listing updated', 'success');
                } else {
                    await api('/api/admin/listings', { method: 'POST', body: fd });
                    toast('Listing published', 'success');
                }
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
       Boot
       ============================================================= */

    async function bootTabs() {
        Store.bind();
        Security.bind();
        Listings.bind();
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
