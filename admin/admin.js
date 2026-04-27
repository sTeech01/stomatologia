// ═══════════════════════════════════════════════════════════════════
// ADMIN.JS — UI-слой CMS
// ═══════════════════════════════════════════════════════════════════
'use strict';

// ── Временное состояние ──────────────────────────────────────────
let _editingDoctorId  = null;
let _editingReviewId  = null;
let _editingBlogId    = null;
let _editingPromoId   = null;
let _doctorPhotoData  = null;
let _blogExcerptQuill = null;   // Quill-редактор для excerpt

// ── Секретная клавиатурная последовательность "admin" ────────────
let _seq = '', _seqTimer = null;
document.addEventListener('keydown', function (e) {
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  _seq += e.key.toLowerCase();
  clearTimeout(_seqTimer);
  _seqTimer = setTimeout(() => { _seq = ''; }, 1500);
  if (_seq.endsWith('admin')) { _seq = ''; openAdmin(); }
});

// ── Авторизация ──────────────────────────────────────────────────
async function openAdmin() {
  // Если Supabase подключён — проверяем JWT-сессию
  if (typeof AdminAuth !== 'undefined') {
    const loggedIn = await AdminAuth.check();
    if (!loggedIn) {
      var m = document.getElementById('adminLoginModal');
      if (m) {
        m.style.display = 'flex';
        setTimeout(() => { var li = document.getElementById('adminLoginInput'); if (li) li.focus(); }, 100);
        var err = document.getElementById('adminLoginError'); if (err) err.style.display = 'none';
        var li2 = document.getElementById('adminLoginInput'); if (li2) li2.value = '';
        var pi2 = document.getElementById('adminPasswordInput'); if (pi2) pi2.value = '';
      }
      return;
    }
    initAdminPage();
    return;
  }
  // Fallback: старая локальная авторизация
  const authOk = window.__auth ? window.__auth.check() : true;
  if (!authOk) {
    var m = document.getElementById('adminLoginModal');
    if (m) {
      m.style.display = 'flex';
      setTimeout(() => { var li = document.getElementById('adminLoginInput'); if (li) li.focus(); }, 100);
      var err = document.getElementById('adminLoginError'); if (err) err.style.display = 'none';
      var li2 = document.getElementById('adminLoginInput'); if (li2) li2.value = '';
      var pi2 = document.getElementById('adminPasswordInput'); if (pi2) pi2.value = '';
    }
    return;
  }
  initAdminPage();
}

async function exitAdmin() {
  if (typeof AdminAuth !== 'undefined') {
    await AdminAuth.logout();
  } else if (typeof window.closeAdminSession === 'function') {
    window.closeAdminSession();
  }
}

// ── Инициализация ────────────────────────────────────────────────
function initAdminPage() {
  loadSiteData();
  loadNewsSettings();
  loadSectionVisibility();
  switchAdminTab('news', null);
  updateAdminStats();
  var c = SiteState.get('clinic') || {};
  if (typeof renderAboutPageFromData === 'function') renderAboutPageFromData(c);
}

// ── Переключение вкладок ─────────────────────────────────────────
function switchAdminTab(tabName, event) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
  var btn = document.querySelector('.admin-tab[data-tab="' + tabName + '"]');
  if (!btn) btn = document.querySelector('.admin-tab[onclick*="\'' + tabName + '\'"]');
  if (btn) btn.classList.add('active');
  var panel = document.getElementById('admin-tab-' + tabName);
  if (panel) panel.classList.add('active');
  if (tabName === 'doctors')    loadExistingDoctors();
  if (tabName === 'services')   { loadExistingServices(); loadServicePagesList(); }
  if (tabName === 'reviews')    loadExistingReviews();
  if (tabName === 'blogs')      loadExistingBlogs();
  if (tabName === 'promos')     loadExistingPromos();
  if (tabName === 'visibility') loadSectionVisibility();
  if (tabName === 'about')      loadAboutSettings();
  if (tabName === 'stats')      updateAdminStats();
}

