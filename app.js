// Konfiguracja
const DB_URL = 'kluby.json';
const LOGO_PATH = 'herby';
const PLACEHOLDER_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="100%" height="100%" rx="12" ry="12" fill="#e5e7eb"/><text x="50%" y="54%" text-anchor="middle" font-family="Inter, Arial" font-size="18" fill="#475569">LOGO</text></svg>');
const COUNTRY_NAMES = { SZ: 'Szwajcaria', W: 'Wosterg', I: 'Inne kraje' };

// Wbudowany fallback (gdy fetch/inline/plik nie zadziała)
const EMBEDDED_DB = [
  { name: 'Areniscas Cadin', tags: ['⚽','🏀'], country: 'W' },
  { name: 'Brzozy Mały Baczów', tags: ['⚽','🏀'], country: 'SZ' },
  { name: 'Garbarnia Baczów', tags: ['⚽','🏀'], country: 'SZ' },
  { name: 'Osiris Tatarów', tags: ['⚽','🏀'], country: 'SZ' },
  { name: 'Poseidon Kings', tags: ['⚽','🏀'], country: 'SZ' },
  { name: 'ZAM Trub', tags: ['⚽','🏀'], country: 'SZ' },
  { name: 'Zamieć Bór', tags: ['⚽','🏀'], country: 'SZ' },
  { name: 'Byki Tatarów', tags: ['⚽','🏀'], country: 'SZ' },

  { name: 'Biali Tatarów', tags: ['⚽'], country: 'SZ' },
  { name: 'Czarni Baczów', tags: ['⚽'], country: 'SZ' },
  { name: 'Dąbniarka Vista', tags: ['⚽'], country: 'SZ' },
  { name: 'Górskie Piaskówki', tags: ['⚽'], country: 'W' },
  { name: 'Lokomotiv Królewiec', tags: ['⚽'], country: 'SZ' },
  { name: 'Olimpia Aavekaupunki', tags: ['⚽'], country: 'SZ' },
  { name: 'Partizana Czarnolas', tags: ['⚽'], country: 'SZ' },
  { name: 'Przenni Między Polanie', tags: ['⚽'], country: 'W' },
  { name: 'Twierdza Aleksandria', tags: ['⚽'], country: 'I', countryName: 'Aleksandria' },
  { name: 'Union Zephyr', tags: ['⚽'], country: 'I', countryName: 'Zephyria' },
  { name: 'WKS Nowy Bór', tags: ['⚽'], country: 'W' },
  { name: 'Żółci Przennów', tags: ['⚽'], country: 'SZ' },

  { name: 'Groklin Cedynia', tags: ['🏀'], country: 'SZ' },
  { name: 'Jeziorak Tar', tags: ['🏀'], country: 'SZ' }
];

// Tabela startowa
let teams = [
  { name: 'Zamieć Bór', pts: 0 }, { name: 'Żółci Przennów', pts: 0 },
  { name: 'Biali Tatarów', pts: 0 }, { name: 'Brzozy Mały Baczów', pts: 0 },
  { name: 'Czarni Baczów', pts: 0 }, { name: 'Dąbniarka Vista', pts: 0 },
  { name: 'Garbarnia Baczów', pts: 0 }, { name: 'Olimpia Aavekaupunki', pts: 0 },
  { name: 'Byki Tatarów', pts: 0 }, { name: 'Partizana Czarnolas', pts: 0 },
  { name: 'Poseidon Kings', pts: 0 }, { name: 'ZAM Trub', pts: 0 }
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
const btnDownloadDb = document.getElementById('btnDownloadDb');
const fileDbEl   = document.getElementById('fileDb');
const stageEl    = document.getElementById('stage');
const titleEl    = document.getElementById('leagueTitle');
// Sekcje rozwijane
const secSettings = document.getElementById('secSettings');
const secDb       = document.getElementById('secDb');
const helpBox     = document.getElementById('helpBox');
// Profile lig UI
const profileNameEl   = document.getElementById('profileName');
const profileSelectEl = document.getElementById('profileSelect');
const btnProfileSave  = document.getElementById('btnProfileSave');
const btnProfileLoad  = document.getElementById('btnProfileLoad');
const btnProfileDelete= document.getElementById('btnProfileDelete');
// Edytor bazy UI
const edNameEl        = document.getElementById('edName');
const edCountryEl     = document.getElementById('edCountry');
const edCountryNameEl = document.getElementById('edCountryName');
const edTagFootBtn    = document.getElementById('edTagFoot');
const edTagBasketBtn  = document.getElementById('edTagBasket');
const btnEdSave       = document.getElementById('btnEdSave');
const btnEdDelete     = document.getElementById('btnEdDelete');
const btnEdClear      = document.getElementById('btnEdClear');

// LocalStorage z TTL
const ONE_DAY = 24*60*60*1000;
const THIRTY_DAYS = 30*ONE_DAY;
const LS_KEYS = {
  state:'liga_state_v1',
  dbOverride:'db_override_v1',
  panels:'ui_panels_v1',
  profiles:'liga_profiles_v1'
};
const storage = {
  set:(k,data,ttl=ONE_DAY)=>{ try{ localStorage.setItem(k, JSON.stringify({ts:Date.now(), ttl: ttl==null?null:ttl, data})); }catch(e){} },
  get:(k)=>{ try{ const raw=localStorage.getItem(k); if(!raw) return null; const o=JSON.parse(raw); if(o && o.ttl && Date.now()-o.ts>o.ttl){ localStorage.removeItem(k); return null; } return o?o.data:null; }catch(e){ return null; } },
  clear:(k)=>{ try{ localStorage.removeItem(k); }catch(e){} }
};

// Helpers
const buildLogoUrl = function(name){ return LOGO_PATH + '/' + encodeURIComponent(String(name||'').trim()) + '.png'; };
const setAutoLogo = function(img,t){ img.onerror=function(){ img.onerror=null; img.src=PLACEHOLDER_SVG; }; img.src=buildLogoUrl(t.name); };
const normalizeName = function(s){ return String(s||'').trim().replace(/\s+/g,' ').toLowerCase(); };
const isNameTaken = function(name, except){ except=except==null?-1:except; return teams.some(function(t,i){ return i!==except && normalizeName(t.name)===normalizeName(name) && String(name).trim()!==''; }); };
const stripAccents = function(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); };
const abbr = function(name){ return String(name||'').trim().split(/\s+/).map(function(p){return p[0];}).join('').slice(0,3).toUpperCase(); };
const colorFor = function(name){ var h=0; var str=String(name||''); for(var i=0;i<str.length;i++){ h=(h*31+str.charCodeAt(i))%360; } return 'hsl(' + h + ' 70% 45%)'; };
const uid = function(p){ return (p||'user') + ':' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); };

