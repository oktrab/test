// stage-fit.js — auto-skalowanie stage do dostępnej przestrzeni
(function () {
  'use strict';

  var stage = document.getElementById('stage');
  var wrap = stage && stage.parentElement;
  if (!stage || !wrap) return;

  var STAGE_W = 1920;
  var STAGE_H = 1080;
  var isExporting = false;

  function fit() {
    if (isExporting) return;

    // Reset żeby zmierzyć naturalny rozmiar wrapa
    stage.style.transform = '';
    stage.style.marginLeft = '';
    wrap.style.height = '';

    var wrapW = wrap.clientWidth;
    if (wrapW < 1) return;

    // Skaluj tak żeby stage zmieścił się w szerokości wrapa
    var scale = Math.min(1, wrapW / STAGE_W);
    var scaledW = Math.floor(STAGE_W * scale);
    var scaledH = Math.ceil(STAGE_H * scale);

    // Wyśrodkuj jeśli jest nadmiar przestrzeni
    var offsetX = Math.max(0, Math.floor((wrapW - scaledW) / 2));

    stage.style.transformOrigin = 'top left';
    stage.style.transform = 'scale(' + scale + ')';
    stage.style.marginLeft = offsetX + 'px';

    wrap.style.height = scaledH + 'px';
    wrap.style.overflow = 'hidden';
  }

  // Debounced resize
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fit, 100);
  });

  // Hook do eksportu — wyłącz skalowanie na czas generowania JPG
  window.stageFit = {
    disable: function () {
      isExporting = true;
      stage.style.transform = '';
      stage.style.marginLeft = '';
      wrap.style.height = '';
      wrap.style.overflow = 'visible';
    },
    enable: function () {
      isExporting = false;
      fit();
    },
    refresh: fit
  };

  // Uruchom po załadowaniu
  if (document.readyState === 'complete') {
    fit();
  } else {
    window.addEventListener('load', fit);
  }

  // Też od razu (DOMContentLoaded)
  fit();
})();