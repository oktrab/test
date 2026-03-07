// baza/zawodnicy/app.js v9 — refactor
(function () {
  'use strict';

  var ONE_DAY = 24 * 60 * 60 * 1000;
  var LS_DB = 'scorers_db_v1';
  var LS_STATE = 'scorers_state_v1';
  var LS_CLUBS = 'db_override_v1';
  var VALID_CC = ['SZ', 'W', 'Z', 'A'];

  // ── DOM ──
  var $ = function (id) { return document.getElementById(id); };
  var ta         = $('taPlayers');
  var status     = $('statusPlayers');
  var statusForm = $('statusPlayersForm');
  var formBox    = $('playersForm');
  var fileEl     = $('filePlayers');
  var datalist   = $('clubsDatalist');

  // ── Dirty state ──
  var isDirty = false;

  function onBeforeUnload(e) {
    e.preventDefault();
    e.returnValue = '';
  }

  function setDirty(v) {
    isDirty = !!v;
    window[isDirty ? 'addEventListener' : 'removeEventListener'](
      'beforeunload', onBeforeUnload
    );
    updateDirtyBadge();
  }

  function updateDirtyBadge() {
    if (status) {
      status.innerHTML = status.innerHTML
        .replace(/<span class="warn">.*?<\/span>/g, '')
        + (isDirty ? ' <span class="warn">Niezapisane zmiany</span>' : '');
    }
    if (statusForm) {
      // ✅ Naprawiony regex — było KATEX_INLINE
      statusForm.textContent = (statusForm.textContent || '')
        .replace(/\s*\(niezapisane\)$/, '')
        + (isDirty ? ' (niezapisane)' : '');
    }
  }

  var switchBtn = $('swToClubs');
  if (switchBtn) {
    switchBtn.addEventListener('click', function (e) {
      if (isDirty && !confirm('Niezapisane zmiany. Przejść bez zapisu?')) {
        e.preventDefault();
      }
    });
  }

  // ── LocalStorage ──
  var LS = {
    set: function (k, d) {
      try {
        localStorage.setItem(k, JSON.stringify({
          ts: Date.now(), data: d
        }));
      } catch (e) {}
    },
    get: function (k) {
      try {
        var o = JSON.parse(localStorage.getItem(k));
        if (!o || Date.now() - o.ts > ONE_DAY) {
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

  // ── Helpers ──
  function el(tag, props) {
    var node = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      node[k] = props[k];
    });
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

  // ── Walidacja / analiza ──
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
    var s = { total: list.length, noName: 0, badGoals: 0, noCC: 0, badCC: 0 };

    list.forEach(function (p) {
      if (!p.name) s.noName++;
      if (!isFinite(p.goals) || p.goals < 0) s.badGoals++;
      if (!p.cc) s.noCC++;
      else if (VALID_CC.indexOf(p.cc) === -1) s.badCC++;
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
    var r = parse(ta.value);
    if (!r.ok) return setStatus(status, 'Błąd: ' + r.error, false);
    var a = analyze(r.data);
    var parts = [
      'Rekordy: <b>' + a.total + '</b>',
      'bez nazwy: <b>' + a.noName + '</b>',
      'brak CC: <b>' + a.noCC + '</b>',
      'duplikaty: <b>' + a.dups.length + '</b>'
    ];
    var hasWarn = a.noName + a.badGoals + a.noCC + a.badCC + a.dups.length > 0;
    setStatus(status, parts.join(' · ')
      + (a.dups.length ? '<br>Duplikaty: ' + a.dups.slice(0, 5).join(', ') : ''),
      !hasWarn);
  }

  // ── Wspólna akcja: parsuj → zrób coś → pokaż status ──
  function withParsed(fn) {
    var r = parse(ta.value);
    if (!r.ok) {
      setStatus(status, 'Błąd: ' + r.error, false);
      return;
    }
    fn(r);
  }

  // ── Datalist klubów ──
  async function loadClubsDatalist() {
    var clubs = LS.get(LS_CLUBS);
    if (!Array.isArray(clubs) || !clubs.length) {
      try {
        var res = await fetch('../../kluby.json?cb=' + Date.now(), { cache: 'no-store' });
        if (res.ok) clubs = await res.json();
      } catch (e) {}
    }
    clubs = Array.isArray(clubs) ? clubs : [];
    datalist.innerHTML = '';
    clubs
      .map(function (x) { return (x && x.name) || ''; })
      .filter(Boolean)
      .sort(function (a, b) { return a.localeCompare(b, 'pl'); })
      .forEach(function (n) {
        datalist.appendChild(el('option', { value: n }));
      });
  }

  // ── Formularz ──
  function buildForm(list) {
    formBox.innerHTML = '';
    var tbl = el('table', {
      style: 'width:100%;border-collapse:collapse;font-size:14px'
    });
    tbl.innerHTML = '<thead><tr>'
      + '<th>Imię i nazwisko</th><th>Gole</th>'
      + '<th>Klub</th><th>Kraj</th><th></th>'
      + '</tr></thead>';
    var tbody = el('tbody');

    function addRow(p) {
      p = p || { name: '', goals: 0, club: '', cc: '' };
      var tr = el('tr');

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
        sel.appendChild(el('option', {
          value: c, textContent: c || '—'
        }));
      });
      sel.value = p.cc || '';
      var btnDel = el('button', {
        type: 'button', className: 'btn secondary',
        textContent: 'Usuń'
      });

      // eventy
      [inpN, inpG, inpC, sel].forEach(function (node) {
        node.addEventListener('input', function () { setDirty(true); });
      });
      // ✅ usunięto zdublowany blur listener
      btnDel.addEventListener('click', function () {
        tbody.removeChild(tr);
        setDirty(true);
      });

      // złóż wiersz
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

    // Przyciski formularza — podpięte raz
    $('btnFormAddPlayer').onclick = function () {
      addRow();
      setDirty(true);
    };

    $('btnFormToPlayers').onclick = function () {
      var arr = [].slice.call(tbody.querySelectorAll('tr')).map(function (tr) {
        var inputs = tr.querySelectorAll('input');
        var name  = inputs[0].value.trim();
        var goals = Math.max(0, Number(inputs[1].value) || 0);
        var club  = inputs[2].value.trim();
        var cc    = tr.querySelector('select').value;
        return name ? { name: name, goals: goals, club: club, cc: cc } : null;
      }).filter(Boolean);
      ta.value = JSON.stringify(arr, null, 2);
      setDirty(true);
      updatePreview();
      setStatus(statusForm, 'Formularz → JSON (niezapisane)', true);
    };

    $('btnFormFromPlayers').onclick = function () {
      withParsed(function (r) {
        buildForm(r.data);
        setDirty(true);
        setStatus(statusForm, 'JSON → formularz', true);
      });
    };
  }

  // ── Wczytaj JSON z pliku/drop ──
  function loadFromFile(file) {
    file.text().then(function (txt) {
      var r = parse(txt);
      if (!r.ok) throw new Error(r.error);
      ta.value = JSON.stringify(r.data, null, 2);
      updatePreview();
      buildForm(r.data);
      setDirty(true);
      setStatus(status, 'Wczytano ' + (file.name || 'JSON'), true);
    }).catch(function (err) {
      setStatus(status, 'Błąd: ' + err.message, false);
    });
  }

  // ── Event listenery (raz, czytelnie) ──
  ta.addEventListener('input', debounce(function () {
    setDirty(true);
    updatePreview();
  }, 300));

  $('btnLoadPlayersFile').addEventListener('click', function () {
    fileEl.click();
  });

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
      LS.set(LS_DB, r.data);
      setDirty(false);
      setStatus(status, 'Zapisano (24h)', true);
    });
  });

  $('btnApplyPlayers').addEventListener('click', function () {
    withParsed(function (r) {
      LS.set(LS_STATE, { scorers: r.data, title: 'Król Strzelców' });
      setStatus(status, 'Zastosowano jako listę strzelców', true);
    });
  });

  $('btnDownloadPlayers').addEventListener('click', function () {
    withParsed(function (r) {
      var blob = new Blob(
        [JSON.stringify(r.data, null, 2)],
        { type: 'application/json' }
      );
      var a = el('a', {
        href: URL.createObjectURL(blob),
        download: 'zawodnicy.json'
      });
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
  ta.addEventListener('dragleave', function () {
    ta.classList.remove('drop-over');
  });
  ta.addEventListener('drop', function (e) {
    ta.classList.remove('drop-over');
    e.preventDefault();
    var f = e.dataTransfer.files[0];
    if (f) loadFromFile(f);
  });

  // ── Init ──
  (async function () {
    await loadClubsDatalist();

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
  })();

})();