// Konfiguracja
const DB_URL = 'kluby.json';
const LOGO_PATH = 'herby';
const PLACEHOLDER_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="100%" height="100%" rx="12" ry="12" fill="#e5e7eb"/><text x="50%" y="54%" text-anchor="middle" font-family="Inter, Arial" font-size="18" fill="#475569">LOGO</text></svg>`);

// Startowa tabela
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
let dbTeams = []; let dbFiltered = []; let dbSelectedIdx = -1; let selectedRowIndex = -1;
let rowsSortable = null; let selectedTag = null;

// DOM
const rowsEl = document.getElementById('rows');
const inPromotion = document.getElementById('inPromotion');
const inReleg = document.getElementById('inReleg');
const dbSearchEl = document.getElementById('dbSearch');
const dbListEl = document.getElementById('dbList');
const btnDbAdd = document.getElementById('btnDbAdd');
const btnDbReplace = document.getElementById('btnDbReplace');

// Helpers
const buildLogoUrl = name => `${LOGO_PATH}/${encodeURIComponent(name.trim())}.png`;
const setAutoLogo = (img, t) => { img.onerror = () => { img.onerror = null; img.src = PLACEHOLDER_SVG; }; img.src = buildLogoUrl(t.name); };
const classForIndex = i => { const p=+inPromotion.value|0, r=+inReleg.value|0; if(i===0)return'first'; if(i===1&&p>=2)return'second'; if(i===2&&p>=3)return'third'; if(i>=teams.length-r)return'releg'; return''; };
const placeCaretAtEnd = el => { const r=document.createRange(), s=window.getSelection(); r.selectNodeContents(el); r.collapse(false); s.removeAllRanges(); s.addRange(r); };
const normalizeName = s => (s||'').trim().replace(/\s+/g,' ').toLowerCase();
const isNameTaken = (name, except=-1) => { const n=normalizeName(name); return teams.some((t,i)=>i!==except && normalizeName(t.name)===n && n!==''); };
const setSelectedRow = i => { selectedRowIndex=i; document.querySelectorAll('#rows .row-item').forEach((el,idx)=>el.classList.toggle('selected', idx===i)); updateDbButtons(); };
const findTeamIndexByName = name => teams.findIndex(t => normalizeName(t.name)===normalizeName(name));
const stripAccents = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const abbr = name => name.trim().split(/\s+/).map(p=>p[0]).join('').slice(0,3).toUpperCase();
const colorFor = name => { let h=0; for(const ch of name) h=(h*31+ch.charCodeAt(0))%360; return `hsl(${h} 70% 45%)`; };

// Drag rozróżnienie
function isClubDrag(e){
  const t = e.dataTransfer && e.dataTransfer.types;
  if (!t) return false;
  const a = [...t];
  return a.includes('text/club') || a.includes('application/x-club');
}
function getClubNameFromDT(e){
  const dt = e.dataTransfer; if(!dt) return null;
  let name = dt.getData('text/club') || dt.getData('application/x-club');
  if (name) return name;
  const plain = dt.getData('text/plain')?.trim(); if (!plain) return null;
  const m = dbTeams.find(x => x?.name && x.name.toLowerCase() === plain.toLowerCase());
  return m ? m.name : null;
}

// Sortable (kolejność)
function initDnD(){
  if(rowsSortable) rowsSortable.destroy();
  rowsSortable = new Sortable(rowsEl, {
    animation:150, handle:'.pos', draggable:'.row-item', ghostClass:'drag-ghost', chosenClass:'drag-chosen',
    onEnd:e=>{
      if(e.oldIndex===e.newIndex || e.oldIndex==null || e.newIndex==null) return;
      const it = teams.splice(e.oldIndex,1)[0]; teams.splice(e.newIndex,0,it);
      if(selectedRowIndex===e.oldIndex) selectedRowIndex=e.newIndex;
      else if(selectedRowIndex!==-1){
        if(e.oldIndex<selectedRowIndex && e.newIndex>=selectedRowIndex) selectedRowIndex-=1;
        else if(e.oldIndex>selectedRowIndex && e.newIndex<=selectedRowIndex) selectedRowIndex+=1;
      }
      render();
    }
  });
}

// Tag helpers
function getEmotesFromTags(raw){
  let arr=[]; if(Array.isArray(raw)) arr=raw; else if(typeof raw==='string') arr=raw.split(/[,;\s]+/); else if(raw&&typeof raw.tag==='string') arr=[raw.tag];
  return arr.map(x=>(x||'').toString().trim()).filter(Boolean).map(x=>{
    const lx=x.toLowerCase(); if(x==='⚽'||lx==='piłka'||lx==='pilka'||lx==='soccer'||lx==='football') return '⚽';
    if(x==='🏀'||lx==='kosz'||lx==='basket'||lx==='basketball') return '🏀'; return null;
  }).filter(Boolean);
}

// Autocomplete
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
  box.innerHTML=''; items.forEach((t,i)=>{ const b=document.createElement('button'); b.type='button'; b.className='ac-item'+(i===0?' selected':''); b.dataset.idx=String(i);
    b.innerHTML=`<span class="ac-badge" style="--badge:${colorFor(t.name)}">${abbr(t.name)}</span><span class="ac-text">${t.name}</span><span class="ac-tags">${(getEmotesFromTags(t.tags)||[]).join(' ')}</span>`;
    b.addEventListener('mousedown',e=>{ e.preventDefault(); onPick(t); }); box.appendChild(b);
  }); box.style.display='block';
}
const moveACSelection=(box,dir)=>{ const items=[...box.querySelectorAll('.ac-item')]; if(!items.length)return; let i=items.findIndex(el=>el.classList.contains('selected')); i=(i+dir+items.length)%items.length; items.forEach(el=>el.classList.remove('selected')); items[i].classList.add('selected'); };
const getACSelected=(box,data)=>{ const sel=box.querySelector('.ac-item.selected'); if(!sel)return null; const i=+sel.dataset.idx||0; return data[i]||null; };

// Render
function render(){
  rowsEl.innerHTML='';
  teams.forEach((t,i)=>{
    const row=document.createElement('div'); row.className=`row-item ${classForIndex(i)} ${i===selectedRowIndex?'selected':''}`;
    row.innerHTML=`
      <div class="pos" title="Przeciągnij, aby zmienić kolejność">${i+1}</div>
      <div class="team">
        <img class="logo" alt="">
        <div class="name" contenteditable="true" spellcheck="false">${t.name}</div>
        <div class="row-actions"><button class="icon-btn" data-act="up">↑</button><button class="icon-btn" data-act="down">↓</button><button class="icon-btn" data-act="del">✕</button></div>
      </div>
      <div class="points"><span class="pts" contenteditable="true">${t.pts}</span></div>`;
    row.addEventListener('mousedown',ev=>{ if(ev.target.closest('.name, .pts, .icon-btn'))return; setSelectedRow(i); });

    const img=row.querySelector('img.logo'); setAutoLogo(img,t);

    const nameEl=row.querySelector('.name'), teamWrap=row.querySelector('.team'); let prevName=t.name; const acBox=makeACBox(teamWrap); let acData=[];
    const accept=item=>{ if(!item)return; nameEl.textContent=item.name; teams[i].name=item.name; setAutoLogo(img,teams[i]); acBox.style.display='none'; renderDbList(); setTimeout(()=>nameEl.blur(),0); };
    const showAC=()=>{ acData=suggestions(nameEl.textContent,i,8); renderAC(acBox,acData,accept); };
    const hideAC=()=>{ acBox.style.display='none'; };

    nameEl.addEventListener('focus',()=>{ prevName=teams[i].name; showAC(); });
    nameEl.addEventListener('input',e=>{ teams[i].name=e.currentTarget.textContent.trim(); setAutoLogo(img,teams[i]); showAC(); });
    nameEl.addEventListener('keydown',e=>{ if(acBox.style.display==='block'){ if(e.key==='ArrowDown'){e.preventDefault();moveACSelection(acBox,+1);} else if(e.key==='ArrowUp'){e.preventDefault();moveACSelection(acBox,-1);} else if(e.key==='Enter'){e.preventDefault();accept(getACSelected(acBox,acData));} else if(e.key==='Escape'){e.preventDefault();hideAC();} }});
    nameEl.addEventListener('blur',()=>{ setTimeout(()=>hideAC(),120); const nn=nameEl.textContent.trim(); if(!nn){ teams[i].name=prevName; nameEl.textContent=prevName; renderDbList(); return; } if(isNameTaken(nn,i)){ nameEl.classList.add('name-dup'); setTimeout(()=>nameEl.classList.remove('name-dup'),800); teams[i].name=prevName; nameEl.textContent=prevName; setAutoLogo(img,teams[i]); renderDbList(); } else { teams[i].name=nn; renderDbList(); } });

    const pts=row.querySelector('.pts');
    pts.addEventListener('focus',e=>{ if(e.currentTarget.textContent.trim()==='0') e.currentTarget.textContent=''; placeCaretAtEnd(e.currentTarget); });
    pts.addEventListener('input',e=>{ const v=e.currentTarget.textContent.replace(/[^\d-]/g,''); e.currentTarget.textContent=v; teams[i].pts=Number(v||0); placeCaretAtEnd(e.currentTarget); });
    pts.addEventListener('blur',e=>{ let v=e.currentTarget.textContent.replace(/[^\d-]/g,''); if(v==='') v='0'; e.currentTarget.textContent=v; teams[i].pts=Number(v); });

    row.querySelectorAll('.row-actions .icon-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{ const act=btn.dataset.act;
        if(act==='up'&&i>0){ const tmp=teams[i-1]; teams[i-1]=teams[i]; teams[i]=tmp; render(); }
        if(act==='down'&&i<teams.length-1){ const tmp=teams[i+1]; teams[i+1]=teams[i]; teams[i]=tmp; render(); }
        if(act==='del'){ teams.splice(i,1); if(selectedRowIndex===i) selectedRowIndex=-1; render(); }
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

// Panel buttons state
function updateDbButtons(){
  const has = dbSelectedIdx!==-1 && dbFiltered[dbSelectedIdx];
  const selName = has ? dbFiltered[dbSelectedIdx].name : null;
  const existsIdx = has ? findTeamIndexByName(selName) : -1;
  btnDbAdd.disabled = !has || existsIdx!==-1;
  btnDbAdd.title = existsIdx!==-1 ? 'Ta drużyna już jest w tabeli' : '';
  const conflict = has && selectedRowIndex!==-1 && (existsIdx!==-1 && existsIdx!==selectedRowIndex);
  btnDbReplace.disabled = !(has && selectedRowIndex!==-1) || conflict;
  btnDbReplace.title = conflict ? 'Ta drużyna już jest w tabeli.' : '';
}

// DB list
function renderDbList(){
  const prevSelName = (dbFiltered[dbSelectedIdx] && dbFiltered[dbSelectedIdx].name) || null;
  const q = stripAccents(dbSearchEl.value.trim());
  const filtered = dbTeams.filter(t=>!q||stripAccents(t.name).includes(q)).filter(t=>{ if(!selectedTag) return true; const e=getEmotesFromTags(t.tags); return e.includes(selectedTag); });
  dbFiltered = filtered; dbSelectedIdx = prevSelName ? dbFiltered.findIndex(t=>t.name===prevSelName) : -1;

  dbListEl.innerHTML='';
  dbFiltered.slice(0,200).forEach((t,idx)=>{
    const item=document.createElement('button'); item.type='button'; item.className='db-item'+(idx===dbSelectedIdx?' selected':''); item.style.setProperty('--badge',colorFor(t.name));
    const badge=document.createElement('span'); badge.className='db-badge'; badge.textContent=abbr(t.name);
    const label=document.createElement('span'); label.className='db-name'; label.textContent=t.name;
    const tags=document.createElement('span'); tags.className='db-tags'; const em=getEmotesFromTags(t.tags); if(em.length){ tags.textContent=em.join(' '); tags.title='Dyscypliny: '+em.join(' '); }
    const disabled = findTeamIndexByName(t.name)!==-1; item.setAttribute('aria-disabled', disabled?'true':'false'); item.draggable=!disabled;

    item.addEventListener('click',()=>{ dbSelectedIdx=idx; renderDbList(); updateDbButtons(); });
    item.addEventListener('dragstart',e=>{ if(disabled){ e.preventDefault(); return; } e.dataTransfer.setData('text/club',t.name); e.dataTransfer.setData('application/x-club',t.name); e.dataTransfer.setData('text/plain',t.name); e.dataTransfer.effectAllowed='copy'; });

    item.appendChild(badge); item.appendChild(label); item.appendChild(tags);
    dbListEl.appendChild(item);
  });
  updateDbButtons();
}

// Tag filter UI
function updateTagPillsUI(){ document.querySelectorAll('#tagFilter .tag-pill').forEach(b=>{ const t=b.dataset.tag; if(t==='__clear') b.classList.remove('active'); else b.classList.toggle('active', selectedTag===t); }); }
document.querySelectorAll('#tagFilter .tag-pill').forEach(btn=>{
  btn.addEventListener('click',()=>{ const t=btn.dataset.tag; selectedTag = (t==='__clear') ? null : (selectedTag===t ? null : t); updateTagPillsUI(); renderDbList(); });
});
updateTagPillsUI();

// Drop z bazy na tabelę
rowsEl.addEventListener('dragover', e=>{
  e.preventDefault(); // pozwól na drop (również dla text/plain fallback)
  const row=e.target.closest('.row-item');
  document.querySelectorAll('.row-item.db-over').forEach(el=>el.classList.remove('db-over'));
  if(isClubDrag(e) && row) row.classList.add('db-over');
});
rowsEl.addEventListener('dragleave', ()=>{ document.querySelectorAll('.row-item.db-over').forEach(el=>el.classList.remove('db-over')); });
rowsEl.addEventListener('drop', e=>{
  const name=getClubNameFromDT(e);
  const row=e.target.closest('.row-item');
  document.querySelectorAll('.row-item.db-over').forEach(el=>el.classList.remove('db-over'));
  if(!name||!row) return;
  const idx=[...rowsEl.children].indexOf(row); if(idx<0) return;
  const exist=findTeamIndexByName(name); if(exist!==-1 && exist!==idx) return;
  if(normalizeName(teams[idx].name)===normalizeName(name)) return;
  teams[idx].name=name; render();
});

// Load DB (cache-bust + komunikat)
async function loadDb(){
  const box=document.getElementById('dbError'); const show=msg=>{ if(box){ box.style.display='block'; box.textContent='Błąd ładowania bazy: '+msg+' (używam listy zapasowej)'; } };
  const hide=()=>{ if(box){ box.style.display='none'; box.textContent=''; } };
  try{
    const res=await fetch(DB_URL+'?cb='+Date.now(),{cache:'no-store'}); if(!res.ok) throw new Error('HTTP '+res.status);
    const txt=await res.text(); let arr; try{ arr=JSON.parse(txt); }catch{ throw new Error('niepoprawny JSON (przecinki/UTF‑8)'); }
    dbTeams=(Array.isArray(arr)?arr:[]).map(x=> typeof x==='string'?{name:x,tags:[]}:{name:x?.name||'',tags:x?.tags??x?.tag??[]}).filter(t=>t.name);
    hide();
  }catch(e){
    show(e.message||'nieznany błąd');
    const base=defaultTeams.map(t=>({name:t.name,tags:[]})); const extras=["Areniscas Cadin","Górskie Piaskówki","Groklin Cedynia","Jeziorak Tar","Osiris Tatarów","Przenni Między Polanie","Twierdza Aleksandria","Union Zephyr","WKS Nowy Bór","Lokomotiv Królewiec"].map(n=>({name:n,tags:[]}));
    dbTeams=base.concat(extras);
  }
  renderDbList();
}

// Eksporty
const waitForImages = node => Promise.all([...node.querySelectorAll('img')].map(img=>new Promise(r=>{ if(img.complete&&img.naturalWidth>0)return r(); img.addEventListener('load',r,{once:true}); img.addEventListener('error',r,{once:true}); })));

document.getElementById('btnExport').addEventListener('click', async ()=>{
  const stage=document.getElementById('stage'); stage.classList.add('exporting');
  await waitForImages(stage); await new Promise(r=>requestAnimationFrame(r));
  try{
    const url=await htmlToImage.toJpeg(stage,{quality:.95,backgroundColor:getComputedStyle(document.documentElement).getPropertyValue('--bg')||'#f2f6fb',width:1920,height:1080,pixelRatio:1,preferCSSPageSize:true,cacheBust:true,imagePlaceholder:PLACEHOLDER_SVG});
    const a=document.createElement('a'); a.href=url; a.download=`tabela_${new Date().toISOString().slice(0,10)}.jpg`; a.click();
  }finally{ stage.classList.remove('exporting'); }
});

document.getElementById('btnExportAll').addEventListener('click', async ()=>{
  const stage=document.getElementById('stage'), rows=document.getElementById('rows');
  const prevH=stage.style.height, prevOv=rows.style.overflow, prevAuto=rows.style.gridAutoRows, hadScroll=rows.classList.contains('scroll');
  stage.classList.add('export-all','exporting'); stage.style.height='auto'; rows.classList.remove('scroll'); rows.style.overflow='visible'; rows.style.gridAutoRows=getComputedStyle(document.documentElement).getPropertyValue('--rowH')||'86px';
  await waitForImages(stage); await new Promise(r=>requestAnimationFrame(r));
  try{
    const rect=stage.getBoundingClientRect();
    const url=await htmlToImage.toJpeg(stage,{quality:.95,backgroundColor:getComputedStyle(document.documentElement).getPropertyValue('--bg')||'#f2f6fb',width:Math.round(rect.width),height:Math.round(stage.scrollHeight),pixelRatio:1,cacheBust:true,imagePlaceholder:PLACEHOLDER_SVG});
    const a=document.createElement('a'); a.href=url; a.download=`tabela_full_${new Date().toISOString().slice(0,10)}.jpg`; a.click();
  }finally{
    stage.classList.remove('export-all','exporting'); stage.style.height=prevH||''; if(hadScroll) rows.classList.add('scroll'); rows.style.overflow=prevOv||''; rows.style.gridAutoRows=prevAuto||'';
  }
});

// Panel
document.getElementById('btnAdd').addEventListener('click', ()=>{ teams.push({name:"Nowa drużyna", pts:0}); render(); });
document.getElementById('btnReset').addEventListener('click', ()=>{ teams=JSON.parse(JSON.stringify(defaultTeams)); selectedRowIndex=-1; render(); });
inPromotion.addEventListener('change', render);
inReleg.addEventListener('change', render);

// DB actions
dbSearchEl.addEventListener('input', renderDbList);
btnDbAdd.addEventListener('click', ()=>{ const c=dbFiltered[dbSelectedIdx]; if(!c) return; if(findTeamIndexByName(c.name)!==-1){ alert('Ta drużyna już jest w tabeli.'); return; } teams.push({name:c.name, pts:0}); render(); });
btnDbReplace.addEventListener('click', ()=>{ const c=dbFiltered[dbSelectedIdx]; if(selectedRowIndex===-1||!c) return; const e=findTeamIndexByName(c.name); if(e!==-1 && e!==selectedRowIndex){ alert('Ta drużyna już jest w tabeli.'); return; } teams[selectedRowIndex]={name:c.name, pts:teams[selectedRowIndex].pts||0}; render(); });

// Start
render();
loadDb();