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
let dbTeams = [];          // {name, tags?[]} z kluby.json
let dbFiltered = [];
let dbSelectedIdx = -1;
let selectedRowIndex = -1;
let rowsSortable = null;   // SortableJS instancja
let selectedTag = null;    // '⚽' | '🏀' | null

// DOM
const rowsEl = document.getElementById('rows');
const inPromotion = document.getElementById('inPromotion');
const inReleg = document.getElementById('inReleg');
const dbSearchEl = document.getElementById('dbSearch');
const dbListEl = document.getElementById('dbList');
const btnDbAdd = document.getElementById('btnDbAdd');
const btnDbReplace = document.getElementById('btnDbReplace');

// Utils
function buildLogoUrl(name){ return `${LOGO_PATH}/${encodeURIComponent(name.trim())}.png`; }
function setAutoLogo(img, team){ img.onerror = () => { img.onerror = null; img.src = PLACEHOLDER_SVG; }; img.src = buildLogoUrl(team.name); }
function classForIndex(idx){
  const promo = Math.max(0, +inPromotion.value|0);
  const releg = Math.max(0, +inReleg.value|0);
  if (idx === 0) return 'first';
  if (idx === 1 && promo >= 2) return 'second';
  if (idx === 2 && promo >= 3) return 'third';
  if (idx >= teams.length - releg) return 'releg';
  return '';
}
function placeCaretAtEnd(el){ const r=document.createRange(), s=window.getSelection(); r.selectNodeContents(el); r.collapse(false); s.removeAllRanges(); s.addRange(r); }
function normalizeName(s){ return (s||'').trim().replace(/\s+/g,' ').toLowerCase(); }
function isNameTaken(name, exceptIndex=-1){ const n=normalizeName(name); return teams.some((t,i)=> i!==exceptIndex && normalizeName(t.name)===n && n!==''); }
function setSelectedRow(i){ selectedRowIndex=i; document.querySelectorAll('#rows .row-item').forEach((el,idx)=> el.classList.toggle('selected', idx===i)); updateDbButtons(); }
function findTeamIndexByName(name){ const n=normalizeName(name); return teams.findIndex(t => normalizeName(t.name)===n); }
function stripAccents(s){ return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function abbr(name){ const parts=name.trim().split(/\s+/); return parts.map(p=>p[0]).join('').slice(0,3).toUpperCase(); }
function colorFor(name){ let h=0; for(const ch of name) h=(h*31+ch.charCodeAt(0))%360; return `hsl(${h} 70% 45%)`; }

// SortableJS (drag&drop w tabeli)
function initDnD(){
  if (rowsSortable) rowsSortable.destroy();
  rowsSortable = new Sortable(rowsEl, {
    animation: 150,
    handle: '.pos',
    draggable: '.row-item',
    ghostClass: 'drag-ghost',
    chosenClass: 'drag-chosen',
    onEnd: (evt)=>{
      if (evt.oldIndex === evt.newIndex || evt.oldIndex == null || evt.newIndex == null) return;
      const item = teams.splice(evt.oldIndex, 1)[0];
      teams.splice(evt.newIndex, 0, item);
      if (selectedRowIndex === evt.oldIndex) selectedRowIndex = evt.newIndex;
      else if (selectedRowIndex !== -1){
        if (evt.oldIndex < selectedRowIndex && evt.newIndex >= selectedRowIndex) selectedRowIndex -= 1;
        else if (evt.oldIndex > selectedRowIndex && evt.newIndex <= selectedRowIndex) selectedRowIndex += 1;
      }
      render();
    }
  });
}

/* ---------- Tag helpers ---------- */
function getEmotesFromTags(raw){
  let arr=[]; if(Array.isArray(raw)) arr=raw; else if(typeof raw==='string') arr=raw.split(/[,;\s]+/); else if(raw&&typeof raw.tag==='string') arr=[raw.tag];
  return arr.map(x=>(x||'').toString().trim()).filter(Boolean).map(x=>{
    const lx=x.toLowerCase();
    if (x==='⚽'||lx==='piłka'||lx==='pilka'||lx==='soccer'||lx==='football') return '⚽';
    if (x==='🏀'||lx==='kosz'||lx==='basket'||lx==='basketball') return '🏀';
    return null;
  }).filter(Boolean);
}

/* ---------- Autocomplete ---------- */
function suggestions(query, exceptIndex=-1, limit=8){
  const q = stripAccents(query.trim());
  if (!q) return [];
  const used = new Set(teams.map((t,i)=> i===exceptIndex ? '__SELF__' : normalizeName(t.name)));
  const list = dbTeams
    .filter(t => t && t.name)
    .filter(t => stripAccents(t.name).includes(q))
    .filter(t => !used.has(normalizeName(t.name)));
  list.sort((a,b)=>{
    const an = stripAccents(a.name).startsWith(q) ? 0 : 1;
    const bn = stripAccents(b.name).startsWith(q) ? 0 : 1;
    return an - bn || a.name.localeCompare(b.name,'pl');
  });
  return list.slice(0, limit);
}
function makeACBox(container){
  const box = document.createElement('div');
  box.className = 'ac';
  container.appendChild(box);
  return box;
}
function renderAC(box, items, onPick){
  if (!items.length){ box.style.display='none'; box.innerHTML=''; return; }
  box.innerHTML = '';
  items.forEach((t, idx)=>{
    const it = document.createElement('button');
    it.type='button'; it.className='ac-item' + (idx===0 ? ' selected':''); it.dataset.idx = String(idx);
    it.innerHTML = `
      <span class="ac-badge" style="--badge:${colorFor(t.name)}">${abbr(t.name)}</span>
      <span class="ac-text">${t.name}</span>
      <span class="ac-tags">${(getEmotesFromTags(t.tags)||[]).join(' ')}</span>
    `;
    it.addEventListener('mousedown', (e)=>{ e.preventDefault(); onPick(t); });
    box.appendChild(it);
  });
  box.style.display='block';
}
function moveACSelection(box, dir){
  const items = [...box.querySelectorAll('.ac-item')];
  if (!items.length) return;
  let idx = items.findIndex(el=>el.classList.contains('selected'));
  idx = (idx + dir + items.length) % items.length;
  items.forEach(el=>el.classList.remove('selected'));
  items[idx].classList.add('selected');
}
function getACSelected(box, data){
  const sel = box.querySelector('.ac-item.selected');
  if (!sel) return null;
  const i = Number(sel.dataset.idx||0);
  return data[i] || null;
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

    // zaznaczenie
    row.addEventListener('mousedown', (ev)=>{
      if (ev.target.closest('.name, .pts, .icon-btn')) return;
      setSelectedRow(i);
    });

    // logo
    const img = row.querySelector('img.logo');
    setAutoLogo(img, t);

    // ===== Nazwa + autocomplete + blokada duplikatów =====
    const nameEl = row.querySelector('.name');
    const teamContainer = row.querySelector('.team');
    let prevName = t.name;
    const acBox = makeACBox(teamContainer);
    let acData = [];

    function acceptSuggestion(item){
      if (!item) return;
      nameEl.textContent = item.name;
      teams[i].name = item.name;
      setAutoLogo(img, teams[i]);
      acBox.style.display='none';
      setTimeout(()=> nameEl.blur(), 0);
    }
    function showAC(){
      const q = nameEl.textContent;
      acData = suggestions(q, i, 8);
      renderAC(acBox, acData, acceptSuggestion);
    }
    function hideAC(){ acBox.style.display='none'; }

    nameEl.addEventListener('focus', ()=>{
      prevName = teams[i].name;
      showAC();
    });
    nameEl.addEventListener('input', e=>{
      teams[i].name = e.currentTarget.textContent.trim();
      setAutoLogo(img, teams[i]);
      showAC();
    });
    nameEl.addEventListener('keydown', e=>{
      if (acBox.style.display==='block'){
        if (e.key==='ArrowDown'){ e.preventDefault(); moveACSelection(acBox, +1); }
        else if (e.key==='ArrowUp'){ e.preventDefault(); moveACSelection(acBox, -1); }
        else if (e.key==='Enter'){ e.preventDefault(); acceptSuggestion(getACSelected(acBox, acData)); }
        else if (e.key==='Escape'){ e.preventDefault(); hideAC(); }
      }
    });
    nameEl.addEventListener('blur', ()=>{
      setTimeout(()=> hideAC(), 120);
      const newName = nameEl.textContent.trim();
      if (!newName){
        teams[i].name = prevName;
        nameEl.textContent = prevName;
        return;
      }
      if (isNameTaken(newName, i)){
        nameEl.classList.add('name-dup');
        setTimeout(()=> nameEl.classList.remove('name-dup'), 800);
        teams[i].name = prevName;
        nameEl.textContent = prevName;
        setAutoLogo(img, teams[i]);
      }else{
        teams[i].name = newName;
      }
    });

    // ===== Punkty =====
    const ptsEl = row.querySelector('.pts');
    ptsEl.addEventListener('focus', e=>{
      if (e.currentTarget.textContent.trim() === '0') e.currentTarget.textContent = '';
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

    // akcje
    row.querySelectorAll('.row-actions .icon-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const act = btn.dataset.act;
        if (act === 'up' && i>0){ const tmp=teams[i-1]; teams[i-1]=teams[i]; teams[i]=tmp; render(); }
        if (act === 'down' && i<teams.length-1){ const tmp=teams[i+1]; teams[i+1]=teams[i]; teams[i]=tmp; render(); }
        if (act === 'del'){ teams.splice(i,1); if (selectedRowIndex===i) selectedRowIndex=-1; render(); }
        updateDbButtons();
      });
    });

    rowsEl.appendChild(row);
  });

  // 12 bez scrolla; >12 przewijanie
  rowsEl.classList.toggle('scroll', teams.length > 12);

  // DnD kolejności
  initDnD();
  updateDbButtons();
}

