'use strict';
// js/common.js — общая логика для всех страниц
'use strict';





// ── аавигация по хэшу (кнопка "аазад" и прямые ссылки) ──────────



// ── Мобильное меню ───────────────────────────────────────────────
let mobOpen = false;
function toggleMobile() {
  mobOpen = !mobOpen;
  document.getElementById('mobNav').classList.toggle('open', mobOpen);
  document.getElementById('burger').classList.toggle('open', mobOpen);
  document.body.style.overflow = mobOpen ? 'hidden' : '';
}
function closeMobile() {
  mobOpen = false;
  document.getElementById('mobNav').classList.remove('open');
  document.getElementById('burger').classList.remove('open');
  document.body.style.overflow = '';
}

// ── ткролл хедера ────────────────────────────────────────────────
window.addEventListener('scroll', () => {
  document.querySelector('.header').classList.toggle('scrolled', scrollY > 10);
}, {passive:true});

// ── Модалка (2 режима: заявка + обратный звонок) ─────────────────
function openLeadModal(mode) {
  document.getElementById('modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  document.getElementById('modal').classList.remove('open');
  document.body.style.overflow = '';
}

// Отправка заявки
function submitLead() {
  const name  = document.getElementById('lead-name').value.trim();
  const phone = document.getElementById('lead-phone').value.trim();
  if (!name || phone.length < 18) { alert('Введите имя и телефон'); return; }
  const data = {
    name,
    phone,
    service: document.getElementById('lead-service').value,
    comment: '',
    type: 'lead'
  };
  sendToAdmin(data, 'ok-lead');
}

// ── MAX (ICQ) Bot — настройки ────────────────────────────────────
const MAX_BOT_TOKEN = 'ВСТАВЬ_ТОКЕН_СЮДА';   // токен от @MetaBot
const MAX_CHAT_ID   = 'ВСТАВЬ_CHAT_ID_СЮДА'; // твой Chat ID в MAX

// сниверсальная отправка данных администратору
function sendToAdmin(data, okId) {
  const time = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
  const text = [
    '🦷 Новая заявка — Дента Смайл',
    `👤 Имя: ${data.name || '—'}`,
    `📞 Телефон: ${data.phone}`,
    `🩺 сслуга: ${data.service || '—'}`,
    `💬 Комментарий: ${data.comment || '—'}`,
    `🕐 Время: ${time} (МтК)`
  ].join('\n');

  fetch(`https://api.icq.net/bot/v1/messages/sendText?token=${MAX_BOT_TOKEN}&chatId=${MAX_CHAT_ID}&text=${encodeURIComponent(text)}`)
    .catch(() => {}); // ошибка сети — молча игнорируем, пользователь не видит

  console.log('Заявка отправлена в MAX:', data);
  const ok = document.getElementById(okId);
  if (ok) {
    ok.style.display = 'block';
    setTimeout(() => { ok.style.display = 'none'; closeModal(); }, 3500);
  }
}

// Форма записи на главной странице
function submitForm(id) {
  const name  = document.getElementById(id+'-name')?.value?.trim();
  const phone = document.getElementById(id+'-phone')?.value?.trim();
  if (!name || !phone) { alert('Введите имя и телефон'); return; }
  sendToAdmin({ name, phone, type:'main-form' }, 'ok-'+id);
}

// ── FAQ ──────────────────────────────────────────────────────────
function faqToggle(el) {
  const item = el.parentElement;
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
}

// ── тчётчики ─────────────────────────────────────────────────────
function runCounters() { /* stats are text-only now */ }

// ── Тема ─────────────────────────────────────────────────────────
let curTheme = 'light';
function setTheme(t) {
  curTheme = t;
  document.documentElement.setAttribute('data-theme', t);
  ['btL','btD','btC'].forEach(id => document.getElementById(id)?.classList.remove('on'));
  const m = {light:'btL', dark:'btD', contrast:'btC'};
  document.getElementById(m[t])?.classList.add('on');
  try { localStorage.setItem('ds_theme', t); } catch(e){}
}

// ── Масштаб текста ───────────────────────────────────────────────
let curFont = 'n';
function setFont(f) {
  curFont = f;
  document.body.classList.remove('fs-lg','fs-xl');
  if (f==='l') document.body.classList.add('fs-lg');
  if (f==='x') document.body.classList.add('fs-xl');
  ['bfN','bfL','bfX'].forEach(id => document.getElementById(id)?.classList.remove('on'));
  const m = {n:'bfN', l:'bfL', x:'bfX'};
  document.getElementById(m[f])?.classList.add('on');
  try { localStorage.setItem('ds_font', f); } catch(e){}
}

// ── Панель настроек ──────────────────────────────────────────────
let a11yOpen = false;
function toggleA11y() {
  a11yOpen = !a11yOpen;
  document.getElementById('a11yPanel').classList.toggle('open', a11yOpen);
}
document.addEventListener('click', e => {
  if (!a11yOpen) return;
  const panel = document.getElementById('a11yPanel');
  if (!panel.contains(e.target) && !e.target.closest('.fab-bar'))
    { a11yOpen = false; panel.classList.remove('open'); }
});

function resetA11y() {
  setFont('n'); setTheme('light');
}

// ── Телефонная маска ─────────────────────────────────────────────
document.addEventListener('input', e => {
  if (e.target.type !== 'tel') return;
  let v = e.target.value.replace(/\D/g,'');
  if (v.startsWith('7')||v.startsWith('8')) v = v.slice(1);
  let f = '+7 ';
  if (v.length>0) f += '('+v.slice(0,3);
  if (v.length>=3) f += ') '+v.slice(3,6);
  if (v.length>=6) f += '-'+v.slice(6,8);
  if (v.length>=8) f += '-'+v.slice(8,10);
  e.target.value = f;
});

// ── База данных врачей ───────────────────────────────────────────
const DOCTORS = {
  balycheva: {
    photo: 'img/doctors/Балычева Татьяна Валентиновна.png',
    name: 'Балычева Татьяна Валентиновна',
    spec: 'Детский стоматолог',
    exp: 'Стаж 7 лет',
    about: 'Татьяна Валентиновна специализируется на лечении молочных и постоянных зубов у детей с 3 лет. смеет создать доверительную атмосферу и найти подход к самому тревожному ребёнку. Проводит профилактику кариеса, фторирование и раннюю ортодонтическую диагностику.',
    edu: [
      { name: 'Костромской государственный медицинский университет', year: 'ттоматология — 2017' },
      { name: 'Ординатура по детской стоматологии', year: '2017–2019' },
    ],
    courses: [
      'Психологические техники работы с тревожными детьми — 2020',
      'Профилактика кариеса у детей — 2021',
      'Раннее ортодонтическое вмешательство — 2023',
    ],
    services: ['Лечение молочных зубов', 'Профилактика кариеса', 'теребрение зубов', 'Фторирование', 'Консультация родителей'],
  },
  galichev: {
    photo: 'img/doctors/Галичев Дмитрий Андреевич.png',
    name: 'Галичев Дмитрий Андреевич',
    spec: 'Хирург',
    exp: 'Стаж 10 лет',
    about: 'Дмитрий Андреевич — хирург-стоматолог с большим клиническим опытом. тпециализируется на сложных удалениях зубов мудрости, лечении воспалительных заболеваний. Работает точно и деликатно — большинство пациентов отмечают минимальный дискомфорт.',
    edu: [
      { name: 'Ярославская государственная медицинская академия', year: 'ттоматология — 2014' },
      { name: 'Ординатура по хирургической стоматологии', year: '2014–2016' },
    ],
    courses: [
      'Атравматичное удаление зубов — 2019',
      'Хирургическое лечение периодонтита — 2021',
      'Имплантология: основы — 2023',
    ],
    services: ['Удаление зубов', 'Удаление зубов мудрости', 'Вскрытие абсцессов', 'Резекция верхушки корня', 'Хирургическое лечение пародонта'],
  },
  kurilova: {
    photo: 'img/doctors/Курилова Ирина Олеговна.png',
    name: 'Курилова Ирина Олеговна',
    spec: 'Ортодонт',
    exp: 'Стаж 8 лет',
    about: 'Ирина Олеговна специализируется на исправлении прикуса и выравнивании зубов у взрослых и детей. Работает с металлическими, керамическими и сапфировыми брекет-системами. Индивидуально подбирает план лечения с учётом особенностей пациента.',
    edu: [
      { name: 'аижегородская государственная медицинская академия', year: 'ттоматология — 2016' },
      { name: 'Ординатура по ортодонтии', year: '2016–2018' },
    ],
    courses: [
      'Брекет-терапия Roth — 2019',
      'Элайнеры: показания и методика — 2021',
      'Ранняя ортодонтическая коррекция у детей — 2023',
    ],
    services: ['Исправление прикуса', 'сстановка брекетов', 'Подбор элайнеров', 'сстановка ретейнеров', 'Консультация ортодонта'],
  },
  rudometkin: {
    photo: 'img/doctors/Рудометкин Олег Иванович.png',
    name: 'Рудометкин Олег Иванович',
    spec: 'Ортопед',
    exp: 'Стаж 12 лет',
    about: 'Олег Иванович занимается протезированием зубов — восстановлением утраченных и повреждённых зубов с помощью современных конструкций. Работает с металлокерамикой, оксидом циркония, изготавливает виниры. Добивается функционального и эстетического результата.',
    edu: [
      { name: 'Ярославская государственная медицинская академия', year: 'ттоматология — 2012' },
      { name: 'Ординатура по ортопедической стоматологии', year: '2012–2014' },
    ],
    courses: [
      'Цифровое протезирование CAD/CAM — 2019',
      'Виниры и эстетическая ортопедия — 2021',
      'Съёмные протезы на имплантах — 2022',
    ],
    services: ['Коронки металлокерамика', 'Циркониевые коронки', 'Виниры', 'Мостовидные протезы', 'тъёмное протезирование'],
  },
  chemodanova: {
    photo: 'img/doctors/Чемоданова Наталия Владимировна.png',
    name: 'Чемоданова ааталия Владимировна',
    spec: 'Терапевт',
    exp: 'Стаж 9 лет',
    about: 'ааталия Владимировна — терапевт широкого профиля. тпециализируется на лечении кариеса, пульпита, периодонтита и эстетической реставрации зубов. Использует современные световые композиты, добиваясь результата, неотличимого от натуральной эмали.',
    edu: [
      { name: 'Костромской государственный медицинский университет', year: 'ттоматология — 2015' },
      { name: 'Интернатура по терапевтической стоматологии', year: '2015–2016' },
    ],
    courses: [
      'Художественная реставрация зубов — 2019',
      'Эндодонтия: лечение каналов — 2020',
      'Эстетика в терапии — 2022',
    ],
    services: ['Лечение кариеса', 'Лечение пульпита', 'Художественная реставрация', 'Лечение каналов', 'Отбеливание зубов'],
  },
  korovkina: {
    photo: 'img/doctors/Коровкина Алина Сергеевна.png',
    name: 'Коровкина Алина тергеевна',
    spec: 'Гигиенист, ортодонт',
    exp: 'Стаж 6 лет',
    about: 'Алина тергеевна совмещает работу гигиениста и ортодонта. Проводит профессиональную чистку зубов, Air Flow и фторирование. Также занимается ортодонтическим лечением на начальных стадиях. сделяет особое внимание обучению пациентов правилам домашней гигиены.',
    edu: [
      { name: 'Ивановская государственная медицинская академия', year: 'ттоматология — 2018' },
    ],
    courses: [
      'Профессиональная гигиена и Air Flow — 2019',
      'Брекет-терапия: начальный уровень — 2021',
      'Отбеливание зубов (методика Beyond) — 2022',
    ],
    services: ['Профессиональная чистка', 'Air Flow', 'Ультразвуковое снятие камня', 'Фторирование', 'Отбеливание зубов'],
  },
  bolshov: {
    photo: 'img/doctors/Большов Сергей Николаевич.png',
    name: 'Большов тергей аиколаевич',
    spec: 'Ортопед',
    exp: 'Стаж 11 лет',
    about: 'тергей аиколаевич специализируется на протезировании зубов с использованием современных материалов. Восстанавливает жевательную функцию и эстетику улыбки коронками, мостами и винирами. Имеет большой опыт работы со сложными клиническими случаями.',
    edu: [
      { name: 'Костромской государственный медицинский университет', year: 'ттоматология — 2013' },
      { name: 'Ординатура по ортопедической стоматологии', year: '2013–2015' },
    ],
    courses: [
      'Металлокерамика и цирконий — 2018',
      'Эстетическое протезирование — 2020',
      'Имплантопротезирование — 2022',
    ],
    services: ['Коронки металлокерамика', 'Циркониевые коронки', 'Виниры', 'Мостовидные протезы', 'Протезирование на имплантах'],
  },
};

// Вызывается из initApp (app-core.js) после загрузки всех данных
function shuffleHomeDoctors() {
  const grid = document.getElementById('home-docs-grid');
  if (!grid) return;
  // Единый источник: SiteState (тот же, что страница "Врачи")
  const doctors = (typeof SiteState !== 'undefined') ? (SiteState.get('doctors') || {}) : {};
  const entries = Object.entries(Object.keys(doctors).length ? doctors : DOCTORS);
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }
  grid.innerHTML = entries.slice(0, 4).map(([key, d]) => {
    const photo = (typeof Utils !== 'undefined')
      ? Utils.renderDoctorPhoto(d.photo, d.name)
      : (d.photo ? `<img src="${encodeURI(d.photo)}" alt="${d.name||''}" loading="lazy" style="width:100%;height:100%;object-fit:cover;object-position:top;display:block"/>` : '');
    const expText = (d.exp || '').replace('Стаж', 'Опыт') + ((d.services||[])[0] ? ' · ' + (d.services||[])[0] : '');
    return `<div class="doc-card" onclick="openDocModal('${key}')">
      <div class="doc-photo doc-photo--img">${photo}<div class="doc-spec-badge">${d.spec || ''}</div></div>
      <div class="doc-body"><div class="doc-name">${d.name || ''}</div><div class="doc-exp">${expText}</div><button class="doc-btn" onclick="event.stopPropagation();openLeadModal('lead')">Оставить заявку</button></div>
    </div>`;
  }).join('');
}

