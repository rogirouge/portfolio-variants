(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function each(sel, fn, root) { Array.prototype.forEach.call((root || document).querySelectorAll(sel), fn); }

  // ---------- Les palettes ----------
  // Comme sur un vrai tableau, chaque case fait défiler les caractères dans l'ordre jusqu'au bon.

  var ALPHA = ' ABCDEFGHIJKLMNOPQRSTUVWXYZÀÂÇÉÈÊÎÏÔÛ0123456789.:-&@/';
  var STEP = 55;       // ms entre deux palettes d'une même case
  var STAGGER = 26;    // ms de décalage d'une case à la suivante

  function pad(text, len) {
    while (text.length < len) text += ' ';
    return text;
  }

  function build(flap) {
    var text = flap.textContent.trim().toUpperCase();
    var len = Math.max(text.length, parseInt(flap.dataset.len || '0', 10));
    flap.target = pad(text, len);
    flap.textContent = '';
    // le texte lisible pour les lecteurs d'écran ; les cases sont décoratives
    // (les horloges changent chaque minute : on ne les fait pas relire)
    if (!flap.hasAttribute('data-clock')) {
      var sr = document.createElement('span');
      sr.className = 'visually-hidden';
      sr.textContent = text;
      flap.appendChild(sr);
    }
    var box = document.createDocumentFragment();
    flap.cells = [];
    for (var i = 0; i < len; i++) {
      var cell = document.createElement('span');
      cell.className = 'cell';
      cell.setAttribute('aria-hidden', 'true');
      var ch = document.createElement('span');
      ch.className = 'ch';
      ch.textContent = ' ';
      cell.appendChild(ch);
      cell.ch = ch;
      cell.cur = ' ';
      cell.queue = [];
      cell.flip = false;
      box.appendChild(cell);
      flap.cells.push(cell);
    }
    flap.appendChild(box);
    flap.classList.add('built');
  }

  function show(cell, c, animate) {
    cell.cur = c;
    cell.ch.textContent = c === ' ' ? ' ' : c;
    if (animate) {
      // deux animations identiques en alternance : on relance l'effet sans forcer de recalcul
      cell.flip = !cell.flip;
      cell.classList.toggle('ta', cell.flip);
      cell.classList.toggle('tb', !cell.flip);
    }
  }

  // les caractères par lesquels passe une case pour aller de « from » à « to »
  function path(from, to, scramble) {
    var L = ALPHA.length;
    var ti = ALPHA.indexOf(to);
    var fi = ALPHA.indexOf(from);
    if (ti < 0) return [ALPHA[1 + Math.floor(Math.random() * 26)], to];
    if (from === to && !scramble) return [];
    if (to === ' ' && from === ' ') return [];
    var start = fi;
    var dist = ((ti - fi) % L + L) % L;
    if (fi < 0 || scramble || dist > 14) {
      dist = 5 + Math.floor(Math.random() * 7);
      start = ti - dist;
    }
    var out = [];
    for (var k = 1; k <= dist; k++) out.push(ALPHA[((start + k) % L + L) % L]);
    return out;
  }

  var active = [];
  var running = false;

  function flipTo(flap, text, opts) {
    opts = opts || {};
    var target = pad(text.toUpperCase(), flap.cells.length).slice(0, flap.cells.length);
    flap.target = target;
    var now = performance.now();
    flap.cells.forEach(function (cell, i) {
      var p = path(cell.cur, target[i], opts.scramble);
      if (reduce) { show(cell, target[i], false); return; }
      if (!p.length) return;
      cell.queue = p;
      cell.at = now + (opts.delay || 0) + i * STAGGER;
      if (active.indexOf(cell) < 0) active.push(cell);
    });
    if (!running && active.length) {
      running = true;
      requestAnimationFrame(tick);
    }
  }

  function tick(now) {
    for (var i = active.length - 1; i >= 0; i--) {
      var cell = active[i];
      if (now < cell.at) continue;
      show(cell, cell.queue.shift(), true);
      cell.at = now + STEP;
      if (!cell.queue.length) active.splice(i, 1);
    }
    if (active.length) requestAnimationFrame(tick);
    else running = false;
  }

  var flaps = Array.prototype.slice.call(document.querySelectorAll('.flap'));
  flaps.forEach(build);

  function reveal(flap, delay) { flipTo(flap, flap.target, { delay: delay }); }
  function shuffle(flap, delay) { flipTo(flap, flap.target, { scramble: true, delay: delay }); }

  // ---------- Les panneaux s'écrivent quand ils arrivent à l'écran ----------

  var groups = [];
  each('.hero, .title, .board, .cf-bar, .mail', function (g) { groups.push(g); });

  function revealGroup(g) {
    var rows = g.querySelectorAll('.row');
    if (rows.length) {
      Array.prototype.forEach.call(rows, function (row, r) {
        each('.flap', function (f, k) { reveal(f, r * 110 + k * 90); }, row);
      });
    } else {
      each('.flap', function (f, k) { reveal(f, k * 260); }, g);
    }
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        revealGroup(e.target);
      });
    }, { threshold: 0.25 });
    groups.forEach(function (g) { io.observe(g); });
  } else {
    groups.forEach(revealGroup);
  }

  // au survol, une ligne du tableau se réécrit
  each('.row, .title, .menu a, .mail a', function (el) {
    el.addEventListener('mouseenter', function () {
      each('.flap', function (f, k) { if (!f.cells.some(function (c) { return c.queue.length; })) shuffle(f, k * 60); }, el);
    });
  });

  // ---------- Horloges : Lille et Hanoï ----------

  var clocks = Array.prototype.slice.call(document.querySelectorAll('[data-clock]'));
  var formats = clocks.map(function (c) {
    return new Intl.DateTimeFormat('fr-FR', { timeZone: c.dataset.clock, hour: '2-digit', minute: '2-digit', hour12: false });
  });
  function updateClocks(first) {
    var d = new Date();
    clocks.forEach(function (c, i) { flipTo(c, formats[i].format(d), { delay: first ? 600 + i * 200 : 0 }); });
  }
  updateClocks(true);
  setInterval(updateClocks, 10000);

  // ---------- Menu ----------

  var menuButton = document.querySelector('.menu-button');
  var menu = document.getElementById('menu');
  menu.inert = true;

  function setMenu(open) {
    document.body.classList.toggle('menu-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.textContent = open ? 'Fermer' : 'Menu';
    menu.inert = !open;
    if (open) {
      each('.flap', function (f, k) { shuffle(f, k * 70); }, menu);
      menu.querySelector('a').focus({ preventScroll: true });
    }
  }
  menuButton.addEventListener('click', function () { setMenu(!document.body.classList.contains('menu-open')); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  // ---------- Parcours : la ligne choisie montre son étape ----------

  var rows = Array.prototype.slice.call(document.querySelectorAll('.timetable .row'));
  var stops = Array.prototype.slice.call(document.querySelectorAll('.stop'));
  var chosen = -1;

  function choose(i) {
    if (i === chosen) return;
    chosen = i;
    rows.forEach(function (r, k) {
      r.classList.toggle('on', k === i);
      r.setAttribute('aria-pressed', String(k === i));
    });
    stops.forEach(function (s, k) { s.classList.toggle('on', k === i); });
  }
  rows.forEach(function (r, i) {
    r.addEventListener('click', function () { choose(i); });
    r.addEventListener('mouseenter', function () { choose(i); });
    r.addEventListener('focus', function () { choose(i); });
  });
  choose(rows.findIndex(function (r) { return r.classList.contains('now'); }));

  // ---------- Photos : carrousel en éventail, le lieu s'affiche sur une ligne de palettes ----------

  var cf = document.querySelector('.cf');
  var items = Array.prototype.slice.call(cf.querySelectorAll('.cf-item'));
  var countEl = document.querySelector('.cf-count');
  var place = document.querySelector('.cf-place .flap');
  var current = 0;
  var n = items.length;

  // « Train Street, le soir · Rod Waddington » → « TRAIN STREET »
  function placeName(item) {
    var t = item.querySelector('figcaption').textContent.split('·')[0].split(',')[0].trim();
    return t.normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, place.cells.length);
  }

  function go(k, quiet) {
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
    if (quiet) place.target = pad(placeName(items[current]).toUpperCase(), place.cells.length);
    else flipTo(place, placeName(items[current]));
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
  go(0, true);

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
})();
