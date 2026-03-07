// liga/app.js v10 — z obsługą stage-fit
/* ═══════════════════ CONFIG ═══════════════════ */
const DB_URL = '../kluby.json';
const LOGO_PATH = '../herby';
const COUNTRY_NAMES = { SZ: 'Szwajcaria', W: 'Wosterg', I: 'Inne kraje' };
const VALID_COUNTRIES = ['SZ', 'W', 'I'];
const MAX_DB_VISIBLE = 200;
const SCROLL_THRESHOLD = 12;
const MAX_TEAMS = 64;
const AC_LIMIT = 8;
const AC_HIDE_MS = 120;
const SAVE_DELAY = 500;
const PLACEHOLDER_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">'
  + '<rect width="100%" height="100%" rx="12" ry="12" fill="#e5e7eb"/>'
  + '<text x="50%" y="54%" text-anchor="middle" font-family="Inter,Arial" font-size="18" fill="#475569">LOGO</text></svg>'
);

const EMBEDDED_DB = [
  { name:'Areniscas Cadin',       tags:['⚽','🏀'], country:'W' },
  { name:'Brzozy Mały Baczów',    tags:['⚽','🏀'], country:'SZ' },
  { name:'Garbarnia Baczów',      tags:['⚽','🏀'], country:'SZ' },
  { name:'Osiris Tatarów',        tags:['⚽','🏀'], country:'SZ' },
  { name:'Poseidon Kings',        tags:['⚽','🏀'], country:'SZ' },
  { name:'ZAM Trub',              tags:['⚽','🏀'], country:'SZ' },
  { name:'Zamieć Bór',            tags:['⚽','🏀'], country:'SZ' },
  { name:'Byki Tatarów',          tags:['⚽','🏀'], country:'SZ' },
  { name:'Biali Tatarów',         tags:['⚽'],      country:'SZ' },
  { name:'Czarni Baczów',         tags:['⚽'],      country:'SZ' },
  { name:'Dąbniarka Vista',       tags:['⚽'],      country:'SZ' },
  { name:'Górskie Piaskówki',     tags:['⚽'],      country:'W' },
  { name:'Lokomotiv Królewiec',   tags:['⚽'],      country:'SZ' },
  { name:'Olimpia Aavekaupunki',  tags:['⚽'],      country:'SZ' },
  { name:'Partizana Czarnolas',   tags:['⚽'],      country:'SZ' },
  { name:'Przenni Między Polanie',tags:['⚽'],      country:'W' },
  { name:'Twierdza Aleksandria',  tags:['⚽'],      country:'I', countryName:'Aleksandria' },
  { name:'Union Zephyr',          tags:['⚽'],      country:'I', countryName:'Zephyria' },
  { name:'WKS Nowy Bór',          tags:['⚽'],      country:'W' },
  { name:'Żółci Przennów',        tags:['⚽'],      country:'SZ' },
  { name:'Groklin Cedynia',       tags:['🏀'],      country:'SZ' },
  { name:'Jeziorak Tar',          tags:['🏀'],      country:'SZ' }
];

let teams = [
  { name:'Zamieć Bór',pts:0 },       { name:'Żółci Przennów',pts:0 },
  { name:'Biali Tatarów',pts:0 },     { name:'Brzozy Mały Baczów',pts:0 },
  { name:'Czarni Baczów',pts:0 },     { name:'Dąbniarka Vista',pts:0 },
  { name:'Garbarnia Baczów',pts:0 },  { name:'Olimpia Aavekaupunki',pts:0 },
  { name:'Byki Tatarów',pts:0 },      { name:'Partizana Czarnolas',pts:0 },
  { name:'Poseidon Kings',pts:0 },    { name:'ZAM Trub',pts:0 }
];
const defaultTeams = JSON.parse(JSON.stringify(teams));

let dbTeams = [], dbFiltered = [];
let dbSelectedIdx = -1, selectedRowIndex = -1;
let rowsSortable = null, selectedTag = null, selectedCountry = null;
let sortMode = 'none', lastTeamCount = teams.length;

const $ = id => document.getElementById(id);
const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

const rowsEl       = $('rows');
const inPodium     = $('inPodium');
const inPlayoff    = $('inPlayoff');
const inReleg      = $('inReleg');
const dbSearchEl   = $('dbSearch');
const dbListEl     = $('dbList');
const btnDbAdd     = $('btnDbAdd');
const btnDbReplace = $('btnDbReplace');
const btnSortPts   = $('btnSortPts');
const stageEl      = $('stage');
const titleEl      = $('leagueTitle');
const secSettings  = $('secSettings');
const secDb        = $('secDb');
const helpBox      = $('helpBox');

const profileNameEl   = $('profileName');
const profileSelectEl = $('profileSelect');
const btnProfileSave  = $('btnProfileSave');
const btnProfileLoad  = $('btnProfileLoad');
const btnProfileDel   = $('btnProfileDelete');

const edNameEl        = $('edName');
const edCountryEl     = $('edCountry');
const edCountryNameEl = $('edCountryName');
const edTagFootBtn    = $('edTagFoot');
const edTagBasketBtn  = $('edTagBasket');
const btnEdSave       = $('btnEdSave');
const btnEdDelete     = $('btnEdDelete');
const btnEdClear      = $('btnEdClear');

const ONE_DAY = 24 * 60 * 60 * 1000;
const THIRTY_DAYS = 30 * ONE_DAY;
const LS_KEYS = {
  state: 'liga_state_v1',
  dbOverride: 'db_override_v1',
  panels: 'ui_panels_v1',
  profiles: 'liga_profiles_v1'
};