// Kraj klubu SZ/W/I
const getCountryCode = t => {
  const c = String((t && (t.country || t.c) || 'SZ')).toUpperCase();
  return (c==='SZ' || c==='W' || c==='I') ? c : 'SZ';
};
const getCountryTitle = t => {
  const cc = getCountryCode(t);
  const base = COUNTRY_NAMES[cc] || cc;
  return cc==='I' && t && t.countryName ? base + ': ' + t.countryName : base;
};
function getEmotesFromTags(raw){
  var arr=[]; if(Array.isArray(raw)) arr=raw; else if(typeof raw==='string') arr=raw.split(/[,;\s]+/); else if(raw&&typeof raw.tag==='string') arr=[raw.tag];
  return arr.map(function(x){ return String(x||'').trim(); }).filter(Boolean).map(function(x){
    var lx=x.toLowerCase();
    if (x==='⚽'||lx==='piłka'||lx==='pilka'||lx==='soccer'||lx==='football') return '⚽';
    if (x==='🏀'||lx==='kosz'||lx==='basket'||lx==='basketball') return '🏀';
    return null;
  }).filter(Boolean);
}
function normalizeDbArray(rawArr){
  return (Array.isArray(rawArr)?rawArr:[]).map(function(x){
    if(typeof x==='string') return { name:x, tags:[], country:'SZ' };
    var cc=String((x && (x.country||x.c)) || 'SZ').toUpperCase();
    cc = (cc==='SZ'||cc==='W'||cc==='I')?cc:'SZ';
    return {
      name: (x && x.name) || '',
      tags: (x && (x.tags!=null?x.tags:(x.tag!=null?x.tag:[]))) || [],
      country: cc,
      countryName: (x && (x.countryName||x.cn)) || ''
    };
  }).filter(function(t){ return t.name; });
}

// Efektywne ustawienia (po clampach)
function effectiveSettings(){
  var n = teams.length;
  var podium  = Math.min(3, Math.max(1, (+inPodium.value|0)));
  var playoff = Math.max(0, (+inPlayoff.value|0));
  var releg   = Math.max(0, (+inReleg.value|0));
  var space = Math.max(0, n - podium);
  if (playoff > space) playoff = space;
  if (releg   > space) releg   = space;
  if (playoff + releg > space){
    releg = Math.max(0, Math.min(releg, space - playoff));
    if (playoff + releg > space) playoff = Math.max(0, space - releg);
  }
  return { podium:podium, playoff:playoff, releg:releg, space:space, n:n };
}

// Licznik miejsc neutralnych (UI)
var slotsInfoEl = (function(){ 
  var el=document.createElement('div'); el.id='slotsInfo'; el.className='note';
  var panel=document.querySelector('.panel'); var sep=panel && panel.querySelector('.sep');
  if (panel){ if (sep) panel.insertBefore(el, sep); else panel.appendChild(el); }
  return el;
})();
function updateSlotsInfoUI(){
  var eff = effectiveSettings();
  var neutral = Math.max(0, eff.space - eff.playoff - eff.releg);
  if (slotsInfoEl) slotsInfoEl.textContent = 'Podium: ' + eff.podium + ' • Baraże: ' + eff.playoff + ' • Spadki: ' + eff.releg + ' • Neutralne: ' + neutral + ' (z ' + eff.n + ')';
}

// Klasy wiersza
function classForIndex(i){
  var eff = effectiveSettings();
  var podium=eff.podium, playoff=eff.playoff, releg=eff.releg, n=eff.n;

  if (i===0) return 'first';
  if (i===1 && podium>=2) return 'second';
  if (i===2 && podium>=3) return 'third';

  var startTopPlayoff = Math.min(podium, 3);
  if (playoff>0 && i>=startTopPlayoff && i<startTopPlayoff+playoff) return 'playoff';
  if (releg>0 && i>=n-releg) return 'releg';
  return '';
}

// SAMOKOREKTA – niezależne pola; bez auto‑wypełniania
function coerceSettings(trigger, silent){
  trigger = trigger || 'auto'; silent = !!silent;
  var n = teams.length;

  var podium = (+inPodium.value|0);
  podium = Math.max(1, Math.min(Math.min(3, n), podium));
  inPodium.value = podium;

  var playoff = Math.max(0, (+inPlayoff.value|0));
  var releg   = Math.max(0, (+inReleg.value|0));

  var space = Math.max(0, n - podium);

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
  updateSlotsInfoUI();
}

// Autosave (TTL 24h)
var saveTimer=null;
function saveState(){
  var state = {
    teams: teams.map(function(t){ return {name:t.name, pts:+t.pts||0}; }),
    settings: { podium:+inPodium.value|0, playoff:+inPlayoff.value|0, releg:+inReleg.value|0 },
    title: titleEl ? String(titleEl.textContent||'').trim() : 'Tabela ligowa'
  };
  storage.set(LS_KEYS.state, state, ONE_DAY);
}
function scheduleSave(){ clearTimeout(saveTimer); saveTimer=setTimeout(saveState, 500); }
function loadSavedState(){
  var s=storage.get(LS_KEYS.state);
  if(!s) return false;
  if(Array.isArray(s.teams)) teams = s.teams.map(function(x){ return {name:String(x.name||''), pts:Number(x.pts||0)}; });
  if(s.settings){ inPodium.value=s.settings.podium!=null?s.settings.podium:inPodium.value; inPlayoff.value=s.settings.playoff!=null?s.settings.playoff:inPlayoff.value; inReleg.value=s.settings.releg!=null?s.settings.releg:inReleg.value; }
  if(titleEl && s.title) titleEl.textContent=s.title;
  lastTeamCount=teams.length;
  return true;
}

