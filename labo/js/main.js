(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- La lumière : rouge (inactinique) ou blanche ----------

  var lightSwitch = document.querySelector('.switch');
  var lightText = lightSwitch.querySelector('.switch-text');

  function setLight(mode, remember) {
    var white = mode === 'blanche';
    if (white) root.dataset.light = 'blanche';
    else delete root.dataset.light;
    lightSwitch.setAttribute('aria-pressed', String(white));
    lightText.textContent = white ? 'Lumière blanche' : 'Lumière inactinique';
    if (remember) {
      try { localStorage.setItem('lumiere', white ? 'blanche' : 'inactinique'); } catch (e) { /* tant pis */ }
    }
  }

  setLight(root.dataset.light, false);
  lightSwitch.addEventListener('click', function () {
    setLight(root.dataset.light === 'blanche' ? 'inactinique' : 'blanche', true);
  });

  // ---------- Développement : chaque tirage apparaît quand il entre dans l'écran ----------
  // On attend aussi que l'image soit chargée, sinon le révélateur agirait sur une feuille vide.

  var prints = Array.prototype.slice.call(document.querySelectorAll('.print'));

  function develop(print) {
    var img = print.querySelector('img');
    function start() {
      print.classList.add('dev');
      // le bain dure 3 secondes ; ensuite le tirage réagit vite à la lumière
      setTimeout(function () { print.classList.add('done'); }, 3300);
    }
    if (!img || img.complete) start();
    else img.addEventListener('load', start, { once: true });
  }

  if (reduce || !('IntersectionObserver' in window)) {
    prints.forEach(function (p) { p.classList.add('dev', 'done'); });
  } else {
    var bath = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        develop(e.target);
        bath.unobserve(e.target);
      });
    }, { threshold: 0.3 });
    prints.forEach(function (p) { bath.observe(p); });
  }

  // ---------- Le trait de crayon gras autour de la vue d'aujourd'hui ----------

  var strip = document.querySelector('.strip-inner');
  var today = strip.querySelector('.frame.now .print');
  var SVG = 'http://www.w3.org/2000/svg';
  var pencil = document.createElementNS(SVG, 'svg');
  var stroke = document.createElementNS(SVG, 'path');
  pencil.setAttribute('class', 'pencil');
  pencil.setAttribute('aria-hidden', 'true');
  pencil.appendChild(stroke);
  strip.appendChild(pencil);
  var drawn = reduce;

  // hasard fixe : le cercle a toujours la même forme, un peu irrégulière, comme à la main
  function seeded(seed) {
    var s = seed;
    return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }
  function f(n) { return n.toFixed(1); }

  function drawPencil() {
    var sr = strip.getBoundingClientRect();
    var r = today.getBoundingClientRect();
    var cx = r.left - sr.left + r.width / 2;
    var cy = r.top - sr.top + r.height / 2;
    var rx = r.width / 2 + 20;
    var ry = r.height / 2 + 14;
    var tilt = -0.09;
    var rnd = seeded(11);
    var pts = [];
    var n = 46;
    var start = -0.4;
    var end = Math.PI * 2 + 0.5; // le trait dépasse un peu son point de départ
    for (var i = 0; i <= n; i++) {
      var t = start + (end - start) * i / n;
      var k = 1 + (rnd() - 0.5) * 0.035 + (i / n) * 0.045;
      var x = Math.cos(t) * rx * k;
      var y = Math.sin(t) * ry * k;
      pts.push([cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)]);
    }
    // une courbe lisse qui passe par tous les points (Catmull-Rom vers Bézier)
    var d = 'M' + f(pts[0][0]) + ' ' + f(pts[0][1]);
    for (var j = 0; j < pts.length - 1; j++) {
      var p0 = pts[j - 1] || pts[j], p1 = pts[j], p2 = pts[j + 1], p3 = pts[j + 2] || p2;
      d += 'C' + f(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + f(p1[1] + (p2[1] - p0[1]) / 6) + ' ' +
                 f(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + f(p2[1] - (p3[1] - p1[1]) / 6) + ' ' +
                 f(p2[0]) + ' ' + f(p2[1]);
    }
    stroke.setAttribute('d', d);
    var len = stroke.getTotalLength();
    stroke.style.strokeDasharray = len;
    stroke.style.strokeDashoffset = drawn ? 0 : len;
  }

  drawPencil();
  if (!drawn) {
    var watch = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      drawn = true;
      stroke.style.strokeDashoffset = 0;
      watch.disconnect();
    }, { threshold: 0.6 });
    watch.observe(today);
  }
  window.addEventListener('resize', drawPencil);
  if (document.fonts) document.fonts.ready.then(drawPencil);

  // ---------- L'agrandisseur ----------

  var enlarger = document.querySelector('.enlarger');
  var bigPhoto = enlarger.querySelector('.photo');
  var big = bigPhoto.querySelector('img');
  var bigTitle = enlarger.querySelector('figcaption b');
  var bigCredit = enlarger.querySelector('figcaption span');
  var bigCount = enlarger.querySelector('.en-count');
  var shots = Array.prototype.slice.call(document.querySelectorAll('.shot'));
  var current = 0;
  var opener = null;

  function show(i) {
    current = (i + shots.length) % shots.length;
    var shot = shots[current];
    var img = shot.querySelector('img');
    bigPhoto.classList.remove('focus');
    big.src = img.currentSrc || img.src;
    big.alt = img.alt;
    bigTitle.textContent = shot.dataset.title;
    bigCredit.textContent = 'photo provisoire, ' + shot.dataset.credit;
    bigCount.textContent = (current + 1) + ' / ' + shots.length;
    if (!reduce) {
      void bigPhoto.offsetWidth; // relance l'animation de mise au point
      bigPhoto.classList.add('focus');
    }
  }

  shots.forEach(function (shot, i) {
    shot.addEventListener('click', function () {
      opener = shot;
      show(i);
      enlarger.showModal();
    });
  });
  enlarger.querySelector('.en-prev').addEventListener('click', function () { show(current - 1); });
  enlarger.querySelector('.en-next').addEventListener('click', function () { show(current + 1); });
  enlarger.querySelector('.en-close').addEventListener('click', function () { enlarger.close(); });
  enlarger.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
  });
  // un clic à côté de la photo referme l'agrandisseur
  enlarger.addEventListener('click', function (e) { if (e.target === enlarger) enlarger.close(); });
  enlarger.addEventListener('close', function () { if (opener) opener.focus(); });

  // ---------- Écrire ----------

  var copy = document.querySelector('.copy');
  if (navigator.clipboard && window.isSecureContext) {
    copy.hidden = false;
    copy.addEventListener('click', function () {
      navigator.clipboard.writeText('igor.belyaev1899@gmail.com').then(function () {
        copy.textContent = 'Adresse copiée';
        setTimeout(function () { copy.textContent = "Copier l'adresse"; }, 2000);
      });
    });
  }
})();
