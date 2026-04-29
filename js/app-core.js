// ═══════════════════════════════════════════════════════════════════
// APP-CORE.JS
// ═══════════════════════════════════════════════════════════════════
'use strict';

// ── 1. УТИЛИТЫ ──────────────────────────────────────────────────
const Utils = {
  escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  },
  renderDoctorPhoto(photo, alt, style) {
    if (!photo) return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
    const webp = encodeURI(photo.replace(/\.png$/i, '.webp'));
    const png  = encodeURI(photo);
    const imgStyle = style || 'width:100%;height:100%;object-fit:cover;object-position:top;display:block';
    return `<picture><source srcset="${webp}" type="image/webp"/><img src="${png}" alt="${this.escapeHtml(alt||'')}" loading="lazy" style="${imgStyle}"/></picture>`;
  },
  generateId(prefix = 'item') {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2,9)}`;
  },
  async compressImage(dataUrl, maxSizeKB = 500) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const maxDim = 800;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round((height/width)*maxDim); width = maxDim; }
          else { width = Math.round((width/height)*maxDim); height = maxDim; }
        }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        let quality = 0.9, result = canvas.toDataURL('image/jpeg', quality);
        while (new Blob([result]).size > maxSizeKB * 1024 && quality > 0.1) {
          quality -= 0.1; result = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(result);
      };
      img.src = dataUrl;
    });
  },
  safeSetItem(key, value) {
    try {
      const str = JSON.stringify(value);
      if (new Blob([str]).size > 5*1024*1024) { console.error('Too large:', key); return false; }
      localStorage.setItem(key, str); return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError') alert('Недостаточно места в хранилище.');
      return false;
    }
  },
  safeGetItem(key, defaultValue = null) {
    try { const item = localStorage.getItem(key); return item ? JSON.parse(item) : defaultValue; }
    catch (e) { return defaultValue; }
  },
  renderStars(rating) {
    const s = op => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;opacity:${op};"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    let h = '';
    for (let i = 1; i <= 5; i++) h += s(i <= rating ? '1' : '0.35');
    return h;
  },
  // Безопасная вставка rich-text через DOMPurify (если подключён)
  safeSetHtml(el, html) {
    if (!el) return;
    if (typeof DOMPurify !== 'undefined') {
      el.innerHTML = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p','b','i','u','strong','em','ul','ol','li','h2','h3','br','a','span'],
        ALLOWED_ATTR: ['href','target','rel','style','class']
      });
    } else {
      el.textContent = html.replace(/<[^>]+>/g, '');
    }
  }
};

// ── 2. ДАННЫЕ ПО УМОЛЧАНИЮ (без readTime) ───────────────────────
const DEFAULT_DATA = {
  reviews: {
    rev_001: { name:'Ульяна Ульяна', text:'Хочу выразить огромную благодарность клинике и лично Наталье Владимировне за высочайший профессионализм, внимательность и чуткость. Лечение проходило абсолютно безболезненно и комфортно. Весь персонал — от администратора до ассистентов — очень приветливый и заботливый. Особо отмечу, что врач подробно всё объяснила и ответила на все вопросы. Чувствовала себя в надёжных руках. Всей семьёй только к вам!', rating:5, date:'Январь 2026' },
    rev_002: { name:'Александр Шарамеев', text:'Очень хорошая стоматология, отличные специалисты, качественное оборудование и такое же оказание услуг. Очень рад, что пользуюсь данной стоматологией. Рекомендую всем.', rating:5, date:'Март 2025' },
    rev_003: { name:'Антон Путилин', text:'Хочу поблагодарить Алину Сергеевну за профессиональную чистку зубов! До этого всегда боялся, что будет больно или неприятно, но здесь всё прошло отлично. Врач работает очень аккуратно и внимательно. Результатом остался очень доволен.', rating:5, date:'Апрель 2026' }
  },
  services: {
    svc_001: { name:'Лечение кариеса',         category:'Терапия',    price:'от 4 000 ₽', description:'Безболезненное лечение кариеса любой стадии. Современные световые пломбы.', icon:'🦷' },
    svc_002: { name:'Профессиональная чистка',  category:'Гигиена',    price:'от 2 800 ₽', description:'Ультразвуковое снятие камня, Air Flow, полировка и фторирование.', icon:'✨' },
    svc_003: { name:'Установка брекетов',        category:'Ортодонтия', price:'от 40 000 ₽', description:'Металлические, керамические, сапфировые брекеты. Консультация ортодонта от 1 200 ₽.', icon:'😁' },
    svc_004: { name:'Дентальная имплантация',   category:'Хирургия',   price:'от 29 000 ₽', description:'Имплантаты Ostem. Хирургическая установка, протезирование под ключ.', icon:'🔬' },
    svc_005: { name:'Циркониевые коронки',      category:'Ортопедия',  price:'от 23 000 ₽', description:'Коронки из оксида циркония — прочные, эстетичные, без металла.', icon:'👑' },
    svc_006: { name:'Виниры керамические',      category:'Эстетика',   price:'от 19 000 ₽', description:'Виниры E.max и цирконий. Голливудская улыбка за 2 визита.', icon:'💎' },
    svc_007: { name:'Удаление зубов',           category:'Хирургия',   price:'от 1 900 ₽',  description:'Атравматичное удаление зубов, включая зубы мудрости.', icon:'🏥' },
    svc_008: { name:'Детская стоматология',     category:'Педиатрия',  price:'от 2 000 ₽',  description:'Лечение молочных и постоянных зубов у детей с 3 лет.', icon:'👶' }
  },
  blogs: {
    blog_001: { title:'Как правильно чистить зубы: полное руководство', excerpt:'Большинство людей чистят зубы неправильно. Рассказываем о технике, выборе щётки и пасты.', category:'Гигиена',    date:'10 янв 2025', pageId:'blog-chistit', url:'blog/blog-kak-chistit.html',     imgClass:'bi1', imgUrl:'img/blog/Как правильно чистить зубы руководство от стоматолога.webp' },
    blog_002: { title:'Болит зуб — что делать до похода к врачу?',      excerpt:'Зубная боль может застать врасплох. Рассказываем, что делать самостоятельно.',           category:'Советы',     date:'22 янв 2025', pageId:'blog-bolit', url:'blog/blog-zub-bolit.html',       imgClass:'bi2', imgUrl:'img/blog/Болит зуб — что делать до похода к врачу.webp' },
    blog_003: { title:'Когда ставить брекеты: возраст, показания, виды',excerpt:'Брекеты можно поставить в любом возрасте. Разбираемся, когда лучше начинать лечение.',   category:'Ортодонтия', date:'5 фев 2025',  pageId:'blog-brekety', url:'blog/blog-brekety.html',    imgClass:'bi3', imgUrl:'img/blog/Когда ставить брекеты возраст, показания, виды.webp' },
    blog_006: { title:'Когда вести ребёнка к стоматологу впервые?',     excerpt:'Многие родители тянут с первым визитом. Объясняем почему важно прийти до проблем.',      category:'Дети',       date:'18 мар 2025', pageId:'blog-deti', url:'blog/blog-deti.html',       imgClass:'bi6', imgUrl:'img/blog/Когда вести ребёнка к стоматологу впервые.webp' },
    blog_007: { title:'Отбеливание зубов: виды, безопасность и результат',excerpt:'Офисное, домашнее, лазерное — что даёт реальный эффект.',                              category:'Гигиена',    date:'2 апр 2025',  pageId:'blog-otbelivanie', url:'blog/blog-otbelivanie.html',imgClass:'bi7', imgUrl:'img/blog/Отбеливание зубов виды, безопасность и результат.webp' },
    blog_008: { title:'Как перестать бояться стоматолога: советы врача', excerpt:'Стоматофобия — серьёзная проблема. Рассказываем, что делает наша клиника.',             category:'Психология', date:'15 апр 2025', pageId:'blog-strah', url:'blog/blog-strah.html',      imgClass:'bi8', imgUrl:'img/blog/Как перестать бояться стоматолога советы врача.webp' },
    blog_009: { title:'Лечение кариеса в Костроме: методы, этапы и стоимость',          excerpt:'Кариес — самая частая стоматологическая проблема. Рассказываем о стадиях, методах и честных ценах на лечение.',      category:'Терапия',    date:'28 май 2025', pageId:'blog-karies-lechenie', url:'blog/blog-karies-lechenie.html',   imgClass:'bi1', imgUrl:'img/blog/Лечение кариеса в Костроме методы, этапы и стоимость.webp' },
    blog_011: { title:'Имплантация зубов в Костроме: этапы, цены и противопоказания',   excerpt:'Всё об имплантации: кому показана, как проходит, сколько стоит и почему откладывать нельзя.',                        category:'Хирургия',   date:'3 июл 2025',  pageId:'blog-implant-info', url:'blog/blog-implant-info.html',       imgClass:'bi4', imgUrl:'img/blog/Имплантация зубов в Костроме этапы, цены и противопоказания.webp' },
    blog_012: { title:'Профессиональная чистка зубов в Костроме: зачем и как часто',    excerpt:'Чем отличается профгигиена от домашней чистки, что входит в процедуру и нужно ли делать это каждые 6 месяцев.',      category:'Гигиена',    date:'20 июл 2025', pageId:'blog-profchistka', url:'blog/blog-profchistka.html',        imgClass:'bi7', imgUrl:'img/blog/Профессиональная чистка зубов в Костроме зачем и как часто.webp' },
    blog_014: { title:'Пародонтит: первые признаки и лечение дёсен в Костроме',         excerpt:'Кровоточат дёсны, шатаются зубы? Это пародонтит. Объясняем, почему нельзя ждать и как проходит лечение.',             category:'Терапия',    date:'18 авг 2025', pageId:'blog-parodont',        url:'blog/blog-parodont.html',        imgClass:'bi8', imgUrl:'img/blog/Пародонтит первые признаки и лечение дёсен в Костроме.webp' },
  },
  promos: {
    promo_001: { title:'Гарантия 12 месяцев на всё лечение', text:'Мы уверены в качестве материалов и квалификации врачей. Гарантия на все виды лечения оформляется письменно.', badge:'Всегда', colorClass:'pc1', btnText:'Оставить заявку', btnAction:"openLeadModal('lead')" },
    promo_002: { title:'Чистка зубов в подарок', text:'При установке любых брекетов — профессиональная чистка Air Flow в подарок. Экономия до 5 000 рублей.', badge:'При установке брекетов', colorClass:'pc2', btnText:'Узнать подробнее', btnAction:"window.location.href='service/service-braces.html'" }
  }
};

// ── 3. DATA MANAGER (legacy-обёртка) ────────────────────────────
const DataManager = {
  KEYS: { DOCTORS:'ds_doctors', SERVICES:'ds_services', REVIEWS:'ds_reviews', BLOGS:'ds_blogs', PROMOS:'ds_promos', NEWS:'ds_news', ABOUT:'ds_about', SECTIONS:'ds_sections_visibility' },
  initDefaults() {
    if (typeof SiteState !== 'undefined') { SiteState.load(); return; }
    // fallback
    const checks = [['SERVICES',DEFAULT_DATA.services],['REVIEWS',DEFAULT_DATA.reviews],['BLOGS',DEFAULT_DATA.blogs],['PROMOS',DEFAULT_DATA.promos]];
    checks.forEach(([k,d]) => { if (!Utils.safeGetItem(this.KEYS[k]) || !Object.keys(Utils.safeGetItem(this.KEYS[k],{})).length) Utils.safeSetItem(this.KEYS[k],d); });
  },
  getDoctors()      { return typeof SiteState!=='undefined'?(SiteState.get('doctors')||{}):Utils.safeGetItem(this.KEYS.DOCTORS,{}); },
  getServices()     { return typeof SiteState!=='undefined'?(SiteState.get('services')||{}):Utils.safeGetItem(this.KEYS.SERVICES,{}); },
  getReviews()      { return typeof SiteState!=='undefined'?(SiteState.get('reviews')||{}):Utils.safeGetItem(this.KEYS.REVIEWS,{}); },
  getBlogs()        { return typeof SiteState!=='undefined'?(SiteState.get('blogs')||{}):Utils.safeGetItem(this.KEYS.BLOGS,{}); },
  getPromos()       { return typeof SiteState!=='undefined'?(SiteState.get('promos')||{}):Utils.safeGetItem(this.KEYS.PROMOS,{}); },
  getNews()         { return typeof SiteState!=='undefined'?(SiteState.get('news')||{}):Utils.safeGetItem(this.KEYS.NEWS,null); },
  getSections()     { return typeof SiteState!=='undefined'?(SiteState.get('visibility')||{}):Utils.safeGetItem(this.KEYS.SECTIONS,null); },
  getServicePages() { return typeof SiteState!=='undefined'?(SiteState.get('svcPages')||{}):{} },
  getAbout() {
    if (typeof SiteState!=='undefined') {
      const c=SiteState.get('clinic')||{};
      return {clinicName:c.name,history:c.history,founderName:c.founderName,founderPosition:c.founderPosition,founderQuote:c.founderQuote,mission:c.mission,licNumber:c.licNumber,licFile:c.licFile,photo1:c.photo1,photo2:c.photo2,photo3:c.photo3,technologies:c.technologies};
    }
    return Utils.safeGetItem(this.KEYS.ABOUT,null);
  },
  resetAll() { if (typeof SiteState!=='undefined') SiteState.reset(); }
};

// ── 4. ИКОНКИ КАТЕГОРИЙ УСЛУГ ───────────────────────────────────
const SVC_ICONS = {
  'Терапия':    `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3c-3 0-5 2.5-5 5.5 0 2 .5 3.5 1 5s1 5.5 3 5.5c1.5 0 2-2.5 3-2.5s1.5 2.5 3 2.5c2 0 2.5-4 3-5.5s1-3 1-5C18 6 16 3 13 3c-1 0-2 1-3 1S10 3 9 3z"/></svg>`,
  'Гигиена':    `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="20" x2="15" y2="9"/><rect x="14" y="2" width="7" height="5.5" rx="2"/><line x1="15" y1="9" x2="15" y2="13.5"/><line x1="17.5" y1="9" x2="17.5" y2="12"/></svg>`,
  'Ортодонтия': `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="7" width="5" height="10" rx="2"/><rect x="9.5" y="7" width="5" height="10" rx="2"/><rect x="18" y="7" width="5" height="10" rx="2"/><line x1="6" y1="12" x2="9.5" y2="12"/><line x1="14.5" y1="12" x2="18" y2="12"/></svg>`,
  'Хирургия':   `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.47" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>`,
  'Ортопедия':  `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19l2.5-8 4 5.5 2.5-8 2.5 8 4-5.5 2.5 8H3z"/><line x1="3" y1="19" x2="21" y2="19"/></svg>`,
  'Эстетика':   `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  'Педиатрия':  `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>`,
};
const SVC_ICONS_DEFAULT = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3c-3 0-5 2.5-5 5.5 0 2 .5 3.5 1 5s1 5.5 3 5.5c1.5 0 2-2.5 3-2.5s1.5 2.5 3 2.5c2 0 2.5-4 3-5.5s1-3 1-5C18 6 16 3 13 3c-1 0-2 1-3 1S10 3 9 3z"/></svg>`;

