/**
 * Shared utilities for all pages: language switching, toasts, formatting.
 */

const I18N = {
    en: {
        home: 'Home', admin: 'Admin', browse: 'Browse Accounts',
        heroTitle: 'Buy & Sell eFootball Accounts',
        heroSubtitle: 'Browse premium eFootball mobile accounts with legendary players, top stats, and instant delivery. Bilingual listings in English & Burmese.',
        searchPlaceholder: 'Search by title, description, players...',
        searchBtn: 'Search', price: 'Price', viewDetails: 'View Details',
        statusAvailable: 'Available', statusReserved: 'Reserved', statusSold: 'Sold',
        emptyState: 'No accounts available right now. Check back later!',
        emptyStateIcon: '🎮',
        featuredPlayers: 'Featured Players', overallRating: 'Overall Rating',
        coins: 'eFootball Coins', contact: 'Contact', description: 'Description',
        backToList: '← Back to listings', notFound: 'Account not found.',
        contactSeller: 'Contact Seller', copyContact: 'Copy', copied: 'Copied!',
        login: 'Login', username: 'Username', password: 'Password',
        loginBtn: 'Sign in', logout: 'Logout', adminPanel: 'Admin Panel',
        singleAdminBadge: 'Single Admin',
        settings: 'Settings', accounts: 'Accounts',
        addAccount: '+ Add New Account', editAccount: 'Edit Account',
        deleteAccount: 'Delete', confirmDelete: 'Delete this account? All images will be removed permanently.',
        titleEn: 'Title (English)', titleMm: 'Title (Burmese)',
        descEn: 'Description (English)', descMm: 'Description (Burmese)',
        priceLabel: 'Price (USD)', status: 'Status',
        statusAvailableOpt: 'Available', statusReservedOpt: 'Reserved', statusSoldOpt: 'Sold',
        featuredPlayersLabel: 'Featured Players (comma separated)',
        overallRatingLabel: 'Overall Team Rating', coinsLabel: 'Coins Amount',
        contactLabel: 'Contact Info (Telegram, Phone, etc.)',
        imagesLabel: 'Images (up to 5)',
        uploadHint: 'Click or drag images here (jpg, png, webp — max 5MB each, up to 5 files)',
        imageRatioHint: 'All images must be 16:9 aspect ratio (e.g. 1920×1080, 1280×720). Other ratios will be rejected.',
        save: 'Save', cancel: 'Cancel',
        loginFailed: 'Invalid username or password',
        savedSuccess: 'Saved successfully', deletedSuccess: 'Deleted successfully',
        noAccounts: 'No accounts yet. Click "Add New Account" to create one.',
        imagesSelected: 'images selected',
        featuredLabel: 'Featured', yes: 'Yes', no: 'No',
        prevImg: 'Previous', nextImg: 'Next',
        contactEmpty: 'No contact info provided.',
        itemsTotal: 'items',
        // Settings tab
        siteSettings: 'Site Configuration', accountSettings: 'Admin Account',
        brandLabel: 'Site Brand Name', taglineLabel: 'Tagline',
        heroTitleEnLabel: 'Hero Title (English)', heroTitleMmLabel: 'Hero Title (Burmese)',
        heroSubtitleEnLabel: 'Hero Subtitle (English)', heroSubtitleMmLabel: 'Hero Subtitle (Burmese)',
        currencyLabel: 'Currency Code', currencySymbolLabel: 'Currency Symbol',
        pageSizeLabel: 'Items Per Page', contactInfoLabel: 'Default Contact Info',
        currentPasswordLabel: 'Current Password', newPasswordLabel: 'New Password',
        changePassword: 'Change Password',
        changeUsername: 'Change Username', newUsernameLabel: 'New Username',
        settingsSaved: 'Settings saved', accountSaved: 'Account updated',
        passwordMismatch: 'Current password is incorrect',
        paginationPrev: 'Previous page', paginationNext: 'Next page',
        noResults: 'No accounts match your search.',
    },
    mm: {
        home: 'ပင်မ', admin: 'အက်ဒမီန်', browse: 'အကောင့်များကြည့်ရန်',
        heroTitle: 'eFootball အကောင့်များ ဝယ်ယူ/ရောင်းချရန်',
        heroSubtitle: 'ထူးခြားကောင်းမွန်သော eFootball မိုဘိုင်းအကောင့်များကို ရှာဖွေဝယ်ယူပါ။ အင်္ဂလိပ်နှင့် မြန်မာ ဘာသာဖြင့် ဖော်ပြထားပါသည်။',
        searchPlaceholder: 'ခေါင်းစဉ်၊ ဖော်ပြချက်၊ ကစားသမားများဖြင့် ရှာဖွေပါ...',
        searchBtn: 'ရှာဖွေရန်', price: 'စျေးနှုန်း', viewDetails: 'အသေးစိတ်ကြည့်ရန်',
        statusAvailable: 'ရရှိနိုင်ပါသည်', statusReserved: 'ကြိုတင်ရယူထားသည်', statusSold: 'ရောင်းပြီးပါပြီ',
        emptyState: 'လောလောဆယ် အကောင့်မရှိသေးပါ။ နောက်မှ ပြန်လည်စစ်ဆေးပါ။',
        emptyStateIcon: '🎮',
        featuredPlayers: 'ထူးခြားကစားသမားများ', overallRating: 'အဖွဲ့အစည်း အဆင့်သတ်မှတ်ချက်',
        coins: 'ဒင်းပြားအရေအတွက်', contact: 'ဆက်သွယ်ရန်', description: 'ဖော်ပြချက်',
        backToList: '← စာရင်းသို့ ပြန်သွားရန်', notFound: 'အကောင့်ရှာမတွေ့ပါ။',
        contactSeller: 'ရောင်းသူထံ ဆက်သွယ်ရန်', copyContact: 'ကူးယူရန်', copied: 'ကူးယူပြီးပါပြီ!',
        login: 'ဝင်ရောက်ရန်', username: 'အသုံးပြုသူအမည်', password: 'စကားဝှက်',
        loginBtn: 'ဝင်ရောက်မည်', logout: 'ထွက်ရန်', adminPanel: 'အက်ဒမီန် ပြင်ဆင်ရန်',
        addAccount: '+ အကောင့်အသစ်ထည့်ရန်', editAccount: 'အကောင့် ပြင်ဆင်ရန်',
        deleteAccount: 'ဖျက်ရန်', confirmDelete: 'ဤအကောင့်ကို ဖျက်မှာ သေချာပါသလား? ပုံများအားလုံး ဖျက်ပစ်ပါမည်။',
        titleEn: 'ခေါင်းစဉ် (အင်္ဂလိပ်)', titleMm: 'ခေါင်းစဉ် (မြန်မာ)',
        descEn: 'ဖော်ပြချက် (အင်္ဂလိပ်)', descMm: 'ဖော်ပြချက် (မြန်မာ)',
        priceLabel: 'စျေးနှုန်း (ဒေါ်လာ)', status: 'အခြေအနေ',
        statusAvailableOpt: 'ရရှိနိုင်ပါသည်', statusReservedOpt: 'ကြိုတင်ရယူထားသည်', statusSoldOpt: 'ရောင်းပြီးပါပြီ',
        featuredPlayersLabel: 'ထူးခြားကစားသမားများ (ကော်မာဖြင့် ပိုင်းခြားရန်)',
        overallRatingLabel: 'အဖွဲ့အစည်း အဆင့်သတ်မှတ်ချက်', coinsLabel: 'ဒင်းပြားအရေအတွက်',
        contactLabel: 'ဆက်သွယ်ရန် အချက်အလက် (Telegram၊ ဖုန်း စသည်)',
        imagesLabel: 'ပုံများ (အများဆုံး ၅ ခု)',
        uploadHint: 'ပုံများကို ဒီနေရာတွင် နှိပ်၍ သို့မဟုတ် ဆွဲထည့်ပါ (jpg, png, webp — 5MB အထိ၊ ၅ ခုအထိ)',
        imageRatioHint: 'ပုံအားလုံး 16:9 အချိုးအစား ရှိရမည် (ဥပမာ 1920×1080, 1280×720)။ အခြားအချိုးအစားများ ငြင်းပယ်ခံရပါမည်။',
        save: 'သိမ်းရန်', cancel: 'မလုပ်တော့ပါ',
        loginFailed: 'အသုံးပြုသူအမည် သို့မဟုတ် စကားဝှက် မှားယွင်းနေပါသည်',
        savedSuccess: 'အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ', deletedSuccess: 'အောင်မြင်စွာ ဖျက်ပြီးပါပြီ',
        noAccounts: 'အကောင့်မရှိသေးပါ။ "အကောင့်အသစ်ထည့်ရန်" ကို နှိပ်၍ ဖန်တီးပါ။',
        imagesSelected: 'ပုံများ ရွေးထားသည်',
        featuredLabel: 'ထူးခြား', yes: 'ဟုတ်ကဲ့', no: 'မဟုတ်ပါ',
        prevImg: 'ရှေ့သို့', nextImg: 'နောက်သို့',
        contactEmpty: 'ဆက်သွယ်ရန် အချက်အလက် မပေးထားပါ။',
        singleAdminBadge: 'အက်ဒမီန် တစ်ဦးတည်း',
        settings: 'ဆက်တင်များ', accounts: 'အကောင့်များ',
        itemsTotal: 'ခု',
        siteSettings: 'ဆိုက် ဆက်တင်များ', accountSettings: 'အက်ဒမီန် အကောင့်',
        brandLabel: 'ဆိုက် အမည်', taglineLabel: 'ဆောင်ပုဒ်',
        heroTitleEnLabel: 'ခေါင်းစဉ် (အင်္ဂလိပ်)', heroTitleMmLabel: 'ခေါင်းစဉ် (မြန်မာ)',
        heroSubtitleEnLabel: 'ဖော်ပြချက် (အင်္ဂလိပ်)', heroSubtitleMmLabel: 'ဖော်ပြချက် (မြန်မာ)',
        currencyLabel: 'ငွေကြေး ကုဒ်', currencySymbolLabel: 'ငွေကြေး သင်္ကေတ',
        pageSizeLabel: '�စ်မျက်နှာတွင် အရေအတွက်', contactInfoLabel: 'မူလ ဆက်သွယ်ရန် အချက်အလက်',
        currentPasswordLabel: 'လက်ရှိ စကားဝှက်', newPasswordLabel: 'စကားဝှက် အသစ်',
        changePassword: 'စကားဝှက် ပြောင်းရန်',
        changeUsername: 'အသုံးပြုသူအမည် ပြောင်းရန်', newUsernameLabel: 'အသုံးပြုသူအမည် အသစ်',
        settingsSaved: 'ဆက်တင်များ သိမ်းပြီးပါပြီ', accountSaved: 'အကောင့် အပ်ဒိတ်လုပ်ပြီးပါပြီ',
        passwordMismatch: 'လက်ရှိ စကားဝှက် မှားယွင်းနေပါသည်',
        paginationPrev: 'ရှေ့စာမျက်နှာ', paginationNext: 'နောက်စာမျက်နှာ',
        noResults: 'ရှာဖွေမှုနှင့် ကိုက်ညီသော အကောင့် မရှိပါ။',
    }
};

