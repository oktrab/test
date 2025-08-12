// Konfiguracja bazy i logo
const DB_URL = 'kluby.json';
const LOGO_PATH = 'herby';
const PLACEHOLDER_SVG = 'data:image/svg+xml;utf8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">
    <rect width="100%" height="100%" rx="12" ry="12" fill="#e5e7eb"/>
    <text x="50%" y="54%" text-anchor="middle" font-family="Inter, Arial" font-size="18" fill="#475569">LOGO</text>
  </svg>`);

// Startowa tabelka (12 rzędów)
let teams = [
  { name: "Zamieć Bór",          pts: 0 },
  { name: "Żółci Przennów",      pts: 0 },
  { name: "Biali Tatarów",       pts: 0 },
  { name: "Brzozy Mały Baczów",  pts: 0 },
  { name: "Czarni Baczów",       pts: 0 },
  { name: "Dąbniarka Vista",     pts: 0 },
  { name: "Garbarnia Baczów",    pts: 0 },
  { name: "Olimpia Aavekaupunki",pts: 0 },
  { name: "Byki Tatarów",        pts: 0 },
  { name: "Partizana Czarnolas", pts: 0 },
  { name: "Poseidon Kings",      pts: 0 },
  { name: "ZAM Trub",            pts: 0 }
];
const defaultTeams = JSON.parse(JSON.stringify(teams));

// Stan UI
let dbTeams = [];        // {name, tags?[]} z kluby.json
let dbFiltered = [];
let dbSelectedIdx = -1;
let selectedRowIndex = -1;
let dragIndex = -1;      // dla DnD
const tagFilter = new Set(); // '⚽' / '🏀'

// Elementy DOM
const rowsEl = document.getElementById('rows');
const inPromotion = document.getElementById('inPromotion');
const inReleg = document.getElementById('inReleg');

const dbSearchEl = document.getElementById('dbSearch');
const dbListEl = document.getElementById('dbList');
const btnDbAdd = document.getElementById('btnDbAdd');
const btnDbReplace = document.getElementById('btnDbReplace');

// Utils
function buildLogoUrl(name){
  const file = encodeURIComponent(name.trim());
  return `${LOGO_PATH}/${file}.png`;
}
function setAutoLogo(img, team){
  img.onerror = () => { img.onerror = null; img.src = PLACEHOLDER_SVG; };
  img.src = buildLogoUrl(team.name);
}
function classForIndex(idx){
  const promo = Math.max(0, +inPromotion.value|0);
  const releg = Math.max(0, +inReleg.value|0);
  if (idx === 0) return 'first';
  if (idx === 1 && promo >= 2) return 'second';
  if (idx === 2 && promo >= 3) return 'third';
  if (idx >= teams.length - releg) return 'releg';
  return '';
}
function placeCaretAtEnd(el){
  const range = document.createRange();
  const sel = window.getSelection();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}
function setSelectedRow(i){
  selectedRowIndex = i;
  document.querySelectorAll('#rows .row-item').forEach((el, idx)=>{
    el.classList.toggle('selected', idx === i);
  });
  updateDbButtons();
}
function findTeamIndexByName(name){
  const n = name.trim().toLowerCase();
  return teams.findIndex(t => t.name.trim().toLowerCase() === n);
}
function stripAccents(s){
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}
function abbr(name){
  const parts = name.trim().split(/\s+/);
  return parts.map(p => p[0]).join('').slice(0,3).toUpperCase();
}
function colorFor(name){
  let h = 0; for (const ch of name) h = (h*31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 70% 45%)`;
}

/* ---------- Drag & Drop (uchwyt = kolumna Poz.) ---------- */
function clearDropHints(){
  document.querySelectorAll('.row-item.drop-top, .row-item.drop-bottom')
    .forEach(el => { el.classList.remove('drop-top','drop-bottom'); });
}
function moveItem(arr, from, to){
  if (from === to) return;
  const item = arr.splice(from, 1)[0];
  if (to > from) to -= 1;
  arr.splice(to, 0, item);
}