/* ---------- SortableJS (kolejność) ---------- */
function initDnD(){
  if (rowsSortable && rowsSortable.destroy) rowsSortable.destroy();
  rowsSortable = new Sortable(rowsEl, {
    animation:150, handle:'.pos', draggable:'.row-item', ghostClass:'drag-ghost', chosenClass:'drag-chosen',
    onEnd:function(e){
      if(e.oldIndex===e.newIndex||e.oldIndex==null||e.newIndex==null) return;
      var it=teams.splice(e.oldIndex,1)[0]; teams.splice(e.newIndex,0,it);
      if(selectedRowIndex===e.oldIndex) selectedRowIndex=e.newIndex;
      else if(selectedRowIndex!==-1){
        if(e.oldIndex<selectedRowIndex && e.newIndex>=selectedRowIndex) selectedRowIndex-=1;
        else if(e.oldIndex>selectedRowIndex && e.newIndex<=selectedRowIndex) selectedRowIndex+=1;
      }
      render(); scheduleSave();
    }
  });
}

/* ---------- Autocomplete ---------- */
function suggestions(q, except, limit){
  if(except==null) except=-1; limit=limit||8;
  q=stripAccents(String(q||'').trim()); if(!q) return [];
  var used=new Set(teams.map(function(t,i){ return i===except?'__SELF__':normalizeName(t.name); }));
  var list=dbTeams.filter(function(t){return t&&t.name;})
    .filter(function(t){return stripAccents(t.name).includes(q);})
    .filter(function(t){return !used.has(normalizeName(t.name));});
  list.sort(function(a,b){
    var an=stripAccents(a.name).startsWith(q)?0:1; var bn=stripAccents(b.name).startsWith(q)?0:1;
    return an-bn || a.name.localeCompare(b.name,'pl');
  });
  return list.slice(0,limit);
}
function makeACBox(container){ var box=document.createElement('div'); box.className='ac'; container.appendChild(box); return box; }
function renderAC(box, items, onPick){
  if(!items.length){ box.style.display='none'; box.innerHTML=''; return; }
  box.innerHTML='';
  items.forEach(function(t,i){
    var b=document.createElement('button'); b.type='button'; b.className='ac-item' + (i===0?' selected':''); b.dataset.idx=String(i);
    var em=(getEmotesFromTags(t.tags)||[]).join(' ');
    b.innerHTML='<span class="ac-badge" style="--badge:'+colorFor(t.name)+'">'+abbr(t.name)+'</span>'
               +'<span class="ac-text">'+t.name+'</span>'
               +'<span class="ac-tags">'+em+'</span>';
    b.addEventListener('mousedown',function(e){ e.preventDefault(); onPick(t); });
    box.appendChild(b);
  });
  box.style.display='block';
}
function moveACSelection(box,dir){
  var it=[].slice.call(box.querySelectorAll('.ac-item')); if(!it.length)return;
  var i=it.findIndex(function(el){return el.classList.contains('selected');});
  i=(i+dir+it.length)%it.length;
  it.forEach(function(el){el.classList.remove('selected');});
  it[i].classList.add('selected');
}
function getACSelected(box,data){
  var sel=box.querySelector('.ac-item.selected'); if(!sel)return null;
  var i=+sel.dataset.idx||0; return data[i]||null;
}

/* ---------- Render tabeli ---------- */
function render(){
  if (teams.length !== lastTeamCount){
    lastTeamCount = teams.length;
    coerceSettings('auto', true);
  }

  rowsEl.innerHTML='';
  teams.forEach(function(t,i){
    var row=document.createElement('div');
    row.className='row-item ' + classForIndex(i) + (i===selectedRowIndex?' selected':'');
    row.innerHTML=
      '<div class="pos" title="Przeciągnij, aby zmienić kolejność">'+(i+1)+'</div>'
     +'<div class="team">'
       +'<img class="logo" alt="">'
       +'<div class="name" contenteditable="true" spellcheck="false">'+t.name+'</div>'
       +'<div class="row-actions"><button class="icon-btn" data-act="up">↑</button><button class="icon-btn" data-act="down">↓</button><button class="icon-btn" data-act="del">✕</button></div>'
     +'</div>'
     +'<div class="points"><span class="pts" contenteditable="true" spellcheck="false">'+t.pts+'</span></div>';

    row.addEventListener('mousedown',function(ev){ if(ev.target.closest('.name,.pts,.icon-btn'))return; selectedRowIndex=i; [].forEach.call(document.querySelectorAll('#rows .row-item'), function(el,idx){ el.classList.toggle('selected', idx===i); }); updateDbButtons(); });

    var img=row.querySelector('img.logo'); setAutoLogo(img,t);

    // Nazwa + autocomplete
    var nameEl=row.querySelector('.name'), wrap=row.querySelector('.team'); var prevName=t.name; var acBox=makeACBox(wrap); var acData=[];
    var accept=function(item){ if(!item)return; nameEl.textContent=item.name; teams[i].name=item.name; setAutoLogo(img,teams[i]); acBox.style.display='none'; renderDbList(); setTimeout(function(){nameEl.blur();},0); scheduleSave(); };
    var showAC=function(){ acData=suggestions(nameEl.textContent,i,8); renderAC(acBox,acData,accept); };
    var hideAC=function(){ acBox.style.display='none'; };

    nameEl.addEventListener('focus',function(){ prevName=teams[i].name; showAC(); });
    nameEl.addEventListener('input',function(e){ teams[i].name=e.currentTarget.textContent.trim(); setAutoLogo(img,teams[i]); showAC(); });
    nameEl.addEventListener('keydown',function(e){
      if(acBox.style.display==='block'){
        if(e.key==='ArrowDown'){e.preventDefault();moveACSelection(acBox,+1);}
        else if(e.key==='ArrowUp'){e.preventDefault();moveACSelection(acBox,-1);}
        else if(e.key==='Enter'){e.preventDefault();accept(getACSelected(acBox,acData));}
        else if(e.key==='Escape'){e.preventDefault();hideAC();}
      }
    });
    nameEl.addEventListener('blur',function(){
      setTimeout(function(){hideAC();},120);
      var nn=nameEl.textContent.trim();
      if(!nn){ teams[i].name=prevName; nameEl.textContent=prevName; renderDbList(); return; }
      if(isNameTaken(nn,i)){
        nameEl.classList.add('name-dup'); setTimeout(function(){nameEl.classList.remove('name-dup');},800);
        teams[i].name=prevName; nameEl.textContent=prevName; setAutoLogo(img,teams[i]); renderDbList();
      } else { teams[i].name=nn; renderDbList(); }
      scheduleSave();
    });

    // Punkty – fokus i walidacja
    var pts=row.querySelector('.pts');
    var ptsCell = row.querySelector('.points');

    ptsCell.addEventListener('mousedown', function(e){ if(e.target!==pts){ e.preventDefault(); e.stopPropagation(); pts.focus(); } });
    pts.addEventListener('mousedown', function(e){ e.stopPropagation(); });

    pts.addEventListener('focus',function(e){
      var r=document.createRange(), s=window.getSelection();
      r.selectNodeContents(e.currentTarget); s.removeAllRanges(); s.addRange(r);
    });
    pts.addEventListener('beforeinput', function(e){
      if(e.inputType==='insertText'){
        var ch=e.data||''; if(!/[\d]/.test(ch)){ e.preventDefault(); }
      }else if(e.inputType==='insertFromPaste'){
        e.preventDefault();
        var text = (e.clipboardData || window.clipboardData) ? (e.clipboardData.getData && e.clipboardData.getData('text')) || '' : '';
        var clean = (text.match(/-?\d+/) || [''])[0];
        document.execCommand('insertText', false, clean);
      }
    });
    pts.addEventListener('input',function(e){
      var raw=e.currentTarget.textContent;
      var v=(raw.match(/-?\d+/) || [''])[0];
      teams[i].pts = Number(v||0);
    });
    pts.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); pts.blur(); } });
    pts.addEventListener('blur',function(e){
      var raw=e.currentTarget.textContent;
      var v=(raw.match(/-?\d+/) || ['0'])[0];
      e.currentTarget.textContent=v;
      teams[i].pts=Number(v);
      scheduleSave();
    });

    // Akcje wiersza
    [].forEach.call(row.querySelectorAll('.row-actions .icon-btn'), function(btn){
      btn.addEventListener('click',function(){
        var a=btn.dataset.act;
        if(a==='up'&&i>0){ var t0=teams[i-1]; teams[i-1]=teams[i]; teams[i]=t0; lastTeamCount=teams.length; render(); scheduleSave(); }
        if(a==='down'&&i<teams.length-1){ var t1=teams[i+1]; teams[i+1]=teams[i]; teams[i]=t1; lastTeamCount=teams.length; render(); scheduleSave(); }
        if(a==='del'){ teams.splice(i,1); if(selectedRowIndex===i) selectedRowIndex=-1; lastTeamCount=teams.length; render(); scheduleSave(); }
        updateDbButtons();
      });
    });

    rowsEl.appendChild(row);
  });

  rowsEl.classList.toggle('scroll', teams.length>12);
  initDnD();
  updateDbButtons();
  requestAnimationFrame(function(){ renderDbList(); updateSlotsInfoUI(); });
}

