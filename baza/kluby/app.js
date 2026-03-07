// baza/kluby/app.js v10
(function () {
  'use strict';

  var ONE_DAY = 24 * 60 * 60 * 1000;
  var LS_KEY = 'db_override_v1';
  var VALID_COUNTRIES = ['SZ', 'W', 'I'];
  var VALID_TAGS = ['⚽', '🏀'];

  var DEFAULT_DB = [
    { name: 'Areniscas Cadin',       tags: ['⚽','🏀'], country: 'W' },
    { name: 'Brzozy Mały Baczów',    tags: ['⚽','🏀'], country: 'SZ' },
    { name: 'Garbarnia Baczów',      tags: ['⚽','🏀'], country: 'SZ' },
    { name: 'Osiris Tatarów',        tags: ['⚽','🏀'], country: 'SZ' },
    { name: 'Poseidon Kings',        tags: ['⚽','🏀'], country: 'SZ' },
    { name: 'ZAM Trub',              tags: ['⚽','🏀'], country: 'SZ' },
    { name: 'Zamieć Bór',            tags: ['⚽','🏀'], country: 'SZ' },
    { name: 'Byki Tatarów',          tags: ['⚽','🏀'], country: 'SZ' },
    { name: 'Biali Tatarów',         tags: ['⚽'],      country: 'SZ' },
    { name: 'Czarni Baczów',         tags: ['⚽'],      country: 'SZ' },
    { name: 'Dąbniarka Vista',       tags: ['⚽'],      country: 'SZ' },
    { name: 'Górskie Piaskówki',     tags: ['⚽'],      country: 'W' },
    { name: 'Lokomotiv Królewiec',   tags: ['⚽'],      country: 'SZ' },
    { name: 'Olimpia Aavekaupunki',  tags: ['⚽'],      country: 'SZ' },
    { name: 'Partizana Czarnolas',   tags: ['⚽'],      country: 'SZ' },
    { name: 'Przenni Między Polanie',tags: ['⚽'],      country: 'W' },
    { name: 'Twierdza Aleksandria',  tags: ['⚽'],      country: 'I', countryName: 'Aleksandria' },
    { name: 'Union Zephyr',          tags: ['⚽'],      country: 'I', countryName: 'Zephyria' },
    { name: 'WKS Nowy Bór',          tags: ['⚽'],      country: 'W' },
    { name: 'Żółci Przennów',        tags: ['⚽'],      country: 'SZ' },
    { name: 'Groklin Cedynia',       tags: ['🏀'],      country: 'SZ' },
    { name: 'Jeziorak Tar',          tags: ['🏀'],      country: 'SZ' }
  ];

  var $ = function (id) { return document.getElementById(id); };
  var ta         = $('taClubs');
  var status     = $('statusClubs');
  var statusForm = $('statusClubsForm');
  var formBox    = $('clubsForm');
  var fileEl     = $('fileClubs');
  var switchBtn  = $('swToPlayers');

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
      if (isDirty && !confirm('Masz niezapisane zmiany. Przejść bez zapisu?')) {
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

  function normalize(raw) {
    return (Array.isArray(raw) ? raw : []).map(function (x) {
      if (typeof x === 'string') x = { name: x };
      var cc = String(x.country || x.c || 'SZ').toUpperCase();
      if (VALID_COUNTRIES.indexOf(cc) === -1) cc = 'SZ';
      var tags = [].concat(x.tags || x.tag || []).filter(function (t) {
        return VALID_TAGS.indexOf(t) !== -1;
      });
      return {
        name: String(x.name || '').trim(),
        tags: tags,
        country: cc,
        countryName: String(x.countryName || x.cn || '')
      };
    }).filter(function (t) { return t.name; });
  }

  function parse(text) {
    try {
      var d = JSON.parse(text);
      if (!Array.isArray(d)) throw new Error('JSON musi być tablicą.');
      return { ok: true, data: normalize(d) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  function analyze(list) {
    var seen = {}, dups = [];
    var s = { total: list.length, noName: 0, badCC: 0, iNoCN: 0, badTag: 0 };
    list.forEach(function (t) {
      if (!t.name) s.noName++;
      if (VALID_COUNTRIES.indexOf(t.country) === -1) s.badCC++;
      if (t.country === 'I' && !t.countryName.trim()) s.iNoCN++;
      var key = t.name.toLowerCase();
      seen[key] = (seen[key] || 0) + 1;
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
      'I bez CN: <b>' + a.iNoCN + '</b>',
      'duplikaty: <b>' + a.dups.length + '</b>'
    ];
    var warn = a.noName + a.badCC + a.iNoCN + a.dups.length > 0;
    setStatus(status, parts.join(' · ')
      + (a.dups.length ? '<br>Duplikaty: ' + a.dups.slice(0, 5).join(', ') : ''), !warn);
  }

  function withParsed(fn) {
    var r = parse(ta.value);
    if (!r.ok) return setStatus(status, 'Błąd: ' + r.error, false);
    fn(r);
  }

  // ✅ NOWE: Synchro formularza → JSON → zwróć dane
  function syncFormToJson(tbody) {
    if (!tbody) return null;
    var arr = [].slice.call(tbody.querySelectorAll('tr')).map(function (tr) {
      var inputs = tr.querySelectorAll('input[type=text]');
      var name = inputs[0].value.trim();
      var country = tr.querySelector('select').value;
      var cn = inputs[1].value.trim();
      var cbs = tr.querySelectorAll('input[type=checkbox]');
      var tags = [];
      if (cbs[0] && cbs[0].checked) tags.push('⚽');
      if (cbs[1] && cbs[1].checked) tags.push('🏀');
      return name ? {
        name: name, country: country,
        countryName: country === 'I' ? cn : '', tags: tags
      } : null;
    }).filter(Boolean);
    ta.value = JSON.stringify(arr, null, 2);
    updatePreview();
    return arr;
  }

  function loadJson(text, source) {
    var r = parse(text);
    if (!r.ok) throw new Error(r.error);
    ta.value = JSON.stringify(r.data, null, 2);
    updatePreview();
    buildForm(r.data);
    setStatus(status, 'Załadowano: ' + source, true);
  }

  function loadFromFile(file) {
    file.text().then(function (txt) {
      loadJson(txt, file.name || 'plik');
      setDirty(true);
      setStatus(statusForm, 'Załadowano do formularza.', true);
    }).catch(function (err) {
      setStatus(status, 'Błąd: ' + err.message, false);
    });
  }

  /* ═══ FORMULARZ ═══ */
  function buildForm(list) {
    formBox.innerHTML = '';
    var tbl = el('table', {
      style: 'width:100%;border-collapse:collapse;font-size:14px'
    });
    tbl.innerHTML = '<thead><tr><th>Nazwa</th><th>Kraj</th>'
      + '<th>CN (I)</th><th>Tagi</th><th></th></tr></thead>';
    var tbody = el('tbody');

    function addRow(t) {
      t = t || { name: '', country: 'SZ', countryName: '', tags: [] };
      var tr = el('tr');
      tr.style.borderTop = '1px solid #223055';

      var inp = el('input', {
        type: 'text', value: t.name,
        className: 'text', placeholder: 'Nazwa klubu'
      });
      inp.style.width = '100%';

      var sel = el('select', { className: 'select' });
      VALID_COUNTRIES.forEach(function (c) {
        sel.appendChild(el('option', { value: c, textContent: c }));
      });
      sel.value = t.country;

      var inpCN = el('input', {
        type: 'text', value: t.countryName || '',
        className: 'text', placeholder: 'np. Zephyria'
      });

      var cbF = el('input', { type: 'checkbox', checked: t.tags.indexOf('⚽') !== -1 });
      var cbB = el('input', { type: 'checkbox', checked: t.tags.indexOf('🏀') !== -1 });

      var btnDel = el('button', {
        type: 'button', className: 'btn secondary', textContent: 'Usuń'
      });

      function syncCN() {
        var show = sel.value === 'I';
        inpCN.disabled = !show;
        inpCN.style.opacity = show ? 1 : 0.5;
        if (!show) inpCN.value = '';
      }
      syncCN();

      sel.addEventListener('change', function () { syncCN(); setDirty(true); });
      [inp, inpCN].forEach(function (i) {
        i.addEventListener('input', function () { setDirty(true); });
      });
      [cbF, cbB].forEach(function (c) {
        c.addEventListener('change', function () { setDirty(true); });
      });
      btnDel.addEventListener('click', function () {
        tbody.removeChild(tr);
        setDirty(true);
      });

      [inp, sel, inpCN].forEach(function (node) {
        var td = el('td');
        td.appendChild(node);
        tr.appendChild(td);
      });

      var tdTag = el('td');
      tdTag.appendChild(cbF); tdTag.append(' ⚽  ');
      tdTag.appendChild(cbB); tdTag.append(' 🏀');
      tr.appendChild(tdTag);

      var tdDel = el('td');
      tdDel.appendChild(btnDel);
      tr.appendChild(tdDel);

      tbody.appendChild(tr);
    }

    (list || []).forEach(addRow);
    tbl.appendChild(tbody);
    formBox.appendChild(tbl);

    $('btnFormAddClub').onclick = function () { addRow(); setDirty(true); };

    $('btnFormSyncToJson').onclick = function () {
      syncFormToJson(tbody);
      setDirty(true);
      setStatus(statusForm, 'Formularz → JSON (niezapisane)', true);
    };

    $('btnFormSyncFromJson').onclick = function () {
      withParsed(function (r) {
        buildForm(r.data);
        setDirty(true);
        setStatus(statusForm, 'JSON → formularz', true);
      });
    };

    // ✅ NOWE: Zapisz bazę z formularza
    var btnFormSave = $('btnFormSaveClubs');
    if (btnFormSave) {
      btnFormSave.onclick = function () {
        var arr = syncFormToJson(tbody);
        if (!arr) return;
        var r = parse(ta.value);
        if (!r.ok) return setStatus(statusForm, 'Błąd: ' + r.error, false);
        LS.set(LS_KEY, r.data, ONE_DAY);
        setDirty(false);
        setStatus(statusForm, 'Zapisano bazę klubów (24h)', true);
        setStatus(status, 'Zapisano (24h)', true);
      };
    }

    // ✅ NOWE: Pobierz JSON z formularza
    var btnFormDownload = $('btnFormDownloadClubs');
    if (btnFormDownload) {
      btnFormDownload.onclick = function () {
        var arr = syncFormToJson(tbody);
        if (!arr) return;
        var blob = new Blob([ta.value], { type: 'application/json' });
        var a = el('a', { href: URL.createObjectURL(blob), download: 'kluby.json' });
        a.click();
        setStatus(statusForm, 'Pobrano kluby.json', true);
      };
    }
  }

  /* ═══ EVENT LISTENERY ═══ */
  ta.addEventListener('input', debounce(function () {
    setDirty(true);
    updatePreview();
  }, 300));

  $('btnFormatClubs').addEventListener('click', function () {
    withParsed(function (r) {
      ta.value = JSON.stringify(r.data, null, 2);
      setDirty(true);
      updatePreview();
    });
  });

  $('btnSaveClubs').addEventListener('click', function () {
    withParsed(function (r) {
      LS.set(LS_KEY, r.data, ONE_DAY);
      setDirty(false);
      setStatus(status, 'Zapisano (24h)', true);
    });
  });

  $('btnDownloadClubs').addEventListener('click', function () {
    withParsed(function (r) {
      var blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
      var a = el('a', { href: URL.createObjectURL(blob), download: 'kluby.json' });
      a.click();
    });
  });

  $('btnClearOverride').addEventListener('click', function () {
    LS.clear(LS_KEY);
    setStatus(status, 'Usunięto override', true);
  });

  $('btnLoadClubsFile').addEventListener('click', function () { fileEl.click(); });
  fileEl.addEventListener('change', function (e) {
    var f = e.target.files[0];
    if (f) loadFromFile(f);
    fileEl.value = '';
  });

  $('btnLoadClubsServer').addEventListener('click', loadServer);

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

  function loadServer() {
    fetch('../../kluby.json?cb=' + Date.now(), { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (txt) {
        loadJson(txt, 'serwer');
        setDirty(false);
      })
      .catch(function () {
        loadJson(JSON.stringify(DEFAULT_DB), 'wbudowana baza');
        setDirty(false);
      });
  }

  (function init() {
    var ov = LS.get(LS_KEY);
    if (ov && Array.isArray(ov) && ov.length) {
      loadJson(JSON.stringify(ov), 'override (24h)');
      setDirty(false);
      return;
    }
    loadJson(JSON.stringify(DEFAULT_DB), 'domyślna baza');
    setDirty(false);
    loadServer();
  })();

})();