const storage = {
  set(k, data, ttl) {
    try { localStorage.setItem(k, JSON.stringify({ ts: Date.now(), ttl: ttl ?? null, data })); }
    catch (e) {}
  },
  get(k) {
    try {
      const o = JSON.parse(localStorage.getItem(k));
      if (!o) return null;
      if (o.ttl && Date.now() - o.ts > o.ttl) { localStorage.removeItem(k); return null; }
      return o.data;
    } catch (e) { return null; }
  },
  clear(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

const buildLogoUrl = name =>
  LOGO_PATH + '/' + encodeURIComponent(String(name || '').trim()) + '.png';

const setAutoLogo = (img, t) => {
  img.onerror = () => { img.onerror = null; img.src = PLACEHOLDER_SVG; };
  img.src = buildLogoUrl(t.name);
};

const normalizeName = s => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

const isNameTaken = (name, except) =>
  teams.some((t, i) => i !== except && normalizeName(t.name) === normalizeName(name) && name.trim());

const stripAccents = s =>
  String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const abbr = name =>
  String(name || '').trim().split(/\s+/).map(p => p[0]).join('').slice(0, 3).toUpperCase();

const colorFor = name => {
  let h = 0;
  const s = String(name || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h} 70% 45%)`;
};

const uid = (p = 'user') =>
  p + ':' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function debounce(fn, ms) {
  let t;
  return function () { clearTimeout(t); t = setTimeout(fn, ms); };
}

const getCountryCode = t => {
  const c = String((t && (t.country || t.c)) || 'SZ').toUpperCase();
  return VALID_COUNTRIES.includes(c) ? c : 'SZ';
};

const getCountryTitle = t => {
  const cc = getCountryCode(t);
  const base = COUNTRY_NAMES[cc] || cc;
  return cc === 'I' && t && t.countryName ? base + ': ' + t.countryName : base;
};

function getEmotesFromTags(raw) {
  let arr = Array.isArray(raw) ? raw
    : typeof raw === 'string' ? raw.split(/[,;\s]+/)
    : raw && typeof raw.tag === 'string' ? [raw.tag] : [];
  return arr.map(x => {
    const lx = String(x || '').trim().toLowerCase();
    if (x === '⚽' || /^(piłka|pilka|soccer|football)$/.test(lx)) return '⚽';
    if (x === '🏀' || /^(kosz|basket|basketball)$/.test(lx)) return '🏀';
    return null;
  }).filter(Boolean);
}

function tagRank(t) {
  const e = getEmotesFromTags(t.tags);
  if (e.includes('⚽') && e.includes('🏀')) return 2;
  if (e.includes('⚽')) return 1;
  if (e.includes('🏀')) return 0;
  return -1;
}

function normalizeDbArray(rawArr) {
  return (Array.isArray(rawArr) ? rawArr : []).map(x => {
    if (typeof x === 'string') return { name: x, tags: [], country: 'SZ', countryName: '' };
    const cc = (() => {
      const c = String((x && (x.country || x.c)) || 'SZ').toUpperCase();
      return VALID_COUNTRIES.includes(c) ? c : 'SZ';
    })();
    return {
      name: (x && x.name) || '',
      tags: (x && (x.tags ?? (x.tag != null ? [x.tag] : []))) || [],
      country: cc,
      countryName: (x && (x.countryName || x.cn)) || ''
    };
  }).filter(t => t.name);
}

function effectiveSettings() {
  const n = teams.length;
  let podium = Math.min(3, Math.max(1, +inPodium.value | 0));
  let playoff = Math.max(0, +inPlayoff.value | 0);
  let releg = Math.max(0, +inReleg.value | 0);
  const space = Math.max(0, n - podium);
  playoff = Math.min(playoff, space);
  releg = Math.min(releg, space);
  if (playoff + releg > space) {
    releg = Math.max(0, Math.min(releg, space - playoff));
    if (playoff + releg > space) playoff = Math.max(0, space - releg);
  }
  return { podium, playoff, releg, space, n };
}

const slotsInfoEl = (() => {
  const el = document.createElement('div');
  el.id = 'slotsInfo';
  el.className = 'note';
  const panel = document.querySelector('.panel');
  const sep = panel && panel.querySelector('.sep');
  if (panel) { sep ? panel.insertBefore(el, sep) : panel.appendChild(el); }
  return el;
})();

function updateSlotsInfoUI() {
  const eff = effectiveSettings();
  const neutral = Math.max(0, eff.space - eff.playoff - eff.releg);
  if (slotsInfoEl) {
    slotsInfoEl.textContent =
      `Podium: ${eff.podium} • Baraże: ${eff.playoff} • Spadki: ${eff.releg} • Neutralne: ${neutral} (z ${eff.n})`;
  }
}

function classForIndex(i) {
  const { podium, playoff, releg, n } = effectiveSettings();
  if (i === 0) return 'first';
  if (i === 1 && podium >= 2) return 'second';
  if (i === 2 && podium >= 3) return 'third';
  const startPlayoff = Math.min(podium, 3);
  if (playoff > 0 && i >= startPlayoff && i < startPlayoff + playoff) return 'playoff';
  if (releg > 0 && i >= n - releg) return 'releg';
  return '';
}

function coerceSettings(trigger = 'auto', silent = false) {
  const n = teams.length;
  let podium = Math.max(1, Math.min(Math.min(3, n), +inPodium.value | 0));
  inPodium.value = podium;

  let playoff = Math.max(0, +inPlayoff.value | 0);
  let releg = Math.max(0, +inReleg.value | 0);
  const space = Math.max(0, n - podium);
  playoff = Math.min(playoff, space);
  releg = Math.min(releg, space);

  if (playoff + releg > space) {
    if (trigger === 'playoff') releg = Math.max(0, space - playoff);
    else if (trigger === 'releg') playoff = Math.max(0, space - releg);
    else {
      releg = Math.max(0, Math.min(releg, space - playoff));
      if (playoff + releg > space) playoff = Math.max(0, space - releg);
    }
  }

  inPlayoff.value = playoff;
  inReleg.value = releg;
  inPodium.max = Math.min(3, n);
  inPlayoff.max = space;
  inReleg.max = space;

  if (!silent) render();
  updateSlotsInfoUI();
}

let saveTimer = null;

function saveState() {
  storage.set(LS_KEYS.state, {
    teams: teams.map(t => ({ name: t.name, pts: +t.pts || 0 })),
    settings: { podium: +inPodium.value | 0, playoff: +inPlayoff.value | 0, releg: +inReleg.value | 0 },
    title: titleEl ? String(titleEl.textContent || '').trim() : 'Tabela ligowa'
  }, ONE_DAY);
}

function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveState, SAVE_DELAY); }

function loadSavedState() {
  const s = storage.get(LS_KEYS.state);
  if (!s) return false;
  if (Array.isArray(s.teams)) {
    teams = s.teams.map(x => ({ name: String(x.name || ''), pts: Number(x.pts || 0) }));
  }
  if (s.settings) {
    if (s.settings.podium != null) inPodium.value = s.settings.podium;
    if (s.settings.playoff != null) inPlayoff.value = s.settings.playoff;
    if (s.settings.releg != null) inReleg.value = s.settings.releg;
  }
  if (titleEl && s.title) titleEl.textContent = s.title;
  lastTeamCount = teams.length;
  return true;
}

function initDnD() {
  if (rowsSortable && rowsSortable.destroy) rowsSortable.destroy();
  rowsSortable = new Sortable(rowsEl, {
    animation: 150, handle: '.pos', draggable: '.row-item',
    ghostClass: 'drag-ghost', chosenClass: 'drag-chosen',
    onEnd(e) {
      if (e.oldIndex === e.newIndex || e.oldIndex == null) return;
      const it = teams.splice(e.oldIndex, 1)[0];
      teams.splice(e.newIndex, 0, it);
      if (selectedRowIndex === e.oldIndex) selectedRowIndex = e.newIndex;
      else if (selectedRowIndex !== -1) {
        if (e.oldIndex < selectedRowIndex && e.newIndex >= selectedRowIndex) selectedRowIndex--;
        else if (e.oldIndex > selectedRowIndex && e.newIndex <= selectedRowIndex) selectedRowIndex++;
      }
      render();
      scheduleSave();
    }
  });
}

function suggestions(q, except = -1) {
  q = stripAccents(String(q || '').trim());
  if (!q) return [];
  const used = new Set(teams.map((t, i) => i === except ? 'SELF' : normalizeName(t.name)));
  return dbTeams
    .filter(t => t && t.name && stripAccents(t.name).includes(q) && !used.has(normalizeName(t.name)))
    .sort((a, b) => {
      const as = stripAccents(a.name).startsWith(q) ? 0 : 1;
      const bs = stripAccents(b.name).startsWith(q) ? 0 : 1;
      return as - bs || a.name.localeCompare(b.name, 'pl');
    })
    .slice(0, AC_LIMIT);
}

function makeACBox(container) {
  const box = document.createElement('div');
  box.className = 'ac';
  container.appendChild(box);
  return box;
}

function renderAC(box, items, onPick) {
  if (!items.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
  box.innerHTML = '';
  items.forEach((t, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ac-item' + (i === 0 ? ' selected' : '');
    b.dataset.idx = i;
    const em = (getEmotesFromTags(t.tags) || []).join(' ');
    b.innerHTML =
      `<span class="ac-badge" style="--badge:${colorFor(t.name)}">${abbr(t.name)}</span>`
      + `<span class="ac-text">${t.name}</span>`
      + `<span class="ac-tags">${em}</span>`;
    b.addEventListener('mousedown', e => { e.preventDefault(); onPick(t); });
    box.appendChild(b);
  });
  box.style.display = 'block';
}

function moveACSelection(box, dir) {
  const items = $$('.ac-item', box);
  if (!items.length) return;
  let i = items.findIndex(el => el.classList.contains('selected'));
  i = (i + dir + items.length) % items.length;
  items.forEach(el => el.classList.remove('selected'));
  items[i].classList.add('selected');
}

function getACSelected(box, data) {
  const sel = box.querySelector('.ac-item.selected');
  return sel ? data[+sel.dataset.idx || 0] || null : null;
}

function attachNameHandlers(row, t, i) {
  const nameEl = row.querySelector('.name');
  const img = row.querySelector('img.logo');
  const wrap = row.querySelector('.team');
  let prevName = t.name;
  const acBox = makeACBox(wrap);
  let acData = [];

  const accept = item => {
    if (!item) return;
    nameEl.textContent = item.name;
    teams[i].name = item.name;
    setAutoLogo(img, teams[i]);
    acBox.style.display = 'none';
    renderDbList();
    setTimeout(() => nameEl.blur(), 0);
    scheduleSave();
  };

  const showAC = () => {
    acData = suggestions(nameEl.textContent, i);
    renderAC(acBox, acData, accept);
  };

  nameEl.addEventListener('focus', () => { prevName = teams[i].name; showAC(); });
  nameEl.addEventListener('input', () => {
    teams[i].name = nameEl.textContent.trim();
    setAutoLogo(img, teams[i]);
    showAC();
  });
  nameEl.addEventListener('keydown', e => {
    if (acBox.style.display !== 'block') return;
    if (e.key === 'ArrowDown')  { e.preventDefault(); moveACSelection(acBox, +1); }
    else if (e.key === 'ArrowUp')    { e.preventDefault(); moveACSelection(acBox, -1); }
    else if (e.key === 'Enter')      { e.preventDefault(); accept(getACSelected(acBox, acData)); }
    else if (e.key === 'Escape')     { e.preventDefault(); acBox.style.display = 'none'; }
  });
  nameEl.addEventListener('blur', () => {
    setTimeout(() => { acBox.style.display = 'none'; }, AC_HIDE_MS);
    const nn = nameEl.textContent.trim();
    if (!nn || isNameTaken(nn, i)) {
      nameEl.classList.add('name-dup');
      setTimeout(() => nameEl.classList.remove('name-dup'), 800);
      teams[i].name = prevName;
      nameEl.textContent = prevName;
      setAutoLogo(img, teams[i]);
    } else {
      teams[i].name = nn;
    }
    renderDbList();
    scheduleSave();
  });
}

function attachPtsHandlers(row, t, i) {
  const pts = row.querySelector('.pts');
  const ptsCell = row.querySelector('.points');

  ptsCell.addEventListener('mousedown', e => {
    if (e.target !== pts) { e.preventDefault(); e.stopPropagation(); pts.focus(); }
  });
  pts.addEventListener('mousedown', e => e.stopPropagation());
  pts.addEventListener('focus', e => {
    const r = document.createRange(), s = window.getSelection();
    r.selectNodeContents(e.currentTarget);
    s.removeAllRanges();
    s.addRange(r);
  });
  pts.addEventListener('beforeinput', e => {
    if (e.inputType === 'insertText') {
      if (!/\d/.test(e.data || '')) e.preventDefault();
    } else if (e.inputType === 'insertFromPaste') {
      e.preventDefault();
      const text = (e.clipboardData && e.clipboardData.getData('text')) || '';
      const clean = (text.match(/-?\d+/) || [''])[0];
      document.execCommand('insertText', false, clean);
    }
  });
  pts.addEventListener('input', e => {
    const v = (e.currentTarget.textContent.match(/-?\d+/) || [''])[0];
    teams[i].pts = Number(v || 0);
  });
  pts.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); pts.blur(); } });
  pts.addEventListener('blur', e => {
    const v = (e.currentTarget.textContent.match(/-?\d+/) || ['0'])[0];
    e.currentTarget.textContent = v;
    teams[i].pts = Number(v);
    scheduleSave();
  });
}

function attachActionHandlers(row, i) {
  $$('.row-actions .icon-btn', row).forEach(btn => {
    btn.addEventListener('click', () => {
      const a = btn.dataset.act;
      if (a === 'up' && i > 0) {
        [teams[i - 1], teams[i]] = [teams[i], teams[i - 1]];
      } else if (a === 'down' && i < teams.length - 1) {
        [teams[i + 1], teams[i]] = [teams[i], teams[i + 1]];
      } else if (a === 'del') {
        teams.splice(i, 1);
        if (selectedRowIndex === i) selectedRowIndex = -1;
      }
      lastTeamCount = teams.length;
      render();
      scheduleSave();
      updateDbButtons();
    });
  });
}

function render() {
  if (teams.length !== lastTeamCount) {
    lastTeamCount = teams.length;
    coerceSettings('auto', true);
  }

  rowsEl.innerHTML = '';
  teams.forEach((t, i) => {
    const row = document.createElement('div');
    row.className = 'row-item ' + classForIndex(i) + (i === selectedRowIndex ? ' selected' : '');
    row.innerHTML =
      `<div class="pos" title="Przeciągnij, aby zmienić kolejność">${i + 1}</div>`
      + '<div class="team">'
      +   '<img class="logo" alt="">'
      +   `<div class="name" contenteditable="true" spellcheck="false">${t.name}</div>`
      +   '<div class="row-actions">'
      +     '<button class="icon-btn" data-act="up">↑</button>'
      +     '<button class="icon-btn" data-act="down">↓</button>'
      +     '<button class="icon-btn" data-act="del">✕</button>'
      +   '</div>'
      + '</div>'
      + '<div class="points">'
      +   `<span class="pts" contenteditable="true" spellcheck="false">${t.pts}</span>`
      + '</div>';

    setAutoLogo(row.querySelector('img.logo'), t);
    attachNameHandlers(row, t, i);
    attachPtsHandlers(row, t, i);
    attachActionHandlers(row, i);

    row.addEventListener('mousedown', ev => {
      if (ev.target.closest('.name,.pts,.icon-btn')) return;
      selectedRowIndex = i;
      $$('#rows .row-item').forEach((el, idx) => el.classList.toggle('selected', idx === i));
      updateDbButtons();
    });

    rowsEl.appendChild(row);
  });

  rowsEl.classList.toggle('scroll', teams.length > SCROLL_THRESHOLD);
  initDnD();
  updateDbButtons();
  requestAnimationFrame(() => { renderDbList(); updateSlotsInfoUI(); });
}

function updateDbButtons() {
  const has = dbSelectedIdx !== -1 && dbFiltered[dbSelectedIdx];
  const selName = has ? dbFiltered[dbSelectedIdx].name : null;
  const existsIdx = has ? teams.findIndex(t => normalizeName(t.name) === normalizeName(selName)) : -1;

  btnDbAdd.disabled = !has || existsIdx !== -1;
  btnDbAdd.title = existsIdx !== -1 ? 'Ta drużyna już jest w tabeli' : '';

  const conflict = has && selectedRowIndex !== -1 && existsIdx !== -1 && existsIdx !== selectedRowIndex;
  btnDbReplace.disabled = !(has && selectedRowIndex !== -1) || conflict;
  btnDbReplace.title = conflict ? 'Ta drużyna już jest w tabeli.' : '';
}

function sortDbByTags(list) {
  return list.slice().sort((a, b) => tagRank(b) - tagRank(a) || a.name.localeCompare(b.name, 'pl'));
}

function renderDbList() {
  const prevSel = dbFiltered[dbSelectedIdx]?.name || null;
  const q = stripAccents(String(dbSearchEl.value || '').trim());

  dbFiltered = sortDbByTags(dbTeams).filter(t => {
    if (q && !stripAccents(t.name).includes(q)) return false;
    if (selectedTag && !getEmotesFromTags(t.tags).includes(selectedTag)) return false;
    if (selectedCountry && getCountryCode(t) !== selectedCountry) return false;
    return true;
  });

  dbSelectedIdx = prevSel ? dbFiltered.findIndex(t => t.name === prevSel) : -1;
  dbListEl.innerHTML = '';

  dbFiltered.slice(0, MAX_DB_VISIBLE).forEach((t, idx) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'db-item' + (idx === dbSelectedIdx ? ' selected' : '');
    item.style.setProperty('--badge', colorFor(t.name));

    const cc = getCountryCode(t);
    const disabled = teams.some(x => normalizeName(x.name) === normalizeName(t.name));
    item.setAttribute('aria-disabled', disabled);
    item.draggable = !disabled;

    item.innerHTML =
      `<span class="db-badge">${abbr(t.name)}</span>`
      + `<span class="db-name">${t.name}</span>`
      + `<span class="db-country" data-cc="${cc}" title="${getCountryTitle(t)}">${cc}</span>`;

    item.addEventListener('click', () => { dbSelectedIdx = idx; renderDbList(); updateDbButtons(); });
    item.addEventListener('dragstart', e => {
      if (disabled) { e.preventDefault(); return; }
      e.dataTransfer.setData('text/club', t.name);
      e.dataTransfer.setData('application/x-club', t.name);
      e.dataTransfer.setData('text/plain', t.name);
      e.dataTransfer.effectAllowed = 'copy';
    });

    dbListEl.appendChild(item);
  });
  updateDbButtons();
}

function setupPills(containerSel, pillSel, getter, setter) {
  const update = () => {
    $$(pillSel).forEach(b => {
      const v = b.dataset.tag || b.dataset.country;
      if (v === '__clear') b.classList.remove('active');
      else b.classList.toggle('active', getter() === v);
    });
  };
  $$(pillSel).forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.tag || btn.dataset.country;
      setter(v === '__clear' ? null : (getter() === v ? null : v));
      update();
      renderDbList();
    });
  });
  update();
}

setupPills('#tagFilter', '#tagFilter .tag-pill',
  () => selectedTag, v => { selectedTag = v; });

setupPills('#countryFilter', '#countryFilter .country-pill',
  () => selectedCountry, v => { selectedCountry = v; });

function isClubDrag(dt) {
  const types = dt && dt.types ? Array.from(dt.types) : [];
  return types.includes('text/club') || types.includes('application/x-club');
}

function getClubName(dt) {
  return dt.getData('text/club') || dt.getData('application/x-club') || '';
}

rowsEl.addEventListener('dragover', e => {
  if (!isClubDrag(e.dataTransfer)) return;
  e.preventDefault();
  $$('.row-item.db-over').forEach(el => el.classList.remove('db-over'));
  const row = e.target.closest('.row-item');
  if (row) row.classList.add('db-over');
});
rowsEl.addEventListener('dragleave', () => {
  $$('.row-item.db-over').forEach(el => el.classList.remove('db-over'));
});
rowsEl.addEventListener('drop', e => {
  $$('.row-item.db-over').forEach(el => el.classList.remove('db-over'));
  if (!isClubDrag(e.dataTransfer)) return;
  e.preventDefault();
  const name = getClubName(e.dataTransfer);
  const row = e.target.closest('.row-item');
  if (!name || !row) return;
  const idx = Array.from(rowsEl.children).indexOf(row);
  if (idx < 0) return;
  const exist = teams.findIndex(x => normalizeName(x.name) === normalizeName(name));
  if (exist !== -1 && exist !== idx) return;
  if (normalizeName(teams[idx].name) === normalizeName(name)) return;
  teams[idx].name = name;
  lastTeamCount = teams.length;
  render();
  scheduleSave();
});

if (stageEl) {
  stageEl.addEventListener('dragover', e => {
    if (!isClubDrag(e.dataTransfer) || e.target.closest('.row-item')) return;
    e.preventDefault();
  });
  stageEl.addEventListener('drop', e => {
    if (!isClubDrag(e.dataTransfer) || e.target.closest('.row-item')) return;
    e.preventDefault();
    const name = getClubName(e.dataTransfer);
    if (!name || teams.some(t => normalizeName(t.name) === normalizeName(name))) return;
    teams.push({ name, pts: 0 });
    lastTeamCount = teams.length;
    coerceSettings('auto');
    scheduleSave();
  });
}

btnSortPts.addEventListener('click', () => {
  if (sortMode === 'none' || sortMode === 'asc') {
    sortMode = 'desc';
    teams.sort((a, b) => b.pts - a.pts);
    btnSortPts.textContent = '↓';
  } else {
    sortMode = 'asc';
    teams.sort((a, b) => a.pts - b.pts);
    btnSortPts.textContent = '↑';
  }
  render();
  scheduleSave();
});

function tryInlineDb() {
  const el = $('dbInline');
  if (!el) return null;
  try { return normalizeDbArray(JSON.parse(el.textContent || '')); }
  catch (e) { return null; }
}

function useDb(arr) {
  dbTeams = normalizeDbArray(arr);
  dbTeams.sort((a, b) => tagRank(b) - tagRank(a) || a.name.localeCompare(b.name, 'pl'));
}

async function loadDb() {
  const box = $('dbError');
  const show = msg => { if (box) { box.style.display = 'block'; box.textContent = msg; } };
  const hide = () => { if (box) { box.style.display = 'none'; box.textContent = ''; } };

  try {
    const ov = storage.get(LS_KEYS.dbOverride);
    if (Array.isArray(ov) && ov.length) {
      useDb(ov);
      show('Używam wczytanej/edytowanej bazy (lokalnie, wygaśnie po 24h).');
      renderDbList();
      return;
    }

    const inline = tryInlineDb();
    if (Array.isArray(inline) && inline.length) {
      useDb(inline); hide(); renderDbList(); return;
    }

    if (location.protocol !== 'file:') {
      const res = await fetch(DB_URL + '?cb=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const arr = await res.json();
      if (Array.isArray(arr) && arr.length) { useDb(arr); hide(); renderDbList(); return; }
      show('Pusta baza z serwera – używam bazy wbudowanej.');
    } else {
      show('Środowisko file:// – używam bazy wbudowanej.');
    }
    useDb(EMBEDDED_DB);
  } catch (e) {
    show('Błąd: ' + (e.message || 'nieznany') + ' – używam bazy wbudowanej.');
    useDb(EMBEDDED_DB);
  }
  renderDbList();
}

const btnLoadDb = $('btnLoadDb');
const fileDbEl = $('fileDb');
const btnDownloadDb = $('btnDownloadDb');

if (btnLoadDb && fileDbEl) {
  btnLoadDb.addEventListener('click', () => fileDbEl.click());
  fileDbEl.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const arr = JSON.parse(await file.text());
      const norm = normalizeDbArray(arr);
      if (!norm.length) throw new Error('Plik nie zawiera klubów.');
      dbTeams = norm;
      storage.set(LS_KEYS.dbOverride, dbTeams, ONE_DAY);
      renderDbList();
      const box = $('dbError');
      if (box) { box.style.display = 'block'; box.textContent = 'Załadowano własną bazę (24h).'; }
    } catch (err) {
      alert('Nie udało się wczytać: ' + (err.message || err));
    } finally { fileDbEl.value = ''; }
  });
}

if (btnDownloadDb) {
  btnDownloadDb.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(dbTeams, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kluby.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

let editorIndex = -1;

function getEditorTags() {
  const out = [];
  if (edTagFootBtn?.classList.contains('active')) out.push('⚽');
  if (edTagBasketBtn?.classList.contains('active')) out.push('🏀');
  return out;
}

function setEditorTags(tags) {
  edTagFootBtn?.classList.toggle('active', (tags || []).includes('⚽'));
  edTagBasketBtn?.classList.toggle('active', (tags || []).includes('🏀'));
}

function updateEditorSaveBtn() {
  const hasName = edNameEl && String(edNameEl.value || '').trim().length > 0;
  if (btnEdSave) btnEdSave.disabled = !(hasName && getEditorTags().length > 0);
}

function clearEditor() {
  editorIndex = -1;
  if (edNameEl) edNameEl.value = '';
  if (edCountryEl) edCountryEl.value = 'SZ';
  if (edCountryNameEl) edCountryNameEl.value = '';
  setEditorTags([]);
  if (btnEdDelete) btnEdDelete.disabled = true;
  updateEditorSaveBtn();
}

if (edTagFootBtn) edTagFootBtn.addEventListener('click', () => { edTagFootBtn.classList.toggle('active'); updateEditorSaveBtn(); });
if (edTagBasketBtn) edTagBasketBtn.addEventListener('click', () => { edTagBasketBtn.classList.toggle('active'); updateEditorSaveBtn(); });
if (btnEdClear) btnEdClear.addEventListener('click', clearEditor);
if (edNameEl) edNameEl.addEventListener('input', updateEditorSaveBtn);

if (btnEdDelete) {
  btnEdDelete.addEventListener('click', () => {
    if (editorIndex < 0) return;
    const name = dbTeams[editorIndex]?.name || '';
    if (!confirm('Usunąć klub: ' + name + '?')) return;
    dbTeams.splice(editorIndex, 1);
    storage.set(LS_KEYS.dbOverride, dbTeams, ONE_DAY);
    clearEditor();
    renderDbList();
  });
}

if (btnEdSave) {
  btnEdSave.addEventListener('click', () => {
    const name = (edNameEl?.value || '').trim();
    if (!name) return alert('Podaj nazwę klubu.');
    const tags = getEditorTags();
    if (!tags.length) return alert('Wybierz co najmniej jeden tag (⚽/🏀).');

    const dup = dbTeams.findIndex((t, i) => i !== editorIndex && normalizeName(t.name) === normalizeName(name));
    if (dup !== -1) return alert('Taki klub już istnieje.');

    let cc = (edCountryEl?.value || 'SZ').toUpperCase();
    cc = VALID_COUNTRIES.includes(cc) ? cc : 'SZ';
    const cn = (edCountryNameEl?.value || '').trim();
    const rec = { name, country: cc, countryName: cc === 'I' ? cn : '', tags };

    if (editorIndex >= 0) dbTeams[editorIndex] = rec;
    else { dbTeams.push(rec); editorIndex = dbTeams.length - 1; if (btnEdDelete) btnEdDelete.disabled = false; }

    storage.set(LS_KEYS.dbOverride, dbTeams, ONE_DAY);
    renderDbList();
  });
}

/* ═══════════════════ EKSPORT JPG — Z STAGE-FIT ═══════════════════ */
const waitForImages = node =>
  Promise.all($$('img', node).map(img =>
    new Promise(r => {
      if (img.complete && img.naturalWidth > 0) return r();
      img.addEventListener('load', r, { once: true });
      img.addEventListener('error', r, { once: true });
    })
  ));

$('btnExport').addEventListener('click', async () => {
  const stage = $('stage');
  stage.classList.add('exporting');

  // ✅ Wyłącz skalowanie na czas eksportu
  if (window.stageFit) window.stageFit.disable();

  await waitForImages(stage);
  await new Promise(r => requestAnimationFrame(r));
  try {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg') || '#f2f6fb';
    const url = await htmlToImage.toJpeg(stage, {
      quality: .95, backgroundColor: bg,
      width: 1920, height: 1080, pixelRatio: 1,
      cacheBust: true, imagePlaceholder: PLACEHOLDER_SVG
    });
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tabela_' + new Date().toISOString().slice(0, 10) + '.jpg';
    a.click();
  } finally {
    stage.classList.remove('exporting');
    // ✅ Przywróć skalowanie
    if (window.stageFit) window.stageFit.enable();
  }
});

$('btnExportAll').addEventListener('click', async () => {
  const stage = $('stage');
  const prevH = stage.style.height;
  const prevOv = rowsEl.style.overflow;
  const prevAuto = rowsEl.style.gridAutoRows;
  const hadScroll = rowsEl.classList.contains('scroll');

  stage.classList.add('export-all', 'exporting');
  stage.style.height = 'auto';
  rowsEl.classList.remove('scroll');
  rowsEl.style.overflow = 'visible';
  rowsEl.style.gridAutoRows = getComputedStyle(document.documentElement).getPropertyValue('--rowH') || '86px';

  // ✅ Wyłącz skalowanie
  if (window.stageFit) window.stageFit.disable();

  await waitForImages(stage);
  await new Promise(r => requestAnimationFrame(r));
  try {
    const rect = stage.getBoundingClientRect();
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg') || '#f2f6fb';
    const url = await htmlToImage.toJpeg(stage, {
      quality: .95, backgroundColor: bg,
      width: Math.round(rect.width), height: Math.round(stage.scrollHeight),
      pixelRatio: 1, cacheBust: true, imagePlaceholder: PLACEHOLDER_SVG
    });
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tabela_full_' + new Date().toISOString().slice(0, 10) + '.jpg';
    a.click();
  } finally {
    stage.classList.remove('export-all', 'exporting');
    stage.style.height = prevH || '';
    if (hadScroll) rowsEl.classList.add('scroll');
    rowsEl.style.overflow = prevOv || '';
    rowsEl.style.gridAutoRows = prevAuto || '';
    // ✅ Przywróć skalowanie
    if (window.stageFit) window.stageFit.enable();
  }
});

$('btnAdd').addEventListener('click', () => {
  teams.push({ name: 'Nowa drużyna', pts: 0 });
  lastTeamCount = teams.length;
  coerceSettings('auto');
  scheduleSave();
});

$('btnReset').addEventListener('click', () => {
  teams = JSON.parse(JSON.stringify(defaultTeams));
  selectedRowIndex = -1;
  sortMode = 'none';
  btnSortPts.textContent = '↕';
  lastTeamCount = teams.length;
  coerceSettings('auto');
  storage.clear(LS_KEYS.state);
});

['input', 'change'].forEach(evt => {
  inPodium.addEventListener(evt, () => { coerceSettings('podium'); scheduleSave(); });
  inPlayoff.addEventListener(evt, () => { coerceSettings('playoff'); scheduleSave(); });
  inReleg.addEventListener(evt, () => { coerceSettings('releg'); scheduleSave(); });
});

dbSearchEl.addEventListener('input', debounce(renderDbList, 200));

btnDbAdd.addEventListener('click', () => {
  const c = dbFiltered[dbSelectedIdx];
  if (!c) return;
  if (teams.some(t => normalizeName(t.name) === normalizeName(c.name))) {
    return alert('Ta drużyna już jest w tabeli.');
  }
  teams.push({ name: c.name, pts: 0 });
  lastTeamCount = teams.length;
  coerceSettings('auto');
  scheduleSave();
});

btnDbReplace.addEventListener('click', () => {
  const c = dbFiltered[dbSelectedIdx];
  if (selectedRowIndex === -1 || !c) return;
  const e = teams.findIndex(t => normalizeName(t.name) === normalizeName(c.name));
  if (e !== -1 && e !== selectedRowIndex) return alert('Ta drużyna już jest w tabeli.');
  teams[selectedRowIndex] = { name: c.name, pts: teams[selectedRowIndex].pts || 0 };
  coerceSettings('auto');
  scheduleSave();
});

if (titleEl) {
  let tmr = null;
  titleEl.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(saveState, 400); });
  titleEl.addEventListener('blur', saveState);
}

// ✅ NAPRAWIONE SKRÓTY KLAWISZOWE
document.addEventListener('keydown', e => {
  const ae = document.activeElement;
  if (ae && (ae.isContentEditable || /^(input|textarea|select)$/i.test(ae.tagName))) return;

  const key = e.key;

  if (e.ctrlKey && key?.toLowerCase?.() === 's') {
    e.preventDefault();
    $('btnExport')?.click();
    return;
  }
  if (e.ctrlKey && key?.toLowerCase?.() === 'f') {
    e.preventDefault();
    dbSearchEl?.focus();
    return;
  }

  // Alt+Arrow NAJPIERW
  if ((e.altKey || e.metaKey) && key === 'ArrowUp' && selectedRowIndex > 0) {
    e.preventDefault();
    const i = selectedRowIndex;
    [teams[i - 1], teams[i]] = [teams[i], teams[i - 1]];
    selectedRowIndex = i - 1;
    render();
    scheduleSave();
    return;
  }
  if ((e.altKey || e.metaKey) && key === 'ArrowDown' && selectedRowIndex < teams.length - 1) {
    e.preventDefault();
    const j = selectedRowIndex;
    [teams[j + 1], teams[j]] = [teams[j], teams[j + 1]];
    selectedRowIndex = j + 1;
    render();
    scheduleSave();
    return;
  }

  if (key === 'ArrowDown') {
    e.preventDefault();
    if (selectedRowIndex < teams.length - 1) {
      selectedRowIndex = selectedRowIndex < 0 ? 0 : selectedRowIndex + 1;
      render();
    }
    return;
  }
  if (key === 'ArrowUp') {
    e.preventDefault();
    if (selectedRowIndex > 0) { selectedRowIndex--; render(); }
    return;
  }

  if (key === 'Delete' && selectedRowIndex !== -1) {
    teams.splice(selectedRowIndex, 1);
    if (selectedRowIndex >= teams.length) selectedRowIndex = teams.length - 1;
    lastTeamCount = teams.length;
    render();
    scheduleSave();
    return;
  }

  if (key === 'Enter' && selectedRowIndex !== -1) {
    e.preventDefault();
    const row = rowsEl.children[selectedRowIndex];
    row?.querySelector('.pts')?.focus();
  }
});

function initPanelsState() {
  const panels = [
    ['secSettings', secSettings],
    ['secDb', secDb],
    ['helpBox', helpBox]
  ];
  const saved = storage.get(LS_KEYS.panels) || {};

  panels.forEach(([key, el]) => {
    if (!el) return;
    if (typeof saved[key] === 'boolean') {
      saved[key] ? el.setAttribute('open', '') : el.removeAttribute('open');
    }
    el.addEventListener('toggle', () => {
      const data = storage.get(LS_KEYS.panels) || {};
      data[key] = el.hasAttribute('open');
      storage.set(LS_KEYS.panels, data, THIRTY_DAYS);
    });
  });
}

function resizeTeams(newSize) {
  newSize = Math.max(1, Math.min(MAX_TEAMS, newSize | 0));
  if (newSize === teams.length) return false;

  if (newSize > teams.length) {
    while (teams.length < newSize) {
      let base = 'Nowa drużyna', name = base, k = 1;
      while (teams.some(t => normalizeName(t.name) === normalizeName(name))) {
        k++;
        name = base + ' ' + k;
      }
      teams.push({ name, pts: 0 });
    }
    lastTeamCount = teams.length;
    return true;
  }

  const removed = teams.length - newSize;
  if (!confirm(`Zastosować rozmiar ${newSize} i usunąć ${removed} wierszy z dołu?`)) return false;
  teams.splice(newSize);
  if (selectedRowIndex >= newSize) selectedRowIndex = newSize - 1;
  lastTeamCount = teams.length;
  return true;
}

const BUILTIN_PROFILES = [
  { id: 'builtin:std12',  name: 'Domyślna 12 (3/0/2)', data: { title: 'Tabela ligowa', podium: 3, playoff: 0, releg: 2, size: 12 } },
  { id: 'builtin:liga16', name: 'Liga 16 (3/2/3)',      data: { title: 'Liga 16',       podium: 3, playoff: 2, releg: 3, size: 16 } },
  { id: 'builtin:liga10', name: 'Liga 10 (2/2/2)',      data: { title: 'Liga 10',       podium: 2, playoff: 2, releg: 2, size: 10 } }
];

const getUserProfiles = () => { const u = storage.get(LS_KEYS.profiles); return Array.isArray(u) ? u : []; };
const saveUserProfiles = list => storage.set(LS_KEYS.profiles, Array.isArray(list) ? list : [], null);

function renderProfilesUI() {
  if (!profileSelectEl) return;
  profileSelectEl.innerHTML = '';
  [...BUILTIN_PROFILES, ...getUserProfiles()].forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name + (p.id.startsWith('builtin:') ? ' (wbudowany)' : '');
    profileSelectEl.appendChild(opt);
  });
}

function applyProfile(p) {
  if (!p?.data) return;
  if (typeof p.data.size === 'number') resizeTeams(p.data.size);
  inPodium.value = p.data.podium;
  inPlayoff.value = p.data.playoff;
  inReleg.value = p.data.releg;
  if (titleEl && p.data.title) titleEl.textContent = p.data.title;
  coerceSettings('auto');
  scheduleSave();
  render();
}

if (btnProfileSave) {
  btnProfileSave.addEventListener('click', () => {
    const name = (profileNameEl?.value || '').trim()
      || ('Profil ' + new Date().toLocaleDateString('pl-PL'));
    const p = {
      id: uid('profile'), name,
      data: {
        title: (titleEl?.textContent || '').trim() || 'Tabela ligowa',
        podium: +inPodium.value | 0,
        playoff: +inPlayoff.value | 0,
        releg: +inReleg.value | 0,
        size: teams.length
      }
    };
    const user = getUserProfiles();
    user.push(p);
    saveUserProfiles(user);
    renderProfilesUI();
    const idx = Array.from(profileSelectEl.options).findIndex(o => o.value === p.id);
    if (idx >= 0) profileSelectEl.selectedIndex = idx;
  });
}

if (btnProfileLoad) {
  btnProfileLoad.addEventListener('click', () => {
    const id = profileSelectEl?.value;
    if (!id) return;
    const p = [...BUILTIN_PROFILES, ...getUserProfiles()].find(x => x.id === id);
    if (p) applyProfile(p);
  });
}

initPanelsState();
loadSavedState();
coerceSettings('auto');
loadDb();
renderProfilesUI();