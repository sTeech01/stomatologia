// ═══════════════════════════════════════════════════════════════════
// SUPABASE-CLIENT.JS — замена localStorage на облако
// Подключать ПЕРЕД app-core.js:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="supabase-client.js"></script>
// ═══════════════════════════════════════════════════════════════════
'use strict';

// ── 1. КОНФИГУРАЦИЯ ──────────────────────────────────────────────
// Замените на свои значения из Supabase → Project Settings → API
const SUPABASE_URL     = 'https://mtfbuphupgbruobefrnn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_tAgmhJQ2ZFFn3R1sSwYsIQ_cxaEjdH2';

// Инициализация клиента
const _sb = (typeof supabase !== 'undefined')
  ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

if (!_sb) {
  console.warn('[Supabase] SDK не загружен. Добавьте CDN-скрипт перед supabase-client.js.');
}

// ── 2. СЕССИЯ (JWT только в памяти, не в localStorage) ──────────
let _session = null;

// ── 3. ЗАГРУЗКА ДАННЫХ (для посетителей) ────────────────────────
const SupabaseDB = {

  /**
   * Загружает все таблицы параллельно и записывает данные в SiteState.
   * Вызывается в initApp() при старте сайта.
   */
  async loadAll() {
    if (!_sb) throw new Error('Supabase SDK не инициализирован');

    const [settings, doctors, reviews, blogs, promos, services, svcPages] =
      await Promise.all([
        _sb.from('site_settings').select('*').eq('id', 1).single(),
        _sb.from('doctors').select('*').order('created_at'),
        _sb.from('reviews').select('*').order('created_at'),
        _sb.from('blogs').select('*').order('created_at', { ascending: false }),
        _sb.from('promos').select('*').order('created_at'),
        _sb.from('services').select('*').order('created_at'),
        _sb.from('svc_pages').select('*'),
      ]);

    // Преобразуем массивы строк в объекты { id: row }
    const toMap = (arr) => (arr || []).reduce((m, r) => ({ ...m, [r.id]: r }), {});

    // Нормализуем поля врачей (photo_url → photo)
    const doctorsMap = toMap(
      (doctors.data || []).map(d => ({ ...d, photo: d.photo_url || null }))
    );

    // Нормализуем поля блогов (img_class → imgClass, page_id → pageId)
    const blogsMap = toMap(
      (blogs.data || []).map(b => ({
        ...b,
        imgClass: b.img_class || 'bi1',
        pageId:   b.page_id || '',
      }))
    );

    // Нормализуем поля акций (color_class → colorClass, btn_text → btnText, btn_action → btnAction)
    const promosMap = toMap(
      (promos.data || []).map(p => ({
        ...p,
        colorClass: p.color_class || 'pc1',
        btnText:    p.btn_text    || 'Подробнее',
        btnAction:  p.btn_action  || "openLeadModal('lead')",
      }))
    );

    // Нормализуем svcPages (snake_case → camelCase)
    const svcPagesMap = toMap(
      (svcPages.data || []).map(sp => ({
        ...sp,
        contentHeading: sp.content_heading || '',
        contentItems:   sp.content_items   || [],
        priceTitle:     sp.price_title     || '',
        promoText:      sp.promo_text      || '',
        ctaText:        sp.cta_text        || '',
      }))
    );

    const s = settings.data || {};

    // Записываем в SiteState (SSOT — продолжает работать без изменений)
    if (typeof SiteState !== 'undefined') {
      SiteState._data = {
        clinic:     s.clinic     || {},
        news:       s.news       || {},
        visibility: s.visibility || {},
        doctors:    doctorsMap,
        reviews:    toMap(reviews.data),
        blogs:      blogsMap,
        promos:     promosMap,
        services:   toMap(services.data),
        svcPages:   svcPagesMap,
      };
    }

    return SiteState ? SiteState._data : {};
  },

  // ── ВРАЧИ ────────────────────────────────────────────────────────
  async saveDoctor(id, data) {
    if (!_sb) throw new Error('Supabase недоступен');
    const { photo, ...rest } = data;
    let photo_url = data.photo_url || null;

    // Если передано новое base64-фото — загружаем в Storage
    if (photo && photo.startsWith('data:')) {
      photo_url = await this._uploadPhoto(id, photo);
    }

    const row = {
      id,
      name:      rest.name      || '',
      spec:      rest.spec      || '',
      exp:       rest.exp       || null,
      about:     rest.about     || null,
      edu:       rest.edu       || [],
      courses:   rest.courses   || [],
      services:  rest.services  || [],
      photo_url,
    };

    const { error } = await _sb.from('doctors').upsert(row);
    if (error) throw error;
    return { ...row, photo: photo_url };
  },

  async deleteDoctor(id) {
    if (!_sb) throw new Error('Supabase недоступен');
    const { error } = await _sb.from('doctors').delete().eq('id', id);
    if (error) throw error;
  },

  // ── ОТЗЫВЫ ────────────────────────────────────────────────────────
  async saveReview(id, data) {
    if (!_sb) throw new Error('Supabase недоступен');
    const { error } = await _sb.from('reviews').upsert({
      id,
      name:   data.name   || '',
      text:   data.text   || '',
      rating: data.rating || 5,
      date:   data.date   || null,
    });
    if (error) throw error;
  },

  async deleteReview(id) {
    if (!_sb) throw new Error('Supabase недоступен');
    const { error } = await _sb.from('reviews').delete().eq('id', id);
    if (error) throw error;
  },

  // ── БЛОГ ─────────────────────────────────────────────────────────
  async saveBlog(id, data) {
    if (!_sb) throw new Error('Supabase недоступен');
    const { error } = await _sb.from('blogs').upsert({
      id,
      title:    data.title    || '',
      excerpt:  data.excerpt  || null,
      content:  data.content  || null,
      category: data.category || null,
      date:     data.date     || null,
      img_class: data.imgClass || data.img_class || 'bi1',
      page_id:  data.pageId   || data.page_id   || null,
    });
    if (error) throw error;
  },

  async deleteBlog(id) {
    if (!_sb) throw new Error('Supabase недоступен');
    const { error } = await _sb.from('blogs').delete().eq('id', id);
    if (error) throw error;
  },

  // ── АКЦИИ ─────────────────────────────────────────────────────────
  async savePromo(id, data) {
    if (!_sb) throw new Error('Supabase недоступен');
    const { error } = await _sb.from('promos').upsert({
      id,
      title:       data.title      || '',
      text:        data.text       || null,
      badge:       data.badge      || null,
      color_class: data.colorClass || data.color_class || 'pc1',
      btn_text:    data.btnText    || data.btn_text    || 'Подробнее',
      btn_action:  data.btnAction  || data.btn_action  || "openLeadModal('lead')",
    });
    if (error) throw error;
  },

  async deletePromo(id) {
    if (!_sb) throw new Error('Supabase недоступен');
    const { error } = await _sb.from('promos').delete().eq('id', id);
    if (error) throw error;
  },

  // ── УСЛУГИ ───────────────────────────────────────────────────────
  async saveService(id, data) {
    if (!_sb) throw new Error('Supabase недоступен');
    const { error } = await _sb.from('services').upsert({
      id,
      name:        data.name        || '',
      category:    data.category    || null,
      price:       data.price       || null,
      description: data.description || null,
      icon:        data.icon        || '🦷',
    });
    if (error) throw error;
  },

  // ── СТРАНИЦЫ УСЛУГ ───────────────────────────────────────────────
  async saveSvcPage(id, data) {
    if (!_sb) throw new Error('Supabase недоступен');
    const { error } = await _sb.from('svc_pages').upsert({
      id,
      title:           data.title           || '',
      tag:             data.tag             || null,
      intro:           data.intro           || null,
      content_heading: data.contentHeading  || data.content_heading || null,
      content_items:   data.contentItems    || data.content_items   || [],
      price_title:     data.priceTitle      || data.price_title     || null,
      prices:          data.prices          || [],
      promo_text:      data.promoText       || data.promo_text      || null,
      cta_text:        data.ctaText         || data.cta_text        || null,
    });
    if (error) throw error;
  },

  // ── НАСТРОЙКИ САЙТА (clinic + news + visibility) ─────────────────
  async saveSettings(clinic, news, visibility) {
    if (!_sb) throw new Error('Supabase недоступен');
    const { error } = await _sb.from('site_settings').upsert({
      id:         1,
      clinic:     clinic     || {},
      news:       news       || {},
      visibility: visibility || {},
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  },

  // ── ЗАГРУЗКА ФОТО В SUPABASE STORAGE ─────────────────────────────
  async _uploadPhoto(id, base64) {
    if (!_sb) throw new Error('Supabase недоступен');
    const res  = await fetch(base64);
    const blob = await res.blob();
    const ext  = blob.type.split('/')[1] || 'jpg';
    const path = `doctors/${id}.${ext}`;

    const { error } = await _sb.storage
      .from('site-photos')
      .upload(path, blob, { upsert: true });
    if (error) throw error;

    const { data } = _sb.storage.from('site-photos').getPublicUrl(path);
    return data.publicUrl;
  }
};

// ── 4. АВТОРИЗАЦИЯ ───────────────────────────────────────────────
const AdminAuth = {

  /**
   * Вход по email + пароль через Supabase Auth.
   * JWT-токен хранится только в памяти (_session).
   */
  async login(email, password) {
    if (!_sb) throw new Error('Supabase недоступен');
    const { data, error } = await _sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    _session = data.session;
    return data.session;
  },

  async logout() {
    if (_sb) await _sb.auth.signOut();
    _session = null;
  },

  isLoggedIn() {
    return !!_session;
  },

  /**
   * Проверка сессии при загрузке страницы (восстановление из памяти SDK).
   */
  async check() {
    if (!_sb) return false;
    try {
      const { data } = await _sb.auth.getSession();
      _session = data.session;
      return !!_session;
    } catch (e) {
      return false;
    }
  }
};

// ── 5. УТИЛИТА МИГРАЦИИ ──────────────────────────────────────────
/**
 * Запустить ОДИН РАЗ в консоли браузера для переноса данных
 * из localStorage в Supabase:
 *   migrateToSupabase();
 */
window.migrateToSupabase = async function () {
  if (typeof SiteState === 'undefined') { alert('SiteState не найден'); return; }
  const state   = SiteState.load();
  const results = [];

  for (const [id, doc] of Object.entries(state.doctors || {})) {
    await SupabaseDB.saveDoctor(id, doc);
    results.push('Врач: ' + doc.name);
  }
  for (const [id, rev] of Object.entries(state.reviews || {})) {
    await SupabaseDB.saveReview(id, rev);
    results.push('Отзыв: ' + rev.name);
  }
  for (const [id, blog] of Object.entries(state.blogs || {})) {
    await SupabaseDB.saveBlog(id, blog);
    results.push('Блог: ' + blog.title);
  }
  for (const [id, promo] of Object.entries(state.promos || {})) {
    await SupabaseDB.savePromo(id, promo);
    results.push('Акция: ' + promo.title);
  }
  for (const [id, svc] of Object.entries(state.services || {})) {
    await SupabaseDB.saveService(id, svc);
    results.push('Услуга: ' + svc.name);
  }
  for (const [id, page] of Object.entries(state.svcPages || {})) {
    await SupabaseDB.saveSvcPage(id, page);
    results.push('Страница услуги: ' + id);
  }

  await SupabaseDB.saveSettings(state.clinic, state.news, state.visibility);
  results.push('Настройки клиники');

  console.log('[Migration] Перенесено:', results);
  alert('Миграция завершена! Перенесено: ' + results.length + ' записей.');
};