function openDocModal(key) {
  const d = DOCTORS[key];
  if (!d) return;
  // Фото врача
  const dmPhoto = document.getElementById('dm-photo');
  if (d.photo) {
    dmPhoto.innerHTML = `<img src="${d.photo}" loading="lazy" style="width:100%;height:100%;object-fit:cover;object-position:top;border-radius:inherit"/>`;
  } else {
    dmPhoto.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M12 11v6"/><path d="M9 14h6"/></svg>';
  }
  document.getElementById('dm-name').textContent  = d.name;
  document.getElementById('dm-spec').textContent  = d.spec;
  document.getElementById('dm-exp').textContent   = d.exp;
  document.getElementById('dm-about').textContent = d.about;

  

  // Услуги
  document.getElementById('dm-services').innerHTML = d.services
    .map(s => `<span class="dm-service">${s}</span>`)
    .join('');

  document.getElementById('docModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDocModal() {
  document.getElementById('docModal').classList.remove('open');
  document.body.style.overflow = '';
}

// ESC закрывает и модал врача
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeDocModal();
});

// ── Инициализация темы и шрифта при загрузке ─────────────────────
document.addEventListener('DOMContentLoaded', function() {
  try {
    var t = localStorage.getItem('ds_theme') || 'light';
    var f = localStorage.getItem('ds_font') || 'n';
    setTheme(t); setFont(f);
  } catch(e) {}
});