/* ---------- Panel: stany ---------- */
function updateDbButtons(){
  var has = dbSelectedIdx!==-1 && dbFiltered[dbSelectedIdx];
  var selName = has ? dbFiltered[dbSelectedIdx].name : null;
  var existsIdx = has ? teams.findIndex(function(t){return normalizeName(t.name)===normalizeName(selName);}) : -1;
  btnDbAdd.disabled = !has || existsIdx!==-1;
  btnDbAdd.title = existsIdx!==-1 ? 'Ta drużyna już jest w tabeli' : '';
  var conflict = has && selectedRowIndex!==-1 && (existsIdx!==-1 && existsIdx!==selectedRowIndex);
  btnDbReplace.disabled = !(has && selectedRowIndex!==-1) || conflict;
  btnDbReplace.title = conflict ? 'Ta drużyna już jest w tabeli.' : '';
}

/* ---------- Baza: lista + sort + filtry + drag ---------- */
function sortDbTeamsByTags(list){
  var rank = function(t){ var e=getEmotesFromTags(t.tags); if(e.indexOf('⚽')!==-1 && e.indexOf('🏀')!==-1)return 2; if(e.indexOf('⚽')!==-1)return 1; if(e.indexOf('🏀')!==-1)return 0; return -1; };
  return list.slice().sort(function(a,b){ var ra=rank(a), rb=rank(b); if(ra!==rb) return rb-ra; return a.name.localeCompare(b.name,'pl'); });
}
function renderDbList(){
  var prevSel = (dbFiltered[dbSelectedIdx] && dbFiltered[dbSelectedIdx].name) || null;
  var q = stripAccents(String(dbSearchEl.value||'').trim());
  var list = sortDbTeamsByTags(dbTeams)
    .filter(function(t){ return !q || stripAccents(t.name).includes(q); })
    .filter(function(t){
      if (selectedTag){ var e=getEmotesFromTags(t.tags); if (e.indexOf(selectedTag)===-1) return false; }
      if (selectedCountry){ if (getCountryCode(t)!==selectedCountry) return false; }
      return true;
    });

  dbFiltered = list;
  dbSelectedIdx = prevSel ? dbFiltered.findIndex(function(t){return t.name===prevSel;}) : -1;

  dbListEl.innerHTML='';
  dbFiltered.slice(0,200).forEach(function(t,idx){
    var item=document.createElement('button'); item.type='button';
    item.className='db-item' + (idx===dbSelectedIdx?' selected':''); item.style.setProperty('--badge',colorFor(t.name));

    var badge=document.createElement('span'); badge.className='db-badge'; badge.textContent=abbr(t.name);
    var label=document.createElement('span'); label.className='db-name'; label.textContent=t.name;
    var c=document.createElement('span'); c.className='db-country'; var cc=getCountryCode(t); c.dataset.cc=cc; c.textContent=cc; c.title=getCountryTitle(t);

    var disabled = teams.findIndex(function(x){return normalizeName(x.name)===normalizeName(t.name);})!==-1;
    item.setAttribute('aria-disabled', disabled?'true':'false'); item.draggable=!disabled;

    item.addEventListener('click',function(){ dbSelectedIdx=idx; renderDbList(); updateDbButtons(); });
    item.addEventListener('dragstart',function(e){ if(disabled){ e.preventDefault(); return; } e.dataTransfer.setData('text/club',t.name); e.dataTransfer.setData('application/x-club',t.name); e.dataTransfer.setData('text/plain',t.name); e.dataTransfer.effectAllowed='copy'; });

    item.appendChild(badge); item.appendChild(label); item.appendChild(c);
    dbListEl.appendChild(item);
  });
  updateDbButtons();
}