// ── 5. RENDER MANAGER ───────────────────────────────────────────
const RenderManager = {

  renderDoctors() {
    const doctors = (typeof SiteState!=='undefined')?(SiteState.get('doctors')||{}):DataManager.getDoctors();
    const _card = (id, doc) => {
      const ph = Utils.renderDoctorPhoto(doc.photo, doc.name);
      return `<div class="doc-card" data-doc-id="${Utils.escapeHtml(id)}" style="cursor:pointer">
        <div class="doc-photo doc-photo--img">${ph}<div class="doc-spec-badge">${Utils.escapeHtml(doc.spec||'Специалист')}</div></div>
        <div class="doc-body">
          <div class="doc-name">${Utils.escapeHtml(doc.name)}</div>
          <button class="doc-btn" onclick="event.stopPropagation();openLeadModal('lead')">Оставить заявку</button>
        </div></div>`;
    };
    const empty = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--c-text2)">Врачи пока не добавлены</div>';
    const html  = Object.keys(doctors).length ? Object.entries(doctors).map(([id,doc])=>_card(id,doc)).join('') : empty;
    const pageGrid = document.getElementById('doctors-page-grid');
    if (pageGrid) pageGrid.innerHTML = html;
    const homeGrid = document.getElementById('home-docs-grid');
    if (homeGrid) {
      const entries = Object.entries(doctors);

      // перемешиваем
      const shuffled = entries.sort(() => 0.5 - Math.random());

      // берём только 4
      const selected = shuffled.slice(0, 4);

      homeGrid.innerHTML = selected.map(([id, doc]) => _card(id, doc)).join('');
      if (!homeGrid._docClickBound) {
        homeGrid._docClickBound = true;
        homeGrid.addEventListener('click', e => { const card=e.target.closest('[data-doc-id]'); if(card) openDocModal(card.dataset.docId); });
      }
    }
    if (pageGrid && !pageGrid._docClickBound) {
      pageGrid._docClickBound = true;
      pageGrid.addEventListener('click', e => { const card=e.target.closest('[data-doc-id]'); if(card) openDocModal(card.dataset.docId); });
    }
  },

  renderServices() {
    // Обеспечиваем наличие контейнера на странице услуг
    this._ensureServicesGrid();
    const c = document.getElementById('services-grid');
    if (!c) return;
    const services = (typeof SiteState!=='undefined')?(SiteState.get('services')||{}):DataManager.getServices();
    if (!services || !Object.keys(services).length) {
      c.innerHTML = '<div style="text-align:center;padding:40px;color:var(--c-text2)">Услуги пока не добавлены</div>';
      return;
    }
    const byCat = {};
    Object.entries(services).forEach(([id,s]) => { const cat=s.category||'Прочее'; if(!byCat[cat]) byCat[cat]=[]; byCat[cat].push({id,...s}); });
    c.innerHTML = Object.entries(byCat).map(([cat,items]) => `
      <div class="svc-cat-group" style="margin-bottom:32px">
        <h3 style="font-size:18px;margin-bottom:16px;color:var(--c-text);border-bottom:2px solid var(--c-border);padding-bottom:8px">${Utils.escapeHtml(cat)}</h3>
        <div style="display:grid;gap:12px">${items.map(s=>`
          <div class="svc-list-item" style="display:flex;align-items:center;gap:16px;padding:16px;background:var(--c-card);border-radius:var(--r-sm);border:1px solid var(--c-border);cursor:pointer;transition:var(--tr)" onmouseenter="this.style.boxShadow='var(--shadow)'" onmouseleave="this.style.boxShadow='none'">
            <div style="flex-shrink:0;width:44px;height:44px;background:var(--c-accent-bg);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--c-accent)">${SVC_ICONS[s.category||'']||SVC_ICONS_DEFAULT}</div>
            <div style="flex:1">
              <div style="font-weight:700;margin-bottom:4px;color:var(--c-text)">${Utils.escapeHtml(s.name)}</div>
              <div style="font-size:13px;color:var(--c-text2)">${Utils.escapeHtml(s.description||'')}</div>
            </div>
            <div style="font-weight:600;color:var(--c-accent);white-space:nowrap;font-size:14px">${Utils.escapeHtml(s.price||'')}</div>
          </div>`).join('')}
        </div>
      </div>`).join('');
  },

  _ensureServicesGrid() {},

  renderReviews() {
    const reviews = (typeof SiteState!=='undefined')?(SiteState.get('reviews')||{}):DataManager.getReviews();
    const entries = Object.entries(reviews||{});
    const _card = r => {
      const init = (r.name||'?').charAt(0).toUpperCase();
      return `<div class="rev-card">
        <div class="rev-stars">${Utils.renderStars(r.rating||5)}</div>
        <p class="rev-text">&laquo;${Utils.escapeHtml(r.text)}&raquo;</p>
        <div class="rev-author"><div class="rev-ava">${init}</div>
          <div><div class="rev-name">${Utils.escapeHtml(r.name)}</div><div class="rev-date">${Utils.escapeHtml(r.date||'')}</div></div>
        </div></div>`;
    };
    const pageGrid = document.getElementById('reviews-grid');
    if (pageGrid) pageGrid.innerHTML = entries.length ? entries.map(([,r])=>_card(r)).join('') : '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--c-text2)">Отзывы пока не добавлены</div>';
    const homeGrid = document.getElementById('home-reviews-grid');
    if (homeGrid && entries.length) homeGrid.innerHTML = entries.slice(0,3).map(([,r])=>_card(r)).join('');
  },

  renderBlogs() {
    const blogs = (typeof SiteState!=='undefined')?(SiteState.get('blogs')||{}):DataManager.getBlogs();
    const entries = Object.entries(blogs||{}).sort((a,b)=>(b[1].date||'').localeCompare(a[1].date||''));
    const grid = document.getElementById('blog-grid');
    if (!grid) return;
    if (!entries.length) { grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--c-text2)">Статьи пока не добавлены</div>'; return; }
    const calSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
    grid.innerHTML = entries.map(([id,b]) => {
      const cls = b.imgClass||'bi1';
      const imgDiv = b.imgUrl
        ? `<div class="blog-img"><img src="${Utils.escapeHtml(b.imgUrl)}" alt="${Utils.escapeHtml(b.title||'')}" loading="lazy"></div>`
        : `<div class="blog-img ${cls}"></div>`;
      // Определяем excerpt: если rich-text — отображаем с разметкой, иначе plain
      const excerptHtml = b.excerpt
        ? (b.excerpt.includes('<') ? b.excerpt : Utils.escapeHtml(b.excerpt))
        : '';
      return `<a class="blog-card" href="${b.url || '#'}">
        ${imgDiv}
        <div class="blog-body">
          <div class="blog-meta"><span>${calSvg} ${Utils.escapeHtml(b.date||'')}</span></div>
          <div class="blog-tit">${Utils.escapeHtml(b.title)}</div>
          <p class="blog-exc">${excerptHtml}</p>
          <div class="blog-more">Читать →</div>
        </div></a>`;
    }).join('');
  },

  renderPromos() {
    return; // раздел Акции отключён
    const promos = (typeof SiteState!=='undefined')?(SiteState.get('promos')||{}):DataManager.getPromos();
    const entries = Object.entries(promos||{});
    const SAFE_ACTIONS = {
      "openLeadModal('lead')":                   "openLeadModal('lead')",
      "window.location.href='doctors.html'":     "window.location.href='doctors.html'",
      "window.location.href='services.html'":    "window.location.href='services.html'",
      "window.location.href='about.html'":       "window.location.href='about.html'",
      "window.location.href='service/service-braces.html'":   "window.location.href='service/service-braces.html'",
      "window.location.href='service/service-karies.html'":   "window.location.href='service/service-karies.html'",
      "window.location.href='service/service-udalenie.html'": "window.location.href='service/service-udalenie.html'",
      "window.location.href='service/service-protez.html'":   "window.location.href='service/service-protez.html'",
      "window.location.href='service/service-cleaning.html'": "window.location.href='service/service-cleaning.html'",
      "window.location.href='service/service-children.html'": "window.location.href='service/service-children.html'"
    };
    const _card = p => {
      const safeAction = SAFE_ACTIONS[p.btnAction]||"openLeadModal('lead')";
      return `<div class="promo-card ${Utils.escapeHtml(p.colorClass||'pc1')}">
        <div class="promo-badge">${Utils.escapeHtml(p.badge||'Акция')}</div>
        <div class="promo-title">${Utils.escapeHtml(p.title)}</div>
        <p class="promo-txt">${Utils.escapeHtml(p.text)}</p>
        <button class="promo-btn" onclick="${safeAction}">${Utils.escapeHtml(p.btnText||'Подробнее')}</button>
      </div>`;
    };
    const pageGrid = document.getElementById('promos-grid');
    if (pageGrid) pageGrid.innerHTML = entries.length ? entries.map(([,p])=>_card(p)).join('') : '<div style="text-align:center;padding:40px;color:var(--c-text2)">Акции пока не добавлены</div>';
    const homeGrid = document.getElementById('home-promos-grid');
    if (homeGrid && entries.length) homeGrid.innerHTML = entries.slice(0,2).map(([,p])=>_card(p)).join('');
  },

  applySectionVisibility() {
    const sections = (typeof SiteState!=='undefined')?(SiteState.get('visibility')||{}):DataManager.getSections();
    if (!sections) return;
    Object.entries(sections).forEach(([id,vis]) => {
      const page = document.getElementById(`page-${id}`);
      if (page) page.style.display = vis ? '' : 'none';
      document.querySelectorAll('[data-section]').forEach(link => {
        if (link.dataset.section === id) link.style.display = vis ? '' : 'none';
      });
    });
  },

  renderAll() {
    this.renderDoctors();
    this.renderServices();
    this.renderReviews();
    this.renderBlogs();
    this.renderPromos();
    this.applySectionVisibility();
  }
};

