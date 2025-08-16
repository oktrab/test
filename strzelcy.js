// Konfiguracja
var DB_URL = 'kluby.json';
var LOGO_PATH = 'herby';
var PLACEHOLDER_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="100%" height="100%" rx="12" ry="12" fill="#e5e7eb"/><text x="50%" y="54%" text-anchor="middle" font-family="Inter, Arial" font-size="18" fill="#475569">LOGO</text></svg>');
var ONE_DAY = 24*60*60*1000;

// DOM
var rowsEl = document.getElementById('rows');
var dbSearchEl = document.getElementById('dbSearch');
var dbListEl = document.getElementById('dbList');
var btnExport = document.getElementById('btnExport');
var btnReset = document.getElementById('btnReset');
var btnLoadDb = document.getElementById('btnLoadDb');
var fileDbEl = document.getElementById('fileDb');
var btnDownloadDb = document.getElementById('btnDownloadDb');
var scTitleEl = document.getElementById('scTitle');
var btnSortGoals = document.getElementById('btnSortGoals');

// Filtry bazy
var selectedTag = null, selectedCountry = null;

// Baza klubów (SZ/W/I)
var dbTeams = [];
var dbFiltered = [];

// Stan
var scorers = []; // {name, goals, club, cc}
var rowsSortable = null;
var sortGoalsMode = 'none';