/* ---------- Filtry ---------- */
function updateTagPillsUI(){ [].forEach.call(document.querySelectorAll('#tagFilter .tag-pill'), function(b){ var t=b.dataset.tag; if(t==='__clear') b.classList.remove('active'); else b.classList.toggle('active', selectedTag===t); }); }
[].forEach.call(document.querySelectorAll('#tagFilter .tag-pill'), function(btn){ btn.addEventListener('click',function(){ var t=btn.dataset.tag; selectedTag=(t==='__clear')?null:(selectedTag===t?null:t); updateTagPillsUI(); renderDbList(); }); });
updateTagPillsUI();

function updateCountryPillsUI(){ [].forEach.call(document.querySelectorAll('#countryFilter .country-pill'), function(b){ var c=b.dataset.country; if(c==='__clear') b.classList.remove('active'); else b.classList.toggle('active', selectedCountry===c); }); }
[].forEach.call(document.querySelectorAll('#countryFilter .country-pill'), function(btn){ btn.addEventListener('click',function(){ var c=btn.dataset.country; selectedCountry=(c==='__clear')?null:(selectedCountry===c?null:c); updateCountryPillsUI(); renderDbList(); }); });
updateCountryPillsUI();

/* ---------- Drop z bazy na tabelę ---------- */
rowsEl.addEventListener('dragover', function(e){
  var dt = e.dataTransfer;
  var types = dt && dt.types ? Array.from(dt.types) : [];
  var isClub = types.indexOf('text/club')!==-1 || types.indexOf('application/x-club')!==-1;
  if (!isClub) return;

  e.preventDefault();
  var row = e.target.closest('.row-item');
  [].forEach.call(document.querySelectorAll('.row-item.db-over'), function(el){el.classList.remove('db-over');});
  if (row) row.classList.add('db-over');
});
rowsEl.addEventListener('dragleave', function(){
  [].forEach.call(document.querySelectorAll('.row-item.db-over'), function(el){el.classList.remove('db-over');});
});
rowsEl.addEventListener('drop', function(e){
  var dt = e.dataTransfer;
  var types = dt && dt.types ? Array.from(dt.types) : [];
  var isClub = types.indexOf('text/club')!==-1 || types.indexOf('application/x-club')!==-1;

  [].forEach.call(document.querySelectorAll('.row-item.db-over'), function(el){el.classList.remove('db-over');});
  if (!isClub) return;

  e.preventDefault();
  var name = dt.getData('text/club') || dt.getData('application/x-club') || '';
  var row=e.target.closest('.row-item');
  if(!name||!row) return;

  var idx=[].slice.call(rowsEl.children).indexOf(row); if(idx<0) return;
  var exist=teams.findIndex(function(x){return normalizeName(x.name)===normalizeName(name);});
  if(exist!==-1 && exist!==idx) return;
  if(normalizeName(teams[idx].name)===normalizeName(name)) return;
  teams[idx].name=name; lastTeamCount=teams.length; render(); scheduleSave();
});

/* ---------- Drop z bazy na scenę (dodaj na koniec) ---------- */
if (stageEl){
  stageEl.addEventListener('dragover', function(e){
    var dt=e.dataTransfer, types=dt&&dt.types?Array.from(dt.types):[];
    var isClub=types.indexOf('text/club')!==-1||types.indexOf('application/x-club')!==-1;
    if(!isClub) return;
    if (e.target.closest('.row-item')) return;
    e.preventDefault();
  });
  stageEl.addEventListener('drop', function(e){
    var dt=e.dataTransfer, types=dt&&dt.types?Array.from(dt.types):[];
    var isClub=types.indexOf('text/club')!==-1||types.indexOf('application/x-club')!==-1;
    if(!isClub) return;
    if (e.target.closest('.row-item')) return;
    e.preventDefault();
    var name=dt.getData('text/club')||dt.getData('application/x-club')||'';
    if(!name) return;
    if(teams.findIndex(function(t){return normalizeName(t.name)===normalizeName(name);})!==-1) return;
    teams.push({name:name, pts:0}); lastTeamCount=teams.length; coerceSettings('auto'); scheduleSave();
  });
}

/* ---------- Sortowanie po punktach ---------- */
btnSortPts.addEventListener('click', function(){
  if (sortMode==='none' || sortMode==='asc'){ sortMode='desc'; teams.sort(function(a,b){return b.pts-a.pts;}); btnSortPts.textContent='↓'; }
  else { sortMode='asc'; teams.sort(function(a,b){return a.pts-b.pts;}); btnSortPts.textContent='↑'; }
  render(); scheduleSave();
});

/* ---------- Ładowanie bazy + komunikat błędu ---------- */
function tryInlineDb(){
  var el=document.getElementById('dbInline');
  if(!el) return null;
  try{ var txt=el.textContent||''; var arr=JSON.parse(txt); return normalizeDbArray(arr); }catch(e){ return null; }
}
async function loadDb(){
  var box=document.getElementById('dbError');
  var show=function(msg){ if(box){ box.style.display='block'; box.textContent=msg; } };
  var hide=function(){ if(box){ box.style.display='none'; box.textContent=''; } };

  var use = function(arr){
    dbTeams = normalizeDbArray(arr);
    var rank=function(t){ var e=getEmotesFromTags(t.tags); if(e.indexOf('⚽')!==-1&&e.indexOf('🏀')!==-1)return 2; if(e.indexOf('⚽')!==-1)return 1; if(e.indexOf('🏀')!==-1)return 0; return -1; };
    dbTeams.sort(function(a,b){ var ra=rank(a), rb=rank(b); if(ra!==rb) return rb-ra; return a.name.localeCompare(b.name,'pl'); });
  };

  try{
    var ov = storage.get(LS_KEYS.dbOverride);
    if (Array.isArray(ov) && ov.length>0){
      use(ov); show('Używam wczytanej/edytowanej bazy (lokalnie, wygaśnie po 24h).'); renderDbList(); return;
    }

    var inline = tryInlineDb();
    if (Array.isArray(inline) && inline.length>0){
      use(inline); hide(); renderDbList(); return;
    }

    if (location.protocol !== 'file:'){
      var res=await fetch(DB_URL+'?cb='+Date.now(),{cache:'no-store'});
      if(!res.ok) throw new Error('HTTP '+res.status);
      var txt=await res.text(); var arr;
      try{ arr=JSON.parse(txt); }catch(e){ throw new Error('niepoprawny JSON (przecinki/UTF-8)'); }
      if (Array.isArray(arr) && arr.length>0){ use(arr); hide(); renderDbList(); return; }
      show('Pusta baza z serwera – używam bazy wbudowanej.'); use(EMBEDDED_DB); renderDbList(); return;
    }

    show('Środowisko file:// – używam bazy wbudowanej.'); use(EMBEDDED_DB);
  }catch(e){
    show('Błąd ładowania bazy: '+(e.message||'nieznany')+' – używam bazy wbudowanej.'); use(EMBEDDED_DB);
  }
  renderDbList();
}

