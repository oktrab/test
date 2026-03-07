// baza/zawodnicy/app.js v13
(function () {
  'use strict';

  var ONE_DAY = 24 * 60 * 60 * 1000;
  var LS_DB = 'scorers_db_v1';
  var LS_STATE = 'scorers_state_v1';
  var LS_CLUBS = 'db_override_v1';
  var VALID_CC = ['SZ', 'W', 'Z', 'A'];

  var $ = function (id) { return document.getElementById(id); };
  var ta         = $('taPlayers');
  var status     = $('statusPlayers');
  var statusForm = $('statusPlayersForm');
  var formBox    = $('playersForm');
  var fileEl     = $('filePlayers');
  var datalist   = $('clubsDatalist');
  var switchBtn  = $('swToClubs');

  var isDirty = false;

  // ---------- Normalizacja ----------
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

  // ---------- Dirty state ----------
  function onBeforeUnload(e) { e.preventDefault(); e.returnValue = ''; }

  function setDirty(v) {
    isDirty = !!v;
    if (isDirty) {
      window.addEventListener('beforeunload', onBeforeUnload);
    } else {
      window.removeEventListener('beforeunload', onBeforeUnload);
    }
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

  // ---------- LocalStorage ----------
  var LS = {
    set: function (k, d, ttl) {
      try {
        localStorage.setItem(k, JSON.stringify({
          ts: Date.now(), ttl: ttl || ONE_DAY, data: d
        }));
      } catch (e) { /* quota */ }
    },
    get: function (k) {
      try {
        var raw = localStorage.getItem(k);
        if (!raw) return null;
        var o = JSON.parse(raw);
        if (!o) return null;
        if (o.ttl && Date.now() - o.ts > o.ttl) {
          localStorage.removeItem(k);
          return null;
        }
        return o.data;
      } catch (e) { return null; }
    },
    clear: function (k) {
      try { localStorage.removeItem(k); } catch (e) { /* */ }
    }
  };

  // ---------- DOM helpers ----------
  function el(tag, props) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) { node[k] = props[k]; });
    }
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
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  // ---------- Parse & Analyze ----------
  function parse(text) {
    try {
      var arr = JSON.parse(text);
      if (!Array.isArray(arr)) throw new Error('JSON musi być tablicą.');
      return { ok: true, data: normalizePlayersArray(arr) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  function analyze(list) {
    var seen = {};
    var dups = [];
    var s = { total: list.length, noName: 0, badGoals: 0, noCC: 0 };

    list.forEach(function (p) {
      if (!p.name) s.noName++;
      if (!isFinite(p.goals) || p.goals < 0) s.badGoals++;
      if (!p.cc) s.noCC++;
      var key = (p.name || '').toLowerCase();
      if (key) seen[key] = (seen[key] || 0) + 1;
    });

    Object.keys(seen).forEach(function (k) {
      if (seen[k] > 1) dups.push(k);
    });

    s.dups = dups.sort();
    return s;
  }

  function updatePreview() {
    if (!ta) return;
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

  // ---------- Form ↔ JSON sync ----------
  function syncFormToJson(tbody) {
    if (!tbody) return null;
    var rows = tbody.querySelectorAll('tr');
    var arr = [];

    for (var i = 0; i < rows.length; i++) {
      var tr = rows[i];
      var inputs = tr.querySelectorAll('input');
      var selectEl = tr.querySelector('select');
      if (!inputs.length || !selectEl) continue;

      var name = inputs[0].value.trim();
      var goals = Math.max(0, Number(inputs[1].value) || 0);
      var club = inputs[2].value.trim();
      var cc = selectEl.value;

      if (name) {
        arr.push({ name: name, goals: goals, club: club, cc: cc });
      }
    }

    ta.value = JSON.stringify(arr, null, 2);
    updatePreview();
    return arr;
  }

  // ---------- File loading ----------
  function loadFromFile(file) {
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var r = parse(ev.target.result);
        if (!r.ok) throw new Error(r.error);
        ta.value = JSON.stringify(r.data, null, 2);
        updatePreview();
        buildForm(r.data);
        setDirty(true);
        setStatus(status, 'Wczytano ' + (file.name || 'JSON'), true);
        setStatus(statusForm, 'Załadowano do formularza.', true);
      } catch (err) {
        setStatus(status, 'Błąd: ' + err.message, false);
      }
    };
    reader.onerror = function () {
      setStatus(status, 'Błąd odczytu pliku.', false);
    };
    reader.readAsText(file);
  }

    // ---------- Clubs datalist ----------
    function loadClubsDatalist() {
      var clubs = LS.get(LS_CLUBS);

      var populate = function (arr) {
        arr = Array.isArray(arr) ? arr : [];
        if (!datalist) return;
        datalist.innerHTML = '';

        // Zbierz kluby z bazy klubów
        var clubNames = {};
        arr.forEach(function (x) {
          var n = (x && x.name) || '';
          if (n) clubNames[n] = true;
        });

        // Zbierz też kluby z bazy zawodników (LS)
        var playersDb = LS.get(LS_DB);
        if (Array.isArray(playersDb)) {
          playersDb.forEach(function (p) {
            var c = (p && p.club) || '';
            if (c) clubNames[c] = true;
          });
        }

        // Zbierz kluby z aktualnego textarea
        try {
          var current = JSON.parse(ta.value);
          if (Array.isArray(current)) {
            current.forEach(function (p) {
              var c = (p && p.club) || '';
              if (c) clubNames[c] = true;
            });
          }
        } catch (e) { /* */ }

        Object.keys(clubNames)
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
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (data) {
          populate(data);
        })
        .catch(function () {
          populate([]);
        });
    }

    // ---------- Formularz ----------
    function buildForm(list) {
      if (!formBox) return;
      formBox.innerHTML = '';

      // Upewnij się że datalist istnieje w DOM
      if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'clubsDatalist';
        document.body.appendChild(datalist);
      }

      // Odśwież podpowiedzi klubów (mogły się zmienić)
      loadClubsDatalist();

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
          type: 'text',
          value: p.name,
          className: 'text',
          placeholder: 'np. Jan Kowalski'
        });

        var inpG = el('input', {
          type: 'number',
          value: isFinite(p.goals) ? p.goals : 0,
          min: '0',
          step: '1',
          className: 'text'
        });
        inpG.style.width = '80px';

        var inpC = el('input', {
          type: 'text',
          value: p.club,
          className: 'text',
          placeholder: 'nazwa klubu'
        });
        // Podłącz datalist — MUSI być setAttribute, nie property
        inpC.setAttribute('list', 'clubsDatalist');

        var sel = el('select', { className: 'select' });
        ['', 'SZ', 'W', 'Z', 'A'].forEach(function (c) {
          var opt = el('option', { value: c, textContent: c || '—' });
          sel.appendChild(opt);
        });
        sel.value = p.cc || '';

        var btnDel = el('button', {
          type: 'button',
          className: 'btn secondary',
          textContent: 'Usuń'
        });

        // Dirty na zmianach
        [inpN, inpG, inpC, sel].forEach(function (node) {
          node.addEventListener('input', function () { setDirty(true); });
          node.addEventListener('change', function () { setDirty(true); });
        });

        // Gdy użytkownik wpisze nowy klub — dodaj do datalist
        inpC.addEventListener('change', function () {
          var val = inpC.value.trim();
          if (!val || !datalist) return;
          // Sprawdź czy już istnieje
          var options = datalist.querySelectorAll('option');
          for (var i = 0; i < options.length; i++) {
            if (options[i].value === val) return;
          }
          // Dodaj nową opcję
          var newOpt = el('option', { value: val });
          datalist.appendChild(newOpt);
        });

        btnDel.addEventListener('click', function () {
          tr.parentNode.removeChild(tr);
          setDirty(true);
        });

        // Buduj wiersz
        [inpN, inpG, inpC, sel, btnDel].forEach(function (node) {
          var td = el('td');
          td.appendChild(node);
          tr.appendChild(td);
        });

        tbody.appendChild(tr);
      }

      // Wypełnij wiersze
      if (Array.isArray(list) && list.length) {
        list.forEach(function (p) { addRow(p); });
      }

      tbl.appendChild(tbody);
      formBox.appendChild(tbl);

      // ── Przyciski formularza ──
      var btnAdd = $('btnFormAddPlayer');
      var btnToJson = $('btnFormToPlayers');
      var btnFromJson = $('btnFormFromPlayers');
      var btnSave = $('btnFormSavePlayers');
      var btnDownload = $('btnFormDownloadPlayers');

      if (btnAdd) {
        btnAdd.onclick = function () {
          addRow();
          setDirty(true);
          // Scroll do nowego wiersza
          var lastTr = tbody.lastElementChild;
          if (lastTr) lastTr.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        };
      }

      if (btnToJson) {
        btnToJson.onclick = function () {
          syncFormToJson(tbody);
          setDirty(true);
          setStatus(statusForm, 'Formularz → JSON (niezapisane)', true);
        };
      }

      if (btnFromJson) {
        btnFromJson.onclick = function () {
          withParsed(function (r) {
            buildForm(r.data);
            setDirty(true);
            setStatus(statusForm, 'JSON → formularz', true);
          });
        };
      }

      if (btnSave) {
        btnSave.onclick = function () {
          var arr = syncFormToJson(tbody);
          if (!arr) return;
          var r = parse(ta.value);
          if (!r.ok) return setStatus(statusForm, 'Błąd: ' + r.error, false);
          LS.set(LS_DB, r.data, ONE_DAY);
          // Odśwież datalist po zapisie (nowe kluby)
          loadClubsDatalist();
          setDirty(false);
          setStatus(statusForm, 'Zapisano bazę zawodników (24h)', true);
          setStatus(status, 'Zapisano (24h)', true);
        };
      }

      if (btnDownload) {
        btnDownload.onclick = function () {
          var arr = syncFormToJson(tbody);
          if (!arr) return;
          var blob = new Blob([ta.value], { type: 'application/json' });
          var url = URL.createObjectURL(blob);
          var a = el('a', { href: url, download: 'zawodnicy.json' });
          a.click();
          setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
          setStatus(statusForm, 'Pobrano zawodnicy.json', true);
        };
      }
    }

  // ---------- Event listeners (textarea) ----------
  if (ta) {
    ta.addEventListener('input', debounce(function () {
      setDirty(true);
      updatePreview();
    }, 300));

    ta.addEventListener('dragover', function (e) {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        e.preventDefault();
        ta.classList.add('drop-over');
      }
    });

    ta.addEventListener('dragleave', function () {
      ta.classList.remove('drop-over');
    });

    ta.addEventListener('drop', function (e) {
      ta.classList.remove('drop-over');
      e.preventDefault();
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) loadFromFile(f);
    });
  }

  // ---------- Toolbar buttons ----------
  var btnLoadFile = $('btnLoadPlayersFile');
  if (btnLoadFile && fileEl) {
    btnLoadFile.addEventListener('click', function () { fileEl.click(); });
    fileEl.addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) loadFromFile(f);
      fileEl.value = '';
    });
  }

  var btnFormat = $('btnFormatPlayers');
  if (btnFormat) {
    btnFormat.addEventListener('click', function () {
      withParsed(function (r) {
        ta.value = JSON.stringify(r.data, null, 2);
        setDirty(true);
        updatePreview();
      });
    });
  }

  var btnSaveMain = $('btnSavePlayers');
  if (btnSaveMain) {
    btnSaveMain.addEventListener('click', function () {
      withParsed(function (r) {
        LS.set(LS_DB, r.data, ONE_DAY);
        setDirty(false);
        setStatus(status, 'Zapisano (24h)', true);
      });
    });
  }

  var btnDownloadMain = $('btnDownloadPlayers');
  if (btnDownloadMain) {
    btnDownloadMain.addEventListener('click', function () {
      withParsed(function (r) {
        var blob = new Blob(
          [JSON.stringify(r.data, null, 2)],
          { type: 'application/json' }
        );
        var url = URL.createObjectURL(blob);
        var a = el('a', { href: url, download: 'zawodnicy.json' });
        a.click();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      });
    });
  }

  var btnClear = $('btnClearPlayers');
  if (btnClear) {
    btnClear.addEventListener('click', function () {
      LS.clear(LS_DB);
      setStatus(status, 'Usunięto bazę zawodników', true);
    });
  }

  // ══════════════════════════════════════════════
  //  START — ładowanie danych
  // ══════════════════════════════════════════════
  function loadInitialData() {
    // 1. Lokalny override (LS)
    var db = LS.get(LS_DB);
    if (Array.isArray(db) && db.length) {
      var normalized = normalizePlayersArray(db);
      if (normalized.length) {
        ta.value = JSON.stringify(normalized, null, 2);
        updatePreview();
        buildForm(normalized);
        setDirty(false);
        setStatus(status, 'Załadowano lokalny override (24h)', true);
        return;
      }
    }

    // 2. Fetch z serwera
    fetch('../../zawodnicy.json?cb=' + Date.now(), { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (raw) {
        var arr = normalizePlayersArray(raw);
        if (arr.length) {
          ta.value = JSON.stringify(arr, null, 2);
          updatePreview();
          buildForm(arr);
          setDirty(false);
          setStatus(status, 'Załadowano z zawodnicy.json', true);
        } else {
          throw new Error('Pusty plik');
        }
      })
      .catch(function () {
        // 3. Fallback — sample
        var sample = [
          { name:'Jan Kowalski',       goals:12, club:'Zamieć Bór',            cc:'SZ' },
          { name:'Aras Veld',          goals: 9, club:'Union Zephyr',          cc:'Z'  },
          { name:'Mateusz Bryłka',     goals: 8, club:'WKS Nowy Bór',          cc:'W'  },
          { name:'Lukas Ried',         goals: 7, club:'Areniscas Cadin',       cc:'W'  },
          { name:'Oskar Drzewiecki',   goals: 7, club:'Garbarnia Baczów',      cc:'SZ' },
          { name:'Ihor Stelmach',      goals: 6, club:'Olimpia Aavekaupunki',  cc:'SZ' },
          { name:'Sami Nurmi',         goals: 6, club:'ZAM Trub',              cc:'SZ' },
          { name:'Dorian Kriets',      goals: 5, club:'Union Zephyr',          cc:'Z'  },
          { name:'Wojciech Lis',       goals: 5, club:'Biali Tatarów',         cc:'SZ' },
          { name:'Rafał Zięba',        goals: 4, club:'Czarni Baczów',         cc:'SZ' }
        ];
        ta.value = JSON.stringify(sample, null, 2);
        updatePreview();
        buildForm(sample);
        setDirty(false);
        setStatus(status, 'Załadowano dane przykładowe', true);
      });
  }

  // Odpal: najpierw kluby (datalist), potem dane zawodników
  loadClubsDatalist()
    .then(function () {
      loadInitialData();
    })
    .catch(function () {
      // Nawet jak kluby się nie załadują — ładuj zawodników
      loadInitialData();
    });

})();