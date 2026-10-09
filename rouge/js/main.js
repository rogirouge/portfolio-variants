(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function docTop(el) { return el.getBoundingClientRect().top + window.scrollY; }
  // largeur de la page : contrairement à window.innerWidth, elle ne grandit pas si un élément déborde
  function pageWidth() { return document.documentElement.clientWidth; }

  // Positions mesurées une fois par mise en page ; pendant l'animation on ne lit que window.scrollY.
  var geo = { heroTop: 0, heroTotal: 1, heroBottom: 0, stepCenters: [], zones: [] };

  var mouse = { nx: 0, ny: 0 };
  var soft = { nx: 0, ny: 0 };

  // ---------- Menu ----------

  var menuButton = document.querySelector('.menu-button');
  var menu = document.getElementById('menu');
  menu.inert = true;

  function setMenu(open) {
    document.body.classList.toggle('menu-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.textContent = open ? 'Fermer' : 'Menu';
    menu.inert = !open;
    if (open) menu.querySelector('a').focus({ preventScroll: true });
  }
  menuButton.addEventListener('click', function () { setMenu(!document.body.classList.contains('menu-open')); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  // ---------- Couverture : la bande rouge ----------
  // La copie noire du texte n'est visible que dans la bande : là où la bande passe, les lettres deviennent noires.

  var stage = document.querySelector('.hero-stage');
  var hero = document.querySelector('.hero');
  var poster = stage.querySelector('.poster');
  var posterK = stage.querySelector('.poster-k');
  posterK.innerHTML = poster.innerHTML.replace('<h1', '<p').replace('</h1>', '</p>');
  var names = stage.querySelectorAll('.name');

  function fitName() {
    var gut = clamp(pageWidth() * 0.026, 16, 36);
    names.forEach(function (n) { n.style.fontSize = '100px'; });
    var w = names[0].lastElementChild.getBoundingClientRect().width; // « Belyaev », la ligne la plus longue
    var byWidth = 100 * (pageWidth() - 2 * gut) / w;
    var byHeight = stage.clientHeight * 0.34;            // deux lignes doivent tenir dans l'affiche
    var size = Math.min(byWidth, byHeight).toFixed(1) + 'px';
    names.forEach(function (n) { n.style.fontSize = size; });
  }

  var lastBand = '';
  function drawBand(y) {
    var p = reduce ? 0 : clamp((y - geo.heroTop) / geo.heroTotal, 0, 1);
    var e = p * p * (3 - 2 * p);
    // la souris fait pivoter la bande
    var tilt = soft.nx * 9;
    var lift = soft.ny * 5;
    var a = 57 + tilt + lift, d = 81 + tilt + lift;
    var b = 17 - tilt + lift, c = 41 - tilt + lift;
    // en défilant, la bande s'élargit jusqu'à couvrir l'écran
    a = lerp(a, -12, e); b = lerp(b, -12, e);
    d = lerp(d, 112, e); c = lerp(c, 112, e);
    var key = [a, b, c, d].map(function (v) { return v.toFixed(2); }).join(' ');
    if (key === lastBand) return;
    lastBand = key;
    stage.style.setProperty('--a', a.toFixed(2) + '%');
    stage.style.setProperty('--b', b.toFixed(2) + '%');
    stage.style.setProperty('--c', c.toFixed(2) + '%');
    stage.style.setProperty('--d', d.toFixed(2) + '%');
  }

  window.addEventListener('mousemove', function (e) {
    mouse.nx = e.clientX / window.innerWidth - 0.5;
    mouse.ny = e.clientY / window.innerHeight - 0.5;
    kick();
  });

  // ---------- Barre du haut : noire sur les sections rouges ----------

  var bar = document.querySelector('.bar');
  var sections = Array.prototype.slice.call(document.querySelectorAll('.section'));

  function updateBar(y) {
    var probe = y + 30;
    var red = false;
    if (probe < geo.heroBottom) {
      red = clamp((y - geo.heroTop) / geo.heroTotal, 0, 1) > 0.6;
    } else {
      for (var i = 0; i < geo.zones.length; i++) {
        if (probe >= geo.zones[i][0] && probe < geo.zones[i][1]) { red = geo.zones[i][2]; break; }
      }
    }
    bar.classList.toggle('on-red', red);
  }

  // ---------- Parcours : la photo suit la ville lue ----------

  var steps = Array.prototype.slice.call(document.querySelectorAll('.step'));
  var views = Array.prototype.slice.call(document.querySelectorAll('.viewer-frame > *'));
  var liquid = document.getElementById('liquid-map');
  var activeStep = -1;
  var wobbleStart = 0;

  function setStep(i) {
    if (i === activeStep) return;
    activeStep = i;
    steps.forEach(function (s, k) { s.classList.toggle('on', k === i); });
    views.forEach(function (v, k) { v.classList.toggle('on', k === i); });
    if (!reduce) { wobbleStart = performance.now(); kick(); }
  }

  function updateSteps(y) {
    var mid = y + window.innerHeight * 0.5;
    var best = 0;
    for (var i = 0; i < geo.stepCenters.length; i++) {
      if (Math.abs(geo.stepCenters[i] - mid) < Math.abs(geo.stepCenters[best] - mid)) best = i;
    }
    setStep(best);
  }

  // la photo « coule » pendant le changement, comme une image liquide
  function wobble(now) {
    var t = (now - wobbleStart) / 700;
    var s = t >= 0 && t < 1 ? Math.sin(t * Math.PI) * 70 : 0;
    liquid.setAttribute('scale', s.toFixed(1));
    return t < 1;
  }

  // ---------- Photos : carrousel en éventail ----------

  var cf = document.querySelector('.cf');
  var items = Array.prototype.slice.call(cf.querySelectorAll('.cf-item'));
  var countEl = document.querySelector('.cf-count');
  var current = 0;
  var n = items.length;

  function go(k) {
    current = ((k % n) + n) % n;
    items.forEach(function (item, j) {
      var d = ((j - current) % n + n) % n;
      if (d > n / 2) d -= n;
      var ad = Math.abs(d);
      item.style.transform = 'translateX(' + (d * 62) + '%) translateZ(' + (-ad * 180) + 'px) rotateY(' + clamp(-d * 34, -50, 50) + 'deg)';
      item.style.opacity = ad > 3 ? '0' : ad === 3 ? '0.6' : '1';
      item.style.zIndex = String(100 - ad);
      item.style.pointerEvents = ad > 3 ? 'none' : 'auto';
      item.classList.toggle('on', d === 0);
      // la photo du centre est en couleurs, les autres restent en rouge et noir
      item.querySelector('.photo').classList.toggle('color', d === 0);
      item.setAttribute('aria-hidden', d === 0 ? 'false' : 'true');
    });
    countEl.innerHTML = '<b>' + String(current + 1).padStart(2, '0') + '</b> / ' + String(n).padStart(2, '0');
  }

  items.forEach(function (item, k) { item.addEventListener('click', function () { go(k); }); });
  document.querySelector('.cf-prev').addEventListener('click', function () { go(current - 1); });
  document.querySelector('.cf-next').addEventListener('click', function () { go(current + 1); });
  cf.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(current - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(current + 1); }
  });
  var startX = null;
  cf.addEventListener('pointerdown', function (e) { startX = e.clientX; });
  window.addEventListener('pointerup', function (e) {
    if (startX === null) return;
    var dx = e.clientX - startX;
    if (Math.abs(dx) > 40) go(current + (dx < 0 ? 1 : -1));
    startX = null;
  });

  // ---------- Lignes ajustées à la largeur : le pipeline, l'adresse, les titres verticaux ----------

  // largeur du contenu d'un élément, sans ses marges intérieures
  function contentWidth(el) {
    var cs = getComputedStyle(el);
    return el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  }

  function fitWidth(el, max) {
    // on mesure le texte lui-même, pas la boîte qui le contient (une boîte de grille s'étire toujours)
    el.style.fontSize = '100px';
    el.style.whiteSpace = 'nowrap';
    var range = document.createRange();
    range.selectNodeContents(el);
    var w = range.getBoundingClientRect().width;
    el.style.whiteSpace = '';
    var size = Math.min(100 * contentWidth(el.parentElement) / w * 0.98, max);
    el.style.fontSize = size.toFixed(1) + 'px';
  }

  function fitSides() {
    // un titre vertical ne doit pas être plus long que l'écran n'est haut
    document.querySelectorAll('.side').forEach(function (s) {
      s.style.fontSize = '';
      // sur téléphone, le titre redevient horizontal : il prend toute la largeur, sans déborder
      if (window.matchMedia('(max-width: 860px)').matches) { fitWidth(s, pageWidth() * 0.21); return; }
      var len = s.getBoundingClientRect().height;
      var room = window.innerHeight - 120;
      if (len > room) s.style.fontSize = (parseFloat(getComputedStyle(s).fontSize) * room / len).toFixed(1) + 'px';
    });
  }

  // ---------- Contact ----------

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

  // ---------- Boucle d'animation : elle ne tourne que pendant un mouvement ----------

  var running = false;
  var until = 0;

  function kick() {
    until = performance.now() + 900;
    if (!running) {
      running = true;
      requestAnimationFrame(frame);
    }
  }

  function frame(now) {
    var k = reduce ? 1 : 0.08;
    soft.nx += (mouse.nx - soft.nx) * k;
    soft.ny += (mouse.ny - soft.ny) * k;
    var y = window.scrollY;
    if (y < geo.heroBottom) drawBand(y);
    updateBar(y);
    updateSteps(y);
    var wobbling = wobble(now);
    var settled = Math.abs(mouse.nx - soft.nx) < 0.0005 && Math.abs(mouse.ny - soft.ny) < 0.0005;
    if (now < until || !settled || wobbling) requestAnimationFrame(frame);
    else running = false;
  }

  function layout() {
    fitName();
    fitWidth(document.querySelector('.pipeline'), 260);
    fitWidth(document.querySelector('.mail'), 150);
    fitSides();
    geo.heroTop = docTop(hero);
    geo.heroTotal = Math.max(1, hero.offsetHeight - stage.offsetHeight);
    geo.heroBottom = geo.heroTop + hero.offsetHeight;
    geo.stepCenters = steps.map(function (s) { return docTop(s) + s.offsetHeight / 2; });
    geo.zones = sections.map(function (s) {
      var t = docTop(s);
      return [t, t + s.offsetHeight, s.classList.contains('red')];
    });
    lastBand = '';
    kick();
  }

  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('resize', layout);
  if (document.fonts) document.fonts.ready.then(layout);
  window.addEventListener('load', layout);

  go(0);
  layout();
})();