/* ---------- Render tabeli ---------- */
function render(){
  rowsEl.innerHTML = '';
  teams.forEach((t, i) => {
    const row = document.createElement('div');
    row.className = `row-item ${classForIndex(i)} ${i===selectedRowIndex ? 'selected' : ''}`;
    row.innerHTML = `
      <div class="pos" title="Przeciągnij, aby zmienić kolejność">${i+1}</div>
      <div class="team">
        <img class="logo" alt="">
        <div class="name" contenteditable="true" spellcheck="false">${t.name}</div>
        <div class="row-actions" aria-hidden="true">
          <button class="icon-btn" data-act="up"    title="Wyżej">↑</button>
          <button class="icon-btn" data-act="down"  title="Niżej">↓</button>
          <button class="icon-btn" data-act="del"   title="Usuń">✕</button>
        </div>
      </div>
      <div class="points"><span class="pts" contenteditable="true">${t.pts}</span></div>
    `;

    // wybór wiersza (nie koliduje z edycją)
    row.addEventListener('mousedown', (ev)=>{
      if (ev.target.closest('.name, .pts, .icon-btn')) return;
      setSelectedRow(i);
    });

    // logo
    const img = row.querySelector('img.logo');
    setAutoLogo(img, t);

    // edycja nazwy
    const nameEl = row.querySelector('.name');
    nameEl.addEventListener('input', e=>{
      teams[i].name = e.currentTarget.textContent.trim();
      setAutoLogo(img, teams[i]);
    });

    // edycja punktów
    const ptsEl = row.querySelector('.pts');
    ptsEl.addEventListener('focus', e=>{
      const txt = e.currentTarget.textContent.trim();
      if (txt === '0') e.currentTarget.textContent = '';
      placeCaretAtEnd(e.currentTarget);
    });
    ptsEl.addEventListener('input', e=>{
      const v = e.currentTarget.textContent.replace(/[^\d-]/g,'');
      e.currentTarget.textContent = v;
      teams[i].pts = Number(v || 0);
      placeCaretAtEnd(e.currentTarget);
    });
    ptsEl.addEventListener('blur', e=>{
      let v = e.currentTarget.textContent.replace(/[^\d-]/g,'');
      if (v === '') v = '0';
      e.currentTarget.textContent = v;
      teams[i].pts = Number(v);
    });

    // przyciski akcji
    row.querySelectorAll('.row-actions .icon-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const act = btn.dataset.act;
        if (act === 'up' && i>0){ const tmp=teams[i-1]; teams[i-1]=teams[i]; teams[i]=tmp; render(); }
        if (act === 'down' && i<teams.length-1){ const tmp=teams[i+1]; teams[i+1]=teams[i]; teams[i]=tmp; render(); }
        if (act === 'del'){ teams.splice(i,1); if (selectedRowIndex===i) selectedRowIndex=-1; render(); }
        updateDbButtons();
      });
    });

    // Drag handle = kolumna Poz.
    const handle = row.querySelector('.pos');
    handle.setAttribute('draggable','true');
    handle.addEventListener('dragstart', (e)=>{
      dragIndex = i;
      handle.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try{ e.dataTransfer.setData('text/plain', String(i)); }catch(_){}
    });
    handle.addEventListener('dragend', ()=>{
      handle.classList.remove('dragging');
      clearDropHints();
      dragIndex = -1;
    });

    // Drop targets = każdy wiersz
    row.addEventListener('dragover', (e)=>{
      if (dragIndex === -1) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      clearDropHints();
      const r = row.getBoundingClientRect();
      const before = e.clientY < r.top + r.height/2;
      row.classList.add(before ? 'drop-top' : 'drop-bottom');
    });
    row.addEventListener('dragleave', clearDropHints);
    row.addEventListener('drop', (e)=>{
      if (dragIndex === -1) return;
      e.preventDefault();
      const r = row.getBoundingClientRect();
      const before = e.clientY < r.top + r.height/2;
      let to = i + (before ? 0 : 1);
      moveItem(teams, dragIndex, to);
      clearDropHints();
      dragIndex = -1;
      render();
    });

    rowsEl.appendChild(row);
  });

  // 12 wierszy bez scrolla; >12 przewijanie
  rowsEl.classList.toggle('scroll', teams.length > 12);
  updateDbButtons();
}

