// baza/zawodnicy/app.js v10
(function () {
  'use strict';

  var ONE_DAY = 24 * 60 * 60 * 1000;
  var LS_DB = 'scorers_db_v1';
  var LS_STATE = 'scorers_state_v1';
  var LS_CLUBS = 'db_override_v1';
  var VALID_CC = ['SZ', 'W', 'Z', 'A'];
  var MIN_SCORERS = 10;

  var $ = function (id) { return document.getElementById(id); };
  var ta         = $('taPlayers');
  var status     = $('statusPlayers');
  var statusForm = $('statusPlayersForm');
  var formBox    = $('playersForm');
  var fileEl     = $('filePlayers');
  var datalist   = $('clubsDatalist');
  var switchBtn  = $('swToClubs');

  var isDirty = false;

  function onBeforeUnload(e) { e.preventDefault(); e.returnValue = ''; }

  function setDirty(v) {
    isDirty = !!v;
    window[isDirty ? 'addEventListener' : 'removeEventListener']('beforeunload', onBeforeUnload);
    updateDirtyBadge();
  }

  function updateDirtyBadge() {
    if (status) {
      status.innerHTML = status.innerHTML
        .replace(/<span class="warn">.*?<\/span>/g, '')
        + (isDirty ? ' <span class="warn">Niezapisane zmiany</span>' : '');
    }
    if (statusForm) {
      statusForm.textContent = (statusForm.textContent || '')
        .replace(/\s*\(niezapisane\)$/, '')
        + (isDirty ? ' (niezapisane)' : '');
    }
  }

  if (switchBtn) {
    switchBtn.addEventListener('click', function (e) {
      if (isDirty && !confirm('Niezapisane zmiany. Przejść bez zapisu?')) {
        e.preventDefault();
      }
    });
  }

  var LS = {
    set: function (k, d, ttl) {
      try {
        localStorage.setItem(k, JSON.stringify({
          ts: Date.now(), ttl: ttl || ONE_DAY, data: d
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

  function el(tag, props) {
    var node = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) { node[k] = props[k]; });
    return node;
  }

  function setStatus(elem, html, ok) {
    if (!elem) return;
    elem.innerHTML = html;
    elem.classList.toggle('ok', ok === true);
    elem.classList.toggle('error', ok === false);
    updateDirtyBadge();
  }

  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  function parse(text) {
    try {
      var arr = JSON.parse(text);
      if (!Array.isArray(arr)) throw new Error('JSON musi być tablicą.');
      var norm = arr.map(function (x) {
        var cc = String((x && x.cc) || '').toUpperCase();
        return {
          name:  String((x && x.name) || '').trim(),
          goals: Math.max(0, Number((x && x.goals) || 0)) || 0,
          club:  String((x && x.club) || '').trim(),
          cc:    VALID_CC.indexOf(cc) !== -1 ? cc : ''
        };
      });
      return { ok: true, data: norm };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  function analyze(list) {
    var seen = {}, dups = [];
    var s = { total: list.length, noName: 0, badGoals: 0, noCC: 0 };
    list.forEach(function (p) {
      if (!p.name) s.noName++;
      if (!isFinite(p.goals) || p.goals < 0) s.badGoals++;
      if (!p.cc) s.noCC++;
      var key = (p.name || '').toLowerCase();
      if (key) seen[key] = (seen[key] || 0) + 1;
    });
    Object.keys(seen).forEach(function (k) { if (seen[k] > 1) dups.push(k); });
    s.dups = dups.sort();
    return s;
  }

  function updatePreview() {
    var r = parse(ta.value);
    if (!r.ok) return setStatus(status, 'Błąd: ' + r.error, false);
    var a = analyze(r.data);
    var parts = [
      'Rekordy: <b>' + a.total + '</b>',
      'bez nazwy: <b>' + a.noName + '</b>',
      'brak CC: <b>' + a.noCC + '</b>',
      'duplikaty: <b>' + a.dups.length + '</b>'
    ];
    var warn = a.noName + a.badGoals + a.noCC + a.dups.length > 0;
    setStatus(status, parts.join(' · ')
      + (a.dups.length ? '<br>Duplikaty: ' + a.dups.slice(0, 5).join(', ') : ''), !warn);
  }

  function withParsed(fn) {
    var r = parse(ta.value);
    if (!r.ok) return setStatus(status, 'Błąd: ' + r.error, false);
    fn(r);
  }

  // ✅ NOWE: Funkcja do dopełniania listy strzelców do min. 10 wierszy
  function padScorers(data) {
    var scorers = data.slice();
    while (scorers.length < MIN_SCORERS) {
      scorers.push({ name: '', goals: 0, club: '', cc: '' });
    }
    return scorers;
  }

  // ✅ NOWE: Synchro formularza → JSON → zwróć dane
  function syncFormToJson(tbody) {
    if (!tbody) return null;
    var arr = [].slice.call(tbody.querySelectorAll('tr')).map(function (tr) {
      var inputs = tr.querySelectorAll('input');
      var name = inputs[0].value.trim();
      var goals = Math.max(0, Number(inputs[1].value) || 0);
      var club = inputs[2].value.trim();
      var cc = tr.querySelector('select').value;
      return name ? { name: name, goals: goals, club: club, cc: cc } : null;
    }).filter(Boolean);
    ta.value = JSON.stringify(arr, null, 2);
    updatePreview();
    return arr;
  }

  function loadFromFile(file) {
    file.text().then(function (txt) {
      var r = parse(txt);
      if (!r.ok) throw new Error(r.error);
      ta.value = JSON.stringify(r.data, null, 2);
      updatePreview();
      buildForm(r.data);
      setDirty(true);
      setStatus(status, 'Wczytano ' + (file.name || 'JSON'), true);
      setStatus(statusForm, 'Załadowano do formularza.', true);
    }).catch(function (err) {
      setStatus(status, 'Błąd: ' + err.message, false);
    });
  }

  function loadClubsDatalist() {
    var clubs = LS.get(LS_CLUBS);
    var populate = function (arr) {
      arr = Array.isArray(arr) ? arr : [];
      datalist.innerHTML = '';
      arr.map(function (x) { return (x && x.name) || ''; })
        .filter(Boolean)
        .sort(function (a, b) { return a.localeCompare(b, 'pl'); })
        .forEach(function (n) {
          datalist.appendChild(el('option', { value: n }));
        });
    };

    if (Array.isArray(clubs) && clubs.length) {
      populate(clubs);
      return Promise.resolve();
    }

    return fetch('../../kluby.json?cb=' + Date.now(), { cache: 'no-store' })
      .then(function (res) { return res.ok ? res.json() : []; })
      .then(populate)
      .catch(function () { populate([]); });
  }

  /* ═══ FORMULARZ ═══ */
  function buildForm(list) {
    formBox.innerHTML = '';
    var tbl = el('table', {
      style: 'width:100%;border-collapse:collapse;font-size:14px'
    });
    tbl.innerHTML = '<thead><tr><th>Imię i nazwisko</th><th>Gole</th>'
      + '<th>Klub</th><th>Kraj</th><th></th></tr></thead>';
    var tbody = el('tbody');

    function addRow(p) {
      p = p || { name: '', goals: 0, club: '', cc: '' };
      var tr = el('tr');
      tr.style.borderTop = '1px solid #223055';

      var inpN = el('input', {
        type: 'text', value: p.name, className: 'text',
        placeholder: 'np. Jan Kowalski'
      });
      var inpG = el('input', {
        type: 'number', value: isFinite(p.goals) ? p.goals : 0,
        min: '0', step: '1', className: 'text'
      });
      inpG.style.width = '80px';

      var inpC = el('input', {
        type: 'text', value: p.club, className: 'text',
        placeholder: 'nazwa klubu'
      });
      inpC.setAttribute('list', 'clubsDatalist');

      var sel = el('select', { className: 'select' });
      ['', 'SZ', 'W', 'Z', 'A'].forEach(function (c) {
        sel.appendChild(el('option', { value: c, textContent: c || '—' }));
      });
      sel.value = p.cc || '';

      var btnDel = el('button', {
        type: 'button', className: 'btn secondary', textContent: 'Usuń'
      });

      [inpN, inpG, inpC, sel].forEach(function (node) {
        node.addEventListener('input', function () { setDirty(true); });
      });
      btnDel.addEventListener('click', function () {
        tbody.removeChild(tr);
        setDirty(true);
      });

      [inpN, inpG, inpC, sel, btnDel].forEach(function (node) {
        var td = el('td');
        td.appendChild(node);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }

    (list || []).forEach(addRow);
    tbl.appendChild(tbody);
    formBox.appendChild(tbl);

    // Przyciski formularza
    $('btnFormAddPlayer').onclick = function () { addRow(); setDirty(true); };

    $('btnFormToPlayers').onclick = function () {
      syncFormToJson(tbody);
      setDirty(true);
      setStatus(statusForm, 'Formularz → JSON (niezapisane)', true);
    };

    $('btnFormFromPlayers').onclick = function () {
      withParsed(function (r) {
        buildForm(r.data);
        setDirty(true);
        setStatus(statusForm, 'JSON → formularz', true);
      });
    };

    // ✅ NOWE: Zapisz bazę z formularza
    var btnFormSave = $('btnFormSavePlayers');
    if (btnFormSave) {
      btnFormSave.onclick = function () {
        var arr = syncFormToJson(tbody);
        if (!arr) return;
        var r = parse(ta.value);
        if (!r.ok) return setStatus(statusForm, 'Błąd: ' + r.error, false);
        LS.set(LS_DB, r.data, ONE_DAY);
        setDirty(false);
        setStatus(statusForm, 'Zapisano bazę zawodników (24h)', true);
        setStatus(status, 'Zapisano (24h)', true);
      };
    }

    // ✅ NOWE: Zastosuj do Strzelców z formularza (z dopełnieniem do 10)
    var btnFormApply = $('btnFormApplyPlayers');
    if (btnFormApply) {
      btnFormApply.onclick = function () {
        var arr = syncFormToJson(tbody);
        if (!arr) return;
        var r = parse(ta.value);
        if (!r.ok) return setStatus(statusForm, 'Błąd: ' + r.error, false);
        var padded = padScorers(r.data);
        LS.set(LS_STATE, { scorers: padded, title: 'Król Strzelców' }, ONE_DAY);
        var filled = r.data.filter(function (x) { return x.name; }).length;
        setStatus(statusForm, 'Zastosowano: ' + filled + ' zawodników + ' + (padded.length - filled) + ' pustych wierszy', true);
      };
    }

    // ✅ NOWE: Pobierz JSON z formularza
    var btnFormDownload = $('btnFormDownloadPlayers');
    if (btnFormDownload) {
      btnFormDownload.onclick = function () {
        var arr = syncFormToJson(tbody);
        if (!arr) return;
        var blob = new Blob([ta.value], { type: 'application/json' });
        var a = el('a', { href: URL.createObjectURL(blob), download: 'zawodnicy.json' });
        a.click();
        setStatus(statusForm, 'Pobrano zawodnicy.json', true);
      };
    }
  }

  /* ═══ EVENT LISTENERY ═══ */
  ta.addEventListener('input', debounce(function () {
    setDirty(true);
    updatePreview();
  }, 300));

  $('btnLoadPlayersFile').addEventListener('click', function () { fileEl.click(); });
  fileEl.addEventListener('change', function (e) {
    var f = e.target.files[0];
    if (f) loadFromFile(f);
    fileEl.value = '';
  });

  $('btnFormatPlayers').addEventListener('click', function () {
    withParsed(function (r) {
      ta.value = JSON.stringify(r.data, null, 2);
      setDirty(true);
      updatePreview();
    });
  });

  $('btnSavePlayers').addEventListener('click', function () {
    withParsed(function (r) {
      LS.set(LS_DB, r.data, ONE_DAY);
      setDirty(false);
      setStatus(status, 'Zapisano (24h)', true);
    });
  });

  // ✅ FIX: Zastosuj do Strzelców — dopełnij do min. 10 wierszy
  $('btnApplyPlayers').addEventListener('click', function () {
    withParsed(function (r) {
      var padded = padScorers(r.data);
      LS.set(LS_STATE, { scorers: padded, title: 'Król Strzelców' }, ONE_DAY);
      var filled = r.data.filter(function (x) { return x.name; }).length;
      setStatus(status, 'Zastosowano: ' + filled + ' zawodników + ' + (padded.length - filled) + ' pustych wierszy', true);
    });
  });

  $('btnDownloadPlayers').addEventListener('click', function () {
    withParsed(function (r) {
      var blob = new Blob(
        [JSON.stringify(r.data, null, 2)],
        { type: 'application/json' }
      );
      var a = el('a', { href: URL.createObjectURL(blob), download: 'zawodnicy.json' });
      a.click();
    });
  });

  $('btnClearPlayers').addEventListener('click', function () {
    LS.clear(LS_DB);
    setStatus(status, 'Usunięto bazę zawodników', true);
  });

  // Drag & drop
  ta.addEventListener('dragover', function (e) {
    if (e.dataTransfer && e.dataTransfer.files.length) {
      e.preventDefault();
      ta.classList.add('drop-over');
    }
  });
  ta.addEventListener('dragleave', function () { ta.classList.remove('drop-over'); });
  ta.addEventListener('drop', function (e) {
    ta.classList.remove('drop-over');
    e.preventDefault();
    var f = e.dataTransfer.files[0];
    if (f) loadFromFile(f);
  });

  /* ═══ INIT ═══ */
  loadClubsDatalist().then(function () {
    var db = LS.get(LS_DB);
    if (Array.isArray(db) && db.length) {
      ta.value = JSON.stringify(db, null, 2);
      updatePreview();
      buildForm(db);
      setDirty(false);
      setStatus(status, 'Załadowano bazę (24h)', true);
    } else {
      var sample = [
        { name: 'Jan Kowalski', goals: 12, club: 'Zamieć Bór', cc: 'SZ' },
        { name: 'Aras Veld',    goals: 9,  club: 'Union Zephyr', cc: 'Z' }
      ];
      ta.value = JSON.stringify(sample, null, 2);
      updatePreview();
      buildForm(sample);
      setDirty(false);
    }
  });

})();