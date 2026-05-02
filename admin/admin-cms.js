// ═══════════════════════════════════════════════════════════════════
// ADMIN-CMS.JS — Single Source of Truth (SSOT)
// ═══════════════════════════════════════════════════════════════════
'use strict';

const CMS_KEY = 'ds_siteData';
const CMS_VERSION = 7; // увеличьте при смене данных клиники

const CMS_DEFAULTS = {
  clinic: {
    name: 'Центр стоматологии Дента Смайл',
    sectionTitle: 'Как мы начинали',
    history: '<p>Центр стоматологии «Дента Смайл» открыл свои двери <strong>11 января 2023 года</strong> в Костроме. Клиника была основана с одной целью — предоставить жителям города качественную стоматологическую помощь без боли и страха, с прозрачными ценами и реальной гарантией результата.</p><p>За короткий срок мы завоевали доверие более <strong>2 400 пациентов</strong>. Этот результат стал возможным благодаря команде из семи опытных специалистов, которые вместе охватывают все направления стоматологии: терапию, хирургию, ортодонтию, ортопедию, детскую стоматологию и профессиональную гигиену.</p><p>Мы принимаем <strong>только по предварительной записи</strong> — это позволяет уделить каждому пациенту достаточно времени, избежать очередей и провести приём в спокойной комфортной обстановке. Перед любым лечением составляем подробный план с указанием всех цен — никаких скрытых платежей. На все виды лечения действует гарантия <strong>не менее 12 месяцев</strong>, которая оформляется письменно.</p>',
    founderName: 'Дудолкина Илона Андреевна',
    founderPosition: 'Основатель и генеральный директор',
    founderQuote: 'В нашей клинике вы можете чувствовать себя спокойно и уверенно. Мы используем качественные материалы и современные методы лечения, а также строго соблюдаем стандарты работы. На все услуги предоставляется гарантия от 12 месяцев. Стоимость лечения фиксируется заранее и подробно отражается в плане — без скрытых платежей.',
    mission: 'Ваша улыбка — наша главная ценность',
    awards: '', licNumber: 'Л041-01140-44/00622714',
    licFile: null, photo1: null, photo2: null, photo3: null,
    technologies: [
      'Цифровой рентген — снимки с минимальной лучевой нагрузкой',
      'Радиовизиограф — изображение зуба сразу на экране',
      'Апекслокатор — точное лечение корневых каналов',
      'Электроодонтодиагностика — проверка «живой» ли зуб',
      'Ультразвуковой скейлер — бережная чистка от камня и налёта',
      'Современные стоматологические установки — комфортное лечение',
      'Турбинные и микромоторные наконечники — высокая точность работы',
      'Автоклав — полная стерилизация инструментов',
      'УФ-рециркуляторы — очистка воздуха от бактерий',
      'Бактерицидные камеры — стерильное хранение инструментов',
      'Гласперленовый стерилизатор — быстрая обработка инструментов',
      'Рентгенозащитное оборудование — безопасность при диагностике'
    ]
  },
  doctors: {}, services: {}, reviews: {}, blogs: {}, promos: {},
  news: { enabled: false, badge: 'Акция', title: '', text: '', btnText: '' },
  visibility: {
    services: true, doctors: true, 'before-after': true,
    reviews: true, blog: true, promos: true, about: true, contacts: true
  },
  svcPages: {}, svcCats: [], svcPops: []
};