/* ---------- Panel – stany przycisków ---------- */
function updateDbButtons(){
  const hasDbSel = dbSelectedIdx !== -1 && dbFiltered[dbSelectedIdx];
  const selectedName = hasDbSel ? dbFiltered[dbSelectedIdx].name : null;
  const existsIdx = hasDbSel ? findTeamIndexByName(selectedName) : -1;

  btnDbAdd.disabled = !hasDbSel || existsIdx !== -1;
  btnDbAdd.title = (existsIdx !== -1) ? 'Ta drużyna już jest w tabeli' : '';

  const replacingConflict = hasDbSel && selectedRowIndex !== -1 && (existsIdx !== -1 && existsIdx !== selectedRowIndex);
  btnDbReplace.disabled = !(hasDbSel && selectedRowIndex !== -1) || replacingConflict;
  btnDbReplace.title = replacingConflict ? 'Ta drużyna już jest w tabeli' : '';
}

/* ---------- Baza klubów – kafelki z tagami + filtr ---------- */
function getEmotesFromTags(raw){
  let arr = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === 'string') arr = raw.split(/[,;\s]+/);
  else if (raw && typeof raw.tag === 'string') arr = [raw.tag];
  return arr
    .map(x => (x || '').toString().trim())
    .filter(Boolean)
    .map(x => {
      const lx = x.toLowerCase();
      if (x === '⚽' || lx === 'pilka' || lx === 'piłka' || lx === 'soccer' || lx === 'football') return '⚽';
      if (x === '🏀' || lx === 'kosz' || lx === 'basket' || lx === 'basketball') return '🏀';
      return null;
    })
    .filter(Boolean);
}
function renderDbList(){
  const q = stripAccents(dbSearchEl.value.trim());
  dbFiltered = dbTeams
    .filter(t => !q || stripAccents(t.name).includes(q))
    .filter(t => {
      if (tagFilter.size === 0) return true;
      const emotes = getEmotesFromTags(t.tags);
      return emotes.some(e => tagFilter.has(e));
    })
    .slice(0, 200);

  dbListEl.innerHTML = '';
  dbFiltered.forEach((t, idx) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'db-item' + (idx===dbSelectedIdx ? ' selected' : '');
    item.style.setProperty('--clr', colorFor(t.name));

    const badge = document.createElement('span');
    badge.className = 'db-badge';
    badge.textContent = abbr(t.name);

    const label = document.createElement('span');
    label.className = 'db-name';
    label.textContent = t.name;

    const tags = document.createElement('span');
    tags.className = 'db-tags';
    const emotes = getEmotesFromTags(t.tags);
    if (emotes.length){
      tags.textContent = emotes.join(' ');
      tags.title = 'Dyscypliny: ' + emotes.join(' ');
    }

    item.appendChild(badge);
    item.appendChild(label);
    item.appendChild(tags);

    item.addEventListener('click', ()=>{
      dbSelectedIdx = idx;
      renderDbList();
      updateDbButtons();
    });
    dbListEl.appendChild(item);
  });
  updateDbButtons();
}

// Filtr tagów – UI
document.querySelectorAll('#tagFilter .tag-pill').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const tag = btn.dataset.tag;
    if (tag === '__clear'){
      tagFilter.clear();
      document.querySelectorAll('#tagFilter .tag-pill').forEach(b=>b.classList.remove('active'));
    } else {
      if (tagFilter.has(tag)){ tagFilter.delete(tag); btn.classList.remove('active'); }
      else { tagFilter.add(tag); btn.classList.add('active'); }
    }
    renderDbList();
  });
});