/* ---------- Panel – stany przycisków ---------- */
function updateDbButtons(){
  const hasDbSel = dbSelectedIdx !== -1 && dbFiltered[dbSelectedIdx];
  const selectedName = hasDbSel ? dbFiltered[dbSelectedIdx].name : null;
  const existsIdx = hasDbSel ? findTeamIndexByName(selectedName) : -1;

  btnDbAdd.disabled = !hasDbSel || existsIdx !== -1;
  btnDbAdd.title = (existsIdx !== -1) ? 'Ta drużyna już jest w tabeli' : '';

  const conflict = hasDbSel && selectedRowIndex !== -1 && (existsIdx !== -1 && existsIdx !== selectedRowIndex);
  btnDbReplace.disabled = !(hasDbSel && selectedRowIndex !== -1) || conflict;
  btnDbReplace.title = conflict ? 'Ta drużyna już jest w tabeli.' : '';
}

/* ---------- Baza klubów – kafelki + tagi + filtr (single-select) ---------- */
function renderDbList(){
  const q = stripAccents(dbSearchEl.value.trim());
  dbFiltered = dbTeams
    .filter(t => !q || stripAccents(t.name).includes(q))
    .filter(t => {
      if (!selectedTag) return true;
      const emotes = getEmotesFromTags(t.tags);
      return emotes.includes(selectedTag);
    })
    .slice(0, 200);

  dbListEl.innerHTML = '';
  dbFiltered.forEach((t, idx) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'db-item' + (idx===dbSelectedIdx ? ' selected' : '');
    item.style.setProperty('--badge', colorFor(t.name));

    const badge = document.createElement('span');
    badge.className = 'db-badge';
    badge.textContent = abbr(t.name);

    const label = document.createElement('span');
    label.className = 'db-name';
    label.textContent = t.name;

    const tags = document.createElement('span');
    tags.className = 'db-tags';
    const emotes = getEmotesFromTags(t.tags);
    if (emotes.length){ tags.textContent = emotes.join(' '); tags.title = 'Dyscypliny: ' + emotes.join(' '); }

    // Zablokuj drag, jeśli klub już jest w tabeli
    const existsIdx = findTeamIndexByName(t.name);
    const disabled = existsIdx !== -1;
    item.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    item.draggable = !disabled;

    // Zaznaczanie
    item.addEventListener('click', ()=>{
      dbSelectedIdx = idx;
      renderDbList();
      updateDbButtons();
    });

    // Drag&Drop z bazy na tabelę (podmiana wiersza)
    item.addEventListener('dragstart', (e)=>{
      if (disabled){ e.preventDefault(); return; }
      e.dataTransfer.setData('text/plain', t.name);
      e.dataTransfer.effectAllowed = 'copy';
    });

    dbListEl.appendChild(item);
  });
  updateDbButtons();
}

