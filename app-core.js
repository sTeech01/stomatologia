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
    rev_001: { name:'Анна Соколова',   text:'Наконец-то нашла стоматолога, которого не боюсь. Меджидова Анжела Вагифовна — золотые руки. Пломба стоит уже год, всё отлично.', rating:5, date:'Март 2025' },
    rev_002: { name:'Михаил Петров',   text:'Поставили брекеты 8 месяцев назад. Коровкина очень внимательный врач, каждый приём всё объясняет. Доволен на 100%!', rating:5, date:'Январь 2025' },
    rev_003: { name:'Елена Иванова',   text:'Удаляли зуб мудрости — думала будет ужас. Ничего не почувствовала! Симонян — профессионал высшего уровня.', rating:5, date:'Февраль 2025' },
    rev_004: { name:'Ольга Кузнецова', text:'Сделали полный осмотр, составили план лечения. Цены прозрачные. Рекомендую.', rating:4, date:'Декабрь 2024' },
    rev_005: { name:'Наталья Волкова', text:'Привела 5-летнего сына. Якимчук Юлия Анатольевна нашла подход сразу — ребёнок не плакал!', rating:5, date:'Ноябрь 2024' },
    rev_006: { name:'Сергей Николаев', text:'Поставили имплант. Симонян объяснила всё до мелочей. Качество на высоте!', rating:5, date:'Октябрь 2024' }
  },
  services: {
    svc_001: { name:'Лечение кариеса',         category:'Терапия',    price:'от 2 500 ₽', description:'Безболезненное лечение кариеса любой стадии. Современные световые пломбы.', icon:'🦷' },
    svc_002: { name:'Профессиональная чистка',  category:'Гигиена',    price:'от 3 500 ₽', description:'Ультразвуковое снятие камня, Air Flow, полировка и фторирование.', icon:'✨' },
    svc_003: { name:'Установка брекетов',        category:'Ортодонтия', price:'от 55 000 ₽', description:'Металлические, керамические, сапфировые брекеты. Бесплатная консультация.', icon:'😁' },
    svc_004: { name:'Дентальная имплантация',   category:'Хирургия',   price:'от 45 000 ₽', description:'Имплантаты Nobel Biocare и Straumann. Протезирование «под ключ».', icon:'🔬' },
    svc_005: { name:'Циркониевые коронки',      category:'Ортопедия',  price:'от 18 000 ₽', description:'Коронки из оксида циркония — прочные, эстетичные, без металла.', icon:'👑' },
    svc_006: { name:'Виниры керамические',      category:'Эстетика',   price:'от 22 000 ₽', description:'Фарфоровые и E.max виниры. Голливудская улыбка за 2 визита.', icon:'💎' },
    svc_007: { name:'Удаление зубов',           category:'Хирургия',   price:'от 1 800 ₽',  description:'Атравматичное удаление зубов, включая зубы мудрости.', icon:'🏥' },
    svc_008: { name:'Детская стоматология',     category:'Педиатрия',  price:'от 1 500 ₽',  description:'Лечение молочных и постоянных зубов у детей с 3 лет.', icon:'👶' }
  },
  blogs: {
    blog_001: { title:'Как правильно чистить зубы: полное руководство', excerpt:'Большинство людей чистят зубы неправильно. Рассказываем о технике, выборе щётки и пасты.', category:'Гигиена',    date:'10 янв 2025', pageId:'blog-chistit',     imgClass:'bi1' },
    blog_002: { title:'Болит зуб — что делать до похода к врачу?',      excerpt:'Зубная боль может застать врасплох. Рассказываем, что делать самостоятельно.',           category:'Советы',     date:'22 янв 2025', pageId:'blog-bolit',       imgClass:'bi2' },
    blog_003: { title:'Когда ставить брекеты: возраст, показания, виды',excerpt:'Брекеты можно поставить в любом возрасте. Разбираемся, когда лучше начинать лечение.',   category:'Ортодонтия', date:'5 фев 2025',  pageId:'blog-brekety',    imgClass:'bi3' },
    blog_004: { title:'Сколько стоит имплант зуба в 2025 году?',        excerpt:'Объясняем, из чего складывается стоимость импланта и как выбрать клинику.',              category:'Протезир.',  date:'18 фев 2025', pageId:'blog-implant',    imgClass:'bi4' },
    blog_005: { title:'Виниры или коронки: что выбрать?',               excerpt:'Разбираем разницу между винирами и коронками.',                                           category:'Эстетика',   date:'5 мар 2025',  pageId:'blog-viniры',     imgClass:'bi5' },
    blog_006: { title:'Когда вести ребёнка к стоматологу впервые?',     excerpt:'Многие родители тянут с первым визитом. Объясняем почему важно прийти до проблем.',      category:'Дети',       date:'18 мар 2025', pageId:'blog-deti',       imgClass:'bi6' },
    blog_007: { title:'Отбеливание зубов: виды, безопасность и результат',excerpt:'Офисное, домашнее, лазерное — что даёт реальный эффект.',                              category:'Гигиена',    date:'2 апр 2025',  pageId:'blog-otbelivanie',imgClass:'bi7' },
    blog_008: { title:'Как перестать бояться стоматолога: советы врача', excerpt:'Стоматофобия — серьёзная проблема. Рассказываем, что делает наша клиника.',             category:'Психология', date:'15 апр 2025', pageId:'blog-strah',      imgClass:'bi8' }
  },
  promos: {
    promo_001: { title:'Бесплатный первичный осмотр', text:'Первое посещение — бесплатно. Полный осмотр полости рта, рентген-снимок и план лечения с ценами.', badge:'Всегда', colorClass:'pc1', btnText:'Оставить заявку', btnAction:"openLeadModal('lead')" },
    promo_002: { title:'Чистка зубов в подарок', text:'При установке любых брекетов — профессиональная чистка Air Flow в подарок. Экономия до 5 000 рублей.', badge:'При установке брекетов', colorClass:'pc2', btnText:'Узнать подробнее', btnAction:"showPage('service-braces')" }
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

// ── 4. RENDER MANAGER ───────────────────────────────────────────
const RenderManager = {

  renderDoctors() {
    const doctors = (typeof SiteState!=='undefined')?(SiteState.get('doctors')||{}):DataManager.getDoctors();
    const _card = (id, doc) => {
      const ph = doc.photo
        ? `<img src="${Utils.escapeHtml(doc.photo)}" alt="${Utils.escapeHtml(doc.name)}" style="width:100%;height:100%;object-fit:cover;object-position:top;display:block"/>`
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
      return `<div class="doc-card" data-doc-id="${Utils.escapeHtml(id)}" style="cursor:pointer">
        <div class="doc-photo doc-photo--img" style="height:280px">${ph}<div class="doc-spec-badge">${Utils.escapeHtml(doc.spec||'Специалист')}</div></div>
        <div class="doc-body">
          <div class="doc-name">${Utils.escapeHtml(doc.name)}</div>
          <div class="doc-exp">${Utils.escapeHtml(doc.exp||'')}</div>
          <button class="doc-btn" onclick="event.stopPropagation();openLeadModal('lead')">Оставить заявку</button>
        </div></div>`;
    };
    const empty = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--c-text2)">Врачи пока не добавлены</div>';
    const html  = Object.keys(doctors).length ? Object.entries(doctors).map(([id,doc])=>_card(id,doc)).join('') : empty;
    const pageGrid = document.getElementById('doctors-page-grid');
    if (pageGrid) pageGrid.innerHTML = html;
    // Главная (home-doctors-grid) обслуживается syncHomeDoctors() в index.html —
    // там сохраняется случайный порядок. Не пишем сюда напрямую.
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
            <div style="font-size:28px;flex-shrink:0">${Utils.escapeHtml(s.icon||'🦷')}</div>
            <div style="flex:1">
              <div style="font-weight:700;margin-bottom:4px;color:var(--c-text)">${Utils.escapeHtml(s.name)}</div>
              <div style="font-size:13px;color:var(--c-text2)">${Utils.escapeHtml(s.description||'')}</div>
            </div>
            <div style="font-weight:600;color:var(--c-accent);white-space:nowrap;font-size:14px">${Utils.escapeHtml(s.price||'')}</div>
          </div>`).join('')}
        </div>
      </div>`).join('');
  },

  // Инжектирует services-grid в page-services если его нет
  _ensureServicesGrid() {
    if (document.getElementById('services-grid')) return;
    const page = document.getElementById('page-services');
    if (!page) return;
    const wrap = document.createElement('section');
    wrap.className = 'section';
    wrap.style.cssText = 'padding-top:48px';
    wrap.innerHTML = `<div class="section-inner">
      <div style="margin-bottom:32px">
        <div class="s-tag">Прайс-лист</div>
        <h2 class="s-title" style="margin-top:8px">Все услуги и цены</h2>
      </div>
      <div id="services-grid"></div>
    </div>`;
    page.appendChild(wrap);
  },

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
        ? `<div class="blog-img" style="background-image:url('${Utils.escapeHtml(b.imgUrl)}');background-size:cover;background-position:center"><div class="blog-cat-badge">${Utils.escapeHtml(b.category||'')}</div></div>`
        : `<div class="blog-img ${cls}"><div class="blog-cat-badge">${Utils.escapeHtml(b.category||'')}</div></div>`;
      // Определяем excerpt: если rich-text — отображаем с разметкой, иначе plain
      const excerptHtml = b.excerpt
        ? (b.excerpt.includes('<') ? b.excerpt : Utils.escapeHtml(b.excerpt))
        : '';
      return `<div class="blog-card" onclick="openBlogArticle('${Utils.escapeHtml(id)}')">
        ${imgDiv}
        <div class="blog-body">
          <div class="blog-meta"><span>${calSvg} ${Utils.escapeHtml(b.date||'')}</span></div>
          <div class="blog-tit">${Utils.escapeHtml(b.title)}</div>
          <p class="blog-exc">${excerptHtml}</p>
          <div class="blog-more">Читать →</div>
        </div></div>`;
    }).join('');
  },

  renderPromos() {
    const promos = (typeof SiteState!=='undefined')?(SiteState.get('promos')||{}):DataManager.getPromos();
    const entries = Object.entries(promos||{});
    const SAFE_ACTIONS = {
      "openLeadModal('lead')":"openLeadModal('lead')", "showPage('doctors')":"showPage('doctors')",
      "showPage('services')":"showPage('services')", "showPage('about')":"showPage('about')",
      "showPage('service-braces')":"showPage('service-braces')", "showPage('service-karies')":"showPage('service-karies')",
      "showPage('service-udalenie')":"showPage('service-udalenie')", "showPage('service-protez')":"showPage('service-protez')",
      "showPage('service-cleaning')":"showPage('service-cleaning')", "showPage('service-children')":"showPage('service-children')"
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
      document.querySelectorAll('.nav-link, .mob-nav-link').forEach(link => {
        const oc = link.getAttribute('onclick')||'';
        if (oc.includes(`'${id}'`)) link.style.display = vis ? '' : 'none';
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

// ── 7. ДИНАМИЧЕСКАЯ СТРАНИЦА СТАТЬИ ─────────────────────────────
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
            <span onclick="showPage('home')" style="cursor:pointer">Главная</span> /
            <span onclick="showPage('blog')" style="cursor:pointer">Блог</span> /
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
            <button onclick="showPage('blog')" style="background:none;border:none;cursor:pointer;color:var(--c-text2);font-size:14px">
              ← Вернуться в блог
            </button>
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
  const blogs = (typeof SiteState !== 'undefined') ? (SiteState.get('blogs') || {}) : DataManager.getBlogs();
  const b = blogs[blogId];
  if (!b) return;

  // Если у статьи есть pageId и такая статическая страница есть в HTML — показываем её
  if (b.pageId && typeof PAGES !== 'undefined' && PAGES[b.pageId]) {
    if (typeof showPage === 'function') showPage(b.pageId);
    return;
  }

  // Иначе — рендерим в динамическую страницу
  _ensureArticlePage();

  const calSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;vertical-align:middle;margin-right:4px"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;

  const _t = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val || ''; };
  _t('art-title', b.title);
  _t('art-bc-title', b.title);
  _t('art-tag', b.category || '');

  const dateEl = document.getElementById('art-date');
  if (dateEl) dateEl.innerHTML = b.date ? `${calSvg}${Utils.escapeHtml(b.date)}` : '';

  // Контент: приоритет b.content, затем b.excerpt, затем заготовка
  const contentEl = document.getElementById('art-content');
  if (contentEl) {
    const rawContent = b.content || b.excerpt || `<p>${Utils.escapeHtml(b.title)}</p>`;
    Utils.safeSetHtml(contentEl, rawContent);
  }

  // Показываем страницу
  if (typeof showPage === 'function') {
    showPage('article');
  } else {
    // Fallback если showPage ещё не инициализирован
    document.querySelectorAll('.page').forEach(p => { p.classList.remove('on'); p.style.display = 'none'; });
    const artPage = document.getElementById('page-article');
    if (artPage) { artPage.style.display = 'block'; artPage.classList.add('on'); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// ── 8. ИНИЦИАЛИЗАЦИЯ ────────────────────────────────────────────
const initApp = async function () {
  // ── Загрузка данных: Supabase → localStorage → DEFAULT_DATA ─────
  if (typeof SupabaseDB !== 'undefined') {
    // Показываем индикатор загрузки
    document.body.style.opacity = '0.6';
    document.body.style.transition = 'opacity 0.3s';
    try {
      await SupabaseDB.loadAll();
      console.log('[CMS] Данные загружены с Supabase');
    } catch (e) {
      console.warn('[CMS] Ошибка Supabase, переходим к localStorage:', e);
      if (typeof SiteState !== 'undefined') SiteState.load();
      else DataManager.initDefaults();
    }
    document.body.style.opacity = '1';

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

  } else {
    if (typeof SiteState !== 'undefined') SiteState.load();
    else DataManager.initDefaults();
  }

  // Убеждаемся, что страница статьи готова
  _ensureArticlePage();

  RenderManager.renderAll();
  updateNewsBanner();

  const hash = location.hash.replace('#', '');
  if (hash && typeof showPage === 'function') showPage(hash);
  if (typeof runCounters       === 'function') setTimeout(runCounters, 400);
  if (typeof shuffleHomeDoctors === 'function') shuffleHomeDoctors();

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

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp);
else initApp();

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