/* ---------- Import/eksport bazy ---------- */
if (btnLoadDb && fileDbEl){
  btnLoadDb.addEventListener('click', function(){ fileDbEl.click(); });
  fileDbEl.addEventListener('change', async function(e){
    var file = e.target.files && e.target.files[0];
    if(!file) return;
    try{
      var txt = await file.text();
      var arr = JSON.parse(txt);
      var norm = normalizeDbArray(arr);
      if (!norm.length) throw new Error('Plik JSON nie zawiera klubów.');
      dbTeams = norm;
      storage.set(LS_KEYS.dbOverride, dbTeams, ONE_DAY);
      renderDbList();
      var box=document.getElementById('dbError'); if(box){ box.style.display='block'; box.textContent='Załadowano własną bazę (lokalnie, wygaśnie po 24h).'; }
    }catch(err){
      alert('Nie udało się wczytać pliku JSON: ' + (err.message||err));
    }finally{
      fileDbEl.value='';
    }
  });
}
if (btnDownloadDb){
  btnDownloadDb.addEventListener('click', function(){
    var data = JSON.stringify(dbTeams, null, 2);
    var blob = new Blob([data], {type:'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'kluby.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}

/* ---------- Edytor bazy ---------- */
var editorIndex = -1;
function getEditorTags(){ var out=[]; if(edTagFootBtn && edTagFootBtn.classList.contains('active')) out.push('⚽'); if(edTagBasketBtn && edTagBasketBtn.classList.contains('active')) out.push('🏀'); return out; }
function setEditorTags(tags){ if(edTagFootBtn) edTagFootBtn.classList.toggle('active', (tags||[]).indexOf('⚽')!==-1); if(edTagBasketBtn) edTagBasketBtn.classList.toggle('active', (tags||[]).indexOf('🏀')!==-1); }
function updateEditorSaveBtn(){
  var hasName = edNameEl && String(edNameEl.value||'').trim().length>0;
  var hasTag = getEditorTags().length>0;
  if (btnEdSave) btnEdSave.disabled = !(hasName && hasTag);
}
function clearEditor(){ editorIndex=-1; if(edNameEl) edNameEl.value=''; if(edCountryEl) edCountryEl.value='SZ'; if(edCountryNameEl) edCountryNameEl.value=''; setEditorTags([]); if(btnEdDelete) btnEdDelete.disabled=true; updateEditorSaveBtn(); }
function openEditorForClub(name){
  var idx = dbTeams.findIndex(function(t){return normalizeName(t.name)===normalizeName(name);});
  if (idx<0) return;
  editorIndex = idx;
  var t = dbTeams[idx];
  if(edNameEl) edNameEl.value = t.name || '';
  if(edCountryEl) edCountryEl.value = getCountryCode(t);
  if(edCountryNameEl) edCountryNameEl.value = t.countryName || '';
  setEditorTags(getEmotesFromTags(t.tags));
  if(btnEdDelete) btnEdDelete.disabled=false;
  updateEditorSaveBtn();
}
if (edTagFootBtn) edTagFootBtn.addEventListener('click', function(){ edTagFootBtn.classList.toggle('active'); updateEditorSaveBtn(); });
if (edTagBasketBtn) edTagBasketBtn.addEventListener('click', function(){ edTagBasketBtn.classList.toggle('active'); updateEditorSaveBtn(); });
if (btnEdClear) btnEdClear.addEventListener('click', clearEditor);
if (btnEdDelete) btnEdDelete.addEventListener('click', function(){
  if (editorIndex<0) return;
  var name = (dbTeams[editorIndex] && dbTeams[editorIndex].name) || '';
  if (!confirm('Usunąć klub: ' + name + '?')) return;
  dbTeams.splice(editorIndex,1);
  storage.set(LS_KEYS.dbOverride, dbTeams, ONE_DAY);
  clearEditor();
  renderDbList();
});
if (edNameEl) edNameEl.addEventListener('input', updateEditorSaveBtn);
if (btnEdSave) btnEdSave.addEventListener('click', function(){
  var name = (edNameEl && edNameEl.value || '').trim();
  if (!name) return alert('Podaj nazwę klubu.');
  var cc = (edCountryEl && edCountryEl.value || 'SZ').toUpperCase();
  var cn = (edCountryNameEl && edCountryNameEl.value || '').trim();
  var tags = getEditorTags();
  if (tags.length === 0) return alert('Wybierz co najmniej jeden tag dyscypliny (⚽/🏀).');

  var dup = dbTeams.findIndex(function(t,i){ return i!==editorIndex && normalizeName(t.name)===normalizeName(name); });
  if (dup!==-1) return alert('Taki klub już istnieje w bazie.');

  cc = (cc==='SZ'||cc==='W'||cc==='I')?cc:'SZ';
  var rec = { name:name, country: cc, countryName: cc==='I'?cn:'', tags:tags };
  if (editorIndex>=0){ dbTeams[editorIndex] = rec; }
  else { dbTeams.push(rec); editorIndex = dbTeams.length-1; if(btnEdDelete) btnEdDelete.disabled=false; }

  storage.set(LS_KEYS.dbOverride, dbTeams, ONE_DAY);
  renderDbList();
  openEditorForClub(name);
});

/* ---------- Eksporty ---------- */
const waitForImages = function(node){
  return Promise.all([].map.call(node.querySelectorAll('img'), function(img){
    return new Promise(function(r){
      if(img.complete && img.naturalWidth>0) return r();
      img.addEventListener('load',r,{once:true}); img.addEventListener('error',r,{once:true});
    });
  }));
};

document.getElementById('btnExport').addEventListener('click', async function(){
  var stage=document.getElementById('stage'); stage.classList.add('exporting');
  await waitForImages(stage); await new Promise(function(r){ requestAnimationFrame(r); });
  try{
    var url=await htmlToImage.toJpeg(stage,{quality:.95,backgroundColor:getComputedStyle(document.documentElement).getPropertyValue('--bg')||'#f2f6fb',width:1920,height:1080,pixelRatio:1,preferCSSPageSize:true,cacheBust:true,imagePlaceholder:PLACEHOLDER_SVG});
    var a=document.createElement('a'); a.href=url; a.download='tabela_' + new Date().toISOString().slice(0,10) + '.jpg'; a.click();
  }finally{ stage.classList.remove('exporting'); }
});

document.getElementById('btnExportAll').addEventListener('click', async function(){
  var stage=document.getElementById('stage'), rows=document.getElementById('rows');
  var prevH=stage.style.height, prevOv=rows.style.overflow, prevAuto=rows.style.gridAutoRows, hadScroll=rows.classList.contains('scroll');
  stage.classList.add('export-all','exporting'); stage.style.height='auto'; rows.classList.remove('scroll'); rows.style.overflow='visible'; rows.style.gridAutoRows=getComputedStyle(document.documentElement).getPropertyValue('--rowH')||'86px';
  await waitForImages(stage); await new Promise(function(r){ requestAnimationFrame(r); });
  try{
    var rect=stage.getBoundingClientRect();
    var url=await htmlToImage.toJpeg(stage,{quality:.95,backgroundColor:getComputedStyle(document.documentElement).getPropertyValue('--bg')||'#f2f6fb',width:Math.round(rect.width),height:Math.round(stage.scrollHeight),pixelRatio:1,cacheBust:true,imagePlaceholder:PLACEHOLDER_SVG});
    var a=document.createElement('a'); a.href=url; a.download='tabela_full_' + new Date().toISOString().slice(0,10) + '.jpg'; a.click();
  }finally{
    stage.classList.remove('export-all','exporting'); stage.style.height=prevH||''; if(hadScroll) rows.classList.add('scroll'); rows.style.overflow=prevOv||''; rows.style.gridAutoRows=prevAuto||'';
  }
});

// Panel/baza – nasłuchy
document.getElementById('btnAdd').addEventListener('click', function(){ teams.push({name:'Nowa drużyna', pts:0}); lastTeamCount=teams.length; coerceSettings('auto'); scheduleSave(); });
document.getElementById('btnReset').addEventListener('click', function(){ teams=JSON.parse(JSON.stringify(defaultTeams)); selectedRowIndex=-1; sortMode='none'; btnSortPts.textContent='↕'; lastTeamCount=teams.length; coerceSettings('auto'); storage.clear(LS_KEYS.state); });

inPodium.addEventListener('input', function(){ coerceSettings('podium'); scheduleSave(); });
inPlayoff.addEventListener('input', function(){ coerceSettings('playoff'); scheduleSave(); });
inReleg.addEventListener('input', function(){ coerceSettings('releg'); scheduleSave(); });

inPodium.addEventListener('change', function(){ coerceSettings('podium'); scheduleSave(); });
inPlayoff.addEventListener('change', function(){ coerceSettings('playoff'); scheduleSave(); });
inReleg.addEventListener('change', function(){ coerceSettings('releg'); scheduleSave(); });

dbSearchEl.addEventListener('input', renderDbList);
btnDbAdd.addEventListener('click', function(){ var c=dbFiltered[dbSelectedIdx]; if(!c) return; if(teams.findIndex(function(t){return normalizeName(t.name)===normalizeName(c.name);})!==-1){ alert('Ta drużyna już jest w tabeli.'); return; } teams.push({name:c.name, pts:0}); lastTeamCount=teams.length; coerceSettings('auto'); scheduleSave(); });
btnDbReplace.addEventListener('click', function(){ var c=dbFiltered[dbSelectedIdx]; if(selectedRowIndex===-1||!c) return; var e=teams.findIndex(function(t){return normalizeName(t.name)===normalizeName(c.name);}); if(e!==-1 && e!==selectedRowIndex){ alert('Ta drużyna już jest w tabeli.'); return; } teams[selectedRowIndex]={name:c.name, pts:teams[selectedRowIndex].pts||0}; coerceSettings('auto'); scheduleSave(); });

// Tytuł – autosave
if (titleEl){
  var tmr=null;
  titleEl.addEventListener('input', function(){ clearTimeout(tmr); tmr=setTimeout(saveState, 400); });
  titleEl.addEventListener('blur', saveState);
}

/* ---------- Skróty klawiszowe ---------- */
document.addEventListener('keydown', function(e){
  var ae=document.activeElement;
  if (ae && (ae.isContentEditable || /^(input|textarea|select)$/i.test(ae.tagName))) return;

  if (e.ctrlKey && e.key && e.key.toLowerCase && e.key.toLowerCase()==='s'){ e.preventDefault(); var be=document.getElementById('btnExport'); if(be) be.click(); }
  else if (e.ctrlKey && e.key && e.key.toLowerCase && e.key.toLowerCase()==='f'){ e.preventDefault(); if(dbSearchEl) dbSearchEl.focus(); }
  else if (e.key==='Delete' && selectedRowIndex!==-1){
    teams.splice(selectedRowIndex,1);
    if(selectedRowIndex>=teams.length) selectedRowIndex=teams.length-1;
    lastTeamCount=teams.length; render(); scheduleSave();
  }
  else if (e.key==='ArrowDown'){
    if (selectedRowIndex<teams.length-1){ selectedRowIndex=(selectedRowIndex<0?0:selectedRowIndex+1); render(); }
    e.preventDefault();
  }
  else if (e.key==='ArrowUp'){
    if (selectedRowIndex>0){ selectedRowIndex=(selectedRowIndex<0?0:selectedRowIndex-1); render(); }
    e.preventDefault();
  }
  else if ((e.altKey||e.metaKey) && e.key==='ArrowUp' && selectedRowIndex>0){
    var i=selectedRowIndex; var t0=teams[i-1]; teams[i-1]=teams[i]; teams[i]=t0; selectedRowIndex=i-1; render(); scheduleSave(); e.preventDefault();
  }
  else if ((e.altKey||e.metaKey) && e.key==='ArrowDown' && selectedRowIndex<teams.length-1){
    var j=selectedRowIndex; var t1=teams[j+1]; teams[j+1]=teams[j]; teams[j]=t1; selectedRowIndex=j+1; render(); scheduleSave(); e.preventDefault();
  }
  else if (e.key==='Enter' && selectedRowIndex!==-1){
    e.preventDefault();
    var row=rowsEl.children[selectedRowIndex]; if(row){ var pe=row.querySelector('.pts'); if(pe) pe.focus(); }
  }
});

/* ---------- Zapamiętywanie stanu sekcji (30 dni) ---------- */
function initPanelsState(){
  var list = [
    ['secSettings', secSettings],
    ['secDb',       secDb],
    ['helpBox',     helpBox]
  ];
  var saved = storage.get(LS_KEYS.panels) || {};

  list.forEach(function(pair){
    var key=pair[0], el=pair[1];
    if(!el) return;
    if (typeof saved[key] === 'boolean'){
      if (saved[key]) el.setAttribute('open','');
      else el.removeAttribute('open');
    }
    el.addEventListener('toggle', function(){
      var data = storage.get(LS_KEYS.panels) || {};
      data[key] = el.hasAttribute('open');
      storage.set(LS_KEYS.panels, data, THIRTY_DAYS);
    });
  });
}

/* ---------- Zmiana rozmiaru tabeli ---------- */
function resizeTeams(newSize){
  newSize = Math.max(1, Math.min(64, newSize|0));
  var cur = teams.length;
  if (newSize === cur) return false;

  if (newSize > cur){
    var toAdd = newSize - cur;
    for (var i=0;i<toAdd;i++){
      var base='Nowa drużyna', name=base, k=1;
      while (teams.some(function(t){return normalizeName(t.name)===normalizeName(name);})){
        k++; name = base + ' ' + k;
      }
      teams.push({name:name, pts:0});
    }
    lastTeamCount=teams.length;
    return true;
  } else {
    var removed = cur - newSize;
    if (!confirm('Zastosować rozmiar ' + newSize + ' i usunąć ' + removed + ' wierszy z dołu tabeli?')) return false;
    teams.splice(newSize);
    if (selectedRowIndex >= newSize) selectedRowIndex = newSize - 1;
    lastTeamCount=teams.length;
    return true;
  }
}

/* ---------- Profile lig ---------- */
const BUILTIN_PROFILES = [
  { id:'builtin:std12',  name:'Domyślna 12 (3/0/2)', data:{ title:'Tabela ligowa', podium:3, playoff:0, releg:2, size:12 } },
  { id:'builtin:liga16', name:'Liga 16 (3/2/3)',     data:{ title:'Liga 16',      podium:3, playoff:2, releg:3, size:16 } },
  { id:'builtin:liga10', name:'Liga 10 (2/2/2)',     data:{ title:'Liga 10',      podium:2, playoff:2, releg:2, size:10 } }
];
function getUserProfiles(){ var u=storage.get(LS_KEYS.profiles); return Array.isArray(u)?u:[]; }
function saveUserProfiles(list){ storage.set(LS_KEYS.profiles, Array.isArray(list)?list:[], null); }
function renderProfilesUI(){
  if (!profileSelectEl) return;
  var user = getUserProfiles();
  profileSelectEl.innerHTML='';
  [].concat(BUILTIN_PROFILES, user).forEach(function(p){
    var opt=document.createElement('option');
    opt.value=p.id; opt.textContent=p.name + (p.id.indexOf('builtin:')===0?' (wbudowany)':'');
    opt.dataset.builtin = String(p.id.indexOf('builtin:')===0);
    profileSelectEl.appendChild(opt);
  });
  updateProfileDeleteBtn();
}
function updateProfileDeleteBtn(){
  if(!btnProfileDelete || !profileSelectEl) return;
  var sel = profileSelectEl.value;
  btnProfileDelete.disabled = !sel || sel.indexOf('builtin:')===0;
}
function applyProfile(p){
  if(!p || !p.data) return;
  if (typeof p.data.size === 'number'){
    resizeTeams(p.data.size);
  }
  inPodium.value = p.data.podium;
  inPlayoff.value = p.data.playoff;
  inReleg.value = p.data.releg;
  if (titleEl && p.data.title) titleEl.textContent = p.data.title;
  coerceSettings('auto'); scheduleSave(); render();
}
if (btnProfileSave) btnProfileSave.addEventListener('click', function(){
  var name=(profileNameEl && profileNameEl.value || '').trim() || ('Profil ' + new Date().toLocaleDateString('pl-PL'));
  var p={ id:uid('profile'), name:name, data:{ title:(titleEl && titleEl.textContent || '').trim() || 'Tabela ligowa', podium:+inPodium.value|0, playoff:+inPlayoff.value|0, releg:+inReleg.value|0, size: teams.length } };
  var user=getUserProfiles(); user.push(p); saveUserProfiles(user); renderProfilesUI();
  var idx=[].slice.call(profileSelectEl.options).findIndex(function(o){return o.value===p.id;}); if(idx>=0) profileSelectEl.selectedIndex=idx;
});
if (btnProfileLoad) btnProfileLoad.addEventListener('click', function(){
  var id=profileSelectEl ? profileSelectEl.value : ''; if(!id) return;
  var all = [].concat(BUILTIN_PROFILES, getUserProfiles());
  var p = all.find(function(x){return x.id===id;});
  if(!p) return; applyProfile(p);
});
if (profileSelectEl) profileSelectEl.addEventListener('change', updateProfileDeleteBtn);
if (btnProfileDelete) btnProfileDelete.addEventListener('click', function(){
  var id=profileSelectEl ? profileSelectEl.value : ''; if(!id || id.indexOf('builtin:')===0) return;
  var user=getUserProfiles(); var idx=user.findIndex(function(x){return x.id===id;});
  if(idx===-1) return;
  if(!confirm('Usunąć profil: ' + user[idx].name + '?')) return;
  user.splice(idx,1); saveUserProfiles(user); renderProfilesUI();
});

/* ---------- Start ---------- */
initPanelsState();
loadSavedState();
coerceSettings('auto');
loadDb();
renderProfilesUI();