// ── 5. NEWS BANNER ──────────────────────────────────────────────
/**
 * Управляет баннером новостей на главной странице.
 * Создаёт HTML-элемент, если его нет в DOM.
 */
function updateNewsBanner() {
  // Получаем или создаём баннер
  let banner = document.getElementById('ds-news-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'ds-news-banner';
    banner.className = 'news-banner';
    banner.style.display = 'none'; // стартуем скрытым, CSS .show управляет через display:flex
    // Вставляем первым ребёнком page-home (прямо под хедером)
    const pageHome = document.getElementById('page-home');
    if (pageHome) pageHome.insertBefore(banner, pageHome.firstChild);
    else document.body.insertBefore(banner, document.body.firstChild);
  }

  const news = (typeof SiteState !== 'undefined') ? (SiteState.get('news') || {}) : {};
  const { enabled, badge, title, text } = news;

  if (!enabled || !title) {
    banner.classList.remove('show');
    banner.style.display = 'none';
    return;
  }

  banner.style.display = '';
  banner.classList.add('show');
  banner.innerHTML = `
    <div class="news-banner-inner" style="display:flex;align-items:center;gap:12px;padding:12px 20px;max-width:1200px;margin:0 auto;width:100%">
      <span class="news-banner-badge" style="display:inline-block;background:var(--c-accent);color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:100px;white-space:nowrap;flex-shrink:0">${Utils.escapeHtml(badge||'Акция')}</span>
      <span class="news-banner-title" style="font-weight:600;font-size:14px;color:var(--c-text)">${Utils.escapeHtml(title)}</span>
      ${text ? `<span class="news-banner-text" style="font-size:13px;color:var(--c-text2);flex:1">${Utils.escapeHtml(text)}</span>` : ''}
      <button onclick="document.getElementById('ds-news-banner').classList.remove('show');document.getElementById('ds-news-banner').style.display='none'" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--c-text3);line-height:1;padding:0 4px;flex-shrink:0" title="Закрыть">×</button>
    </div>`;
}