// Helpers
var storage = {
  set:function(k,data,ttl){ try{ localStorage.setItem(k, JSON.stringify({ts:Date.now(),ttl:ttl||ONE_DAY,data:data})) }catch(e){} },
  get:function(k){ try{ var raw=localStorage.getItem(k); if(!raw) return null; var o=JSON.parse(raw); if(o && o.ttl && Date.now()-o.ts>o.ttl){ localStorage.removeItem(k); return null; } return o?o.data:null; }catch(e){ return null; } }
};
function buildLogoUrl(name){ return LOGO_PATH + '/' + encodeURIComponent(String(name||'').trim()) + '.png'; }
function setAutoLogo(img, club){ img.onerror=function(){ img.onerror=null; img.src=PLACEHOLDER_SVG; }; img.src = club ? buildLogoUrl(club) : PLACEHOLDER_SVG; }
function normalizeName(s){ return String(s||'').trim().replace(/\s+/g,' ').toLowerCase(); }
function stripAccents(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function abbr(name){ return String(name||'').trim().split(/\s+/).map(function(p){return p[0];}).join('').slice(0,3).toUpperCase(); }
function colorFor(name){ var h=0, str=String(name||''); for(var i=0;i<str.length;i++){ h=(h*31+str.charCodeAt(i))%360; } return 'hsl(' + h + ' 70% 45%)'; }

// normalizacja bazy klubów – SZ/W/I
function normalizeDbArray(rawArr){
  return (Array.isArray(rawArr)?rawArr:[]).map(function(x){
    if(typeof x==='string') return { name:x, tags:[], country:'SZ' };
    var cc = String((x && (x.country||x.c)) || 'SZ').toUpperCase();
    cc = (cc==='SZ'||cc==='W'||cc==='I') ? cc : 'SZ';
    return {
      name:(x&&x.name)||'',
      tags:(x&&(x.tags!=null?x.tags:(x.tag!=null?x.tag:[])))||[],
      country:cc,
      countryName:(x&&x.countryName)||(x&&x.cn)||''
    };
  }).filter(function(t){ return t.name; });
}
function getCountryCodeClub(t){
  var cc=String((t && (t.country||t.c)) || 'SZ').toUpperCase();
  return (cc==='SZ'||cc==='W'||cc==='I')?cc:'SZ';
}
function countryTitleClub(t){
  var cc=getCountryCodeClub(t);
  if (cc==='I'){
    var cn = String((t&&t.countryName)||'').trim();
    return 'Inne kraje' + (cn?': '+cn:'');
  }
  return cc==='SZ'?'Szwajcaria':(cc==='W'?'Wosterg':cc);
}

// Wybór kraju zawodnika – mapowanie z klubu (I+countryName → Z/A)
function derivePlayerCCFromClub(t){
  var raw = String((t && (t.country||t.c)) || 'SZ').toUpperCase();
  if (raw==='SZ' || raw==='W') return raw;
  var cn = String((t && (t.countryName||t.cn)) || '').toLowerCase();
  if (cn.indexOf('zephyr') !== -1) return 'Z';
  if (cn.indexOf('aleks') !== -1 || cn.indexOf('alex') !== -1) return 'A';
  return 'Z';
}

// Inicjalne 10 wierszy
function defaultScorers(){ var arr=[]; for(var i=0;i<10;i++){ arr.push({ name:'', goals:0, club:'', cc:'' }); } return arr; }

// CC menu (popover dla zawodnika)
var ccMenuEl = (function(){
  var el=document.createElement('div'); el.className='cc-menu';
  var opts=[{cc:'SZ',name:'Szwajcaria'},{cc:'W',name:'Wosterg'},{cc:'Z',name:'Zephyria'},{cc:'A',name:'Aleksandria'}];
  opts.forEach(function(o){
    var b=document.createElement('button');
    b.type='button'; b.className='cc-item';
    b.innerHTML='<span class="cc-badge" data-cc="'+o.cc+'">'+o.cc+'</span><span>'+o.name+'</span>';
    b.dataset.cc=o.cc;
    el.appendChild(b);
  });
  document.body.appendChild(el);
  return el;
})();
function showCcMenu(anchor, onPick){
  var r=anchor.getBoundingClientRect();
  ccMenuEl.style.display='block';
  ccMenuEl.style.left = Math.round(window.scrollX + r.left) + 'px';
  ccMenuEl.style.top  = Math.round(window.scrollY + r.bottom + 6) + 'px';
  var handler=function(e){
    var btn=e.target.closest('.cc-item');
    if(btn){ onPick(btn.dataset.cc); hideCcMenu(); }
    else if(!e.target.closest('.cc-menu')){ hideCcMenu(); }
  };
  function hideCcMenu(){
    ccMenuEl.style.display='none';
    document.removeEventListener('mousedown', handler, true);
    document.removeEventListener('wheel', handler, true);
  }
  document.addEventListener('mousedown', handler, true);
  document.addEventListener('wheel', handler, true);
}

// Render
function render(){
  rowsEl.innerHTML = '';
  scorers.forEach(function(s,i){
    var row=document.createElement('div');
    row.className='row-item';
    row.innerHTML =
      '<div class="pos" title="Przeciągnij, aby zmienić kolejność">'+(i+1)+'</div>'
     +'<div class="club"><img class="logo" alt="" title="'+(s.club||'')+'"></div>'
     +'<div class="cc" data-cc="'+(s.cc||'')+'">'+(s.cc||'')+'</div>'
     +'<div class="name" contenteditable="true" spellcheck="false" data-ph="Imię i nazwisko">'+(s.name||'')+'</div>'
     +'<div class="goals"><span class="gval" contenteditable="true" spellcheck="false">'+(s.goals||0)+'</span></div>';

    // Logo
    var img=row.querySelector('.logo'); setAutoLogo(img, s.club);

    // CC zawodnika (klik -> menu)
    var ccEl=row.querySelector('.cc');
    ccEl.addEventListener('click', function(){
      showCcMenu(ccEl, function(cc){
        s.cc=cc; ccEl.dataset.cc=cc; ccEl.textContent=cc; saveStateSoon();
      });
    });

    // Name
    var nameEl=row.querySelector('.name');
    nameEl.addEventListener('input', function(e){ scorers[i].name=e.currentTarget.textContent.trim(); });
    nameEl.addEventListener('blur', function(){ saveStateSoon(); });

    // Goals
    var gEl=row.querySelector('.gval');
    gEl.addEventListener('beforeinput', function(e){
      if(e.inputType==='insertText'){
        var ch=e.data||''; if(!/[\d]/.test(ch)){ e.preventDefault(); }
      }else if(e.inputType==='insertFromPaste'){
        e.preventDefault();
        var text = (e.clipboardData || window.clipboardData) ? (e.clipboardData.getData && e.clipboardData.getData('text')) || '' : '';
        var clean = (text.match(/\d+/) || [''])[0];
        document.execCommand('insertText', false, clean);
      }
    });
    gEl.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); gEl.blur(); } });
    gEl.addEventListener('input', function(e){
      var raw=e.currentTarget.textContent; var v=(raw.match(/\d+/)||[''])[0];
      scorers[i].goals = Number(v||0);
    });
    gEl.addEventListener('blur', function(e){
      var raw=e.currentTarget.textContent; var v=(raw.match(/\d+/)||['0'])[0];
      e.currentTarget.textContent=v; scorers[i].goals=Number(v); saveStateSoon();
    });

    // Drop club na wiersz
    row.addEventListener('dragover', function(e){
      var dt=e.dataTransfer, types=dt&&dt.types?Array.from(dt.types):[];
      var isClub=types.indexOf('text/club')!==-1||types.indexOf('application/x-club')!==-1;
      if(!isClub) return; e.preventDefault(); row.classList.add('db-over');
    });
    row.addEventListener('dragleave', function(){ row.classList.remove('db-over'); });
    row.addEventListener('drop', function(e){
      row.classList.remove('db-over');
      var dt=e.dataTransfer, types=dt&&dt.types?Array.from(dt.types):[];
      var isClub=types.indexOf('text/club')!==-1||types.indexOf('application/x-club')!==-1; if(!isClub) return;
      e.preventDefault();
      var name=dt.getData('text/club')||dt.getData('application/x-club')||''; if(!name) return;
      scorers[i].club = name;
      var t = dbTeams.find(function(k){return normalizeName(k.name)===normalizeName(name);});
      // kraj zawodnika wyprowadzony z klubu (I + countryName -> Z/A)
      scorers[i].cc = t ? derivePlayerCCFromClub(t) : (scorers[i].cc||'');
      render(); saveStateSoon();
    });

    rowsEl.appendChild(row);
  });

  initDnD();
}