// Filtr tagów – UI (single-select)
function updateTagPillsUI(){
  document.querySelectorAll('#tagFilter .tag-pill').forEach(b=>{
    const t = b.dataset.tag;
    if (t === '__clear') { b.classList.remove('active'); }
    else { b.classList.toggle('active', selectedTag === t); }
  });
}
document.querySelectorAll('#tagFilter .tag-pill').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const tag = btn.dataset.tag;
    if (tag === '__clear'){ selectedTag = null; }
    else { selectedTag = (selectedTag === tag) ? null : tag; }
    updateTagPillsUI();
    renderDbList();
  });
});
updateTagPillsUI();

/* ---------- Obsługa drop z bazy na tabelę ---------- */
rowsEl.addEventListener('dragover', (e)=>{
  // pozwól upuszczać kluby (text/plain)
  if (!e.dataTransfer) return;
  e.preventDefault();
  const row = e.target.closest('.row-item');
  document.querySelectorAll('.row-item.db-over').forEach(el=>el.classList.remove('db-over'));
  if (row) row.classList.add('db-over');
});
rowsEl.addEventListener('dragleave', ()=>{
  document.querySelectorAll('.row-item.db-over').forEach(el=>el.classList.remove('db-over'));
});
rowsEl.addEventListener('drop', (e)=>{
  e.preventDefault();
  const name = e.dataTransfer.getData('text/plain');
  const row = e.target.closest('.row-item');
  document.querySelectorAll('.row-item.db-over').forEach(el=>el.classList.remove('db-over'));
  if (!name || !row) return;
  const idx = Array.from(rowsEl.children).indexOf(row);
  if (idx < 0) return;

  const existsIdx = findTeamIndexByName(name);
  if (existsIdx !== -1 && existsIdx !== idx){
    // Klub już jest w tabeli w innym miejscu – odrzuć
    return;
  }
  if (normalizeName(teams[idx].name) === normalizeName(name)) return; // bez zmian

  teams[idx].name = name;
  render();
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

/* ---------- Eksport JPG ---------- */
function waitForImages(node){
  const imgs = Array.from(node.querySelectorAll('img'));
  return Promise.all(imgs.map(img => new Promise(res=>{
    if (img.complete && img.naturalWidth > 0) return res();
    img.addEventListener('load', res, {once:true});
    img.addEventListener('error', res, {once:true});
  })));
}

// 1) Eksport widoku 1920×1080 (z ukrytymi suwakami)
document.getElementById('btnExport').addEventListener('click', async ()=>{
  const node = document.getElementById('stage');
  node.classList.add('exporting');
  await waitForImages(node);
  await new Promise(r => requestAnimationFrame(r));
  try{
    const dataUrl = await htmlToImage.toJpeg(node, {
      quality: 0.95,
      backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg') || '#f2f6fb',
      width: 1920, height: 1080, pixelRatio: 1, preferCSSPageSize: true, cacheBust: true,
      imagePlaceholder: PLACEHOLDER_SVG
    });
    const a = document.createElement('a'); a.href = dataUrl; a.download = `tabela_${new Date().toISOString().slice(0,10)}.jpg`; a.click();
  }catch(err){
    console.error(err);
    alert('Jeśli w JPG nie ma herbów, uruchom stronę przez serwer HTTP (np. python -m http.server).');
  }finally{
    node.classList.remove('exporting');
  }
});

// 2) Eksport pełnej listy – bez suwaków, długi obraz (wysokość = wszystkie wiersze)
document.getElementById('btnExportAll').addEventListener('click', async ()=>{
  const stage = document.getElementById('stage');
  const clone = stage.cloneNode(true);
  clone.classList.add('exporting');
  clone.style.height = 'auto';         // zdejmij sztywną wysokość
  // W clone: usuń przewijanie i ustaw stałą wysokość wiersza
  const rowsClone = clone.querySelector('#rows');
  if (rowsClone){
    rowsClone.classList.remove('scroll');
    rowsClone.style.overflow = 'visible';
    rowsClone.style.gridAutoRows = getComputedStyle(document.documentElement).getPropertyValue('--rowH') || '86px';
  }
  // Umieść poza ekranem, aby się policzyły wymiary
  clone.style.position = 'absolute'; clone.style.left = '-99999px'; clone.style.top = '0';
  document.body.appendChild(clone);
  await waitForImages(clone);
  await new Promise(r => requestAnimationFrame(r));
  try{
    const rect = clone.getBoundingClientRect();
    const dataUrl = await htmlToImage.toJpeg(clone, {
      quality: 0.95,
      backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg') || '#f2f6fb',
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      pixelRatio: 1,
      cacheBust: true,
      imagePlaceholder: PLACEHOLDER_SVG
    });
    const a = document.createElement('a'); a.href = dataUrl; a.download = `tabela_full_${new Date().toISOString().slice(0,10)}.jpg`; a.click();
  }catch(err){
    console.error(err);
    alert('Nie udało się wygenerować długiego JPG. Spróbuj odświeżyć stronę.');
  }finally{
    clone.remove();
  }
});

/* ---------- Panel: przyciski ---------- */
document.getElementById('btnAdd').addEventListener('click', ()=>{ teams.push({ name: "Nowa drużyna", pts: 0 }); render(); });
document.getElementById('btnReset').addEventListener('click', ()=>{ teams = JSON.parse(JSON.stringify(defaultTeams)); selectedRowIndex = -1; render(); });
inPromotion.addEventListener('change', render);
inReleg.addEventListener('change', render);

/* ---------- Baza klubów – akcje ---------- */
dbSearchEl.addEventListener('input', renderDbList);
btnDbAdd.addEventListener('click', ()=>{
  const c = dbFiltered[dbSelectedIdx]; if(!c) return;
  if (findTeamIndexByName(c.name) !== -1){ alert('Ta drużyna już jest w tabeli.'); return; }
  teams.push({ name: c.name, pts: 0 }); render();
});
btnDbReplace.addEventListener('click', ()=>{
  const c = dbFiltered[dbSelectedIdx]; if (selectedRowIndex===-1 || !c) return;
  const existsIdx = findTeamIndexByName(c.name);
  if (existsIdx !== -1 && existsIdx !== selectedRowIndex){ alert('Ta drużyna już jest w tabeli.'); return; }
  teams[selectedRowIndex] = { name: c.name, pts: teams[selectedRowIndex].pts || 0 }; render();
});

/* ---------- Start ---------- */
render();
loadDb();