// Current language (persisted in localStorage)
function getLang() { return localStorage.getItem('ef_lang') || 'en'; }
function setLang(lang) {
    localStorage.setItem('ef_lang', lang);
    document.documentElement.lang = lang === 'mm' ? 'my' : 'en';
    document.body.classList.toggle('lang-mm', lang === 'mm');
    document.body.classList.toggle('lang-en', lang === 'en');
    document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        if (I18N[lang][key] !== undefined) el.textContent = I18N[lang][key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (I18N[lang][key] !== undefined) el.placeholder = I18N[lang][key];
    });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
        const key = el.getAttribute('data-i18n-title');
        if (I18N[lang][key] !== undefined) el.title = I18N[lang][key];
    });
    document.querySelectorAll('.lang-switch button').forEach((b) => {
        b.classList.toggle('active', b.dataset.lang === lang);
    });
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
}
function t(key) { return I18N[getLang()][key] || I18N.en[key] || key; }

// Toast notifications
function showToast(msg, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
}

// Format price
function formatPrice(p) {
    const n = Number(p) || 0;
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// Render a status pill
function renderStatus(status) {
    const map = {
        available: { cls: 'status-available', key: 'statusAvailable' },
        reserved:  { cls: 'status-reserved',  key: 'statusReserved' },
        sold:      { cls: 'status-sold',      key: 'statusSold' },
    };
    const cfg = map[status] || map.available;
    return `<span class="card-status ${cfg.cls}">${t(cfg.key)}</span>`;
}

// Render a phone-frame image (for cards and detail pages)
function renderPhoneFrame(images, options = {}) {
    const { main = false, activeIdx = 0 } = options;
    const cls = main ? 'detail-main-frame' : 'phone-frame';
    const imgs = images || [];
    const mainSrc = imgs[activeIdx] || '';
    const dots = imgs.length > 1 ? `<div class="phone-dots">${
        imgs.map((_, i) => `<span class="${i === activeIdx ? 'active' : ''}"></span>`).join('')
    }</div>` : '';
    const body = mainSrc
        ? `<img src="${mainSrc}" alt="">`
        : `<span class="placeholder">${t('emptyStateIcon')}</span>`;
    return `<div class="${cls}"><div class="phone-screen">${body}</div>${dots}</div>`;
}

// Pick text based on current language, fallback to the other if empty
function pickText(en, mm) {
    const lang = getLang();
    if (lang === 'mm') return mm || en || '';
    return en || mm || '';
}

function accountText(acc, baseField) {
    return pickText(acc[`${baseField}_en`], acc[`${baseField}_mm`]);
}

function setActiveNav(page) {
    document.querySelectorAll('.nav-links a[data-page]').forEach((a) => {
        a.classList.toggle('active', a.dataset.page === page);
    });
}

function initLangSwitcher() {
    document.querySelectorAll('.lang-switch button').forEach((b) => {
        b.addEventListener('click', () => setLang(b.dataset.lang));
    });
    setLang(getLang());
}

// Admin auth helpers
function getAdminToken() { return localStorage.getItem('ef_admin_token'); }
function setAdminToken(t) { localStorage.setItem('ef_admin_token', t); }
function clearAdminToken() { localStorage.removeItem('ef_admin_token'); }
async function adminFetch(url, options = {}) {
    const token = getAdminToken();
    options.headers = options.headers || {};
    if (token) options.headers['x-admin-token'] = token;
    const res = await fetch(url, options);
    if (res.status === 401) {
        clearAdminToken();
        showToast('Session expired. Please login again.', 'error');
        setTimeout(() => location.reload(), 800);
    }
    return res;
}

document.addEventListener('DOMContentLoaded', () => { initLangSwitcher(); });