// DND kolejność
function initDnD(){
  if (rowsSortable && rowsSortable.destroy) rowsSortable.destroy();
  rowsSortable = new Sortable(rowsEl, {
    animation:150, handle:'.pos', draggable:'.row-item',
    onEnd:function(e){
      if(e.oldIndex===e.newIndex||e.oldIndex==null||e.newIndex==null) return;
      var it=scorers.splice(e.oldIndex,1)[0]; scorers.splice(e.newIndex,0,it);
      render(); saveStateSoon();
    }
  });
}

// Baza klubów (SZ/W/I) + filtry
var EMBEDDED_DB = [
  { name: 'Zamieć Bór', tags:['⚽'], country:'SZ' },
  { name: 'Żółci Przennów', tags:['⚽'], country:'SZ' },
  { name: 'Biali Tatarów', tags:['⚽'], country:'SZ' },
  { name: 'Brzozy Mały Baczów', tags:['⚽'], country:'SZ' },
  { name: 'Czarni Baczów', tags:['⚽'], country:'SZ' },
  { name: 'Olimpia Aavekaupunki', tags:['⚽'], country:'SZ' },
  { name: 'Areniscas Cadin', tags:['⚽','🏀'], country:'W' },
  { name: 'Union Zephyr', tags:['⚽'], country:'I', countryName:'Zephyria' }
];
function sortDbTeamsByName(list){ return list.slice().sort(function(a,b){ return a.name.localeCompare(b.name,'pl'); }); }
function getEmotesFromTags(raw){
  var arr=[]; if(Array.isArray(raw)) arr=raw; else if(typeof raw==='string') arr=raw.split(/[,;\s]+/); else if(raw&&typeof raw.tag==='string') arr=[raw.tag];
  return arr.map(function(x){ return String(x||'').trim(); }).filter(Boolean).map(function(x){
    var lx=x.toLowerCase();
    if (x==='⚽'||lx==='piłka'||lx==='pilka'||lx==='soccer'||lx==='football') return '⚽';
    if (x==='🏀'||lx==='kosz'||lx==='basket'||lx==='basketball') return '🏀';
    return null;
  }).filter(Boolean);
}
function renderDbList(){
  var q = stripAccents(String(dbSearchEl.value||'').trim());
  var list = sortDbTeamsByName(dbTeams)
    .filter(function(t){ return !q || stripAccents(t.name).includes(q); })
    .filter(function(t){
      if (selectedTag){ var e=getEmotesFromTags(t.tags); if (e.indexOf(selectedTag)===-1) return false; }
      if (selectedCountry){
        var cc = getCountryCodeClub(t);
        if (cc !== selectedCountry) return false;
      }
      return true;
    });

  dbFiltered = list;
  dbListEl.innerHTML='';
  list.slice(0,250).forEach(function(t){
    var item=document.createElement('button'); item.type='button'; item.className='db-item'; item.style.setProperty('--badge',colorFor(t.name));
    var badge=document.createElement('span'); badge.className='db-badge'; badge.textContent=abbr(t.name);
    var label=document.createElement('span'); label.className='db-name'; label.textContent=t.name;
    var c=document.createElement('span'); c.className='db-country'; var cc=getCountryCodeClub(t); c.dataset.cc=cc; c.textContent=cc; c.title=countryTitleClub(t);
    item.appendChild(badge); item.appendChild(label); item.appendChild(c);
    item.draggable=true;
    item.addEventListener('dragstart', function(e){
      e.dataTransfer.setData('text/club',t.name);
      e.dataTransfer.setData('application/x-club',t.name);
      e.dataTransfer.setData('text/plain',t.name);
      e.dataTransfer.effectAllowed='copy';
    });
    dbListEl.appendChild(item);
  });
}