const SiteState = {
  _data: null,

  load() {
    try {
      const raw = localStorage.getItem(CMS_KEY);
      if (raw) { this._data = JSON.parse(raw); this._fill(); return this._data; }
    } catch (e) { console.warn('[SiteState] read error:', e); }
    this._data = this._migrate();
    this.save();
    return this._data;
  },

  save() {
    if (!this._data) return false;
    try {
      localStorage.setItem(CMS_KEY, JSON.stringify(this._data));
      this._sync();
      return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError')
        alert('Недостаточно места. Удалите фотографии или сбросьте данные.');
      return false;
    }
  },

  get(path) {
    if (!this._data) this.load();
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), this._data);
  },

  set(path, value) {
    if (!this._data) this.load();
    const parts = path.split('.');
    let o = this._data;
    for (let i = 0; i < parts.length - 1; i++) {
      if (o[parts[i]] == null || typeof o[parts[i]] !== 'object') o[parts[i]] = {};
      o = o[parts[i]];
    }
    o[parts[parts.length - 1]] = value;
    return this.save();
  },

  reset() {
    localStorage.removeItem(CMS_KEY);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('ds_')) localStorage.removeItem(k);
    }
    this._data = JSON.parse(JSON.stringify(CMS_DEFAULTS));
    if (typeof DOCTORS !== 'undefined') this._data.doctors = DOCTORS;
    if (typeof DEFAULT_DATA !== 'undefined') {
      ['services','reviews','blogs','promos'].forEach(n => {
        this._data[n] = JSON.parse(JSON.stringify(DEFAULT_DATA[n]));
      });
    }
    this.save();
  },

  _fill() {
    const fill = (t, s) => {
      for (const k of Object.keys(s)) {
        if (t[k] == null) t[k] = JSON.parse(JSON.stringify(s[k]));
        else if (typeof s[k] === 'object' && !Array.isArray(s[k]) && s[k] !== null &&
                 typeof t[k] === 'object' && !Array.isArray(t[k])) fill(t[k], s[k]);
      }
    };
    fill(this._data, CMS_DEFAULTS);
    if (typeof DOCTORS !== 'undefined' && (!this._data.doctors || !Object.keys(this._data.doctors).length)) {
      this._data.doctors = JSON.parse(JSON.stringify(DOCTORS));
    }
  },

  _sync() {
    const d = this._data;
    const s = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
    s('ds_doctors',  d.doctors  || {});
    s('ds_services', d.services || {});
    s('ds_reviews',  d.reviews  || {});
    s('ds_blogs',    d.blogs    || {});
    s('ds_promos',   d.promos   || {});
    s('ds_news',     d.news     || {});
    s('ds_sections_visibility', d.visibility || {});
    if (d.svcPages) s('ds_svc_pages', d.svcPages);
    const c = d.clinic || {};
    s('ds_about', {
      clinicName: c.name || '', headline: c.sectionTitle || c.name || '',
      history: c.history || '', description: c.history || '',
      founderName: c.founderName || '', founderPosition: c.founderPosition || '',
      founderQuote: c.founderQuote || '', mission: c.mission || '',
      licNumber: c.licNumber || '', licFile: c.licFile || null,
      photo1: c.photo1 || null, photo2: c.photo2 || null, photo3: c.photo3 || null,
      technologies: c.technologies || [], awards: c.awards || c.technologies || []
    });
  },

  _migrate() {
    const g = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
    const state = JSON.parse(JSON.stringify(CMS_DEFAULTS));

    const dr = g('ds_doctors', null);
    if (dr && Object.keys(dr).length) state.doctors = dr;
    else if (typeof DOCTORS !== 'undefined') state.doctors = DOCTORS;

    for (const [key, name] of [['ds_services','services'],['ds_reviews','reviews'],['ds_blogs','blogs'],['ds_promos','promos']]) {
      const d = g(key, null);
      if (d && Object.keys(d).length) state[name] = d;
      else if (typeof DEFAULT_DATA !== 'undefined') state[name] = JSON.parse(JSON.stringify(DEFAULT_DATA[name]));
    }

    const news = g('ds_news', null); if (news) state.news = { ...state.news, ...news };
    const vis  = g('ds_sections_visibility', null); if (vis) state.visibility = { ...state.visibility, ...vis };
    const pages = g('ds_svc_pages', null); if (pages) state.svcPages = pages;

    const ab = g('ds_about', null);
    if (ab) state.clinic = {
      name: ab.clinicName || ab.headline || '', sectionTitle: ab.clinicName || ab.headline || '',
      history: ab.history || ab.description || '',
      founderName: ab.founderName || '', founderPosition: ab.founderPosition || '',
      founderQuote: ab.founderQuote || '', mission: ab.mission || '',
      awards: ab.awards || '', licNumber: ab.licNumber || '', licFile: ab.licFile || null,
      photo1: ab.photo1 || null, photo2: ab.photo2 || null, photo3: ab.photo3 || null,
      technologies: ab.technologies || []
    };
    return state;
  }
};

const ListManager = {
  saveItem(path, id, data, prefix = 'item') {
    const col = SiteState.get(path) || {};
    const fid = id || (typeof Utils !== 'undefined'
      ? Utils.generateId(prefix)
      : `${prefix}_${Date.now()}`);
    col[fid] = data;
    SiteState.set(path, col);
    return fid;
  },
  deleteItem(path, id) {
    const col = SiteState.get(path) || {};
    if (!col[id]) return false;
    delete col[id];
    SiteState.set(path, col);
    return true;
  }
};

const loadSiteData   = () => SiteState.load();
const saveSiteData   = () => SiteState.save();
const updateSiteData = (p, v) => SiteState.set(p, v);

const renderSite = function () {
  if (typeof RenderManager !== 'undefined' && RenderManager.renderAll) RenderManager.renderAll();
  if (typeof renderAboutPageFromData === 'function') {
    const c = SiteState.get('clinic') || {};
    renderAboutPageFromData({
      sectionTitle: c.sectionTitle || c.name || '', clinicName: c.name || '',
      history: c.history || '', founderName: c.founderName || '',
      founderPosition: c.founderPosition || '', founderQuote: c.founderQuote || '',
      licNumber: c.licNumber || '', licFile: c.licFile || null,
      photo1: c.photo1 || null, photo2: c.photo2 || null, photo3: c.photo3 || null,
      technologies: c.technologies || []
    });
  }
  if (typeof updateNewsBanner === 'function') updateNewsBanner();
};