/* ---------- Ładowanie bazy z JSON ---------- */
async function loadDb(){
  try{
    const res = await fetch(DB_URL, { cache: 'no-store' });
    const arr = await res.json();
    dbTeams = (Array.isArray(arr) ? arr : []).map(x => {
      if (typeof x === 'string') return { name: x, tags: [] };
      return { name: x?.name || '', tags: x?.tags ?? x?.tag ?? [] };
    }).filter(t => t.name);
  }catch(e){
    // fallback – bez tagów
    const base = defaultTeams.map(t => ({ name: t.name, tags: [] }));
    const extras = [
      "Areniscas Cadin","Górskie Piaskówki","Groklin Cedynia","Jeziorak Tar",
      "Osiris Tatarów","Przenni Między Polanie","Twierdza Aleksandria",
      "Union Zephyr","WKS Nowy Bór","Lokomotiv Królewiec"
    ].map(name => ({ name, tags: [] }));
    dbTeams = base.concat(extras);
  }
  renderDbList();
}

/* ---------- Eksport JPG 1920x1080 ---------- */
function waitForImages(node){
  const imgs = Array.from(node.querySelectorAll('img'));
  return Promise.all(imgs.map(img => new Promise(res=>{
    if (img.complete && img.naturalWidth > 0) return res();
    img.addEventListener('load', res, {once:true});
    img.addEventListener('error', res, {once:true});
  })));
}
document.getElementById('btnExport').addEventListener('click', async ()=>{
  const node = document.getElementById('stage');
  node.classList.add('exporting');
  await waitForImages(node);
  await new Promise(r => requestAnimationFrame(r));
  try{
    const dataUrl = await htmlToImage.toJpeg(node, {
      quality: 0.95,
      backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg') || '#f2f6fb',
      width: 1920, height: 1080, pixelRatio: 1,
      preferCSSPageSize: true, cacheBust: true,
      imagePlaceholder: PLACEHOLDER_SVG
    });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `tabela_${new Date().toISOString().slice(0,10)}.jpg`;
    a.click();
  }catch(err){
    console.error(err);
    alert('Jeśli w JPG nie ma herbów, uruchom stronę przez serwer HTTP (np. python -m http.server).');
  }finally{
    node.classList.remove('exporting');
  }
});

/* ---------- Panel: przyciski ---------- */
document.getElementById('btnAdd').addEventListener('click', ()=>{
  teams.push({ name: "Nowa drużyna", pts: 0 });
  render();
});
document.getElementById('btnReset').addEventListener('click', ()=>{
  teams = JSON.parse(JSON.stringify(defaultTeams));
  selectedRowIndex = -1;
  render();
});
inPromotion.addEventListener('change', render);
inReleg.addEventListener('change', render);

/* ---------- Baza klubów – akcje ---------- */
dbSearchEl.addEventListener('input', renderDbList);
btnDbAdd.addEventListener('click', ()=>{
  const chosen = dbFiltered[dbSelectedIdx];
  if (!chosen) return;
  if (findTeamIndexByName(chosen.name) !== -1){
    alert('Ta drużyna już jest w tabeli.');
    return;
  }
  teams.push({ name: chosen.name, pts: 0 });
  render();
});
btnDbReplace.addEventListener('click', ()=>{
  const chosen = dbFiltered[dbSelectedIdx];
  if (selectedRowIndex === -1 || !chosen) return;
  const existsIdx = findTeamIndexByName(chosen.name);
  if (existsIdx !== -1 && existsIdx !== selectedRowIndex){
    alert('Ta drużyna już jest w tabeli.');
    return;
  }
  teams[selectedRowIndex] = { name: chosen.name, pts: teams[selectedRowIndex].pts || 0 };
  render();
});

/* ---------- Start ---------- */
render();
loadDb();