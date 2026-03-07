// ══════════════════════════════════════════════
//  strzelcy/app.js v15
// ══════════════════════════════════════════════
(function () {
  'use strict';

  /* ═══ CONFIG ═══ */
  var PLAYERS_DB_URL = '../zawodnicy.json';
  var LOGO_PATH = '../herby';
  var ONE_DAY = 24 * 60 * 60 * 1000;
  var AC_LIMIT = 8;
  var AC_HIDE_MS = 150;
  var MAX_DB_VISIBLE = 300;
  var SAVE_DELAY = 400;
  var DEFAULT_ROWS = 10;
  var VALID_CC = ['SZ', 'W', 'Z', 'A'];
  var PLACEHOLDER_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">'
    + '<rect width="100%" height="100%" rx="12" ry="12" fill="#e5e7eb"/>'
    + '<text x="50%" y="54%" text-anchor="middle" font-family="Inter,Arial" font-size="18" fill="#475569">LOGO</text>'
    + '</svg>'
  );

  var CC_OPTIONS = [
    { code: 'SZ', name: 'Szwajcaria', cls: 'sz' },
    { code: 'W',  name: 'Wosterg',    cls: 'w'  },
    { code: 'Z',  name: 'Zephyria',   cls: 'z'  },
    { code: 'A',  name: 'Aleksandria', cls: 'a'  }
  ];

  /* ═══ STORAGE ═══ */
  var storage = {
    set: function (k, data, ttl) {
      try {
        localStorage.setItem(k, JSON.stringify({
          ts: Date.now(), ttl: ttl || ONE_DAY, data: data
        }));
      } catch (e) {}
    },
    get: function (k) {
      try {
        var o = JSON.parse(localStorage.getItem(k));
        if (!o) return null;
        if (o.ttl && Date.now() - o.ts > o.ttl) {
          localStorage.removeItem(k);
          return null;
        }
        return o.data;
      } catch (e) { return null; }
    },
    clear: function (k) {
      try { localStorage.removeItem(k); } catch (e) {}
    }
  };

  /* ═══ HELPERS ═══ */
  var $ = function (id) { return document.getElementById(id); };

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = String(s || '');
    return d.innerHTML;
  }

  function buildLogoUrl(name) {
    return LOGO_PATH + '/' + encodeURIComponent(String(name || '').trim()) + '.png';
  }

  function setAutoLogo(img, club) {
    img.onerror = function () { img.onerror = null; img.src = PLACEHOLDER_SVG; };
    img.src = club ? buildLogoUrl(club) : PLACEHOLDER_SVG;
  }

  function normalizeName(s) {
    return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function stripAccents(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function abbr(name) {
    return String(name || '').trim().split(/\s+/).map(function (p) {
      return p[0];
    }).join('').slice(0, 3).toUpperCase();
  }

  function colorFor(name) {
    var h = 0, str = String(name || '');
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
    return 'hsl(' + h + ' 70% 45%)';
  }

  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  function insertTextAtCursor(text) {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    var range = sel.getRangeAt(0);
    range.deleteContents();
    var node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.setEndAfter(node);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function normalizePlayersArray(arr) {
    return (Array.isArray(arr) ? arr : []).map(function (x) {
      if (!x) return null;
      var name = String(x.name || '').trim();
      if (!name) return null;
      var goals = Number(x.goals || 0);
      var club = String(x.club || '').trim();
      var cc = String(x.cc || '').toUpperCase();
      if (VALID_CC.indexOf(cc) === -1) cc = '';
      return {
        name: name,
        goals: isFinite(goals) && goals >= 0 ? goals : 0,
        club: club,
        cc: cc
      };
    }).filter(Boolean);
  }

  function tryInlinePlayers() {
    var el = $('playersInline');
    if (!el) return null;
    try { return normalizePlayersArray(JSON.parse(el.textContent || '')); }
    catch (e) { return null; }
  }

  /* ═══ DOM REFS ═══ */
  var rowsEl            = $('rows');
  var btnExport         = $('btnExport');
  var btnReset          = $('btnReset');
  var btnAddRow         = $('btnAddRow');
  var btnRemoveRow      = $('btnRemoveRow');
  var scTitleEl         = $('scTitle');
  var btnSortGoals      = $('btnSortGoals');
  var pdbErrorEl        = $('pdbError');
  var btnLoadPlayersDb  = $('btnLoadPlayersDb');
  var filePlayersDbEl   = $('filePlayersDb');
  var btnDownloadDb     = $('btnDownloadPlayersDb');
  var pdbSearchEl       = $('pdbSearch');
  var pdbListEl         = $('pdbList');
  var pdbCcFilterEl     = $('pdbCcFilter');
  var pdbClubSelectEl   = $('pdbClub');
  var rowCountEl        = $('rowCount');

  /* ═══ STATE ═══ */
  var playersDb = [];
  var scorers = [];
  var rowsSortable = null;
  var sortGoalsMode = 'none';
  var selectedPdbCC = null;
  var selectedPdbClub = '';
  var LS_PLAYERS_DB = 'scorers_db_v1';
  var activeACBox = null;

  /* ═══ CC MENU (globalny dropdown) ═══ */
  var ccMenuEl = null;
  var ccMenuOnPick = null;

  function ensureCCMenu() {
    if (ccMenuEl) return ccMenuEl;
    var el = document.createElement('div');
    el.className = 'ccg-menu';
    var list = document.createElement('div');
    list.className = 'ccg-list';
    CC_OPTIONS.forEach(function (opt) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ccg-opt';
      var chip = document.createElement('span');
      chip.className = 'ccg-chip ' + opt.cls;
      chip.textContent = opt.code;
      var lab = document.createElement('span');
      lab.className = 'ccg-label';
      lab.textContent = opt.name;
      b.appendChild(chip);
      b.appendChild(lab);
      b.addEventListener('click', function () {
        if (typeof ccMenuOnPick === 'function') ccMenuOnPick(opt.code);
        hideCCMenu();
      });
      list.appendChild(b);
    });
    el.appendChild(list);
    el.style.display = 'none';
    document.body.appendChild(el);
    ccMenuEl = el;
    return el;
  }

  function showCCMenu(anchorBtn, onPick) {
    var el = ensureCCMenu();
    ccMenuOnPick = onPick;
    el.style.display = 'block';
    var r = anchorBtn.getBoundingClientRect();
    var menuW = el.offsetWidth || 220;
    var menuH = el.offsetHeight || 160;
    var top = Math.round(r.bottom + 8);
    var left = Math.round(r.left);
    if (top + menuH > window.innerHeight - 8) top = Math.max(8, Math.round(r.top - 8 - menuH));
    if (left + menuW > window.innerWidth - 8) left = Math.max(8, window.innerWidth - 8 - menuW);
    el.style.top = top + 'px';
    el.style.left = left + 'px';
    el.classList.add('open');
  }

  function hideCCMenu() {
    if (!ccMenuEl) return;
    ccMenuEl.classList.remove('open');
    ccMenuEl.style.display = 'none';
  }

  document.addEventListener('click', function (e) {
    if (!ccMenuEl || ccMenuEl.style.display === 'none') return;
    if (e.target.closest && e.target.closest('.ccg-menu')) return;
    hideCCMenu();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') hideCCMenu();
  });

  /* ═══ CC PICKER (w wierszu) ═══ */
  function buildCCPicker(model, onChange) {
    var wrap = document.createElement('div');
    wrap.className = 'cc';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cc-btn';
    function renderBtn() {
      var code = (model.cc || '').toUpperCase();
      btn.setAttribute('data-cc', code);
      btn.textContent = code || '';
      var opt = CC_OPTIONS.find(function (o) { return o.code === code; });
      btn.title = opt ? opt.name : 'Wybierz kraj';
    }
    renderBtn();
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      showCCMenu(btn, function (picked) {
        model.cc = picked;
        renderBtn();
        if (onChange) onChange(picked);
      });
    });
    wrap.appendChild(btn);
    return wrap;
  }

  /* ═══ AUTOCOMPLETE ═══ */
  function isNameUsed(name, exceptIdx) {
    var nn = normalizeName(name);
    if (!nn) return false;
    return scorers.some(function (x, idx) {
      return idx !== exceptIdx && normalizeName(x.name) === nn;
    });
  }

  function playerSuggestions(query, exceptIdx) {
    var q = stripAccents(String(query || '').trim());
    if (!q) return [];
    var usedNames = {};
    scorers.forEach(function (x, idx) {
      if (idx !== exceptIdx) {
        var nn = normalizeName(x.name);
        if (nn) usedNames[nn] = true;
      }
    });
    return playersDb
      .filter(function (p) {
        return p && p.name && !usedNames[normalizeName(p.name)]
          && stripAccents(p.name).indexOf(q) !== -1;
      })
      .sort(function (a, b) {
        var ap = stripAccents(a.name).indexOf(q) === 0 ? 0 : 1;
        var bp = stripAccents(b.name).indexOf(q) === 0 ? 0 : 1;
        return ap - bp || a.name.localeCompare(b.name, 'pl');
      })
      .slice(0, AC_LIMIT);
  }

  function destroyActiveAC() {
    if (activeACBox) { activeACBox.remove(); activeACBox = null; }
  }

  function createACBox() {
    destroyActiveAC();
    var box = document.createElement('div');
    box.className = 'ac';
    document.body.appendChild(box);
    activeACBox = box;
    return box;
  }

  function renderACItems(box, items, onPick) {
    if (!items.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.innerHTML = '';
    items.forEach(function (p, idx) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ac-item' + (idx === 0 ? ' selected' : '');
      b.dataset.idx = idx;
      b.innerHTML =
        '<span class="ac-badge" style="--badge:' + colorFor(p.name) + '">' + escapeHtml(abbr(p.name)) + '</span>'
        + '<span class="ac-text">' + escapeHtml(p.name) + (p.club ? ' – ' + escapeHtml(p.club) : '') + '</span>'
        + '<span class="ac-tags">' + escapeHtml(p.cc || '') + '</span>';
      b.addEventListener('mousedown', function (e) { e.preventDefault(); onPick(p); });
      box.appendChild(b);
    });
    box.style.display = 'block';
  }

  function moveACSelection(box, dir) {
    if (!box || box.style.display === 'none') return;
    var items = box.querySelectorAll('.ac-item');
    if (!items.length) return;
    var cur = -1;
    for (var j = 0; j < items.length; j++) {
      if (items[j].classList.contains('selected')) { cur = j; break; }
    }
    var next = (cur + dir + items.length) % items.length;
    for (var j = 0; j < items.length; j++) {
      items[j].classList.toggle('selected', j === next);
    }
  }

  function getACSelected(box, data) {
    if (!box) return null;
    var sel = box.querySelector('.ac-item.selected');
    if (!sel) return null;
    return data[parseInt(sel.dataset.idx, 10) || 0] || null;
  }

  /* ═══ SCORERS — domyślne wiersze ═══ */
  function defaultScorers() {
    var arr = [];
    for (var i = 0; i < DEFAULT_ROWS; i++) {
      arr.push({ name: '', goals: 0, club: '', cc: '' });
    }
    return arr;
  }

  function updateRowCount() {
    if (rowCountEl) {
      rowCountEl.textContent = scorers.length;
    }
  }

  /* ═══ RENDER ═══ */
  function render() {
    destroyActiveAC();
    rowsEl.innerHTML = '';

    scorers.forEach(function (s, i) {
      var row = document.createElement('div');
      row.className = 'row-item';
      row.innerHTML =
        '<div class="pos" title="Przeciągnij, aby zmienić kolejność">' + (i + 1) + '</div>'
        + '<div class="club"><img class="logo" alt="" title="' + escapeHtml(s.club || '') + '"></div>'
        + '<div class="cc-cell"></div>'
        + '<div class="name" contenteditable="true" spellcheck="false" data-ph="Imię i nazwisko">'
          + escapeHtml(s.name || '')
        + '</div>'
        + '<div class="goals"><span class="gval" contenteditable="true" spellcheck="false">'
          + (s.goals || 0)
        + '</span></div>';

      var img = row.querySelector('.logo');
      setAutoLogo(img, s.club);
      var ccCell = row.querySelector('.cc-cell');
      ccCell.appendChild(buildCCPicker(s, function () { saveStateSoon(); }));

      attachNameHandlers(row, s, i);
      attachGoalsHandlers(row, s, i);
      attachDropHandlers(row, i);
      rowsEl.appendChild(row);
    });

    updateRowCount();
    initDnD();

    // Renderuj listę bazy TYLKO jeśli playersDb jest już załadowane
    if (playersDb.length) {
      renderPlayersDbList();
    }
  }

  /* ═══ NAME HANDLERS ═══ */
  function attachNameHandlers(row, s, i) {
    var nameEl = row.querySelector('.name');
    var acBox = null;
    var acData = [];
    var accepted = false;

    function accept(p) {
      if (!p || isNameUsed(p.name, i)) return;
      accepted = true;
      scorers[i] = {
        name: p.name,
        goals: Number(p.goals || 0),
        club: String(p.club || ''),
        cc: String(p.cc || '')
      };
      destroyActiveAC();
      acBox = null;
      render();
      saveStateSoon();
    }

    function showAC() {
      acData = playerSuggestions(nameEl.textContent, i);
      if (!acBox) acBox = createACBox();
      renderACItems(acBox, acData, accept);
      if (acData.length) {
        var r = nameEl.getBoundingClientRect();
        acBox.style.left = r.left + 'px';
        acBox.style.top = (r.bottom + 6) + 'px';
      }
    }

    nameEl.addEventListener('focus', function () { accepted = false; showAC(); });
    nameEl.addEventListener('input', function () {
      scorers[i].name = nameEl.textContent.trim();
      showAC();
    });
    nameEl.addEventListener('keydown', function (e) {
      if (!acBox || acBox.style.display === 'none') return;
      if (e.key === 'ArrowDown')  { e.preventDefault(); moveACSelection(acBox, 1); }
      else if (e.key === 'ArrowUp')    { e.preventDefault(); moveACSelection(acBox, -1); }
      else if (e.key === 'Enter')      { e.preventDefault(); accept(getACSelected(acBox, acData)); }
      else if (e.key === 'Escape')     { e.preventDefault(); acBox.style.display = 'none'; }
    });
    nameEl.addEventListener('blur', function () {
      if (accepted) return;
      setTimeout(function () {
        destroyActiveAC();
        acBox = null;
        scorers[i].name = nameEl.textContent.trim();
        renderPlayersDbList();
        saveStateSoon();
      }, AC_HIDE_MS);
    });
  }

  /* ═══ GOALS HANDLERS ═══ */
  function attachGoalsHandlers(row, s, i) {
    var gEl = row.querySelector('.gval');

    gEl.addEventListener('beforeinput', function (e) {
      if (e.inputType === 'insertText') {
        if (!/^\d$/.test(e.data || '')) e.preventDefault();
      }
    });
    gEl.addEventListener('paste', function (e) {
      e.preventDefault();
      var text = (e.clipboardData && e.clipboardData.getData('text')) || '';
      var clean = (text.match(/\d+/) || [''])[0];
      if (clean) insertTextAtCursor(clean);
    });
    gEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); gEl.blur(); }
    });
    gEl.addEventListener('input', function () {
      scorers[i].goals = Number((gEl.textContent.match(/\d+/) || [''])[0] || 0);
    });
    gEl.addEventListener('blur', function () {
      var v = (gEl.textContent.match(/\d+/) || ['0'])[0];
      gEl.textContent = v;
      scorers[i].goals = Number(v);
      saveStateSoon();
    });
  }

  /* ═══ DROP HANDLERS ═══ */
  function attachDropHandlers(row, i) {
    row.addEventListener('dragover', function (e) {
      var types = e.dataTransfer && e.dataTransfer.types
        ? Array.prototype.slice.call(e.dataTransfer.types) : [];
      if (types.indexOf('text/player') === -1 && types.indexOf('application/x-player') === -1) return;
      e.preventDefault();
      row.classList.add('db-over');
    });
    row.addEventListener('dragleave', function () { row.classList.remove('db-over'); });
    row.addEventListener('drop', function (e) {
      row.classList.remove('db-over');
      var types = e.dataTransfer && e.dataTransfer.types
        ? Array.prototype.slice.call(e.dataTransfer.types) : [];
      if (types.indexOf('text/player') === -1 && types.indexOf('application/x-player') === -1) return;
      e.preventDefault();
      var name = e.dataTransfer.getData('text/player')
        || e.dataTransfer.getData('application/x-player') || '';
      if (!name) return;
      var p = playersDb.find(function (x) {
        return normalizeName(x.name) === normalizeName(name);
      });
      if (!p || isNameUsed(p.name, i)) return;
      scorers[i] = {
        name: p.name,
        goals: Number(p.goals || 0),
        club: String(p.club || ''),
        cc: String(p.cc || '')
      };
      render();
      saveStateSoon();
    });
  }

  /* ═══ SORTABLE DND ═══ */
  function initDnD() {
    if (typeof Sortable === 'undefined') return;
    if (rowsSortable && rowsSortable.destroy) rowsSortable.destroy();
    rowsSortable = new Sortable(rowsEl, {
      animation: 150,
      handle: '.pos',
      draggable: '.row-item',
      onEnd: function (e) {
        if (e.oldIndex === e.newIndex || e.oldIndex == null) return;
        var item = scorers.splice(e.oldIndex, 1)[0];
        scorers.splice(e.newIndex, 0, item);
        render();
        saveStateSoon();
      }
    });
  }

  /* ═══ DODAJ / USUŃ WIERSZ ═══ */
  if (btnAddRow) {
    btnAddRow.addEventListener('click', function () {
      scorers.push({ name: '', goals: 0, club: '', cc: '' });
      render();
      saveStateSoon();

      // Scroll do nowego wiersza
      var lastRow = rowsEl.lastElementChild;
      if (lastRow) lastRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  if (btnRemoveRow) {
    btnRemoveRow.addEventListener('click', function () {
      if (scorers.length <= 1) return;

      // Usuń ostatni PUSTY wiersz, albo po prostu ostatni
      var idxToRemove = -1;
      for (var i = scorers.length - 1; i >= 0; i--) {
        if (!scorers[i].name.trim()) {
          idxToRemove = i;
          break;
        }
      }

      if (idxToRemove === -1) {
        // Wszystkie mają dane — zapytaj
        if (!confirm('Wszystkie wiersze mają dane. Usunąć ostatni?')) return;
        idxToRemove = scorers.length - 1;
      }

      scorers.splice(idxToRemove, 1);
      render();
      saveStateSoon();
    });
  }

  /* ═══ BAZA ZAWODNIKÓW — panel boczny ═══ */
  function usedPlayersSet() {
    var s = {};
    scorers.forEach(function (x) {
      var nn = normalizeName(x.name);
      if (nn) s[nn] = true;
    });
    return s;
  }

  function fillClubsFilter() {
    if (!pdbClubSelectEl) return;
    var clubs = {};
    playersDb.forEach(function (p) {
      var c = (p.club || '').trim();
      if (c) clubs[c] = true;
    });
    pdbClubSelectEl.innerHTML = '<option value="">Wszystkie kluby</option>'
      + Object.keys(clubs).sort(function (a, b) { return a.localeCompare(b, 'pl'); })
        .map(function (c) {
          return '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>';
        }).join('');
  }

  function updateCcFilterUI() {
    if (!pdbCcFilterEl) return;
    var pills = pdbCcFilterEl.querySelectorAll('.country-pill');
    for (var i = 0; i < pills.length; i++) {
      var cc = pills[i].dataset.cc;
      if (cc === '__clear') pills[i].classList.remove('active');
      else pills[i].classList.toggle('active', selectedPdbCC === cc);
    }
  }

  function renderPlayersDbList() {
    if (!pdbListEl) return;
    var q = stripAccents(String(pdbSearchEl && pdbSearchEl.value || '').trim());
    var used = usedPlayersSet();

    var list = playersDb.filter(function (p) {
      if (selectedPdbCC && String(p.cc || '').toUpperCase() !== selectedPdbCC) return false;
      if (selectedPdbClub && String(p.club || '') !== selectedPdbClub) return false;
      if (!q) return true;
      return stripAccents(p.name || '').indexOf(q) !== -1
        || stripAccents(p.club || '').indexOf(q) !== -1;
    }).sort(function (a, b) {
      return a.name.localeCompare(b.name, 'pl');
    });

    pdbListEl.innerHTML = '';
    var max = Math.min(list.length, MAX_DB_VISIBLE);

    if (max === 0 && playersDb.length === 0) {
      pdbListEl.innerHTML = '<div style="padding:12px;color:#a9b6cb;font-size:13px">'
        + 'Brak zawodników w bazie. Załaduj plik JSON lub dodaj w edytorze.'
        + '</div>';
      return;
    }

    if (max === 0) {
      pdbListEl.innerHTML = '<div style="padding:12px;color:#a9b6cb;font-size:13px">'
        + 'Brak wyników dla aktualnych filtrów.'
        + '</div>';
      return;
    }

    for (var idx = 0; idx < max; idx++) {
      var p = list[idx];
      var disabled = !!used[normalizeName(p.name)];
      var item = document.createElement('div');
      item.className = 'pdb-item';
      item.style.setProperty('--badge', colorFor(p.name));
      item.setAttribute('aria-disabled', disabled ? 'true' : 'false');
      item.draggable = !disabled;
      item.innerHTML =
        '<span class="pdb-badge">' + escapeHtml(abbr(p.name)) + '</span>'
        + '<span class="pdb-name">' + escapeHtml(p.name + (p.club ? ' – ' + p.club : '')) + '</span>'
        + '<span class="pdb-cc" data-cc="' + escapeHtml(p.cc || '') + '">'
          + escapeHtml(p.cc || '') + '</span>';

      if (!disabled) {
        (function (player) {
          item.addEventListener('dragstart', function (e) {
            e.dataTransfer.setData('text/player', player.name);
            e.dataTransfer.setData('application/x-player', player.name);
            e.dataTransfer.setData('text/plain', player.name);
            e.dataTransfer.effectAllowed = 'copy';
          });
        })(p);
      }
      pdbListEl.appendChild(item);
    }

    // Pokaż licznik
    if (list.length > max) {
      pdbListEl.innerHTML += '<div style="padding:8px;color:#a9b6cb;font-size:12px;text-align:center">'
        + '…i ' + (list.length - max) + ' więcej'
        + '</div>';
    }
  }

  function showPdbError(msg) {
    if (pdbErrorEl) { pdbErrorEl.removeAttribute('hidden'); pdbErrorEl.textContent = msg; }
  }

  function hidePdbError() {
    if (pdbErrorEl) { pdbErrorEl.setAttribute('hidden', ''); pdbErrorEl.textContent = ''; }
  }

  /* ═══ ŁADOWANIE BAZY ZAWODNIKÓW ═══ */
  function loadPlayersDb() {
    // 1. Inline
    var inline = tryInlinePlayers();
    if (inline && inline.length) {
      playersDb = inline;
      hidePdbError();
      fillClubsFilter();
      renderPlayersDbList();
      return;
    }

    // 2. LocalStorage (ten sam klucz co edytor)
    var cached = storage.get(LS_PLAYERS_DB);
    if (Array.isArray(cached) && cached.length) {
      playersDb = normalizePlayersArray(cached);
      hidePdbError();
      fillClubsFilter();
      renderPlayersDbList();
      return;
    }

    // 3. Fetch z serwera
    fetch(PLAYERS_DB_URL + '?cb=' + Date.now(), { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (arr) {
        var norm = normalizePlayersArray(arr);
        if (!norm.length) throw new Error('Pusta baza');
        playersDb = norm;
      })
      .catch(function () {
        // 4. Fallback sample
        playersDb = normalizePlayersArray([
          { name: 'Jan Kowalski',       goals: 12, club: 'Zamieć Bór',            cc: 'SZ' },
          { name: 'Aras Veld',          goals: 9,  club: 'Union Zephyr',          cc: 'Z'  },
          { name: 'Mateusz Bryłka',     goals: 8,  club: 'WKS Nowy Bór',          cc: 'W'  },
          { name: 'Lukas Ried',         goals: 7,  club: 'Areniscas Cadin',       cc: 'W'  },
          { name: 'Oskar Drzewiecki',   goals: 7,  club: 'Garbarnia Baczów',      cc: 'SZ' },
          { name: 'Ihor Stelmach',      goals: 6,  club: 'Olimpia Aavekaupunki',  cc: 'SZ' },
          { name: 'Sami Nurmi',         goals: 6,  club: 'ZAM Trub',              cc: 'SZ' },
          { name: 'Dorian Kriets',      goals: 5,  club: 'Union Zephyr',          cc: 'Z'  },
          { name: 'Wojciech Lis',       goals: 5,  club: 'Biali Tatarów',         cc: 'SZ' },
          { name: 'Rafał Zięba',        goals: 4,  club: 'Czarni Baczów',         cc: 'SZ' }
        ]);
      })
      .then(function () {
        hidePdbError();
        fillClubsFilter();
        renderPlayersDbList();
      });
  }

  /* ═══ NASŁUCHIWANIE NA ZMIANY W LOCALSTORAGE (inna karta) ═══ */
  window.addEventListener('storage', function (e) {
    if (e.key === LS_PLAYERS_DB) {
      // Baza zawodników zmieniona w innej karcie (np. edytor)
      var fresh = storage.get(LS_PLAYERS_DB);
      if (Array.isArray(fresh) && fresh.length) {
        playersDb = normalizePlayersArray(fresh);
      } else {
        playersDb = [];
      }
      fillClubsFilter();
      renderPlayersDbList();
    }
  });

  /* ═══ PANEL EVENTS — jednorazowo ═══ */
  function initPanelEvents() {
    if (btnLoadPlayersDb && filePlayersDbEl) {
      btnLoadPlayersDb.addEventListener('click', function () { filePlayersDbEl.click(); });
      filePlayersDbEl.addEventListener('change', function (e) {
        var f = e.target.files && e.target.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
          try {
            var norm = normalizePlayersArray(JSON.parse(ev.target.result));
            if (!norm.length) throw new Error('Plik nie zawiera zawodników.');
            playersDb = norm;
            storage.set(LS_PLAYERS_DB, playersDb, ONE_DAY);
            hidePdbError();
            fillClubsFilter();
            renderPlayersDbList();
            alert('Załadowano ' + norm.length + ' zawodników (lokalnie, 24h).');
          } catch (err) {
            alert('Błąd: ' + (err.message || err));
          }
        };
        reader.readAsText(f);
        filePlayersDbEl.value = '';
      });
    }

    if (btnDownloadDb) {
      btnDownloadDb.addEventListener('click', function () {
        var blob = new Blob(
          [JSON.stringify(playersDb || [], null, 2)],
          { type: 'application/json' }
        );
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'zawodnicy.json';
        a.click();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      });
    }

    if (pdbSearchEl) {
      pdbSearchEl.addEventListener('input', debounce(renderPlayersDbList, 200));
    }

    if (pdbCcFilterEl) {
      var pills = pdbCcFilterEl.querySelectorAll('.country-pill');
      for (var i = 0; i < pills.length; i++) {
        (function (btn) {
          btn.addEventListener('click', function () {
            var cc = btn.dataset.cc;
            selectedPdbCC = (cc === '__clear') ? null : (selectedPdbCC === cc ? null : cc);
            updateCcFilterUI();
            renderPlayersDbList();
          });
        })(pills[i]);
      }
    }

    if (pdbClubSelectEl) {
      pdbClubSelectEl.addEventListener('change', function () {
        selectedPdbClub = pdbClubSelectEl.value || '';
        renderPlayersDbList();
      });
    }
  }

  /* ═══ SORTOWANIE ═══ */
  if (btnSortGoals) {
    btnSortGoals.addEventListener('click', function () {
      if (sortGoalsMode === 'none' || sortGoalsMode === 'asc') {
        sortGoalsMode = 'desc';
        scorers.sort(function (a, b) { return (b.goals | 0) - (a.goals | 0); });
        btnSortGoals.textContent = '↓';
      } else {
        sortGoalsMode = 'asc';
        scorers.sort(function (a, b) { return (a.goals | 0) - (b.goals | 0); });
        btnSortGoals.textContent = '↑';
      }
      render();
      saveStateSoon();
    });
  }

  /* ═══ EKSPORT JPG ═══ */
  function waitForImages(node) {
    var imgs = node.querySelectorAll('img');
    var promises = [];
    for (var i = 0; i < imgs.length; i++) {
      (function (img) {
        promises.push(new Promise(function (r) {
          if (img.complete && img.naturalWidth > 0) return r();
          img.addEventListener('load', r, { once: true });
          img.addEventListener('error', r, { once: true });
        }));
      })(imgs[i]);
    }
    return Promise.all(promises);
  }

  if (btnExport) {
    btnExport.addEventListener('click', function () {
      if (typeof htmlToImage === 'undefined') {
        return alert('Biblioteka html-to-image nie jest załadowana.');
      }
      var stage = $('stage');
      if (!stage) return alert('Brak elementu #stage.');

      stage.classList.add('exporting');
      hideCCMenu();
      destroyActiveAC();

      if (window.stageFit) window.stageFit.disable();

      waitForImages(stage)
        .then(function () {
          return new Promise(function (r) { requestAnimationFrame(r); });
        })
        .then(function () {
          var bg = getComputedStyle(document.documentElement)
            .getPropertyValue('--bg') || '#f2f6fb';
          return htmlToImage.toJpeg(stage, {
            quality: 0.95,
            backgroundColor: bg.trim(),
            width: 1920, height: 1080, pixelRatio: 1,
            cacheBust: true, imagePlaceholder: PLACEHOLDER_SVG
          });
        })
        .then(function (url) {
          var a = document.createElement('a');
          a.href = url;
          a.download = 'strzelcy_' + new Date().toISOString().slice(0, 10) + '.jpg';
          a.click();
        })
        .catch(function (err) {
          alert('Eksport nie powiódł się: ' + (err.message || err));
        })
        .then(function () {
          stage.classList.remove('exporting');
          if (window.stageFit) window.stageFit.enable();
        });
    });
  }

  /* ═══ ZAPIS / ODCZYT STANU ═══ */
  var saveTimer = null;

  function saveState() {
    storage.set('scorers_state_v1', {
      scorers: scorers,
      title: scTitleEl ? String(scTitleEl.textContent || '').trim() : ''
    }, ONE_DAY);
  }

  function saveStateSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveState, SAVE_DELAY);
  }

  function loadState() {
    var s = storage.get('scorers_state_v1');
    if (!s) return false;
    if (Array.isArray(s.scorers)) {
      scorers = s.scorers.map(function (x) {
        return {
          name: String(x.name || ''),
          goals: Number(x.goals || 0),
          club: String(x.club || ''),
          cc: String(x.cc || '')
        };
      });
    }
    if (s.title && scTitleEl) scTitleEl.textContent = s.title;
    return true;
  }

  /* ═══ RESET ═══ */
  if (btnReset) {
    btnReset.addEventListener('click', function () {
      if (!confirm('Wyczyścić tabelę strzelców?')) return;
      scorers = defaultScorers();
      if (scTitleEl) scTitleEl.textContent = 'Król Strzelców';
      saveStateSoon();
      render();
    });
  }

  /* ═══ TITLE EDIT ═══ */
  if (scTitleEl) {
    var titleTimer = null;
    scTitleEl.addEventListener('input', function () {
      clearTimeout(titleTimer);
      titleTimer = setTimeout(saveState, SAVE_DELAY);
    });
    scTitleEl.addEventListener('blur', saveState);
  }
    
  /* ═══ NASŁUCHIWANIE NA ZMIANY Z EDYTORA (inna karta) ═══ */
  window.addEventListener('storage', function (e) {
    if (e.key === LS_PLAYERS_DB) {
      var fresh = storage.get(LS_PLAYERS_DB);
      if (Array.isArray(fresh) && fresh.length) {
        playersDb = normalizePlayersArray(fresh);
      } else {
        playersDb = [];
      }
      fillClubsFilter();
      renderPlayersDbList();
    }
  });    

  /* ═══ START ═══ */
  if (!loadState()) {
    var db = storage.get(LS_PLAYERS_DB);
    scorers = Array.isArray(db) && db.length
      ? normalizePlayersArray(db)
      : defaultScorers();
  }

  initPanelEvents();
  render();
  loadPlayersDb();

})();