// ── 6. СТРАНИЦА «О КЛИНИКЕ» ──────────────────────────────────────
const renderAboutPageFromData = function (s) {
  const DEFAULT_H = '<p style="color:var(--c-text2);line-height:1.8;margin-bottom:14px">Клиника «Дента Смайл» была основана в 2014 году Дудолкиной Илоной Андреевной. Идея была проста: создать стоматологию, куда пациенты идут без страха — зная, что их услышат и помогут.</p>'
    + '<p style="color:var(--c-text2);line-height:1.8;margin-bottom:14px">За 10 лет работы мы приняли более 3 000 пациентов, вылечили свыше 5 000 зубов, собрали команду из 7 опытных специалистов.</p>'
    + '<p style="color:var(--c-text2);line-height:1.8;margin-bottom:14px">Сегодня «Дента Смайл» — это современное оборудование, прозрачные цены и гарантия качества на каждую процедуру.</p>';

  const historyOut = document.getElementById('about-history-output');
  if (historyOut) {
    const content = (s && s.history) ? s.history : DEFAULT_H;
    Utils.safeSetHtml(historyOut, content);
  }

  const sTitle = (s && (s.sectionTitle || s.clinicName)) || '';
  const titleEl = document.getElementById('about-section-title') || document.querySelector('#page-about .about-2col .s-title');
  if (titleEl && sTitle) titleEl.textContent = sTitle;

  const quoteEl = document.querySelector('#page-about .founder-quote');
  if (quoteEl) {
    const q = (s && s.founderQuote) ? s.founderQuote.trim() : '';
    quoteEl.textContent = q ? '«' + q + '»' : '';
    const card = quoteEl.closest('.founder-card');
    if (card) card.style.display = q ? '' : 'none';
  }
  const nameEl = document.querySelector('#page-about .founder-name');
  if (nameEl) nameEl.textContent = (s && s.founderName) ? s.founderName : '';
  const posEl = document.querySelector('#page-about .founder-pos');
  if (posEl) posEl.textContent = (s && s.founderPosition) ? s.founderPosition : '';

  const licNumEl = document.querySelector('#page-about .lic-num');
  if (licNumEl) {
    const num = (s && s.licNumber) ? s.licNumber : '';
    if (s && s.licFile && num) {
      licNumEl.innerHTML = `<a href="${Utils.escapeHtml(s.licFile)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">${Utils.escapeHtml(num)}</a>`;
    } else {
      licNumEl.textContent = num || 'Л041-01140-44/00622714';
    }
  }

  const photoEls = document.querySelectorAll('#page-about .about-photo');
  const photos = s ? [s.photo1, s.photo2, s.photo3] : [null, null, null];
  photos.forEach((src, i) => {
    const el = photoEls[i]; if (!el) return;
    if (src) { el.style.cssText = `background-image:url("${src}");background-size:cover;background-position:center;padding:0`; el.innerHTML = ''; }
    else { el.style.backgroundImage = ''; el.style.padding = ''; }
  });

  const srvItems = document.querySelector('#page-about .srv-items');
  if (srvItems) {
    const techs = (s && s.technologies && s.technologies.length) ? s.technologies : [];
    srvItems.innerHTML = techs.map(t => `<div class="srv-item">${Utils.escapeHtml(t)}</div>`).join('');
  }
};

