/* =============================================================
   pages/portal.js — the seller portal page controller.

   Wired up against portal.html. The page has:
     - a sign-in card (#authScreen)
     - a portal shell (#portal) with three tabs (listings, profile, security)
     - a listing editor modal (#editor)
     - a delete-confirm modal (#confirm)

   Every action hits the JSON API under /api/seller/*; the server
   gates mutations behind the reseller session and (for new listings)
   an active subscription.
   ============================================================= */
(function () {
    "use strict";

    if (!window.EX) {
        const host = document.getElementById("authScreen");
        if (host) host.innerHTML = "<div class=\"auth-card\"><h1>Boot error</h1><p>window.EX is not loaded. Check that /js/core.js loads before this file.</p></div>";
        return;
    }

    const {
        $, $$, t, esc, money, statusPill,
        games, gameName,
        ICONS, api, token, setLang, getLang, applyTranslations, loadSite, site,
        toast, copyText, debounce,
    } = window.EX;

    /* =============================================================
       Local state
       ============================================================= */
    let ME = null;          // current user (from /api/auth/me)
    let STORE_URL = "";     // public URL of this seller's store
    let PLANS = [];         // subscription plans, for the banner

    const ListState = { q: "", game: "", status: "", sort: "newest", page: 1, limit: 12, total: 0, totalPages: 1 };
    const Editor = { open: false, editing: null, files: [], removed: new Set(), existing: [], existingThumbs: [] };

    /* =============================================================
       Boot
       ============================================================= */
    async function boot() {
        try { await loadSite(); } catch { /* site defaults are fine */ }

        if (window.UI && window.UI.loadAds) { try { await window.UI.loadAds(); } catch { /* ads are optional */ } }
        if (window.UI && window.UI.mountHeader) window.UI.mountHeader();
        if (window.UI && window.UI.mountAds) window.UI.mountAds();

        applyTranslations();

        $$(".lang-switch button").forEach((b) => b.addEventListener("click", () => setLang(b.dataset.lang)));
        setLang(getLang());
        document.addEventListener("langchange", () => {
            applyTranslations();
            if (ME) paintShell();
        });

        const brand = (site() && site().brand) || "EXABYTE";
        const tmpl = document.documentElement.getAttribute("data-title") || "%s";
        document.title = tmpl.replace("%s", brand);
        const mark = $("#authMark"); if (mark) mark.textContent = brand.trim().charAt(0).toUpperCase();
        const name = $("#authBrand"); if (name) name.textContent = brand;

        bindLogin();
        bindLogout();
        bindTabs();
        bindFilters();
        bindProfileForm();
        bindPasswordForm();
        bindEditor();
        bindConfirm();

        const me = await tryAutoLogin();
        if (me && me.role === "reseller") {
            showShell(me);
        } else {
            if (me && me.role === "admin") token.clear();
            showLogin();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }

    /* =============================================================
       Auth
       ============================================================= */
    async function tryAutoLogin() {
        if (!token.get()) return null;
        try {
            const { user } = await api("/api/auth/me");
            return user || null;
        } catch {
            token.clear();
            return null;
        }
    }

    function bindLogin() {
        const form = $("#loginForm");
        if (!form) return;
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const user = (($("#loginUser") || {}).value || "");
            const pass = (($("#loginPass") || {}).value || "");
            const btn = $("#loginBtn");
            if (btn) { btn.disabled = true; btn.textContent = t("signIn") + "…"; }
            try {
                const res = await api("/api/auth/login", { method: "POST", json: { username: user.trim(), password: pass } });
                if (!res || !res.user) throw new Error("Sign in failed");
                if (res.user.role !== "reseller") {
                    throw new Error("This portal is for seller accounts only.");
                }
                if (res.token) token.set(res.token);
                showShell(res.user);
            } catch (err) {
                toast(err.message || "Sign in failed", "error");
            } finally {
                if (btn) { btn.disabled = false; btn.textContent = t("signIn"); }
            }
        });
    }

    function bindLogout() {
        const btn = $("#logoutBtn");
        if (!btn) return;
        btn.addEventListener("click", async () => {
            try { await api("/api/auth/logout", { method: "POST" }); } catch { /* ignore */ }
            token.clear();
            ME = null;
            showLogin();
            const u = $("#loginUser"); if (u) u.value = "";
            const p = $("#loginPass"); if (p) p.value = "";
        });
    }

    function showLogin() {
        const a = $("#authScreen"); if (a) a.hidden = false;
        const p = $("#portal"); if (p) p.hidden = true;
        const h = $("[data-header]"); if (h) h.hidden = false;
    }

    function showShell(user) {
        ME = user;
        const a = $("#authScreen"); if (a) a.hidden = true;
        const p = $("#portal"); if (p) p.hidden = false;
        const h = $("[data-header]"); if (h) h.hidden = true;
        paintShell();
        activateTab("listings");
        Listings.load();
    }

    function paintAvatar(el, name, url) {
        if (!el) return;
        if (url) {
            el.innerHTML = "<img src=\"" + esc(url) + "\" alt=\"\">";
        } else {
            el.textContent = (name || "?").charAt(0).toUpperCase();
        }
    }

    function paintShell() {
        if (!ME) return;
        const name = ME.displayName || ME.username;
        const me = $("#meName"); if (me) me.textContent = name;
        paintAvatar($("#meAvatar"), name, ME.avatar);
        const brand = (site() && site().brand) || "EXABYTE";
        const pb = $("#portalBrand"); if (pb) pb.textContent = brand;
        const pm = $("#portalMark"); if (pm) pm.textContent = brand.trim().charAt(0).toUpperCase();
    }

    /* =============================================================
       Tabs
       ============================================================= */
    function bindTabs() {
        $$(".tab").forEach((btn) => {
            btn.addEventListener("click", () => activateTab(btn.dataset.tab));
        });
    }

    function activateTab(name) {
        $$(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
        $$("main > section").forEach((s) => { s.classList.toggle("hidden", s.id !== "tab-" + name); });
        if (name === "listings") Listings.load();
        if (name === "profile")  Profile.load();
    }

    /* =============================================================
       Listings tab
       ============================================================= */
    const Listings = {
        async load() {
            await Promise.all([Listings.loadSubBanner(), Listings.loadTiles(), Listings.loadRows()]);
        },

        async loadSubBanner() {
            const host = $("#subBanner");
            if (!host) return;
            try {
                const o = await api("/api/seller/overview");
                PLANS = Array.isArray(o.plans) ? o.plans : [];
                if (window.Panel && Panel.setPlansCache) Panel.setPlansCache(PLANS);
                STORE_URL = o.storeUrl || "";

                const sub = o.subscription || {};
                const ringCls = sub.active ? "" : (sub.expired ? "bad" : "warn");
                const ringLabel = sub.unlimited ? "∞" : (sub.daysLeft || 0);
                const planName = sub.planName || t("subscription");
                let statusKey = "subActive";
                if (!sub.active) statusKey = sub.expired ? "subExpired" : "subUnpaid";
                else if (sub.expiringSoon) statusKey = "subExpiringSoon";
                const statusLabel = t(statusKey);
                const expiresLine = sub.expiresAt
                    ? (t("expiresOn") + " " + new Date(sub.expiresAt).toLocaleDateString(getLang() === "mm" ? "my-MM" : "en-GB", { year: "numeric", month: "short", day: "numeric" }))
                    : "";
                const renewLine = sub.active ? "" : t("renewPrompt");
                const counts = o.counts || {};
                const limit = o.limit || 0;
                const remaining = (counts.remaining === null || counts.remaining === undefined) ? null : counts.remaining;

                host.innerHTML = ""
                    + "<div class=\"sub-banner " + (sub.active ? (sub.expiringSoon ? "is-warn" : "") : "is-danger") + "\">"
                    +   "<div class=\"ring " + ringCls + "\"><b>" + esc(ringLabel) + "</b></div>"
                    +   "<div class=\"sub-meta\">"
                    +     "<b>" + esc(planName) + " · " + esc(statusLabel) + "</b>"
                    +     "<span>" + esc(expiresLine) + (renewLine ? " · " + esc(renewLine) : "") + "</span>"
                    +   "</div>"
                    +   "<div class=\"sub-actions\">"
                    +     (limit
                        ? ("<span class=\"dim\">" + esc(counts.total) + " / " + esc(limit) + " " + esc(t("listingsTitle").toLowerCase())
                            + (remaining !== null ? " · " + esc(remaining) + " " + esc(t("listingsIncluded").toLowerCase()) : "")
                            + "</span>")
                        : "")
                    +     "<a class=\"btn btn-outline btn-sm\" href=\"/sell#plans\" data-i18n=\"plansTitle\">" + esc(t("plansTitle")) + "</a>"
                    +   "</div>"
                    + "</div>";
            } catch (err) {
                host.innerHTML = "";
            }
        },

        async loadTiles() {
            const host = $("#tiles");
            if (!host) return;
            try {
                const o = await api("/api/seller/overview");
                const c = (o && o.counts) || {};
                host.innerHTML = [
                    tile("Total listings", c.total || 0, "accent"),
                    tile("Available", c.available || 0),
                    tile("Reserved", c.reserved || 0),
                    tile("Sold", c.sold || 0),
                ].join("");
            } catch (err) {
                host.innerHTML = "";
            }
        },

        async loadRows() {
            const host = $("#rows");
            if (!host) return;
            host.innerHTML = "<div class=\"portal-row\"><div class=\"shot\">⏳</div><div class=\"info\"><div class=\"name\">Loading…</div></div><div class=\"acts\"></div></div>";
            try {
                const params = new URLSearchParams();
                if (ListState.q) params.set("q", ListState.q);
                if (ListState.game) params.set("game", ListState.game);
                if (ListState.status) params.set("status", ListState.status);
                if (ListState.sort && ListState.sort !== "newest") params.set("sort", ListState.sort);
                params.set("page", String(ListState.page));
                params.set("limit", String(ListState.limit));
                const data = await api("/api/seller/listings?" + params.toString());
                const rows = (data && data.items) || [];
                ListState.total = (data && data.total) || 0;
                ListState.totalPages = (data && data.totalPages) || 1;
                if (!rows.length) {
                    host.innerHTML = ""
                        + "<div class=\"portal-row\" style=\"grid-template-columns:1fr;\">"
                        +   "<div class=\"info\" style=\"text-align:center;padding:30px;color:var(--text-3);\">"
                        +     esc(t("noResultsTitle") || "No listings yet") + " — "
                        +     "<a href=\"#\" data-act=\"new\">" + esc(t("newListing")) + "</a>"
                        +   "</div>"
                        + "</div>";
                    const a = host.querySelector("[data-act=\"new\"]");
                    if (a) a.addEventListener("click", (e) => { e.preventDefault(); Listings.openEditor(); });
                } else {
                    host.innerHTML = rows.map(Listings.row).join("");
                    Listings.wireRows(host);
                }
                Listings.renderPagination();
            } catch (err) {
                host.innerHTML = "<div class=\"portal-row\" style=\"grid-template-columns:1fr;\"><div class=\"info\" style=\"padding:24px;color:var(--danger);\">" + esc(err.message || "Load failed") + "</div></div>";
            }
        },

        row(l) {
            const thumb = (l.thumbs && l.thumbs[0]) || (l.images && l.images[0]) || "";
            const title = l.title_en || l.title_mm || ("Listing " + (l.id || "").slice(0, 6));
            const game = gameName(l.game);
            const meta = [
                "<span class=\"game-tag\">" + esc(game) + "</span>",
                l.level ? "<span>·</span><span>" + esc(l.level) + "</span>" : "",
                l.currency_amount ? "<span>·</span><span>" + esc(l.currency_amount) + "</span>" : "",
                "<span>·</span><b>" + esc(money(l.price)) + "</b>",
            ].join("");
            return ""
                + "<div class=\"portal-row\" data-id=\"" + esc(l.id) + "\">"
                +   "<div class=\"shot\">" + (thumb ? "<img src=\"" + esc(thumb) + "\" alt=\"\" loading=\"lazy\">" : "🎮") + "</div>"
                +   "<div class=\"info\">"
                +     "<div class=\"name\">" + esc(title) + "</div>"
                +     "<div class=\"meta\">" + statusPill(l.status) + " " + meta + "</div>"
                +   "</div>"
                +   "<div class=\"acts\">"
                +     statusChip(l.id, "available", l.status === "available")
                +     statusChip(l.id, "reserved",  l.status === "reserved")
                +     statusChip(l.id, "sold",      l.status === "sold")
                +     "<button type=\"button\" class=\"btn btn-ghost btn-sm\" data-act=\"edit\">Edit</button>"
                +     "<button type=\"button\" class=\"btn btn-ghost btn-sm\" data-act=\"del\">Delete</button>"
                +   "</div>"
                + "</div>";
        },

        wireRows(host) {
            $$(".portal-row", host).forEach((card) => {
                const id = card.dataset.id;
                const edit = card.querySelector("[data-act=\"edit\"]");
                const del  = card.querySelector("[data-act=\"del\"]");
                if (edit) edit.addEventListener("click", () => Listings.openEditor(id));
                if (del)  del.addEventListener("click",  () => Listings.confirmDelete(id));
                $$("[data-status]", card).forEach((b) => {
                    b.addEventListener("click", () => Listings.setStatus(id, b.dataset.status));
                });
            });
        },

        renderPagination() {
            const host = $("#pagination");
            if (!host) return;
            const UI = window.UI;
            if (UI && UI.pagination) {
                UI.pagination(host, { page: ListState.page, totalPages: ListState.totalPages }, (p) => { ListState.page = p; Listings.loadRows(); });
            } else {
                host.innerHTML = "";
            }
        },

        async setStatus(id, status) {
            try {
                // The seller route has no dedicated status endpoint, so we PUT the
                // full record (the current fields) and just change the status.
                const all = await api("/api/seller/listings?limit=999");
                const found = (all.items || []).find((x) => x.id === id);
                if (!found) throw new Error("Listing not found");
                const body = {
                    game: found.game,
                    title_en: found.title_en || "",
                    title_mm: found.title_mm || "",
                    description_en: found.description_en || "",
                    description_mm: found.description_mm || "",
                    price: Number(found.price) || 0,
                    status: status,
                    level: found.level || "",
                    currency_amount: found.currency_amount || "",
                    highlights: found.highlights || "",
                    server: found.server || "",
                    contact_note: found.contact_note || "",
                    keepImages: found.images || [],
                };
                await api("/api/seller/listings/" + id, { method: "PUT", json: body });
                toast("Marked " + status, "success");
                Listings.loadRows();
            } catch (err) {
                toast(err.message || "Could not change status", "error");
            }
        },

        confirmDelete(id) {
            const scrim = $("#confirm");
            if (!scrim) return;
            const title = $("#confirmTitle");
            if (title) title.textContent = "Delete this listing?";
            const body  = $("#confirmBody");
            if (body)  body.textContent = "This removes the listing, its images, and its public page. This cannot be undone.";
            scrim.removeAttribute("hidden");
            scrim.classList.add("open");
            const yes = $("#confirmYes");
            const no  = $("#confirmNo");
            const off = () => {
                scrim.classList.remove("open");
                yes.removeEventListener("click", onYes);
                no.removeEventListener("click", off);
            };
            const onYes = async () => {
                off();
                try {
                    await api("/api/seller/listings/" + id, { method: "DELETE" });
                    toast("Listing deleted", "success");
                    Listings.loadRows();
                } catch (err) {
                    toast(err.message || "Delete failed", "error");
                }
            };
            yes.addEventListener("click", onYes);
            no.addEventListener("click", off);
        },

        /* ================= editor ================= */
        openEditor(id) {
            Editor.open = true;
            Editor.editing = id || null;
            Editor.files = [];
            Editor.removed = new Set();
            Editor.existing = [];
            Editor.existingThumbs = [];

            const form = $("#editorForm");
            if (form) form.reset();
            const title = $("#editorTitle");
            if (title) title.textContent = id ? "Edit listing" : "New listing";

            // Populate the game select.
            const gameSel = $("#f_game");
            if (gameSel) {
                gameSel.innerHTML = games().map((g) => "<option value=\"" + esc(g.id) + "\">" + esc(g.name) + "</option>").join("");
                gameSel.value = "efootball";
            }
            const statusSel = $("#f_status");
            if (statusSel) statusSel.value = "available";

            if (window.Panel) { Panel.refreshGameLabels(); Panel.refreshPriceSymbol(); }
            Listings.renderShots();
            const scrim = $("#editor");
            if (scrim) { scrim.removeAttribute("hidden"); scrim.classList.add("open"); }

            if (id) Listings.loadIntoEditor(id);
        },

        async loadIntoEditor(id) {
            try {
                const all = await api("/api/seller/listings?limit=999");
                const found = (all.items || []).find((x) => x.id === id);
                if (!found) { toast("Listing not found", "error"); Listings.closeEditor(); return; }
                const setVal = (id2, v) => { const el = $("#" + id2); if (el) el.value = v == null ? "" : v; };
                setVal("f_game",     found.game || "efootball");
                setVal("f_status",   found.status || "available");
                setVal("f_title_en", found.title_en || "");
                setVal("f_title_mm", found.title_mm || "");
                setVal("f_price",    String(found.price || 0));
                setVal("f_level",    found.level || "");
                setVal("f_currency_amount", found.currency_amount || "");
                setVal("f_server",   found.server || "");
                setVal("f_highlights", found.highlights || "");
                setVal("f_description_en", found.description_en || "");
                setVal("f_description_mm", found.description_mm || "");
                setVal("f_contact_note",   found.contact_note || "");
                Editor.existing = (found.images || []).slice();
                Editor.existingThumbs = (found.thumbs || []).slice();
                if (window.Panel) { Panel.refreshGameLabels(); Panel.refreshPriceSymbol(); }
                Listings.renderShots();
            } catch (err) {
                toast(err.message || "Could not load listing", "error");
            }
        },

        closeEditor() {
            const scrim = $("#editor");
            if (scrim) { scrim.classList.remove("open"); scrim.setAttribute("hidden", ""); }
            Editor.open = false;
            Editor.editing = null;
            Editor.files = [];
            Editor.removed = new Set();
            Editor.existing = [];
            Editor.existingThumbs = [];
        },

        renderShots() {
            const host = $("#shots");
            if (!host) return;
            const tiles = [];
            Editor.existing.forEach((url) => {
                const isGone = Editor.removed.has(url);
                tiles.push("<div class=\"shot-item\" data-existing=\"" + esc(url) + "\"" + (isGone ? " style=\"opacity:.35;\"" : "") + ">"
                    + "<img src=\"" + esc(url) + "\" alt=\"\">"
                    + "<button type=\"button\" class=\"kill\" data-rm-existing=\"" + esc(url) + "\" title=\"Remove\">×</button>"
                    + "</div>");
            });
            Editor.files.forEach((file, i) => {
                const preview = URL.createObjectURL(file);
                tiles.push("<div class=\"shot-item\" data-new=\"" + i + "\">"
                    + "<img src=\"" + esc(preview) + "\" alt=\"\">"
                    + "<button type=\"button\" class=\"kill\" data-rm-new=\"" + i + "\" title=\"Remove\">×</button>"
                    + "<span class=\"tag\">NEW</span>"
                    + "</div>");
            });
            host.innerHTML = tiles.join("");
            $$("[data-rm-existing]", host).forEach((btn) => {
                btn.addEventListener("click", () => {
                    const url = btn.dataset.rmExisting;
                    if (Editor.removed.has(url)) Editor.removed.delete(url);
                    else Editor.removed.add(url);
                    Listings.renderShots();
                });
            });
            $$("[data-rm-new]", host).forEach((btn) => {
                btn.addEventListener("click", () => {
                    const i = Number(btn.dataset.rmNew);
                    Editor.files.splice(i, 1);
                    Listings.renderShots();
                });
            });
        },

        addFiles(fileList) {
            const keptExisting = (Editor.existing || []).filter((u) => !Editor.removed.has(u)).length;
            const remaining = 6 - (keptExisting + Editor.files.length);
            if (remaining <= 0) { toast("Maximum 6 images", "error"); return; }
            const incoming = Array.from(fileList).slice(0, remaining);
            incoming.forEach((f) => {
                if (!/^image\//.test(f.type)) { toast("\"" + f.name + "\" is not an image", "error"); return; }
                if (f.size > 8 * 1024 * 1024) { toast("\"" + f.name + "\" exceeds 8 MB", "error"); return; }
                Editor.files.push(f);
            });
            Listings.renderShots();
        },

        async saveEditor(e) {
            e.preventDefault();
            const id = Editor.editing;
            const btn = $("#editorSave");
            btn.disabled = true;
            const restore = btn.textContent;
            btn.textContent = "Saving…";

            try {
                const fd = new FormData();
                const v = (i) => { const el = $("#" + i); return el ? el.value : ""; };
                fd.append("game",             v("f_game") || "efootball");
                fd.append("title_en",         v("f_title_en"));
                fd.append("title_mm",         v("f_title_mm"));
                fd.append("description_en",   v("f_description_en"));
                fd.append("description_mm",   v("f_description_mm"));
                fd.append("price",            v("f_price") || "0");
                fd.append("status",           v("f_status") || "available");
                fd.append("level",            v("f_level"));
                fd.append("currency_amount",  v("f_currency_amount"));
                fd.append("highlights",       v("f_highlights"));
                fd.append("server",           v("f_server"));
                fd.append("contact_note",     v("f_contact_note"));
                Editor.files.forEach((f) => fd.append("images", f, f.name));

                if (id) {
                    const existing = (Editor.existing || []).filter((u) => !Editor.removed.has(u));
                    existing.forEach((u) => fd.append("keepImages", u));
                    await api("/api/seller/listings/" + id, { method: "PUT", body: fd });
                    toast("Listing updated", "success");
                } else {
                    await api("/api/seller/listings", { method: "POST", body: fd });
                    toast("Listing published", "success");
                }
                Listings.closeEditor();
                Listings.load();
            } catch (err) {
                if (err && err.status === 402) {
                    toast(err.message || "Subscription required", "error");
                } else {
                    toast(err.message || "Save failed", "error");
                }
            } finally {
                btn.disabled = false;
                btn.textContent = restore;
            }
        },
    };

    /* =============================================================
       Profile tab
       ============================================================= */
    const Profile = {
        avatarFile: null,
        removeAvatar: false,

        async load() {
            try {
                const { user } = await api("/api/auth/me");
                ME = user || ME;
                const u = ME || {};
                Profile.avatarFile = null;
                Profile.removeAvatar = false;
                const setVal = (id2, v) => { const el = $("#" + id2); if (el) el.value = v == null ? "" : v; };
                setVal("p_displayName", u.displayName || u.username || "");
                setVal("p_bio_en",      u.bio_en || "");
                setVal("p_bio_mm",      u.bio_mm || "");
                const c = u.contacts || {};
                setVal("p_telegram", c.telegram || "");
                setVal("p_facebook", c.facebook || "");
                setVal("p_email",    c.email || "");
                setVal("p_phone",    c.phone || "");
                setVal("p_viber",    c.viber || "");
                const url = STORE_URL || ((window.location.origin) + "/store/" + encodeURIComponent(u.username || ""));
                const urlEl = $("#p_storeUrl");
                if (urlEl) urlEl.textContent = url || "—";
                paintAvatar($("#p_avatarPreview"), u.displayName || u.username, u.avatar);
                const rmBtn = $("#p_avatarRemove");
                if (rmBtn) rmBtn.hidden = !u.avatar;
            } catch (err) {
                toast(err.message || "Could not load profile", "error");
            }
        },
    };

    function bindProfileForm() {
        const form = $("#profileForm");
        if (!form) return;

        const avatarInput = $("#p_avatarFile");
        if (avatarInput) {
            avatarInput.addEventListener("change", (e) => {
                const file = (e.target.files || [])[0];
                if (!file) return;
                if (!/^image\//.test(file.type)) { toast("\"" + file.name + "\" is not an image", "error"); avatarInput.value = ""; return; }
                if (file.size > 8 * 1024 * 1024) { toast("\"" + file.name + "\" exceeds 8 MB", "error"); avatarInput.value = ""; return; }
                Profile.avatarFile = file;
                Profile.removeAvatar = false;
                paintAvatar($("#p_avatarPreview"), (ME && (ME.displayName || ME.username)) || "?", URL.createObjectURL(file));
                const rmBtn = $("#p_avatarRemove");
                if (rmBtn) rmBtn.hidden = false;
            });
        }
        const removeBtn = $("#p_avatarRemove");
        if (removeBtn) {
            removeBtn.addEventListener("click", () => {
                Profile.avatarFile = null;
                Profile.removeAvatar = true;
                if (avatarInput) avatarInput.value = "";
                paintAvatar($("#p_avatarPreview"), (ME && (ME.displayName || ME.username)) || "?", null);
                removeBtn.hidden = true;
            });
        }

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const v = (id) => { const el = $("#" + id); return el ? el.value : ""; };
            const fields = {
                displayName: v("p_displayName").trim(),
                bio_en:      v("p_bio_en"),
                bio_mm:      v("p_bio_mm"),
                telegram:    v("p_telegram"),
                facebook:    v("p_facebook"),
                email:       v("p_email"),
                phone:       v("p_phone"),
                viber:       v("p_viber"),
            };
            try {
                let res;
                if (Profile.avatarFile || Profile.removeAvatar) {
                    const fd = new FormData();
                    Object.keys(fields).forEach((k) => fd.append(k, fields[k]));
                    if (Profile.avatarFile) fd.append("avatar", Profile.avatarFile, Profile.avatarFile.name);
                    if (Profile.removeAvatar) fd.append("removeAvatar", "true");
                    res = await api("/api/seller/profile", { method: "PUT", body: fd });
                } else {
                    res = await api("/api/seller/profile", { method: "PUT", json: fields });
                }
                if (res && res.user) ME = res.user;
                Profile.avatarFile = null;
                Profile.removeAvatar = false;
                paintShell();
                toast("Profile saved", "success");
            } catch (err) {
                toast(err.message || "Save failed", "error");
            }
        });

        const copyBtn = $("#copyStoreUrl");
        if (copyBtn) {
            copyBtn.addEventListener("click", async () => {
                const url = (($("#p_storeUrl") || {}).textContent || "").trim();
                if (!url || url === "—") { toast("No public link yet", "error"); return; }
                const ok = await copyText(url);
                toast(ok ? "Copied" : "Copy failed", ok ? "success" : "error");
            });
        }
    }

    /* =============================================================
       Password tab
       ============================================================= */
    function bindPasswordForm() {
        const form = $("#passwordForm");
        if (!form) return;
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const currentPassword = (($("#s_current") || {}).value || "");
            const newPassword     = (($("#s_new")     || {}).value || "");
            try {
                const res = await api("/api/seller/password", {
                    method: "PUT",
                    json: { currentPassword: currentPassword, newPassword: newPassword },
                });
                if (res && res.token) token.set(res.token);
                toast("Password updated", "success");
                form.reset();
            } catch (err) {
                toast(err.message || "Update failed", "error");
            }
        });
    }

    /* =============================================================
       Filters + editor + confirm (binding)
       ============================================================= */
    function bindFilters() {
        const search = $("#searchInput");
        const searchClear = $("#searchClear");
        const searchIcon = $("#searchIcon");
        if (searchIcon) searchIcon.innerHTML = ICONS.search || "🔍";
        if (search) {
            const run = () => { ListState.q = search.value.trim(); ListState.page = 1; Listings.loadRows(); };
            const debounced = debounce(run, 250);
            search.addEventListener("input", () => {
                if (searchClear) searchClear.style.display = search.value ? "" : "none";
                debounced();
            });
            search.addEventListener("keydown", (e) => {
                if (e.key === "Escape") {
                    search.value = "";
                    if (searchClear) searchClear.style.display = "none";
                    run();
                }
            });
        }
        if (searchClear) {
            searchClear.addEventListener("click", () => {
                if (search) search.value = "";
                searchClear.style.display = "none";
                ListState.q = "";
                ListState.page = 1;
                Listings.loadRows();
            });
        }

        const gameSel = $("#gameFilter");
        if (gameSel) {
            gameSel.innerHTML = "<option value=\"\">" + esc(t("allGames") || "All games") + "</option>"
                + games().map((g) => "<option value=\"" + esc(g.id) + "\">" + esc(g.name) + "</option>").join("");
            gameSel.addEventListener("change", () => { ListState.game = gameSel.value; ListState.page = 1; Listings.loadRows(); });
        }
        const statusSel = $("#statusFilter");
        if (statusSel) {
            statusSel.addEventListener("change", () => { ListState.status = statusSel.value; ListState.page = 1; Listings.loadRows(); });
        }
        const sortSel = $("#sortFilter");
        if (sortSel) {
            sortSel.addEventListener("change", () => { ListState.sort = sortSel.value; ListState.page = 1; Listings.loadRows(); });
        }

        const newBtn = $("#newBtn");
        if (newBtn) newBtn.addEventListener("click", () => Listings.openEditor());
    }

    function bindEditor() {
        const close = $("#editorClose");
        const cancel = $("#editorCancel");
        const scrim = $("#editor");
        if (close) close.addEventListener("click", Listings.closeEditor);
        if (cancel) cancel.addEventListener("click", Listings.closeEditor);
        if (scrim) scrim.addEventListener("click", (e) => { if (e.target === scrim) Listings.closeEditor(); });

        const gameSel = $("#f_game");
        if (gameSel) gameSel.addEventListener("change", () => { if (window.Panel) Panel.refreshGameLabels(); });

        const dz = $("#dropzone");
        const input = $("#fileInput");
        if (dz && input) {
            dz.addEventListener("click", () => input.click());
            dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("over"); });
            dz.addEventListener("dragleave", () => dz.classList.remove("over"));
            dz.addEventListener("drop", (e) => {
                e.preventDefault();
                dz.classList.remove("over");
                Listings.addFiles(e.dataTransfer.files);
            });
            input.addEventListener("change", (e) => {
                Listings.addFiles(e.target.files);
                input.value = "";
            });
        }

        const form = $("#editorForm");
        if (form) form.addEventListener("submit", Listings.saveEditor);
    }

    function bindConfirm() {
        const scrim = $("#confirm");
        if (!scrim) return;
        scrim.addEventListener("click", (e) => { if (e.target === scrim) scrim.classList.remove("open"); });
    }

    /* =============================================================
       Tiny helpers
       ============================================================= */
    function tile(label, value, mod) {
        return "<div class=\"tile" + (mod ? " " + mod : "") + "\">"
            + "<label>" + esc(label) + "</label>"
            + "<b>" + esc(String(value)) + "</b>"
            + "</div>";
    }

    function statusChip(id, status, active) {
        const labels = { available: t("statusAvailable") || "Available", reserved: t("statusReserved") || "Reserved", sold: t("statusSold") || "Sold" };
        return "<button type=\"button\" class=\"status-chip\" data-status=\"" + esc(status) + "\"" + (active ? " aria-pressed=\"true\"" : "") + ">" + esc(labels[status] || status) + "</button>";
    }
})();
