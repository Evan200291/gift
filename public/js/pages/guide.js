/* =============================================================
   pages/guide.js — user guide: buying, selling, safety, FAQ,
   what is coming next, and a suggestion box read in the admin panel.

   Content lives here in both languages (it is long-form, so it is
   kept out of the short-string i18n table) and re-renders on
   langchange. Sections: jump chips, then each section in order.
   ============================================================= */
(function () {
    'use strict';

    const { esc, getLang, site, api, toast, $, $$ } = window.EX;

    const I = {
        search: '<path d="m20 20-3.5-3.5"/><circle cx="11" cy="11" r="7"/>',
        shield: '<path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
        chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
        key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M16 7l3 3M14 9l2 2"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
        login: '<path d="M14 4h5v16h-5"/><path d="M10 8l4 4-4 4M14 12H3"/>',
        plus: '<rect x="3.5" y="3.5" width="17" height="17"/><path d="M12 8v8M8 12h8"/>',
        refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20v-4h-4"/>',
        badge: '<path d="m12 2 2.4 2 3.2-.3 1 3 2.6 1.9-1.2 3 1.2 3-2.6 1.9-1 3-3.2-.3L12 22l-2.4-2-3.2.3-1-3-2.6-1.9 1.2-3-1.2-3 2.6-1.9 1-3 3.2.3z"/><path d="m9 12 2 2 4-4"/>',
        image: '<rect x="3" y="4" width="18" height="16"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>',
        lock: '<rect x="4" y="10" width="16" height="11"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
        alert: '<path d="M12 3 2 21h20z"/><path d="M12 10v5M12 18v.5"/>',
        star: '<path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/>',
        wallet: '<path d="M3.5 6.5h15v13h-15z"/><path d="M3.5 6.5 16 3v3.5"/><path d="M14 12h6.5v4H14z"/>',
        phone: '<rect x="6.5" y="2.5" width="11" height="19"/><path d="M11 18h2"/>',
        plug: '<path d="M9 3v5M15 3v5M6 8h12v4a6 6 0 0 1-12 0z"/><path d="M12 18v3"/>',
        review: '<path d="M4 4h16v12H9l-5 4z"/><path d="m12 7 1.1 2.2 2.4.3-1.8 1.6.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.6 2.4-.3z"/>',
        cash: '<rect x="2.5" y="6" width="19" height="12"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9v6M18 9v6"/>',
    };
    const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name]}</svg>`;

    const CONTENT = {
        en: {
            title: 'How EXABYTE works',
            sub: 'Everything you need to buy or sell a game account here — step by step, plus how to stay safe.',
            jump: { buy: 'Buying', sell: 'Selling', safety: 'Stay safe', faq: 'FAQ', soon: 'Coming soon', ideas: 'Suggest' },
            buy: {
                title: 'Buying an account',
                lead: 'No sign-up needed. You deal with the seller directly.',
                steps: [
                    ['search', 'Find an account', 'Pick a game on the home page or use Browse. Filter by price and search by rank, hero or player name.'],
                    ['image', 'Check the details', 'Open the listing and look through every screenshot, the price and the description. Note the listing code.'],
                    ['chat', 'Message the seller', 'Use the Telegram, Viber, Facebook or phone button on the listing. Mention the listing code so they know which account.'],
                    ['key', 'Pay and take over', 'Agree on payment with the seller, receive the login, then change the password, email and linked accounts straight away.'],
                ],
                cta: ['Browse accounts', '/browse'],
            },
            sell: {
                title: 'Selling on EXABYTE',
                lead: 'Listings come from subscribed resellers, so buyers know who they are dealing with.',
                steps: [
                    ['user', 'Get a seller account', 'Message us on Telegram to open a reseller account and choose a plan.'],
                    ['login', 'Sign in to the portal', 'Use Seller login with the username and password we send you, then fill in your profile and contact channels.'],
                    ['plus', 'Post a listing', 'Tap New listing, choose the game, add a clear title, price, description and up to 6 screenshots.'],
                    ['refresh', 'Keep it up to date', 'Mark accounts Reserved or Sold as soon as they are. Sold accounts leave your public store automatically.'],
                ],
                cta: ['Seller login', '/seller'],
            },
            safety: {
                title: 'Stay safe',
                tips: [
                    ['badge', 'Look for the verified badge', 'Verified sellers have been checked by our team. Their badge shows next to their name everywhere on the site.'],
                    ['image', 'Ask for live proof', 'Before paying, ask the seller for a fresh screenshot or short video showing the account and today’s date.'],
                    ['lock', 'Secure the account at once', 'Change the password, recovery email and phone, and unlink old social logins as soon as you receive it.'],
                    ['cash', 'Keep your payment record', 'Save the chat and payment receipt until you have fully taken over the account.'],
                    ['alert', 'Never share codes', 'Nobody from EXABYTE will ask for your OTP, verification code or password. Report anyone who does.'],
                ],
            },
            faq: {
                title: 'Questions',
                items: [
                    ['Do I need an account to buy?', 'No. Buyers never sign up — you contact the seller directly from the listing.'],
                    ['Does EXABYTE handle payment?', 'No. Payment is agreed between you and the seller. Follow the safety tips above.'],
                    ['Which games are listed?', 'eFootball, Mobile Legends: Bang Bang, PUBG Mobile and Free Fire.'],
                    ['What does “Reserved” mean?', 'Another buyer is already arranging to buy it. You can still ask the seller to be next in line.'],
                    ['How do I report a problem?', 'Message us on Telegram with the listing code or the seller’s store link.'],
                ],
            },
            soon: {
                title: 'Coming soon',
                tag: 'Soon',
                lead: 'We are building these next to make buying and selling safer and faster.',
                items: [
                    ['user', 'Buyer accounts', 'Sign in to save accounts you like, follow sellers and keep a history of your purchases.'],
                    ['review', 'Seller reviews', 'Leave a review for a seller after you buy, so other buyers know who to trust.'],
                    ['star', 'Ratings', 'Every seller gets a star rating built from real buyer reviews, shown on their store and listings.'],
                    ['wallet', 'EXABYTE balance', 'Top up once and pay for accounts from your balance, with every payment recorded.'],
                    ['phone', 'KBZPay & WavePay', 'Pay and top up with the Myanmar mobile wallets you already use.'],
                    ['plug', 'Payment APIs', 'Automatic payment checks, so sellers see confirmed payments instantly.'],
                ],
            },
            ideas: {
                title: 'Suggest something',
                lead: 'Tell us what you want next: a feature, a game or a problem you hit. Our team reads every message.',
                topic: 'Topic',
                topics: { feature: 'New feature', game: 'Add a game', payment: 'Payments', problem: 'Report a problem', other: 'Other' },
                message: 'Your suggestion',
                messagePh: 'What should we add or improve?',
                name: 'Name (optional)',
                contact: 'Telegram or phone (optional)',
                contactPh: 'So we can reply',
                send: 'Send suggestion',
                sending: 'Sending…',
                thanks: 'Thanks! Your suggestion was sent.',
                short: 'Please write a little more.',
            },
            contact: 'Message us on Telegram',
        },
        mm: {
            title: 'EXABYTE အသုံးပြုနည်း',
            sub: 'ဂိမ်းအကောင့် ဝယ်ရန် သို့မဟုတ် ရောင်းရန် လိုအပ်သမျှကို အဆင့်လိုက်နှင့် ဘေးကင်းစေမည့် အကြံပြုချက်များ။',
            jump: { buy: 'ဝယ်ယူခြင်း', sell: 'ရောင်းချခြင်း', safety: 'ဘေးကင်းရေး', faq: 'မေးခွန်းများ', soon: 'မကြာမီ', ideas: 'အကြံပြုရန်' },
            buy: {
                title: 'အကောင့် ဝယ်ယူခြင်း',
                lead: 'အကောင့်ဖွင့်ရန် မလိုပါ။ ရောင်းသူနှင့် တိုက်ရိုက် ဆက်သွယ်ပါ။',
                steps: [
                    ['search', 'အကောင့်ရှာပါ', 'ပင်မစာမျက်နှာတွင် ဂိမ်းရွေးပါ သို့မဟုတ် Browse ကို သုံးပါ။ ဈေးနှုန်း၊ rank၊ hero သို့မဟုတ် player အမည်ဖြင့် ရှာနိုင်ပါသည်။'],
                    ['image', 'အသေးစိတ် စစ်ဆေးပါ', 'Screenshot များ၊ ဈေးနှုန်းနှင့် ဖော်ပြချက်ကို သေချာကြည့်ပါ။ Listing code ကို မှတ်ထားပါ။'],
                    ['chat', 'ရောင်းသူကို ဆက်သွယ်ပါ', 'Listing ပေါ်ရှိ Telegram၊ Viber၊ Facebook သို့မဟုတ် ဖုန်းခလုတ်ကို နှိပ်ပြီး listing code ကို ပြောပါ။'],
                    ['key', 'ငွေပေးပြီး အကောင့်ယူပါ', 'ငွေပေးချေမှုကို ရောင်းသူနှင့် ညှိပါ။ Login ရပြီးတာနဲ့ password၊ email နှင့် ချိတ်ထားသော အကောင့်များကို ချက်ချင်း ပြောင်းပါ။'],
                ],
                cta: ['အကောင့်များ ကြည့်ရန်', '/browse'],
            },
            sell: {
                title: 'EXABYTE တွင် ရောင်းချခြင်း',
                lead: 'Listing များကို subscription ရှိသော ရောင်းသူများသာ တင်နိုင်သဖြင့် ဝယ်သူများ ယုံကြည်စိတ်ချနိုင်ပါသည်။',
                steps: [
                    ['user', 'ရောင်းသူအကောင့် ရယူပါ', 'Reseller အကောင့်ဖွင့်ရန်နှင့် plan ရွေးရန် Telegram မှ ဆက်သွယ်ပါ။'],
                    ['login', 'Portal သို့ ဝင်ပါ', 'ပေးပို့ထားသော username နှင့် password ဖြင့် Seller login ဝင်ပြီး profile နှင့် ဆက်သွယ်ရန် လမ်းကြောင်းများ ဖြည့်ပါ။'],
                    ['plus', 'Listing တင်ပါ', 'New listing ကိုနှိပ်၍ ဂိမ်းရွေးပါ။ ခေါင်းစဉ်၊ ဈေးနှုန်း၊ ဖော်ပြချက်နှင့် screenshot ၆ ပုံအထိ ထည့်ပါ။'],
                    ['refresh', 'အခြေအနေ update လုပ်ပါ', 'Reserved သို့မဟုတ် Sold ဖြစ်သည်နှင့် ချက်ချင်း ပြောင်းပါ။ Sold အကောင့်များ သင့်စတိုးမှ အလိုအလျောက် ဖယ်ရှားပါမည်။'],
                ],
                cta: ['ရောင်းသူ ဝင်ရန်', '/seller'],
            },
            safety: {
                title: 'ဘေးကင်းရေး',
                tips: [
                    ['badge', 'Verified တံဆိပ်ကို ကြည့်ပါ', 'Verified ရောင်းသူများကို ကျွန်ုပ်တို့အဖွဲ့က စစ်ဆေးပြီးဖြစ်ပြီး အမည်ဘေးတွင် တံဆိပ် ပြထားပါသည်။'],
                    ['image', 'လက်ရှိ အထောက်အထား တောင်းပါ', 'ငွေမပေးမီ ယနေ့ရက်စွဲပါသော screenshot သို့မဟုတ် video တိုကို တောင်းပါ။'],
                    ['lock', 'အကောင့်ကို ချက်ချင်း လုံခြုံအောင်လုပ်ပါ', 'Password၊ recovery email နှင့် ဖုန်းနံပါတ်ကို ပြောင်းပြီး အဟောင်း social login များကို ဖြုတ်ပါ။'],
                    ['cash', 'ငွေပေးချေမှု မှတ်တမ်း သိမ်းပါ', 'အကောင့်ကို အပြည့်အဝ ရယူပြီးသည်အထိ chat နှင့် ငွေလွှဲပြေစာကို သိမ်းထားပါ။'],
                    ['alert', 'Code များ မမျှဝေပါနှင့်', 'EXABYTE မှ OTP၊ verification code သို့မဟုတ် password ကို ဘယ်တော့မှ မတောင်းပါ။ တောင်းသူကို report လုပ်ပါ။'],
                ],
            },
            faq: {
                title: 'မေးလေ့ရှိသော မေးခွန်းများ',
                items: [
                    ['ဝယ်ရန် အကောင့်လိုပါသလား။', 'မလိုပါ။ ဝယ်သူများ စာရင်းသွင်းရန် မလိုဘဲ listing မှ ရောင်းသူကို တိုက်ရိုက် ဆက်သွယ်နိုင်ပါသည်။'],
                    ['EXABYTE က ငွေကိုင်ပေးပါသလား။', 'မကိုင်ပါ။ ငွေပေးချေမှုကို သင်နှင့် ရောင်းသူ ညှိရပါမည်။ အထက်ပါ ဘေးကင်းရေး အကြံပြုချက်များကို လိုက်နာပါ။'],
                    ['ဘယ်ဂိမ်းတွေ ရှိပါသလဲ။', 'eFootball၊ Mobile Legends: Bang Bang၊ PUBG Mobile နှင့် Free Fire။'],
                    ['“Reserved” ဆိုတာ ဘာလဲ။', 'အခြားဝယ်သူတစ်ဦး ဝယ်ရန် ညှိနေဆဲဖြစ်သည်။ နောက်တစ်ယောက်အဖြစ် ရောင်းသူကို မေးနိုင်ပါသည်။'],
                    ['ပြဿနာကို ဘယ်လို report လုပ်ရမလဲ။', 'Listing code သို့မဟုတ် ရောင်းသူ၏ စတိုးလင့်ခ်နှင့်အတူ Telegram မှ ဆက်သွယ်ပါ။'],
                ],
            },
            soon: {
                title: 'မကြာမီ လာမည်',
                tag: 'မကြာမီ',
                lead: 'ဝယ်ယူခြင်းနှင့် ရောင်းချခြင်းကို ပိုမိုလုံခြုံမြန်ဆန်စေရန် အောက်ပါတို့ကို တည်ဆောက်နေပါသည်။',
                items: [
                    ['user', 'ဝယ်သူ အကောင့်များ', 'ကြိုက်သော အကောင့်များ သိမ်းရန်၊ ရောင်းသူများကို follow လုပ်ရန်နှင့် ဝယ်ယူမှုမှတ်တမ်း ကြည့်ရန် login ဝင်နိုင်ပါမည်။'],
                    ['review', 'ရောင်းသူ သုံးသပ်ချက်များ', 'ဝယ်ပြီးနောက် ရောင်းသူအတွက် review ရေးနိုင်ပြီး အခြားဝယ်သူများ ယုံကြည်ရမည့်သူကို သိနိုင်ပါမည်။'],
                    ['star', 'Rating', 'ရောင်းသူတိုင်းတွင် တကယ့်ဝယ်သူ review များမှ ကြယ်ပွင့် rating ရှိပြီး စတိုးနှင့် listing များတွင် ပြပါမည်။'],
                    ['wallet', 'EXABYTE လက်ကျန်ငွေ', 'တစ်ကြိမ် ငွေဖြည့်ပြီး လက်ကျန်ငွေမှ အကောင့်များ ဝယ်နိုင်ကာ ငွေပေးချေမှုတိုင်း မှတ်တမ်းတင်ပါမည်။'],
                    ['phone', 'KBZPay နှင့် WavePay', 'သင်သုံးနေကျ မြန်မာ mobile wallet များဖြင့် ငွေပေးချေခြင်းနှင့် ငွေဖြည့်ခြင်း ပြုလုပ်နိုင်ပါမည်။'],
                    ['plug', 'Payment API များ', 'ငွေပေးချေမှုကို အလိုအလျောက် စစ်ဆေးပေးသဖြင့် ရောင်းသူများ ချက်ချင်း အတည်ပြုချက် မြင်ရပါမည်။'],
                ],
            },
            ideas: {
                title: 'အကြံပြုရန်',
                lead: 'နောက်ထပ် ဘာလိုချင်သလဲ — feature အသစ်၊ ဂိမ်းအသစ် သို့မဟုတ် ကြုံတွေ့ရသော ပြဿနာကို ပြောပြပါ။ စာတိုင်းကို ဖတ်ပါသည်။',
                topic: 'အကြောင်းအရာ',
                topics: { feature: 'Feature အသစ်', game: 'ဂိမ်းထည့်ရန်', payment: 'ငွေပေးချေမှု', problem: 'ပြဿနာ report', other: 'အခြား' },
                message: 'သင့်အကြံပြုချက်',
                messagePh: 'ဘာထည့်သင့်သလဲ၊ ဘာပြင်သင့်သလဲ။',
                name: 'အမည် (မဖြည့်လည်းရ)',
                contact: 'Telegram သို့မဟုတ် ဖုန်း (မဖြည့်လည်းရ)',
                contactPh: 'ပြန်ဆက်သွယ်နိုင်ရန်',
                send: 'အကြံပြုချက် ပို့ရန်',
                sending: 'ပို့နေသည်…',
                thanks: 'ကျေးဇူးတင်ပါသည်။ အကြံပြုချက် ပို့ပြီးပါပြီ။',
                short: 'နည်းနည်းပိုရေးပေးပါ။',
            },
            contact: 'Telegram မှ ဆက်သွယ်ရန်',
        },
    };

    function telegramHref() {
        const raw = String(site().adsContact || '').trim();
        if (!raw) return '';
        if (/^https?:\/\//i.test(raw)) return raw;
        const clean = raw.replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '');
        return clean ? `https://t.me/${clean}` : '';
    }

    function steps(list) {
        return `<ol class="guide-steps">${list.map(([ic, title, body], i) => `
            <li class="guide-step">
                <span class="guide-step-n">${i + 1}</span>
                <span class="guide-step-ico">${icon(ic)}</span>
                <b>${esc(title)}</b>
                <p>${esc(body)}</p>
            </li>`).join('')}</ol>`;
    }

    function render() {
        const c = CONTENT[getLang()] || CONTENT.en;
        const tg = telegramHref();
        const tgBtn = tg
            ? `<a class="btn btn-outline" href="${esc(tg)}" target="_blank" rel="noopener noreferrer">${window.EX.ICONS.telegram} ${esc(c.contact)}</a>`
            : '';

        $('#guideRoot').innerHTML = `
        <div class="guide-hero">
            <div class="shell">
                <h1>${esc(c.title)}</h1>
                <p>${esc(c.sub)}</p>
                <nav class="guide-jump" aria-label="${esc(c.title)}">
                    ${Object.entries(c.jump).map(([id, label]) => `<a href="#guide-${id}" data-tone="${id}">${esc(label)}</a>`).join('')}
                </nav>
            </div>
        </div>

        <section class="section-sm guide-section" id="guide-buy" data-tone="buy">
            <div class="shell">
                <div class="guide-head"><h2>${esc(c.buy.title)}</h2><p>${esc(c.buy.lead)}</p></div>
                ${steps(c.buy.steps)}
                <div class="guide-actions"><a class="btn btn-primary" href="${c.buy.cta[1]}">${esc(c.buy.cta[0])}</a></div>
            </div>
        </section>

        <section class="section-sm guide-section" id="guide-sell" data-tone="sell">
            <div class="shell">
                <div class="guide-head"><h2>${esc(c.sell.title)}</h2><p>${esc(c.sell.lead)}</p></div>
                ${steps(c.sell.steps)}
                <div class="guide-actions"><a class="btn btn-primary" href="${c.sell.cta[1]}">${esc(c.sell.cta[0])}</a>${tgBtn}</div>
            </div>
        </section>

        <section class="section-sm guide-section" id="guide-safety" data-tone="safety">
            <div class="shell">
                <div class="guide-head"><h2>${esc(c.safety.title)}</h2></div>
                <div class="guide-tips">${c.safety.tips.map(([ic, title, body]) => `
                    <div class="guide-tip"><span class="guide-tip-ico">${icon(ic)}</span><div><b>${esc(title)}</b><p>${esc(body)}</p></div></div>`).join('')}
                </div>
            </div>
        </section>

        <section class="section-sm guide-section" id="guide-faq" data-tone="faq">
            <div class="shell">
                <div class="guide-head"><h2>${esc(c.faq.title)}</h2></div>
                <div class="guide-faq">${c.faq.items.map(([q, a], i) => `
                    <details${i === 0 ? ' open' : ''}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}
                </div>
                ${tgBtn ? `<div class="guide-actions">${tgBtn}</div>` : ''}
            </div>
        </section>
        <section class="section-sm guide-section" id="guide-soon" data-tone="soon">
            <div class="shell">
                <div class="guide-head"><h2>${esc(c.soon.title)}</h2><p>${esc(c.soon.lead)}</p></div>
                <div class="guide-tips guide-soon">${c.soon.items.map(([ic, title, body]) => `
                    <div class="guide-tip"><span class="guide-tip-ico">${icon(ic)}</span><div><b>${esc(title)}</b><p>${esc(body)}</p></div><span class="guide-soon-tag">${esc(c.soon.tag)}</span></div>`).join('')}
                </div>
            </div>
        </section>

        <section class="section-sm guide-section" id="guide-ideas" data-tone="ideas">
            <div class="shell">
                <div class="guide-ideas">
                    <div class="guide-head"><h2>${esc(c.ideas.title)}</h2><p>${esc(c.ideas.lead)}</p></div>
                    <form id="ideaForm" class="guide-idea-form" novalidate>
                        <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
                        <div class="guide-topics" role="radiogroup" aria-label="${esc(c.ideas.topic)}">
                            ${Object.entries(c.ideas.topics).map(([id, label], i) => `
                                <label class="guide-topic"><input type="radio" name="topic" value="${id}"${i === 0 ? ' checked' : ''}><span>${esc(label)}</span></label>`).join('')}
                        </div>
                        <div class="field">
                            <label for="ideaMessage">${esc(c.ideas.message)}</label>
                            <textarea id="ideaMessage" name="message" rows="4" maxlength="1000" required placeholder="${esc(c.ideas.messagePh)}"></textarea>
                        </div>
                        <div class="guide-idea-row">
                            <div class="field"><label for="ideaName">${esc(c.ideas.name)}</label><input id="ideaName" type="text" name="name" maxlength="60" autocomplete="name"></div>
                            <div class="field"><label for="ideaContact">${esc(c.ideas.contact)}</label><input id="ideaContact" type="text" name="contact" maxlength="100" placeholder="${esc(c.ideas.contactPh)}"></div>
                            <button type="submit" class="btn btn-primary">${esc(c.ideas.send)}</button>
                        </div>
                    </form>
                </div>
            </div>
        </section>`;

        $$('.guide-jump a').forEach((a) => a.addEventListener('click', (e) => {
            const target = document.querySelector(a.getAttribute('href'));
            if (!target) return;
            e.preventDefault();
            target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        }));

        const form = $('#ideaForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(form).entries());
            if (String(data.message || '').trim().length < 5) {
                toast(c.ideas.short, 'error');
                form.elements.message.focus();
                return;
            }
            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = c.ideas.sending;
            try {
                await api('/api/suggestions', { method: 'POST', json: { ...data, lang: getLang() } });
                form.reset();
                toast(c.ideas.thanks, 'success');
            } catch (err) {
                toast(err.message || 'Could not send', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = c.ideas.send;
            }
        });
    }

    (async function boot() {
        await window.UI.boot();
        render();
        document.addEventListener('langchange', render);
    })();
})();