// ── 7. ДИНАМИЧЕСКАЯ СТРАНИЦА СТАТЬИ (LEGACY SPA) ─────────────────
// Используется только для CMS-статей без статической страницы (без pageId).
// Все статические страницы блога теперь в /blog/*.html.
// Не удалять: fallback для статей, созданных прямо в CMS-панели.
/**
 * Создаёт или получает `#page-article` и регистрирует его в роутере PAGES.
 */
function _ensureArticlePage() {
  let el = document.getElementById('page-article');
  if (!el) {
    el = document.createElement('div');
    el.className = 'page';
    el.id = 'page-article';
    el.style.display = 'none';
    el.innerHTML = `
      <div class="pg-hero art-hero">
        <div class="art-wrap">
          <div class="bc">
            <a class="bc-link" href="index.html">Главная</a> /
            <a class="bc-link" href="blog.html">Блог</a> /
            <span id="art-bc-title" style="color:var(--c-text2)">Статья</span>
          </div>
          <div id="art-tag" class="art-tag"></div>
          <h1 id="art-title" class="art-title"></h1>
          <div class="art-meta">
            <span id="art-date"></span>
          </div>
        </div>
      </div>
      <section class="section">
        <div class="art-wrap">
          <div id="art-content" class="art-body"></div>
          <div style="margin-top:48px;text-align:center">
            <button class="btn-article-cta" onclick="openLeadModal('lead')">
              Записаться на приём
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M15 8l4 4-4 4"/></svg>
            </button>
          </div>
          <div style="margin-top:32px;text-align:center">
            <a href="blog.html" style="color:var(--c-text2);font-size:14px;text-decoration:none">← Вернуться в блог</a>
          </div>
        </div>
      </section>`;
    document.body.appendChild(el);
  }
  // Расширяем PAGES для роутинга
  if (typeof PAGES !== 'undefined' && !PAGES['article']) {
    PAGES['article'] = 'page-article';
  }
  return el;
}