// ── Subpage ──────────────────────────────────────────────────────
function openAdminSubpage(title, contentHtml) {
  var subpage   = document.getElementById('admin-subpage');
  var titleEl   = document.getElementById('admin-subpage-title');
  var contentEl = document.getElementById('admin-subpage-content');
  if (!subpage) return;
  titleEl.textContent = title;
  contentEl.innerHTML = '<div style="background:var(--c-card);border:1px solid var(--c-border);border-radius:var(--r);padding:28px 32px;box-shadow:var(--shadow);box-sizing:border-box">' + contentHtml + '</div>';
  document.getElementById('admin-tabs-nav').style.display    = 'none';
  document.getElementById('admin-tab-panels').style.display  = 'none';
  subpage.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function closeAdminSubpage() {
  var subpage = document.getElementById('admin-subpage');
  if (subpage) subpage.style.display = 'none';
  document.getElementById('admin-tabs-nav').style.display   = '';
  document.getElementById('admin-tab-panels').style.display = '';
  _blogExcerptQuill = null;
}

// ── Toast ────────────────────────────────────────────────────────
function showNotification(message) {
  var el = document.getElementById('adminNotification');
  if (!el) {
    el = document.createElement('div'); el.id = 'adminNotification';
    el.style.cssText = 'position:fixed;bottom:24px;right:24px;background:var(--c-text);color:var(--c-bg);padding:14px 22px;border-radius:8px;font-size:14px;font-weight:600;z-index:9999;opacity:0;transform:translateX(40px);transition:all 0.3s ease;pointer-events:none';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.opacity = '1'; el.style.transform = 'translateX(0)';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(40px)'; }, 3000);
}

// ── Helpers ──────────────────────────────────────────────────────
function _getVal(id) {
  var el = document.getElementById(id); if (!el) return '';
  return el.type === 'checkbox' ? el.checked : (el.value||'').trim();
}
function _setVal(id, val) {
  var el = document.getElementById(id); if (!el) return;
  if (el.type === 'checkbox') el.checked = !!val; else el.value = val || '';
}

// ═══════════════════════════════════════════════════════════════════
// НОВОСТИ
// ═══════════════════════════════════════════════════════════════════
function loadNewsSettings() {
  var s = SiteState.get('news') || {};
  _setVal('newsEnabled',    s.enabled);
  _setVal('newsBadgeType',  s.badge   || 'Акция');
  _setVal('newsTitleInput', s.title   || '');
  _setVal('newsTextInput',  s.text    || '');
}
async function saveNewsSettings() {
  var news = { enabled:_getVal('newsEnabled'), badge:_getVal('newsBadgeType'), title:_getVal('newsTitleInput'), text:_getVal('newsTextInput') };
  SiteState.set('news', news);
  if (typeof updateNewsBanner === 'function') updateNewsBanner();
  if (typeof SupabaseDB !== 'undefined') {
    try {
      await SupabaseDB.saveSettings(SiteState.get('clinic'), news, SiteState.get('visibility'));
    } catch (e) { console.warn('[Supabase] saveNewsSettings:', e); }
  }
  showNotification('Новость сохранена!');
}
function previewNews() { saveNewsSettings(); exitAdmin(); }
function resetNews() {
  var n = SiteState.get('news') || {}; n.enabled = false; SiteState.set('news', n);
  loadNewsSettings();
  if (typeof updateNewsBanner === 'function') updateNewsBanner();
}

// ═══════════════════════════════════════════════════════════════════
// ВРАЧИ — редактирование на отдельной странице
// ═══════════════════════════════════════════════════════════════════
function showDoctorForm() { openDoctorEditor(null); }

function editDoctor(id) { openDoctorEditor(id); }

function openDoctorEditor(id) {
  _editingDoctorId = id;
  _doctorPhotoData = null;
  var d = id ? ((SiteState.get('doctors')||{})[id]||{}) : {};
  if (d.photo) _doctorPhotoData = d.photo;
  var eduVal = (d.edu||[]).map(e => e.name + ' — ' + e.year).join('\n');
  var title  = id ? 'Редактировать: ' + (d.name||'') : 'Добавить врача';
  var photoPreviewHtml = d.photo
    ? `<img src="${Utils.escapeHtml(d.photo)}" id="docPhotoPreview" style="width:120px;height:120px;border-radius:50%;object-fit:cover;object-position:top;display:block">`
    : `<div id="docPhotoPreview" style="width:120px;height:120px;border-radius:50%;background:var(--c-bg2);display:flex;align-items:center;justify-content:center;color:var(--c-text3)"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`;

  var html = `
    <div class="admin-field" style="display:flex;flex-direction:column;align-items:flex-start;gap:12px">
      <label>Фото врача</label>
      <div style="position:relative">
        ${photoPreviewHtml}
        <button type="button" onclick="document.getElementById('_docPhotoInput').click()" style="position:absolute;bottom:0;right:0;width:32px;height:32px;border-radius:50%;border:none;background:var(--c-accent);color:#fff;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center">+</button>
      </div>
      <input type="file" id="_docPhotoInput" accept="image/*" style="display:none" onchange="handleDoctorPhotoInSubpage(event)">
    </div>
    <div class="admin-field"><label>ФИО *</label><input type="text" id="_docName" value="${Utils.escapeHtml(d.name||'')}"></div>
    <div class="admin-field"><label>Специализация *</label><input type="text" id="_docSpec" value="${Utils.escapeHtml(d.spec||'')}"></div>
    <div class="admin-field"><label>Опыт</label><input type="text" id="_docExp" value="${Utils.escapeHtml(d.exp||'')}" placeholder="10 лет опыта"></div>
    <div class="admin-field"><label>О враче</label><textarea id="_docAbout" rows="3">${Utils.escapeHtml(d.about||'')}</textarea></div>
    <div class="admin-field"><label>Образование (каждый на новой строке: Название — Год)</label><textarea id="_docEdu" rows="4">${Utils.escapeHtml(eduVal)}</textarea></div>
    <div class="admin-field"><label>Курсы/сертификаты (каждый на новой строке)</label><textarea id="_docCourses" rows="3">${Utils.escapeHtml((d.courses||[]).join('\n'))}</textarea></div>
    <div class="admin-field"><label>Услуги (каждая на новой строке)</label><textarea id="_docServices" rows="3">${Utils.escapeHtml((d.services||[]).join('\n'))}</textarea></div>
    <div style="display:flex;gap:12px;padding-top:8px">
      <button class="admin-btn" onclick="saveDoctorFromSubpage()">Сохранить</button>
      <button class="admin-btn admin-btn-secondary" onclick="closeAdminSubpage();loadExistingDoctors()">Отмена</button>
    </div>`;
  openAdminSubpage(title, html);
}

window.handleDoctorPhotoInSubpage = function(event) {
  var file = event.target.files[0]; if (!file) return;
  event.target.value = '';
  var reader = new FileReader();
  reader.onload = function(e) {
    Utils.compressImage(e.target.result, 300).then(data => {
      _doctorPhotoData = data;
      var prev = document.getElementById('docPhotoPreview');
      if (prev) { prev.src = data; prev.tagName !== 'IMG' && (prev.outerHTML = `<img id="docPhotoPreview" src="${data}" style="width:120px;height:120px;border-radius:50%;object-fit:cover;object-position:top;display:block">`); }
    });
  };
  reader.readAsDataURL(file);
};

async function saveDoctorFromSubpage() {
  var name = (_getVal('_docName')), spec = (_getVal('_docSpec'));
  if (!name || !spec) { alert('Заполните ФИО и специализацию'); return; }
  var eduRaw = _getVal('_docEdu');
  var edu = eduRaw.split('\n').filter(Boolean).map(line => {
    var parts = line.split('—').map(s => s.trim());
    return { name:parts[0]||'', year:parts[1]||'' };
  });
  var id = _editingDoctorId || Utils.generateId('doc');
  var data = {
    name:name, spec:spec, exp:_getVal('_docExp'), about:_getVal('_docAbout'), edu:edu,
    courses:_getVal('_docCourses').split('\n').filter(Boolean),
    services:_getVal('_docServices').split('\n').filter(Boolean),
    photo:_doctorPhotoData
  };
  try {
    if (typeof SupabaseDB !== 'undefined') {
      var saved = await SupabaseDB.saveDoctor(id, data);
      // Обновляем локальный SiteState с нормализованными полями
      ListManager.saveItem('doctors', id, { ...data, photo: saved.photo || data.photo });
    } else {
      ListManager.saveItem('doctors', id, data);
    }
    closeAdminSubpage();
    loadExistingDoctors(); renderSite();
    showNotification('Врач сохранён!');
  } catch (e) {
    showNotification('Ошибка сохранения: ' + e.message);
  }
}

async function deleteDoctor(id) {
  if (!confirm('Удалить врача?')) return;
  try {
    if (typeof SupabaseDB !== 'undefined') await SupabaseDB.deleteDoctor(id);
    ListManager.deleteItem('doctors', id);
    loadExistingDoctors(); renderSite();
    showNotification('Врач удалён');
  } catch (e) { showNotification('Ошибка: ' + e.message); }
}

function loadExistingDoctors() {
  var el = document.getElementById('doctorsList'); if (!el) return;
  var doctors = SiteState.get('doctors') || {};
  var keys = Object.keys(doctors);
  if (!keys.length) { el.innerHTML = '<p style="color:var(--c-text3);font-size:14px">Врачи ещё не добавлены</p>'; return; }
  el.innerHTML = keys.map(id => {
    var d = doctors[id];
    var photo = d.photo
      ? `<img src="${Utils.escapeHtml(d.photo)}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;object-position:top;flex-shrink:0">`
      : `<div style="width:48px;height:48px;border-radius:50%;background:var(--c-bg2);flex-shrink:0;display:flex;align-items:center;justify-content:center;color:var(--c-text3);font-size:20px;font-weight:600">${(d.name||'').charAt(0).toUpperCase()}</div>`;
    return `<div class="admin-list-item"><div class="admin-list-item-info" style="display:flex;align-items:center;gap:12px">${photo}<div><div class="admin-list-item-name">${Utils.escapeHtml(d.name||'')}</div><div class="admin-list-item-desc">${Utils.escapeHtml(d.spec||'')}</div></div></div>
      <div class="admin-list-actions">
        <button class="admin-icon-btn" onclick="editDoctor('${id}')" title="Редактировать"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="admin-icon-btn admin-icon-btn--danger" onclick="deleteDoctor('${id}')" title="Удалить"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
      </div></div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// ОТЗЫВЫ — редактирование на отдельной странице
// ═══════════════════════════════════════════════════════════════════
function showReviewForm() { openReviewEditor(null); }
function editReview(id) { openReviewEditor(id); }

function openReviewEditor(id) {
  _editingReviewId = id;
  var r = id ? ((SiteState.get('reviews')||{})[id]||{}) : {};
  var title = id ? 'Редактировать отзыв' : 'Добавить отзыв';
  var starsHtml = [1,2,3,4,5].map(n => `<option value="${n}" ${(r.rating||5)==n?'selected':''}>${n} ★</option>`).join('');
  var html = `
    <div class="admin-field"><label>Имя *</label><input type="text" id="_revName" value="${Utils.escapeHtml(r.name||'')}"></div>
    <div class="admin-field"><label>Текст отзыва *</label><textarea id="_revText" rows="4">${Utils.escapeHtml(r.text||'')}</textarea></div>
    <div class="admin-field"><label>Дата</label><input type="text" id="_revDate" value="${Utils.escapeHtml(r.date||'')}" placeholder="Март 2025"></div>
    <div class="admin-field"><label>Рейтинг</label><select id="_revRating">${starsHtml}</select></div>
    <div style="display:flex;gap:12px;padding-top:8px">
      <button class="admin-btn" onclick="saveReviewFromSubpage()">Сохранить</button>
      <button class="admin-btn admin-btn-secondary" onclick="closeAdminSubpage();loadExistingReviews()">Отмена</button>
    </div>`;
  openAdminSubpage(title, html);
}

async function saveReviewFromSubpage() {
  var name = _getVal('_revName'), text = _getVal('_revText');
  if (!name || !text) { alert('Заполните имя и текст отзыва'); return; }
  var id = _editingReviewId || Utils.generateId('rev');
  var data = { name:name, text:text, date:_getVal('_revDate'), rating:parseInt(_getVal('_revRating'))||5 };
  try {
    if (typeof SupabaseDB !== 'undefined') await SupabaseDB.saveReview(id, data);
    ListManager.saveItem('reviews', id, data);
    closeAdminSubpage(); loadExistingReviews(); renderSite();
    showNotification('Отзыв сохранён!');
  } catch (e) { showNotification('Ошибка: ' + e.message); }
}
async function deleteReview(id) {
  if (!confirm('Удалить отзыв?')) return;
  try {
    if (typeof SupabaseDB !== 'undefined') await SupabaseDB.deleteReview(id);
    ListManager.deleteItem('reviews', id); loadExistingReviews(); renderSite();
    showNotification('Отзыв удалён');
  } catch (e) { showNotification('Ошибка: ' + e.message); }
}
function loadExistingReviews() {
  var el = document.getElementById('reviewsList'); if (!el) return;
  var items = SiteState.get('reviews') || {};
  var keys = Object.keys(items);
  if (!keys.length) { el.innerHTML = '<p style="color:var(--c-text3);font-size:14px">Отзывы ещё не добавлены</p>'; return; }
  el.innerHTML = keys.map(id => {
    var r = items[id];
    return `<div class="admin-list-item"><div class="admin-list-item-info"><div class="admin-list-item-name">${Utils.escapeHtml(r.name||'')} ${'★'.repeat(r.rating||5)}</div><div class="admin-list-item-desc">${Utils.escapeHtml((r.text||'').substring(0,70))}…</div></div>
      <div class="admin-list-actions">
        <button class="admin-icon-btn" onclick="editReview('${id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="admin-icon-btn admin-icon-btn--danger" onclick="deleteReview('${id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
      </div></div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// БЛОГ — редактирование с Quill для excerpt (без readTime)
// ═══════════════════════════════════════════════════════════════════
function showBlogForm() { openBlogEditor(null); }
function editBlog(id) { openBlogEditor(id); }

function openBlogEditor(id) {
  _editingBlogId = id;
  _blogExcerptQuill = null;
  var b = id ? ((SiteState.get('blogs')||{})[id]||{}) : {};
  var title = id ? 'Редактировать: ' + (b.title||'') : 'Добавить статью';
  var html = `
    <div class="admin-field"><label>Заголовок *</label><input type="text" id="_blogTitle" value="${Utils.escapeHtml(b.title||'')}"></div>
    <div class="admin-field">
      <label>Краткое описание (excerpt) — форматированный текст</label>
      <div id="_blogExcerptWrap" style="border:1px solid var(--c-border);border-radius:var(--r-sm);min-height:120px;background:var(--c-bg)"></div>
      <div id="_blogExcerptEditor" style="display:none">${b.excerpt||''}</div>
    </div>
    <div class="admin-field"><label>Содержание статьи</label><textarea id="_blogContent" rows="8" placeholder="Полный текст статьи (HTML или обычный текст)">${Utils.escapeHtml(b.content||b.excerpt||'')}</textarea></div>
    <div class="admin-field"><label>Категория</label><input type="text" id="_blogCategory" value="${Utils.escapeHtml(b.category||'')}" placeholder="Гигиена / Советы / Ортодонтия…"></div>
    <div class="admin-field"><label>Дата публикации</label><input type="text" id="_blogDate" value="${Utils.escapeHtml(b.date||'')}" placeholder="10 янв 2025"></div>
    <div style="display:flex;gap:12px;padding-top:8px">
      <button class="admin-btn" onclick="saveBlogFromSubpage()">Сохранить</button>
      <button class="admin-btn admin-btn-secondary" onclick="closeAdminSubpage();loadExistingBlogs()">Отмена</button>
    </div>`;
  openAdminSubpage(title, html);
  // Инициализируем Quill для excerpt
  _initBlogExcerptQuill(b.excerpt || '');
}

function _initBlogExcerptQuill(content) {
  var wrap = document.getElementById('_blogExcerptWrap');
  if (!wrap) return;
  if (typeof Quill !== 'undefined') {
    _createBlogQuill(wrap, content);
  } else {
    if (!document.getElementById('quill-css')) {
      var link = document.createElement('link'); link.id = 'quill-css'; link.rel = 'stylesheet';
      link.href = 'https://cdn.quilljs.com/1.3.6/quill.snow.css';
      document.head.appendChild(link);
    }
    if (window._quillLoading) {
      window._quillLoadCallbacks = window._quillLoadCallbacks || [];
      window._quillLoadCallbacks.push(() => _createBlogQuill(wrap, content));
      return;
    }
    window._quillLoading = true;
    var script = document.createElement('script');
    script.src = 'https://cdn.quilljs.com/1.3.6/quill.min.js';
    script.onload = function() {
      window._quillLoading = false;
      _createBlogQuill(wrap, content);
      (window._quillLoadCallbacks||[]).forEach(cb => cb());
      window._quillLoadCallbacks = [];
    };
    document.head.appendChild(script);
  }
}

function _createBlogQuill(container, content) {
  _blogExcerptQuill = new Quill(container, {
    theme: 'snow',
    modules: { toolbar: [
      [{ 'header': [false] }],
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['clean']
    ]},
    placeholder: 'Краткое описание статьи…'
  });
  if (content && content.trim() && content !== '<p><br></p>') {
    _blogExcerptQuill.root.innerHTML = content;
  }
}

async function saveBlogFromSubpage() {
  var title = _getVal('_blogTitle');
  if (!title) { alert('Введите заголовок статьи'); return; }

  var excerpt = '';
  if (_blogExcerptQuill) {
    excerpt = _blogExcerptQuill.root.innerHTML;
    if (excerpt === '<p><br></p>' || !_blogExcerptQuill.getText().trim()) excerpt = '';
  } else {
    var excerptEl = document.getElementById('_blogExcerptEditor');
    if (excerptEl) excerpt = excerptEl.value || '';
  }

  var id = _editingBlogId || Utils.generateId('blog');
  var existing = _editingBlogId ? ((SiteState.get('blogs')||{})[_editingBlogId]||{}) : {};
  var data = {
    title:   title,
    excerpt: excerpt,
    content: _getVal('_blogContent') || excerpt,
    category: _getVal('_blogCategory'),
    date:    _getVal('_blogDate'),
    imgClass: existing.imgClass || 'bi1',
    pageId:   existing.pageId  || ''
  };
  try {
    if (typeof SupabaseDB !== 'undefined') await SupabaseDB.saveBlog(id, data);
    ListManager.saveItem('blogs', id, data);
    closeAdminSubpage(); loadExistingBlogs(); renderSite();
    showNotification('Статья сохранена!');
  } catch (e) { showNotification('Ошибка: ' + e.message); }
}

async function deleteBlog(id) {
  if (!confirm('Удалить статью?')) return;
  try {
    if (typeof SupabaseDB !== 'undefined') await SupabaseDB.deleteBlog(id);
    ListManager.deleteItem('blogs', id); loadExistingBlogs(); renderSite();
    showNotification('Статья удалена');
  } catch (e) { showNotification('Ошибка: ' + e.message); }
}

function loadExistingBlogs() {
  var el = document.getElementById('blogsList'); if (!el) return;
  var blogs = SiteState.get('blogs') || {};
  var entries = Object.entries(blogs).sort((a,b) => (b[1].date||'').localeCompare(a[1].date||''));
  if (!entries.length) { el.innerHTML = '<p style="color:var(--c-text3);font-size:14px">Статьи ещё не добавлены</p>'; return; }
  el.innerHTML = entries.map(([id,b]) => {
    var cat = b.category ? `<span style="display:inline-block;padding:2px 7px;border-radius:4px;background:var(--c-bg2);font-size:11px">${Utils.escapeHtml(b.category)}</span> ` : '';
    return `<div class="admin-list-item"><div class="admin-list-item-info"><div class="admin-list-item-name">${Utils.escapeHtml(b.title||'Без названия')}</div><div class="admin-list-item-desc">${cat}${Utils.escapeHtml(b.date||'')}</div></div>
      <div class="admin-list-actions">
        <button class="admin-icon-btn" onclick="editBlog('${id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="admin-icon-btn admin-icon-btn--danger" onclick="deleteBlog('${id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
      </div></div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// АКЦИИ — редактирование на отдельной странице
// ═══════════════════════════════════════════════════════════════════
function showPromoForm() { openPromoEditor(null); }
function editPromo(id) { openPromoEditor(id); }

function openPromoEditor(id) {
  _editingPromoId = id;
  var p = id ? ((SiteState.get('promos')||{})[id]||{}) : {};
  var title = id ? 'Редактировать акцию' : 'Добавить акцию';
  var colorOpts = ['pc1','pc2','pc3','pc4'].map(c => `<option value="${c}" ${(p.colorClass||'pc1')===c?'selected':''}>${c}</option>`).join('');
  var html = `
    <div class="admin-field"><label>Название акции *</label><input type="text" id="_promoTitle" value="${Utils.escapeHtml(p.title||'')}"></div>
    <div class="admin-field"><label>Текст</label><textarea id="_promoText" rows="3">${Utils.escapeHtml(p.text||'')}</textarea></div>
    <div class="admin-field"><label>Бейдж/метка</label><input type="text" id="_promoBadge" value="${Utils.escapeHtml(p.badge||'')}" placeholder="Всегда / До 31 декабря…"></div>
    <div class="admin-field"><label>Цвет карточки</label><select id="_promoColorClass">${colorOpts}</select></div>
    <div class="admin-field"><label>Текст кнопки</label><input type="text" id="_promoBtnText" value="${Utils.escapeHtml(p.btnText||'')}"></div>
    <div class="admin-field"><label>Действие кнопки</label><input type="text" id="_promoBtnAction" value="${Utils.escapeHtml(p.btnAction||"openLeadModal('lead')")}" placeholder="openLeadModal('lead')"></div>
    <div style="display:flex;gap:12px;padding-top:8px">
      <button class="admin-btn" onclick="savePromoFromSubpage()">Сохранить</button>
      <button class="admin-btn admin-btn-secondary" onclick="closeAdminSubpage();loadExistingPromos()">Отмена</button>
    </div>`;
  openAdminSubpage(title, html);
}

async function savePromoFromSubpage() {
  var title = _getVal('_promoTitle');
  if (!title) { alert('Введите название акции'); return; }
  var id = _editingPromoId || Utils.generateId('promo');
  var data = {
    title:title, text:_getVal('_promoText'), badge:_getVal('_promoBadge'),
    colorClass:_getVal('_promoColorClass')||'pc1', btnText:_getVal('_promoBtnText'),
    btnAction:_getVal('_promoBtnAction')||"openLeadModal('lead')"
  };
  try {
    if (typeof SupabaseDB !== 'undefined') await SupabaseDB.savePromo(id, data);
    ListManager.saveItem('promos', id, data);
    closeAdminSubpage(); loadExistingPromos(); renderSite();
    showNotification('Акция сохранена!');
  } catch (e) { showNotification('Ошибка: ' + e.message); }
}
async function deletePromo(id) {
  if (!confirm('Удалить акцию?')) return;
  try {
    if (typeof SupabaseDB !== 'undefined') await SupabaseDB.deletePromo(id);
    ListManager.deleteItem('promos', id); loadExistingPromos(); renderSite();
    showNotification('Акция удалена');
  } catch (e) { showNotification('Ошибка: ' + e.message); }
}
function loadExistingPromos() {
  var el = document.getElementById('promosList'); if (!el) return;
  var promos = SiteState.get('promos') || {};
  var keys = Object.keys(promos);
  if (!keys.length) { el.innerHTML = '<p style="color:var(--c-text3);font-size:14px">Акции ещё не добавлены</p>'; return; }
  el.innerHTML = keys.map(id => {
    var p = promos[id];
    return `<div class="admin-list-item"><div class="admin-list-item-info"><div class="admin-list-item-name">${Utils.escapeHtml(p.title||'')}</div><div class="admin-list-item-desc">${Utils.escapeHtml(p.badge||'')} — ${Utils.escapeHtml((p.text||'').substring(0,60))}…</div></div>
      <div class="admin-list-actions">
        <button class="admin-icon-btn" onclick="editPromo('${id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="admin-icon-btn admin-icon-btn--danger" onclick="deletePromo('${id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
      </div></div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// УСЛУГИ (сервисные страницы)
// ═══════════════════════════════════════════════════════════════════
var SVC_PAGE_LABELS = {
  'service-braces':'Брекеты и ортодонтия','service-karies':'Лечение кариеса',
  'service-udalenie':'Хирургия и удаление','service-protez':'Протезирование',
  'service-cleaning':'Профессиональная чистка','service-children':'Детская стоматология'
};
function loadExistingServices() { loadServicePagesList(); }
function loadServicePagesList() {
  var el = document.getElementById('servicePagesList'); if (!el) return;
  var pages = SiteState.get('svcPages') || {};
  el.innerHTML = Object.entries(SVC_PAGE_LABELS).map(([key,label]) => {
    var p = pages[key]||{};
    return `<div class="admin-list-item"><div class="admin-list-item-info"><div class="admin-list-item-name">${Utils.escapeHtml(p.title||label)}</div><div class="admin-list-item-desc">${p.prices?p.prices.length+' позиций в прайсе':'Не настроена'}</div></div>
      <div class="admin-list-actions"><button class="admin-icon-btn" onclick="editServicePage('${key}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button></div></div>`;
  }).join('');
}
function editServicePage(key) {
  var pages = SiteState.get('svcPages')||{}, p = pages[key]||{};
  var pricesText = (p.prices||[]).map(r => r.name+'|'+r.val).join('\n');
  var html = `<div class="admin-field"><label>Заголовок *</label><input type="text" id="spTitle"></div>
    <div class="admin-field"><label>Тег</label><input type="text" id="spTag"></div>
    <div class="admin-field"><label>Вводный абзац</label><textarea id="spIntro" rows="3"></textarea></div>
    <div class="admin-field"><label>Подзаголовок</label><input type="text" id="spContentHeading"></div>
    <div class="admin-field"><label>Пункты (каждый с новой строки)</label><textarea id="spItems" rows="5"></textarea></div>
    <div class="admin-field"><label>Заголовок прайса</label><input type="text" id="spPriceTitle"></div>
    <div class="admin-field"><label>Прайс (Название|цена, каждая с новой строки)</label><textarea id="spPrices" rows="5"></textarea></div>
    <div class="admin-field"><label>Текст акции</label><input type="text" id="spPromo"></div>
    <div class="admin-field"><label>Текст под кнопкой CTA</label><input type="text" id="spCtaText"></div>
    <div style="display:flex;gap:12px;padding-top:8px">
      <button class="admin-btn" onclick="saveServicePage('${key}')">Сохранить</button>
      <button class="admin-btn admin-btn-secondary" onclick="closeAdminSubpage()">Отмена</button></div>`;
  openAdminSubpage('Страница: '+(p.title||SVC_PAGE_LABELS[key]||key), html);
  var s = (id,v) => { var e=document.getElementById(id); if(e) e.value=v||''; };
  s('spTitle',p.title||''); s('spTag',p.tag||''); s('spIntro',p.intro||'');
  s('spContentHeading',p.contentHeading||''); s('spItems',(p.contentItems||[]).join('\n'));
  s('spPriceTitle',p.priceTitle||''); s('spPrices',pricesText);
  s('spPromo',p.promoText||''); s('spCtaText',p.ctaText||'');
}
async function saveServicePage(key) {
  var g = id => { var e=document.getElementById(id); return e?(e.value||'').trim():''; };
  var title = g('spTitle'); if (!title) { alert('Введите заголовок'); return; }
  var prices = g('spPrices').split('\n').filter(Boolean).map(line => {
    var parts = line.split('|'); return {name:parts[0].trim(), val:(parts.slice(1).join('|')||'').trim()};
  }).filter(r => r.name);
  var pageData = { title, tag:g('spTag'), intro:g('spIntro'),
    contentHeading:g('spContentHeading'), contentItems:g('spItems').split('\n').map(s=>s.trim()).filter(Boolean),
    priceTitle:g('spPriceTitle'), prices, promoText:g('spPromo'), ctaText:g('spCtaText') };
  try {
    if (typeof SupabaseDB !== 'undefined') await SupabaseDB.saveSvcPage(key, pageData);
    var pages = SiteState.get('svcPages')||{};
    pages[key] = { ...(pages[key]||{}), ...pageData };
    SiteState.set('svcPages', pages);
    loadServicePagesList(); closeAdminSubpage();
    showNotification('Страница сохранена!');
  } catch (e) { showNotification('Ошибка: ' + e.message); }
}

// ═══════════════════════════════════════════════════════════════════
// ВИДИМОСТЬ
// ═══════════════════════════════════════════════════════════════════
function loadSectionVisibility() {
  var vis = SiteState.get('visibility') || {};
  var s = (id, val) => { var e=document.getElementById(id); if(e) e.checked = val!==false; };
  s('toggle-services',vis.services); s('toggle-doctors',vis.doctors);
  s('toggle-before-after',vis['before-after']); s('toggle-reviews',vis.reviews);
  s('toggle-blog',vis.blog); s('toggle-promos',vis.promos);
  s('toggle-about',vis.about); s('toggle-contacts',vis.contacts);
  var newsEl = document.getElementById('toggle-news');
  if (newsEl) newsEl.checked = !!(SiteState.get('news')||{}).enabled;
}
window.toggleSection = async function(sectionId) {
  var elem = document.getElementById('toggle-'+sectionId); if (!elem) return;
  var vis = SiteState.get('visibility')||{};
  vis[sectionId] = elem.checked;
  SiteState.set('visibility', vis);
  if (typeof SupabaseDB !== 'undefined') {
    try {
      await SupabaseDB.saveSettings(SiteState.get('clinic'), SiteState.get('news'), vis);
    } catch (e) { console.warn('[Supabase] toggleSection:', e); }
  }
  if (typeof RenderManager!=='undefined'&&RenderManager.applySectionVisibility) RenderManager.applySectionVisibility();
  showNotification(elem.checked ? 'Раздел показан' : 'Раздел скрыт');
};

// ═══════════════════════════════════════════════════════════════════
// О КЛИНИКЕ
// ═══════════════════════════════════════════════════════════════════
var _aboutLicFileData = null;
var _aboutPhotos      = [null, null, null];
var _aboutQuill       = null;
var DEFAULT_TECHNOLOGIES = ['Цифровой рентген (минимум излучения)','3D компьютерная томография','Лазерное лечение','Air Flow (пескоструйная чистка)','Цифровые слепки (без силикона)','Автоклавная стерилизация'];

window.loadAboutSettings = function() {
  var s = SiteState.get('clinic') || {};
  _setVal('about_sectionTitle',    s.sectionTitle    || s.name || '');
  _setVal('about_founderQuote',    s.founderQuote    || '');
  _setVal('about_founderName',     s.founderName     || '');
  _setVal('about_founderPosition', s.founderPosition || '');
  _setVal('about_licNumber',       s.licNumber       || '');
  _aboutLicFileData = s.licFile || null; _renderLicPreview();
  _aboutPhotos = [s.photo1||null, s.photo2||null, s.photo3||null];
  [0,1,2].forEach(i => _renderAboutPhoto(i));
  _renderTechList(s.technologies&&s.technologies.length ? s.technologies : DEFAULT_TECHNOLOGIES.slice());
  _initAboutQuill(s.history || '');
};
function _initAboutQuill(content) {
  var editorDiv = document.getElementById('about_historyEditor'); if (!editorDiv) return;
  var wrapper = document.getElementById('about_quill_wrapper');
  if (wrapper) wrapper.parentNode.removeChild(wrapper);
  wrapper = document.createElement('div'); wrapper.id = 'about_quill_wrapper';
  editorDiv.parentNode.insertBefore(wrapper, editorDiv);
  var newContainer = document.createElement('div'); newContainer.id = 'about_quill_inner';
  wrapper.appendChild(newContainer); editorDiv.style.display = 'none';
  if (typeof Quill === 'undefined') {
    if (!document.getElementById('quill-css')) {
      var link = document.createElement('link'); link.id='quill-css'; link.rel='stylesheet';
      link.href='https://cdn.quilljs.com/1.3.6/quill.snow.css'; document.head.appendChild(link);
    }
    if (window._quillLoading) { window._quillLoadCallbacks=window._quillLoadCallbacks||[]; window._quillLoadCallbacks.push(()=>_createAboutQuill(newContainer,content)); return; }
    window._quillLoading = true;
    var script = document.createElement('script'); script.src='https://cdn.quilljs.com/1.3.6/quill.min.js';
    script.onload = function() { window._quillLoading=false; _createAboutQuill(newContainer,content); (window._quillLoadCallbacks||[]).forEach(cb=>cb()); window._quillLoadCallbacks=[]; };
    document.head.appendChild(script);
  } else { _createAboutQuill(newContainer, content); }
}
function _createAboutQuill(container, content) {
  _aboutQuill = new Quill(container, { theme:'snow', modules:{toolbar:[[{header:[2,3,false]}],['bold','italic','underline'],[{list:'ordered'},{list:'bullet'}],['clean']]}, placeholder:'Введите историю клиники...' });
  if (content && content.trim() && content!=='<p><br></p>') _aboutQuill.root.innerHTML = content;
}
window.saveAboutSettings = async function() {
  var history = '';
  if (_aboutQuill) { history=_aboutQuill.root.innerHTML; if (history==='<p><br></p>'||!_aboutQuill.getText().trim()) history=''; }
  var techs = [];
  document.querySelectorAll('#about_techList .about-tech-text').forEach(el => { var v=el.value.trim(); if(v) techs.push(v); });
  var clinic = { name:_getVal('about_sectionTitle'), sectionTitle:_getVal('about_sectionTitle'), history, founderQuote:_getVal('about_founderQuote'), founderName:_getVal('about_founderName'), founderPosition:_getVal('about_founderPosition'), licNumber:_getVal('about_licNumber'), licFile:_aboutLicFileData, photo1:_aboutPhotos[0], photo2:_aboutPhotos[1], photo3:_aboutPhotos[2], technologies:techs.length?techs:DEFAULT_TECHNOLOGIES.slice() };
  SiteState.set('clinic', clinic);
  if (typeof SupabaseDB !== 'undefined') {
    try {
      await SupabaseDB.saveSettings(clinic, SiteState.get('news'), SiteState.get('visibility'));
    } catch (e) { console.warn('[Supabase] saveAboutSettings:', e); }
  }
  if (typeof renderAboutPageFromData==='function') renderAboutPageFromData(clinic);
  showNotification('О клинике сохранено!');
};
window.handleAboutLicUpload = function(event) {
  var file = event.target.files[0]; if (!file) return; event.target.value='';
  var reader = new FileReader();
  reader.onload = e => { _aboutLicFileData=e.target.result; var n=document.getElementById('about_licFileName'); if(n) n.textContent=file.name; _renderLicPreview(); };
  reader.readAsDataURL(file);
};
function _renderLicPreview() {
  var wrap = document.getElementById('about_licPreview'); if (!wrap) return;
  wrap.innerHTML = _aboutLicFileData ? '<span style="font-size:12px;color:var(--c-text2)">Файл загружен</span> <button type="button" class="admin-btn admin-btn-secondary" style="font-size:11px;padding:4px 10px;margin-left:8px" onclick="clearAboutLic()">Удалить</button>' : '<span style="font-size:12px;color:var(--c-text3)">Файл не загружен</span>';
}
window.clearAboutLic = function() { _aboutLicFileData=null; var i=document.getElementById('about_licFileInput'); if(i) i.value=''; var n=document.getElementById('about_licFileName'); if(n) n.textContent=''; _renderLicPreview(); };
window.handleAboutPhoto = function(event, idx) {
  var file = event.target.files[0]; if (!file) return; event.target.value='';
  var reader = new FileReader();
  reader.onload = e => { Utils.compressImage(e.target.result,500).then(data => { _aboutPhotos[idx]=data; _renderAboutPhoto(idx); }); };
  reader.readAsDataURL(file);
};
function _renderAboutPhoto(idx) {
  var wrap = document.getElementById('about_photoWrap_'+idx); if (!wrap) return;
  var src = _aboutPhotos[idx];
  if (src) { wrap.innerHTML=`<img src="${src}" style="width:100%;height:100%;object-fit:cover;display:block"><button type="button" onclick="removeAboutPhoto(${idx})" style="position:absolute;top:4px;right:4px;width:22px;height:22px;border:none;border-radius:50%;background:rgba(0,0,0,0.6);color:#fff;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center">×</button>`; wrap.style.padding='0'; }
  else { wrap.innerHTML='Фото '+(idx+1); wrap.style.padding=''; }
}
window.removeAboutPhoto = function(idx) { _aboutPhotos[idx]=null; var i=document.getElementById('about_photoInput_'+idx); if(i) i.value=''; _renderAboutPhoto(idx); };
function _renderTechList(items) {
  var list = document.getElementById('about_techList'); if (!list) return;
  list.innerHTML = ''; items.forEach((text,i) => _addTechRow(list,text,i));
}
function _addTechRow(list, text, idx) {
  var row = document.createElement('div'); row.className='about-tech-row'; row.style.cssText='display:flex;align-items:center;gap:8px;margin-bottom:8px'; row.draggable=true; row.dataset.idx=idx;
  row.innerHTML='<span style="cursor:grab;color:var(--c-text3);font-size:18px;padding:0 4px" title="Перетащить">⠿</span><input type="text" class="about-tech-text" style="flex:1;padding:8px 10px;border:1px solid var(--c-border);border-radius:var(--r-sm);background:var(--c-bg);color:var(--c-text);font-size:13px" placeholder="Название технологии" value=""><button type="button" onclick="removeTechRow(this)" style="width:30px;height:30px;border:none;border-radius:6px;background:var(--c-bg2);color:var(--c-text2);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">×</button>';
  row.querySelector('.about-tech-text').value = text;
  row.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain',row.dataset.idx); row.style.opacity='0.4'; });
  row.addEventListener('dragend',   () => { row.style.opacity='1'; });
  row.addEventListener('dragover',  e => { e.preventDefault(); row.style.background='var(--c-accent-bg)'; });
  row.addEventListener('dragleave', () => { row.style.background=''; });
  row.addEventListener('drop', e => { e.preventDefault(); row.style.background=''; var from=parseInt(e.dataTransfer.getData('text/plain')),to=parseInt(row.dataset.idx); if(from===to)return; var rows=Array.from(list.querySelectorAll('.about-tech-row')),fromEl=rows[from],toEl=rows[to]; if(from<to)list.insertBefore(fromEl,toEl.nextSibling);else list.insertBefore(fromEl,toEl); Array.from(list.querySelectorAll('.about-tech-row')).forEach((r,i)=>r.dataset.idx=i); });
  list.appendChild(row);
}
window.aboutAddTech = function() { var l=document.getElementById('about_techList'); if(!l)return; var idx=l.querySelectorAll('.about-tech-row').length; _addTechRow(l,'',idx); var rows=l.querySelectorAll('.about-tech-text'); if(rows.length) rows[rows.length-1].focus(); };
window.removeTechRow = function(btn) { var row=btn.closest('.about-tech-row'); if(!row)return; row.remove(); var l=document.getElementById('about_techList'); if(l) Array.from(l.querySelectorAll('.about-tech-row')).forEach((r,i)=>r.dataset.idx=i); };

// ═══════════════════════════════════════════════════════════════════
// СТАТИСТИКА И СБРОС
// ═══════════════════════════════════════════════════════════════════
function updateAdminStats() {
  var s = (id,v) => { var e=document.getElementById(id); if(e) e.textContent=v; };
  s('doctorsCount',  Object.keys(SiteState.get('doctors') ||{}).length);
  s('servicesCount', Object.keys(SiteState.get('services')||{}).length);
  s('reviewsCount',  Object.keys(SiteState.get('reviews') ||{}).length);
  s('blogsCount',    Object.keys(SiteState.get('blogs')   ||{}).length);
  s('promosCount',   Object.keys(SiteState.get('promos')  ||{}).length);
  try {
    var total = 0;
    for (var i=0;i<localStorage.length;i++) { var k=localStorage.key(i),v=localStorage.getItem(k); if(v) total+=v.length; }
    var pct = Math.min(100,Math.round(total/(5*1024*1024)*100));
    var bar=document.getElementById('storageBar'), used=document.getElementById('storageUsed');
    if (bar) bar.style.width=pct+'%';
    if (used) used.textContent=Math.round(total/1024)+' KB из ~5 MB ('+pct+'%)';
  } catch(e) {}
}
function resetAllData() {
  if (!confirm('Вы уверены? Все данные будут сброшены к демо-версии.')) return;
  if (!confirm('Последнее предупреждение!')) return;
  SiteState.reset();
  if (typeof RenderManager!=='undefined'&&RenderManager.renderAll) RenderManager.renderAll();
  if (typeof updateNewsBanner==='function') updateNewsBanner();
  initAdminPage();
  showNotification('Данные сброшены к демо-версии');
}

// ── openDocModal патч ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  var _origDocModal = window.openDocModal;
  window.openDocModal = function(key) {
    var doctors = (typeof SiteState!=='undefined')?(SiteState.get('doctors')||{}):{};
    var d = doctors[key];
    if (!d && typeof DOCTORS!=='undefined') d = DOCTORS[key];
    if (!d) { if (typeof _origDocModal==='function') _origDocModal(key); return; }
    var dmPhoto = document.getElementById('dm-photo');
    if (dmPhoto) {
      dmPhoto.innerHTML = (typeof Utils !== 'undefined')
        ? Utils.renderDoctorPhoto(d.photo, d.name, 'width:100%;height:100%;object-fit:cover;object-position:top;border-radius:inherit')
        : (d.photo ? `<img src="${encodeURI(d.photo)}" style="width:100%;height:100%;object-fit:cover;object-position:top;border-radius:inherit"/>` : '');
    }
    var _t = (id,v) => { var e=document.getElementById(id); if(e) e.textContent=v||''; };
    _t('dm-name',d.name); _t('dm-spec',d.spec); _t('dm-exp',d.exp); _t('dm-about',d.about);
    var eduEl=document.getElementById('dm-edu');
    if (eduEl) eduEl.innerHTML=(d.edu||[]).map(e=>`<div class="dm-edu-item"><div class="dm-edu-name">${Utils.escapeHtml(e.name||'')}</div><div class="dm-edu-year">${Utils.escapeHtml(e.year||'')}</div></div>`).join('');
    var crsEl=document.getElementById('dm-courses');
    if (crsEl) crsEl.innerHTML=(d.courses||[]).map(c=>`<li>${Utils.escapeHtml(c)}</li>`).join('');
    var svcEl=document.getElementById('dm-services');
    if (svcEl) svcEl.innerHTML=(d.services||[]).map(s=>`<span class="dm-service">${Utils.escapeHtml(s)}</span>`).join('');
    var modal=document.getElementById('docModal');
    if (modal) { modal.classList.add('open'); document.body.style.overflow='hidden'; }
  };
});

function saveSettings() { showNotification('Настройки сохранены'); }