// Filtry
function updateTagPillsUI(){ [].forEach.call(document.querySelectorAll('#tagFilter .tag-pill'), function(b){ var t=b.dataset.tag; if(t==='__clear') b.classList.remove('active'); else b.classList.toggle('active', selectedTag===t); }); }
[].forEach.call(document.querySelectorAll('#tagFilter .tag-pill'), function(btn){ btn.addEventListener('click',function(){ var t=btn.dataset.tag; selectedTag=(t==='__clear')?null:(selectedTag===t?null:t); updateTagPillsUI(); renderDbList(); }); });
updateTagPillsUI();

function updateCountryPillsUI(){ [].forEach.call(document.querySelectorAll('#countryFilter .country-pill'), function(b){ var c=b.dataset.country; if(c==='__clear') b.classList.remove('active'); else b.classList.toggle('active', selectedCountry===c); }); }
[].forEach.call(document.querySelectorAll('#countryFilter .country-pill'), function(btn){ btn.addEventListener('click',function(){ var c=btn.dataset.country; selectedCountry=(c==='__clear')?null:(selectedCountry===c?null:c); updateCountryPillsUI(); renderDbList(); }); });
updateCountryPillsUI();

// Sortowanie po golach
if (btnSortGoals){
  btnSortGoals.addEventListener('click', function(){
    if (sortGoalsMode==='none' || sortGoalsMode==='asc'){ sortGoalsMode='desc'; scorers.sort(function(a,b){return (b.goals|0)-(a.goals|0)}); btnSortGoals.textContent='↓'; }
    else { sortGoalsMode='asc'; scorers.sort(function(a,b){return (a.goals|0)-(b.goals|0)}); btnSortGoals.textContent='↑'; }
    render();
  });
}

// Eksport JPG
btnExport.addEventListener('click', async function(){
  var stage=document.getElementById('stage'); stage.classList.add('exporting');
  await new Promise(function(r){ requestAnimationFrame(r); });
  try{
    var url=await htmlToImage.toJpeg(stage,{quality:.95,backgroundColor:getComputedStyle(document.documentElement).getPropertyValue('--bg')||'#f2f6fb',width:1920,height:1080,pixelRatio:1,preferCSSPageSize:true,cacheBust:true,imagePlaceholder:PLACEHOLDER_SVG});
    var a=document.createElement('a'); a.href=url; a.download='strzelcy_' + new Date().toISOString().slice(0,10) + '.jpg'; a.click();
  }finally{ stage.classList.remove('exporting'); }
});

// Reset
btnReset.addEventListener('click', function(){
  scorers = defaultScorers();
  scTitleEl.textContent = 'Król Strzelców';
  saveStateSoon(); render();
});

// Szukajka
dbSearchEl.addEventListener('input', renderDbList);

// Autosave (TTL 24h)
var saveTimer=null;
function saveState(){ storage.set('scorers_state_v1', { scorers:scorers, title: String(scTitleEl.textContent||'').trim() }, ONE_DAY); }
function saveStateSoon(){ clearTimeout(saveTimer); saveTimer=setTimeout(saveState, 400); }
function loadState(){
  var s=storage.get('scorers_state_v1');
  if(!s) return false;
  if(Array.isArray(s.scorers)) scorers = s.scorers.map(function(x){ return { name:String(x.name||''), goals:Number(x.goals||0), club:String(x.club||''), cc:String(x.cc||'') }; });
  if(s.title) scTitleEl.textContent = s.title;
  return true;
}
scTitleEl.addEventListener('input', saveStateSoon);
scTitleEl.addEventListener('blur', saveState);

// Start
if(!loadState()) scorers = defaultScorers();
render();
loadDb();