/**
 * Открыть статью из CMS или перейти на статическую страницу по pageId.
 */
function openBlogArticle(blogId) {
  var blogs = (typeof SiteState !== 'undefined') ? (SiteState.get('blogs') || {}) : DataManager.getBlogs();
  var b = blogs[blogId];
  if (!b) return;
  if (b.url) { window.location.href = b.url; return; }
  if (b.pageId) {
    var urlMap = {"blog-chistit":"blog/blog-kak-chistit.html","blog-bolit":"blog/blog-zub-bolit.html","blog-brekety":"blog/blog-brekety.html","blog-implant":"blog/blog-implant.html","blog-viniры":"blog/blog-viniры.html","blog-deti":"blog/blog-deti.html","blog-otbelivanie":"blog/blog-otbelivanie.html","blog-strah":"blog/blog-strah.html","blog-karies-lechenie":"blog/blog-karies-lechenie.html","blog-brekety-cena":"blog/blog-brekety-cena.html","blog-implant-info":"blog/blog-implant-info.html","blog-profchistka":"blog/blog-profchistka.html","blog-vybor-stom":"blog/blog-vybor-stom.html","blog-parodont":"blog/blog-parodont.html"};
    if (urlMap[b.pageId]) { window.location.href = urlMap[b.pageId]; return; }
  }
}

