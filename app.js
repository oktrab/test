// Konfiguracja
const DB_URL = 'kluby.json';
const LOGO_PATH = 'herby';
const PLACEHOLDER_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="100%" height="100%" rx="12" ry="12" fill="#e5e7eb"/><text x="50%" y="54%" text-anchor="middle" font-family="Inter, Arial" font-size="18" fill="#475569">LOGO</text></svg>`);
const COUNTRY_NAMES = { SZ: 'Szwajcaria', W: 'Wosterg', I: 'Inne kraje' };

// Wbudowany fallback (gdy fetch/inline/plik nie zadziała)
const EMBEDDED_DB = [
  { name: "Areniscas Cadin", tags: ["⚽","🏀"], country: "W" },
  { name: "Brzozy Mały Baczów", tags: ["⚽","🏀"], country: "SZ" },
  { name: "Garbarnia Baczów", tags: ["⚽","🏀"], country: "SZ" },
  { name: "Osiris Tatarów", tags: ["⚽","🏀"], country: "SZ" },
  { name: "Poseidon Kings", tags: ["⚽","🏀"], country: "SZ" },
  { name: "ZAM Trub", tags: ["⚽","🏀"], country: "SZ" },
  { name: "Zamieć Bór", tags: ["⚽","🏀"], country: "SZ" },
  { name: "Byki Tatarów", tags: ["⚽","🏀"], country: "SZ" },

  { name: "Biali Tatarów", tags: ["⚽"], country: "SZ" },
  { name: "Czarni Baczów", tags: ["⚽"], country: "SZ" },
  { name: "Dąbniarka Vista", tags: ["⚽"], country: "SZ" },
  { name: "Górskie Piaskówki", tags: ["⚽"], country: "W" },
  { name: "Lokomotiv Królewiec", tags: ["⚽"], country: "SZ" },
  { name: "Olimpia Aavekaupunki", tags: ["⚽"], country: "SZ" },
  { name: "Partizana Czarnolas", tags: ["⚽"], country: "SZ" },
  { name: "Przenni Między Polanie", tags: ["⚽"], country: "W" },
  { name: "Twierdza Aleksandria", tags: ["⚽"], country: "I", countryName: "Aleksandria" },
  { name: "Union Zephyr", tags: ["⚽"], country: "I", countryName: "Zephyria" },
  { name: "WKS Nowy Bór", tags: ["⚽"], country: "W" },
  { name: "Żółci Przennów", tags: ["⚽"], country: "SZ" },

  { name: "Groklin Cedynia", tags: ["🏀"], country: "SZ" },
  { name: "Jeziorak Tar", tags: ["🏀"], country: "SZ" }
];

// Tabela startowa
let teams = [
  { name: "Zamieć Bór", pts: 0 }, { name: "Żółci Przennów", pts: 0 },
  { name: "Biali Tatarów", pts: 0 }, { name: "Brzozy Mały Baczów", pts: 0 },
  { name: "Czarni Baczów", pts: 0 }, { name: "Dąbniarka Vista", pts: 0 },
  { name: "Garbarnia Baczów", pts: 0 }, { name: "Olimpia Aavekaupunki", pts: 0 },
  { name: "Byki Tatarów", pts: 0 }, { name: "Partizana Czarnolas", pts: 0 },
  { name: "Poseidon Kings", pts: 0 }, { name: "ZAM Trub", pts: 0 }
];
const defaultTeams = JSON.parse(JSON.stringify(teams));

// UI state
let dbTeams = []; let dbFiltered = [];
let dbSelectedIdx = -1; let selectedRowIndex = -1;
let rowsSortable = null; let selectedTag = null; let selectedCountry = null;
let sortMode = 'none';
let lastTeamCount = teams.length;

// DOM
const rowsEl = document.getElementById('rows');
const inPodium  = document.getElementById('inPodium');
const inPlayoff = document.getElementById('inPlayoff');
const inReleg   = document.getElementById('inReleg');
const dbSearchEl = document.getElementById('dbSearch');
const dbListEl   = document.getElementById('dbList');
const btnDbAdd   = document.getElementById('btnDbAdd');
const btnDbReplace = document.getElementById('btnDbReplace');
const btnSortPts = document.getElementById('btnSortPts');
const btnLoadDb  = document.getElementById('btnLoadDb');
const fileDbEl   = document.getElementById('fileDb');

// Helpers
const buildLogoUrl = name => `${LOGO_PATH}/${encodeURIComponent(name.trim())}.png`;
const setAutoLogo = (img,t) => { img.onerror=()=>{ img.onerror=null; img.src=PLACEHOLDER_SVG; }; img.src=buildLogoUrl(t.name); };
const normalizeName = s => (s||'').trim().replace(/\s+/g,' ').toLowerCase();
const isNameTaken = (name, except=-1) => teams.some((t,i)=>i!==except && normalizeName(t.name)===normalizeName(name) && name.trim()!=='');
const stripAccents = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const abbr = name => name.trim().split(/\s+/).map(p=>p[0]).join('').slice(0,3).toUpperCase();
const colorFor = name => { let h=0; for(const ch of name) h=(h*31+ch.charCodeAt(0))%360; return `hsl(${h} 70% 45%)`; };

// Kraj i tagi
const getCountryCode = t => { const c=(t.country||t.c||'SZ').toUpperCase(); return (c==='SZ'||c==='W'||c==='I')?c:'SZ'; };
const getCountryTitle = t => { const cc=getCountryCode(t); const base=COUNTRY_NAMES[cc]||cc; return cc==='I' && t.countryName ? `${base}: ${t.countryName}` : base; };
function getEmotesFromTags(raw){
  let arr=[]; if(Array.isArray(raw)) arr=raw; else if(typeof raw==='string') arr=raw.split(/[,;\s]+/); else if(raw&&typeof raw.tag==='string') arr=[raw.tag];
  return arr.map(x=>(x||'').toString().trim()).filter(Boolean).map(x=>{
    const lx=x.toLowerCase();
    if (x==='⚽'||lx==='piłka'||lx==='pilka'||lx==='soccer'||lx==='football') return '⚽';
    if (x==='🏀'||lx==='kosz'||lx==='basket'||lx==='basketball') return '🏀';
    return null;
  }).filter(Boolean);
}
function normalizeDbArray(rawArr){
  return (Array.isArray(rawArr)?rawArr:[]).map(x=>{
    if(typeof x==='string') return { name:x, tags:[], country:'SZ' };
    const cc=(x?.country||x?.c||'SZ').toUpperCase();
    return {
      name: x?.name||'',
      tags: x?.tags??x?.tag??[],
      country: (cc==='SZ'||cc==='W'||cc==='I')?cc:'SZ',
      countryName: x?.countryName||x?.cn||''
    };
  }).filter(t=>t.name);
}

// Klasy wiersza (podium + baraże od góry + spadki)
function classForIndex(i){
  const n = teams.length;
  let podium  = Math.min(3, Math.max(1, +inPodium.value|0));
  let playoff = Math.max(0, +inPlayoff.value|0);
  let releg   = Math.max(0, +inReleg.value|0);

  // twarde ograniczenie względem "space"
  const space = Math.max(0, n - podium);
  if (playoff > space) playoff = space;
  if (releg   > space) releg   = space;
  if (playoff + releg > space){
    releg = Math.max(0, Math.min(releg, space - playoff));
    if (playoff + releg > space){
      playoff = Math.max(0, space - releg);
    }
  }

  if (i===0) return 'first';
  if (i===1 && podium>=2) return 'second';
  if (i===2 && podium>=3) return 'third';

  const startTopPlayoff = Math.min(podium, 3);
  if (playoff>0 && i>=startTopPlayoff && i<startTopPlayoff+playoff) return 'playoff';

  if (releg>0 && i>=n-releg) return 'releg';
  return '';
}

// SAMOKOREKTA – niezależne pola; bez auto‑wypełniania
function coerceSettings(trigger='auto', silent=false){
  const n = teams.length;

  // Podium 1..min(3,n)
  let podium = +inPodium.value|0;
  podium = Math.max(1, Math.min(Math.min(3, n), podium));
  inPodium.value = podium;

  let playoff = Math.max(0, +inPlayoff.value|0);
  let releg   = Math.max(0, +inReleg.value|0);

  const space = Math.max(0, n - podium);

  playoff = Math.min(playoff, space);
  releg   = Math.min(releg,   space);

  if (playoff + releg > space){
    if (trigger === 'playoff'){
      releg = Math.max(0, space - playoff);
    } else if (trigger === 'releg'){
      playoff = Math.max(0, space - releg);
    } else {
      releg = Math.max(0, Math.min(releg, space - playoff));
      if (playoff + releg > space){
        playoff = Math.max(0, space - releg);
      }
    }
  }

  inPlayoff.value = playoff;
  inReleg.value   = releg;

  inPodium.max  = Math.min(3, n);
  inPlayoff.max = space;
  inReleg.max   = space;

  if (!silent) render();
}

/* ---------- SortableJS (kolejność) ---------- */
function initDnD(){
  if (rowsSortable) rowsSortable.destroy();
  rowsSortable = new Sortable(rowsEl, {
    animation:150, handle:'.pos', draggable:'.row-item', ghostClass:'drag-ghost', chosenClass:'drag-chosen',
    onEnd:e=>{
      if(e.oldIndex===e.newIndex||e.oldIndex==null||e.newIndex==null) return;
      const it=teams.splice(e.oldIndex,1)[0]; teams.splice(e.newIndex,0,it);
      if(selectedRowIndex===e.oldIndex) selectedRowIndex=e.newIndex;
      else if(selectedRowIndex!==-1){
        if(e.oldIndex<selectedRowIndex && e.newIndex>=selectedRowIndex) selectedRowIndex-=1;
        else if(e.oldIndex>selectedRowIndex && e.newIndex<=selectedRowIndex) selectedRowIndex+=1;
      }
      render();
    }
  });
}

/* ---------- Autocomplete ---------- */
function suggestions(q, except=-1, limit=8){
  q=stripAccents(q.trim()); if(!q) return [];
  const used=new Set(teams.map((t,i)=> i===except?'__SELF__':normalizeName(t.name)));
  const list=dbTeams.filter(t=>t&&t.name).filter(t=>stripAccents(t.name).includes(q)).filter(t=>!used.has(normalizeName(t.name)));
  list.sort((a,b)=>{const an=stripAccents(a.name).startsWith(q)?0:1; const bn=stripAccents(b.name).startsWith(q)?0:1; return an-bn||a.name.localeCompare(b.name,'pl');});
  return list.slice(0,limit);
}
function makeACBox(container){ const box=document.createElement('div'); box.className='ac'; container.appendChild(box); return box; }
function renderAC(box, items, onPick){
  if(!items.length){ box.style.display='none'; box.innerHTML=''; return; }
  box.innerHTML='';
  items.forEach((t,i)=>{
    const b=document.createElement('button'); b.type='button'; b.className='ac-item'+(i===0?' selected':''); b.dataset.idx=String(i);
    b.innerHTML=`<span class="ac-badge" style="--badge:${colorFor(t.name)}">${abbr(t.name)}</span><span class="ac-text">${t.name}</span><span class="ac-tags">${(getEmotesFromTags(t.tags)||[]).join(' ')}</span>`;
    b.addEventListener('mousedown',e=>{ e.preventDefault(); onPick(t); });
    box.appendChild(b);
  });
  box.style.display='block';
}
const moveACSelection=(box,dir)=>{ const it=[...box.querySelectorAll('.ac-item')]; if(!it.length)return; let i=it.findIndex(el=>el.classList.contains('selected')); i=(i+dir+it.length)%it.length; it.forEach(el=>el.classList.remove('selected')); it[i].classList.add('selected'); };
const getACSelected=(box,data)=>{ const sel=box.querySelector('.ac-item.selected'); if(!sel)return null; const i=+sel.dataset.idx||0; return data[i]||null; };

/* ---------- Render tabeli ---------- */
function render(){
  if (teams.length !== lastTeamCount){
    lastTeamCount = teams.length;
    coerceSettings('auto', true);
  }

  rowsEl.innerHTML='';
  teams.forEach((t,i)=>{
    const row=document.createElement('div');
    row.className=`row-item ${classForIndex(i)} ${i===selectedRowIndex?'selected':''}`;
    row.innerHTML=`
      <div class="pos" title="Przeciągnij, aby zmienić kolejność">${i+1}</div>
      <div class="team">
        <img class="logo" alt="">
        <div class="name" contenteditable="true" spellcheck="false">${t.name}</div>
        <div class="row-actions"><button class="icon-btn" data-act="up">↑</button><button class="icon-btn" data-act="down">↓</button><button class="icon-btn" data-act="del">✕</button></div>
      </div>
      <div class="points"><span class="pts" contenteditable="true" spellcheck="false">${t.pts}</span></div>`;

    row.addEventListener('mousedown',ev=>{ if(ev.target.closest('.name,.pts,.icon-btn'))return; selectedRowIndex=i; document.querySelectorAll('#rows .row-item').forEach((el,idx)=>el.classList.toggle('selected', idx===i)); updateDbButtons(); });

    const img=row.querySelector('img.logo'); setAutoLogo(img,t);

    // Nazwa + autocomplete
    const nameEl=row.querySelector('.name'), wrap=row.querySelector('.team'); let prevName=t.name; const acBox=makeACBox(wrap); let acData=[];
    const accept=item=>{ if(!item)return; nameEl.textContent=item.name; teams[i].name=item.name; setAutoLogo(img,teams[i]); acBox.style.display='none'; renderDbList(); setTimeout(()=>nameEl.blur(),0); };
    const showAC=()=>{ acData=suggestions(nameEl.textContent,i,8); renderAC(acBox,acData,accept); };
    const hideAC=()=>{ acBox.style.display='none'; };

    nameEl.addEventListener('focus',()=>{ prevName=teams[i].name; showAC(); });
    nameEl.addEventListener('input',e=>{ teams[i].name=e.currentTarget.textContent.trim(); setAutoLogo(img,teams[i]); showAC(); });
    nameEl.addEventListener('keydown',e=>{ if(acBox.style.display==='block'){ if(e.key==='ArrowDown'){e.preventDefault();moveACSelection(acBox,+1);} else if(e.key==='ArrowUp'){e.preventDefault();moveACSelection(acBox,-1);} else if(e.key==='Enter'){e.preventDefault();accept(getACSelected(acBox,acData));} else if(e.key==='Escape'){e.preventDefault();hideAC();} }});
    nameEl.addEventListener('blur',()=>{ setTimeout(()=>hideAC(),120); const nn=nameEl.textContent.trim(); if(!nn){ teams[i].name=prevName; nameEl.textContent=prevName; renderDbList(); return; } if(isNameTaken(nn,i)){ nameEl.classList.add('name-dup'); setTimeout(()=>nameEl.classList.remove('name-dup'),800); teams[i].name=prevName; nameEl.textContent=prevName; setAutoLogo(img,teams[i]); renderDbList(); } else { teams[i].name=nn; renderDbList(); } });

    // Punkty – pewny fokus i miękka walidacja
    const pts=row.querySelector('.pts');
    const ptsCell = row.querySelector('.points');

    // Pewny fokus przy mousedown (działa lepiej niż click)
    ptsCell.addEventListener('mousedown', e=>{ if(e.target!==pts){ e.preventDefault(); e.stopPropagation(); pts.focus(); } });
    pts.addEventListener('mousedown', e=>{ e.stopPropagation(); });

    // Focus: zaznacz całość
    pts.addEventListener('focus',e=>{
      const r=document.createRange(), s=window.getSelection();
      r.selectNodeContents(e.currentTarget);
      s.removeAllRanges(); s.addRange(r);
    });

    // beforeinput: blokuj niedozwolone znaki (jeśli wspierane)
    pts.addEventListener('beforeinput', e=>{
      if(e.inputType==='insertText'){
        const ch=e.data||'';
        if(!/[\d]/.test(ch)){ e.preventDefault(); }
      }else if(e.inputType==='insertFromPaste'){
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
        const clean = (text.match(/-?\d+/)?.[0]||'');
        document.execCommand('insertText', false, clean);
      }
    });

    // input: aktualizuj stan, nie “czyść” na żywo (żeby nie psuć caret)
    pts.addEventListener('input',e=>{
      const raw=e.currentTarget.textContent;
      const v=(raw.match(/-?\d+/)?.[0]||'');
      teams[i].pts = Number(v||0);
    });

    // Enter kończy edycję
    pts.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); pts.blur(); } });

    // blur: finalne czyszczenie i zapis
    pts.addEventListener('blur',e=>{
      const raw=e.currentTarget.textContent;
      const v=(raw.match(/-?\d+/)?.[0]||'0');
      e.currentTarget.textContent=v;
      teams[i].pts=Number(v);
    });

    // Akcje wiersza
    row.querySelectorAll('.row-actions .icon-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{ const a=btn.dataset.act;
        if(a==='up'&&i>0){ const t0=teams[i-1]; teams[i-1]=teams[i]; teams[i]=t0; lastTeamCount=teams.length; render(); }
        if(a==='down'&&i<teams.length-1){ const t0=teams[i+1]; teams[i+1]=teams[i]; teams[i]=t0; lastTeamCount=teams.length; render(); }
        if(a==='del'){ teams.splice(i,1); if(selectedRowIndex===i) selectedRowIndex=-1; lastTeamCount=teams.length; render(); }
        updateDbButtons();
      });
    });

    rowsEl.appendChild(row);
  });

  rowsEl.classList.toggle('scroll', teams.length>12);
  initDnD();
  updateDbButtons();
  requestAnimationFrame(renderDbList);
}

/* ---------- Panel: stany ---------- */
function updateDbButtons(){
  const has = dbSelectedIdx!==-1 && dbFiltered[dbSelectedIdx];
  const selName = has ? dbFiltered[dbSelectedIdx].name : null;
  const existsIdx = has ? teams.findIndex(t=>normalizeName(t.name)===normalizeName(selName)) : -1;
  btnDbAdd.disabled = !has || existsIdx!==-1;
  btnDbAdd.title = existsIdx!==-1 ? 'Ta drużyna już jest w tabeli' : '';
  const conflict = has && selectedRowIndex!==-1 && (existsIdx!==-1 && existsIdx!==selectedRowIndex);
  btnDbReplace.disabled = !(has && selectedRowIndex!==-1) || conflict;
  btnDbReplace.title = conflict ? 'Ta drużyna już jest w tabeli.' : '';
}

/* ---------- Baza: lista + sort + filtry + drag ---------- */
function sortDbTeamsByTags(list){
  const rank = t => { const e=getEmotesFromTags(t.tags); if(e.includes('⚽')&&e.includes('🏀'))return 2; if(e.includes('⚽'))return 1; if(e.includes('🏀'))return 0; return -1; };
  return list.slice().sort((a,b)=>{ const ra=rank(a), rb=rank(b); if(ra!==rb) return rb-ra; return a.name.localeCompare(b.name,'pl'); });
}
function renderDbList(){
  const prevSel = (dbFiltered[dbSelectedIdx] && dbFiltered[dbSelectedIdx].name) || null;
  const q = stripAccents(dbSearchEl.value.trim());
  let list = sortDbTeamsByTags(dbTeams)
    .filter(t => !q || stripAccents(t.name).includes(q))
    .filter(t => {
      if (selectedTag){ const e=getEmotesFromTags(t.tags); if (!e.includes(selectedTag)) return false; }
      if (selectedCountry){ if (getCountryCode(t)!==selectedCountry) return false; }
      return true;
    });

  dbFiltered = list;
  dbSelectedIdx = prevSel ? dbFiltered.findIndex(t=>t.name===prevSel) : -1;

  dbListEl.innerHTML='';
  dbFiltered.slice(0,200).forEach((t,idx)=>{
    const item=document.createElement('button'); item.type='button';
    item.className='db-item'+(idx===dbSelectedIdx?' selected':''); item.style.setProperty('--badge',colorFor(t.name));

    const badge=document.createElement('span'); badge.className='db-badge'; badge.textContent=abbr(t.name);
    const label=document.createElement('span'); label.className='db-name'; label.textContent=t.name;
    const tags=document.createElement('span'); tags.className='db-tags'; const em=getEmotesFromTags(t.tags); if(em.length){ tags.textContent=em.join(' '); tags.title='Dyscypliny: '+em.join(' '); }
    const c=document.createElement('span'); c.className='db-country'; const cc=getCountryCode(t); c.dataset.cc=cc; c.textContent=cc; c.title=getCountryTitle(t);

    const disabled = teams.findIndex(x=>normalizeName(x.name)===normalizeName(t.name))!==-1;
    item.setAttribute('aria-disabled', disabled?'true':'false'); item.draggable=!disabled;

    item.addEventListener('click',()=>{ dbSelectedIdx=idx; renderDbList(); updateDbButtons(); });
    item.addEventListener('dragstart',e=>{ if(disabled){ e.preventDefault(); return; } e.dataTransfer.setData('text/club',t.name); e.dataTransfer.setData('application/x-club',t.name); e.dataTransfer.setData('text/plain',t.name); e.dataTransfer.effectAllowed='copy'; });

    item.appendChild(badge); item.appendChild(label); item.appendChild(tags); item.appendChild(c);
    dbListEl.appendChild(item);
  });
  updateDbButtons();
}

/* ---------- Filtry ---------- */
function updateTagPillsUI(){ document.querySelectorAll('#tagFilter .tag-pill').forEach(b=>{ const t=b.dataset.tag; if(t==='__clear') b.classList.remove('active'); else b.classList.toggle('active', selectedTag===t); }); }
document.querySelectorAll('#tagFilter .tag-pill').forEach(btn=>btn.addEventListener('click',()=>{ const t=btn.dataset.tag; selectedTag=(t==='__clear')?null:(selectedTag===t?null:t); updateTagPillsUI(); renderDbList(); }));
updateTagPillsUI();

function updateCountryPillsUI(){ document.querySelectorAll('#countryFilter .country-pill').forEach(b=>{ const c=b.dataset.country; if(c==='__clear') b.classList.remove('active'); else b.classList.toggle('active', selectedCountry===c); }); }
document.querySelectorAll('#countryFilter .country-pill').forEach(btn=>btn.addEventListener('click',()=>{ const c=btn.dataset.country; selectedCountry=(c==='__clear')?null:(selectedCountry===c?null:c); updateCountryPillsUI(); renderDbList(); }));
updateCountryPillsUI();

/* ---------- Drop z bazy na tabelę ---------- */
rowsEl.addEventListener('dragover', e=>{
  const dt = e.dataTransfer;
  const types = dt?.types ? Array.from(dt.types) : [];
  const isClub = types.includes('text/club') || types.includes('application/x-club');
  if (!isClub) return;

  e.preventDefault();
  const row = e.target.closest('.row-item');
  document.querySelectorAll('.row-item.db-over').forEach(el=>el.classList.remove('db-over'));
  if (row) row.classList.add('db-over');
});
rowsEl.addEventListener('dragleave', ()=>{
  document.querySelectorAll('.row-item.db-over').forEach(el=>el.classList.remove('db-over'));
});
rowsEl.addEventListener('drop', e=>{
  const dt = e.dataTransfer;
  const types = dt?.types ? Array.from(dt.types) : [];
  const isClub = types.includes('text/club') || types.includes('application/x-club');

  document.querySelectorAll('.row-item.db-over').forEach(el=>el.classList.remove('db-over'));
  if (!isClub) return;

  e.preventDefault();
  const name = dt.getData('text/club') || dt.getData('application/x-club') || '';
  const row=e.target.closest('.row-item');
  if(!name||!row) return;

  const idx=[...rowsEl.children].indexOf(row); if(idx<0) return;
  const exist=teams.findIndex(x=>normalizeName(x.name)===normalizeName(name));
  if(exist!==-1 && exist!==idx) return;
  if(normalizeName(teams[idx].name)===normalizeName(name)) return;
  teams[idx].name=name; lastTeamCount=teams.length; render();
});

/* ---------- Sortowanie po punktach ---------- */
btnSortPts.addEventListener('click', ()=>{
  if (sortMode==='none' || sortMode==='asc'){ sortMode='desc'; teams.sort((a,b)=>b.pts-a.pts); btnSortPts.textContent='↓'; }
  else { sortMode='asc'; teams.sort((a,b)=>a.pts-b.pts); btnSortPts.textContent='↑'; }
  render();
});

/* ---------- Ładowanie bazy + komunikat błędu ---------- */
function tryInlineDb(){
  const el=document.getElementById('dbInline');
  if(!el) return null;
  try{
    const txt=el.textContent||'';
    const arr=JSON.parse(txt);
    return normalizeDbArray(arr);
  }catch{ return null; }
}
async function loadDb(){
  const box=document.getElementById('dbError');
  const show=msg=>{ if(box){ box.style.display='block'; box.textContent='Błąd ładowania bazy: '+msg+' (używam alternatywy)'; } };
  const hide=()=>{ if(box){ box.style.display='none'; box.textContent=''; } };

  const use = (arr)=>{
    dbTeams = normalizeDbArray(arr);
    const rank=t=>{ const e=getEmotesFromTags(t.tags); if(e.includes('⚽')&&e.includes('🏀'))return 2; if(e.includes('⚽'))return 1; if(e.includes('🏀'))return 0; return -1; };
    dbTeams.sort((a,b)=>{ const ra=rank(a), rb=rank(b); if(ra!==rb) return rb-ra; return a.name.localeCompare(b.name,'pl'); });
  };

  try{
    // 1) inline JSON
    const inline = tryInlineDb();
    if (inline && inline.length){
      use(inline); hide(); renderDbList(); return;
    }

    // 2) fetch (online)
    if (location.protocol !== 'file:'){
      const res=await fetch(DB_URL+'?cb='+Date.now(),{cache:'no-store'});
      if(!res.ok) throw new Error('HTTP '+res.status);
      const txt=await res.text(); let arr;
      try{ arr=JSON.parse(txt); }catch{ throw new Error('niepoprawny JSON (przecinki/UTF‑8)'); }
      use(arr); hide(); renderDbList(); return;
    }

    // 3) file:// bez inline – brak fetch → fallback
    show('środowisko file:// – używam bazy wbudowanej'); use(EMBEDDED_DB);
  }catch(e){
    show(e.message||'nieznany błąd'); use(EMBEDDED_DB);
  }
  renderDbList();
}

/* ---------- Import pliku JSON (offline) ---------- */
if (btnLoadDb && fileDbEl){
  btnLoadDb.addEventListener('click', ()=>fileDbEl.click());
  fileDbEl.addEventListener('change', async (e)=>{
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    try{
      const txt = await file.text();
      const arr = JSON.parse(txt);
      dbTeams = normalizeDbArray(arr);
      renderDbList();
      const box=document.getElementById('dbError'); if(box){ box.style.display='none'; box.textContent=''; }
    }catch(err){
      alert('Nie udało się wczytać pliku JSON: '+(err.message||err));
    }finally{
      fileDbEl.value='';
    }
  });
}

// Panel/baza – nasłuchy
document.getElementById('btnAdd').addEventListener('click', ()=>{ teams.push({name:"Nowa drużyna", pts:0}); lastTeamCount=teams.length; coerceSettings('auto'); });
document.getElementById('btnReset').addEventListener('click', ()=>{ teams=JSON.parse(JSON.stringify(defaultTeams)); selectedRowIndex=-1; sortMode='none'; btnSortPts.textContent='↕'; lastTeamCount=teams.length; coerceSettings('auto'); });

inPodium.addEventListener('input', ()=>coerceSettings('podium'));
inPlayoff.addEventListener('input', ()=>coerceSettings('playoff'));
inReleg.addEventListener('input', ()=>coerceSettings('releg'));

inPodium.addEventListener('change', ()=>coerceSettings('podium'));
inPlayoff.addEventListener('change', ()=>coerceSettings('playoff'));
inReleg.addEventListener('change', ()=>coerceSettings('releg'));

dbSearchEl.addEventListener('input', renderDbList);
btnDbAdd.addEventListener('click', ()=>{ const c=dbFiltered[dbSelectedIdx]; if(!c) return; if(teams.findIndex(t=>normalizeName(t.name)===normalizeName(c.name))!==-1){ alert('Ta drużyna już jest w tabeli.'); return; } teams.push({name:c.name, pts:0}); lastTeamCount=teams.length; coerceSettings('auto'); });
btnDbReplace.addEventListener('click', ()=>{ const c=dbFiltered[dbSelectedIdx]; if(selectedRowIndex===-1||!c) return; const e=teams.findIndex(t=>normalizeName(t.name)===normalizeName(c.name)); if(e!==-1 && e!==selectedRowIndex){ alert('Ta drużyna już jest w tabeli.'); return; } teams[selectedRowIndex]={name:c.name, pts:teams[selectedRowIndex].pts||0}; coerceSettings('auto'); });

// Start
coerceSettings('auto');
loadDb();