// ── 8. ИНИЦИАЛИЗАЦИЯ ────────────────────────────────────────────
let _supabaseLoaded = false;

const initApp = async function () {
  // ── 0. Версия данных: проверяем ПЕРВЫМ, до Supabase/localStorage ─
  // Если данные устарели — сразу сбрасываем и пропускаем все внешние загрузки.
  let _freshReset = false;
  if (typeof SiteState !== 'undefined' && typeof CMS_VERSION !== 'undefined') {
    if (!SiteState._data) SiteState.load();
    if ((SiteState.get('_version') || 0) < CMS_VERSION) {
      console.log('[CMS] Устаревшие данные — сброс до v' + CMS_VERSION);
      SiteState.reset();
      SiteState.set('_version', CMS_VERSION);
      _freshReset = true;
    }
  }

  // ── 0б. Мгновенный пре-рендер из localStorage ────────────────────
  // Показываем кешированные данные до Supabase — устраняет мелькание
  if (!_freshReset && typeof SiteState !== 'undefined') {
    const _cached = SiteState.load();
    if (_cached) {
      // Страница «О клинике»
      if (document.getElementById('about-history-output')) {
        const _c = _cached.clinic || {};
        renderAboutPageFromData({
          sectionTitle: _c.sectionTitle||_c.name||'', clinicName: _c.name||'',
          history: _c.history||'', founderQuote: _c.founderQuote||'',
          founderName: _c.founderName||'', founderPosition: _c.founderPosition||'',
          licNumber: _c.licNumber||'', licFile: _c.licFile||null,
          photo1: _c.photo1||null, photo2: _c.photo2||null, photo3: _c.photo3||null,
          technologies: _c.technologies||[]
        });
      }
      // Динамические секции (отзывы, врачи, блог, видимость навигации)
      if (typeof RenderManager !== 'undefined') {
        RenderManager.renderReviews();
        RenderManager.renderDoctors();
        RenderManager.renderBlogs();
        RenderManager.applySectionVisibility();
      }
    }
  }

  // ── Загрузка данных: Supabase → localStorage → DEFAULT_DATA ─────
  if (!_freshReset && typeof SupabaseDB !== 'undefined') {
try {
  await SupabaseDB.loadAll();
  _supabaseLoaded = true;
  console.log('[CMS] Данные загружены с Supabase');
} catch (e) {
  console.warn('[CMS] Supabase упал, пробуем localStorage:', e);

  let loaded = false;

  if (typeof SiteState !== 'undefined') {
    const ls = SiteState.load();

    const isEmpty =
      !ls ||
      (!Object.keys(ls.doctors || {}).length &&
       !Object.keys(ls.reviews || {}).length &&
       !Object.keys(ls.blogs || {}).length);

    if (!isEmpty) {
      console.log('[CMS] Данные взяты из localStorage');
      loaded = true;
    }
  }

  // 👉 ЕСЛИ localStorage ПУСТ — ИНИЦИАЛИЗИРУЕМ ДАННЫМИ ПО УМОЛЧАНИЮ
  if (!loaded) {
    DataManager.initDefaults();
  }
}

    // ── Проверка: не оказались ли все коллекции пустыми ───────────
    // Такое возможно даже без ошибки (RLS вернул [] без exception).
    // Если пусто — пробуем добрать данные из localStorage.
    if (typeof SiteState !== 'undefined') {
      const _isEmpty = obj => !obj || Object.keys(obj).length === 0;
      const afterSupabase =
        _isEmpty(SiteState.get('doctors'))  &&
        _isEmpty(SiteState.get('reviews'))  &&
        _isEmpty(SiteState.get('blogs'))    &&
        _isEmpty(SiteState.get('promos'));

      if (afterSupabase) {
        console.warn('[CMS] Supabase вернул пустые коллекции. Пробуем localStorage...');

        // Пытаемся загрузить из localStorage
        const lsData = SiteState.load();
        const _isEmptyLs = obj => !obj || Object.keys(obj).length === 0;
        const lsAlsoEmpty =
          _isEmptyLs(lsData.doctors)  &&
          _isEmptyLs(lsData.reviews)  &&
          _isEmptyLs(lsData.blogs)    &&
          _isEmptyLs(lsData.promos);

        if (lsAlsoEmpty) {
          // ── Последний резерв: DEFAULT_DATA ──────────────────────
          console.warn('[CMS] localStorage тоже пуст. Загружаем DEFAULT_DATA...');
          if (typeof DEFAULT_DATA !== 'undefined' && SiteState._data) {
            // Врачей нет в DEFAULT_DATA — оставляем пустыми
            SiteState._data.reviews  = JSON.parse(JSON.stringify(DEFAULT_DATA.reviews  || {}));
            SiteState._data.services = JSON.parse(JSON.stringify(DEFAULT_DATA.services || {}));
            SiteState._data.blogs    = JSON.parse(JSON.stringify(DEFAULT_DATA.blogs    || {}));
            SiteState._data.promos   = JSON.parse(JSON.stringify(DEFAULT_DATA.promos   || {}));
          }
        } else {
          console.log('[CMS] Данные восстановлены из localStorage');
        }
      }
    }

    // ── Итоговый отчёт о загруженных данных ───────────────────────
    if (typeof SiteState !== 'undefined') {
      const _count = obj => obj ? Object.keys(obj).length : 0;
      console.log(
        '[CMS Init] doctors:', _count(SiteState.get('doctors')),
        '| reviews:',  _count(SiteState.get('reviews')),
        '| blogs:',    _count(SiteState.get('blogs')),
        '| promos:',   _count(SiteState.get('promos')),
        '| services:', _count(SiteState.get('services'))
      );
    }

  } else if (!_freshReset) {
    if (typeof SiteState !== 'undefined') SiteState.load();
    else DataManager.initDefaults();
  }

  // ── Проверка целостности после загрузки ──────────────────────────
  // Если Supabase или localStorage вернули устаревшие данные (другая клиника),
  // сбрасываем принудительно. Срабатывает до первой миграции в Supabase.
  if (!_freshReset && typeof SiteState !== 'undefined' && typeof CMS_DEFAULTS !== 'undefined') {
    const loadedName = SiteState.get('clinic.name') || '';
    const expectedName = CMS_DEFAULTS.clinic.name || '';
    if (expectedName && loadedName && loadedName !== expectedName) {
      console.warn('[CMS] Несоответствие данных клиники ("' + loadedName + '"). Сброс...');
      SiteState.reset();
      if (typeof CMS_VERSION !== 'undefined') SiteState.set('_version', CMS_VERSION);
    }
  }

  // ── Блог: imgUrl и url из DEFAULT_DATA (статические картинки/ссылки) ──
  // Когда Supabase загружен: только обновляем imgUrl/url для существующих записей.
  // Когда Supabase недоступен: добавляем отсутствующие статьи как fallback.
  if (typeof DEFAULT_DATA !== 'undefined' && typeof SiteState !== 'undefined' && SiteState._data) {
    const bl = SiteState.get('blogs') || {};
    let blogsChanged = false;
    Object.entries(DEFAULT_DATA.blogs).forEach(([k, v]) => {
      if (bl[k]) {
        if (bl[k].imgUrl !== v.imgUrl) { bl[k].imgUrl = v.imgUrl; blogsChanged = true; }
        if (v.url && !bl[k].url)       { bl[k].url    = v.url;    blogsChanged = true; }
      } else if (!_supabaseLoaded) {
        bl[k] = v; blogsChanged = true;
      }
    });
    if (blogsChanged) { SiteState.set('blogs', bl); console.log('[CMS] Обновлены данные блога'); }
  }

  // Убеждаемся, что страница статьи готова
  _ensureArticlePage();

  RenderManager.renderAll();
  updateNewsBanner();

  // Если открыта страница admin.html — обновляем UI после загрузки данных из Supabase
  if (typeof initAdminPage === 'function' && document.getElementById('admin-tabs-nav')) {
    initAdminPage();
  }

  if (typeof runCounters       === 'function') setTimeout(runCounters, 400);

  // О клинике
  let aboutData = null;
  if (typeof SiteState !== 'undefined') {
    const c = SiteState.get('clinic') || {};
    aboutData = { sectionTitle:c.sectionTitle||c.name||'', clinicName:c.name||'', history:c.history||'',
      founderQuote:c.founderQuote||'', founderName:c.founderName||'', founderPosition:c.founderPosition||'',
      licNumber:c.licNumber||'', licFile:c.licFile||null, photo1:c.photo1||null, photo2:c.photo2||null, photo3:c.photo3||null, technologies:c.technologies||[] };
  } else {
    const ab = DataManager.getAbout() || {};
    aboutData = { sectionTitle:ab.clinicName||ab.headline||'', clinicName:ab.clinicName||ab.headline||'',
      history:ab.history||ab.description||'', founderQuote:ab.founderQuote||ab.mission||'',
      founderName:ab.founderName||'', founderPosition:ab.founderPosition||'',
      licNumber:ab.licNumber||'', licFile:ab.licFile||null, photo1:ab.photo1||null, photo2:ab.photo2||null, photo3:ab.photo3||null,
      technologies:ab.technologies||ab.awards||[] };
  }
  renderAboutPageFromData(aboutData);
};

document.addEventListener('DOMContentLoaded', initApp);

// ── Инжект стилей для статьи ────────────────────────────────────
(function injectStyles() {
  if (document.getElementById('ds-extra-styles')) return;
  const s = document.createElement('style');
  s.id = 'ds-extra-styles';
  s.textContent = `
    .btn-article-cta {
      display:inline-flex;align-items:center;justify-content:center;gap:8px;
      padding:14px 32px;border:none;border-radius:10px;
      background:linear-gradient(135deg,var(--c-accent),var(--c-accent2));
      color:#fff;font-size:15px;font-weight:700;cursor:pointer;
      transition:transform .2s,box-shadow .2s;
      box-shadow:0 4px 16px rgba(107,114,128,.3);
    }
    .btn-article-cta:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(107,114,128,.45);}
    #ds-news-banner.show {
      display: flex !important;
      background: var(--c-accent-bg, rgba(59,130,246,.08));
      border-bottom: 1px solid var(--c-accent, #3b82f6);
      animation: slideDown .3s ease;
    }
    @keyframes slideDown { from{transform:translateY(-100%);opacity:0} to{transform:translateY(0);opacity:1} }
    .art-body p{margin-bottom:14px;line-height:1.8;color:var(--c-text2);}
    .art-body h2{font-size:22px;font-weight:700;margin:28px 0 12px;color:var(--c-text);}
    .art-body h3{font-size:18px;font-weight:600;margin:20px 0 10px;color:var(--c-text);}
    .art-body ul,.art-body ol{padding-left:24px;margin-bottom:14px;color:var(--c-text2);}
    .art-body li{margin-bottom:6px;line-height:1.7;}
  `;
  document.head.appendChild(s);
})();
