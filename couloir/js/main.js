(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var narrowQuery = window.matchMedia('(max-width: 760px)');

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function gutter() { return clamp(window.innerWidth * 0.024, 16, 32); }
  function docTop(el) { return el.getBoundingClientRect().top + window.scrollY; }

  // Positions mesurées une fois par mise en page (chargement, polices, redimensionnement).
  // Pendant l'animation on ne relit rien dans la page : seulement window.scrollY.
  var geo = { W: 0, H: 0, heroTop: 0, heroTotal: 1, heroBottom: 0, pinTop: 0, pinTotal: 1, giantTops: [] };

  var mouse = { x: -100, y: -100, nx: 0, ny: 0 };
  var soft = { x: -100, y: -100, nx: 0, ny: 0 };

  // ---------- Point qui suit la souris ----------

  var dot = document.querySelector('.dot');

  window.addEventListener('mousemove', function (e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.nx = e.clientX / window.innerWidth - 0.5;
    mouse.ny = e.clientY / window.innerHeight - 0.5;
    dot.classList.add('on');
    kick();
  });
  document.addEventListener('mouseleave', function () { dot.classList.remove('on'); });
  document.addEventListener('mouseover', function (e) {
    dot.classList.toggle('big', !!e.target.closest('a, button, .cf-item'));
  });

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

  // ---------- Couverture : le couloir ----------
  // Un couloir de cadres carrés mène à la photo. Il y a autant de cadres que de « serveurs » :
  // plus la fenêtre est large, plus il y en a. En faisant défiler, la caméra avance dans le couloir,
  // les cadres passent de chaque côté et la photo s'ouvre jusqu'à remplir l'écran.

  var hero = document.querySelector('.hero');
  var stage = hero.querySelector('.hero-stage');
  var card = hero.querySelector('.hero-card');
  var svg = hero.querySelector('.hero-lines');
  var w1 = hero.querySelector('.w1');
  var w2 = hero.querySelector('.w2');
  var role = hero.querySelector('.hero-role');
  var fading = hero.querySelectorAll('.hero-role, .hero-corner');
  var base = { cw: 0, ch: 0, gap: 0 };
  var servers = 1;
  var C_END = 0.9; // jusqu'où avance la caméra (la photo est à la profondeur 1)
  var lastHero = '';

  svg.innerHTML = '<path/>';
  var heroPath = svg.firstChild;

  function serverCount(w) {
    return w < 640 ? 1 : w < 900 ? 2 : w < 1150 ? 3 : w < 1400 ? 4 : w < 1700 ? 5 : 6;
  }

  function measureHero() {
    card.style.width = '';
    card.style.height = '';
    base.cw = card.offsetWidth;
    base.ch = card.offsetHeight;
    base.gap = clamp(window.innerWidth * 0.016, 14, 28);

    // le nom prend toute la place disponible à côté (ou au-dessus) de la photo
    var root = document.documentElement;
    root.style.setProperty('--name', '100px');
    var probe = w2.firstElementChild.getBoundingClientRect().width;
    var avail = narrowQuery.matches
      ? window.innerWidth - 2 * gutter()
      : window.innerWidth / 2 - base.cw / 2 - base.gap - gutter();
    root.style.setProperty('--name', clamp(96 * avail / probe, 28, 150).toFixed(1) + 'px');

    servers = serverCount(window.innerWidth);
    document.getElementById('vw').textContent = window.innerWidth.toLocaleString('fr-FR');
    document.getElementById('servers').textContent = servers + (servers > 1 ? ' serveurs' : ' serveur');
    lastHero = '';
  }

  function drawHero(y) {
    var W = geo.W;
    var H = geo.H;
    var p = reduce ? 0 : clamp((y - geo.heroTop) / geo.heroTotal, 0, 1);
    var camX = soft.nx * 46;
    var camY = soft.ny * 30;

    // rien n'a bougé depuis la dernière image : on ne redessine pas
    var key = p.toFixed(4) + ' ' + camX.toFixed(2) + ' ' + camY.toFixed(2);
    if (key === lastHero) return;
    lastHero = key;

    var cx = W / 2;
    var cy = H / 2;
    var c = p * C_END;
    var k = (1 / (1 - c) - 1) / (1 / (1 - C_END) - 1); // 0 → 1, s'accélère comme en perspective

    function px(x, z) { return cx + (x - camX) / (z - c); }
    function py(v, z) { return cy + (v - camY) / (z - c); }

    // la photo, au bout du couloir : elle s'ouvre jusqu'à remplir l'écran
    var cw = lerp(base.cw, W, k);
    var ch = lerp(base.ch, H, k);
    var ox = -camX * (1 - k);
    var oy = -camY * (1 - k);
    card.style.width = cw.toFixed(1) + 'px';
    card.style.height = ch.toFixed(1) + 'px';
    card.style.transform = 'translate(-50%, -50%) translate(' + ox.toFixed(1) + 'px,' + oy.toFixed(1) + 'px)';

    // le nom s'écarte, comme deux portes
    var push = (cw - base.cw) / 2 + k * W * 0.3;
    var pushY = (ch - base.ch) / 2 + k * H * 0.3;
    var nameAlpha = String(1 - smoothstep(0.08, 0.5, k));
    if (narrowQuery.matches) {
      w1.style.transform = 'translate(0, calc(-100% - ' + pushY.toFixed(1) + 'px))';
      w2.style.transform = 'translate(0, ' + pushY.toFixed(1) + 'px)';
    } else {
      w1.style.transform = 'translate(' + (-push + ox).toFixed(1) + 'px, -50%)';
      w2.style.transform = 'translate(' + (push + ox).toFixed(1) + 'px, -50%)';
    }
    w1.style.opacity = nameAlpha;
    w2.style.opacity = nameAlpha;
    // la ligne sous la photo descend avec son bord et s'efface vite : elle ne passe jamais sur la photo
    var roleY = (narrowQuery.matches ? pushY : (ch - base.ch) / 2) + oy;
    role.style.transform = 'translate(-50%, ' + roleY.toFixed(1) + 'px)';
    var restAlpha = String(1 - smoothstep(0, 0.12, k));
    fading.forEach(function (el) { el.style.opacity = restAlpha; });

    // les lignes (elles passent sous la photo et sous les textes, qui ont un fond)
    var d = [];
    function seg(x1, y1, x2, y2) { d.push('M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + 'L' + x2.toFixed(1) + ' ' + y2.toFixed(1)); }
    function rect(x1, y1, x2, y2) { seg(x1, y1, x2, y1); seg(x2, y1, x2, y2); seg(x2, y2, x1, y2); seg(x1, y2, x1, y1); }

    // horizon et axe vertical
    seg(0, cy, W, cy);
    seg(cx, 0, cx, H);

    // les cadres du couloir, du plus proche de la photo au plus proche de nous
    var A = base.ch * 0.4 * 0.935;
    var corners = null;
    for (var j = 0; j < servers; j++) {
      var z = 1 - 0.085 * (j + 1);
      if (z - c < 0.03) break;
      var x1 = px(-A, z), x2 = px(A, z), y1 = py(-A, z), y2 = py(A, z);
      if (x2 - x1 > W * 3) break;
      rect(x1, y1, x2, y2);
      if (corners) {
        seg(corners[0], corners[1], x1, y1); seg(corners[2], corners[1], x2, y1);
        seg(corners[2], corners[3], x2, y2); seg(corners[0], corners[3], x1, y2);
      }
      corners = [x1, y1, x2, y2];
    }
    // fuyantes vers les coins de l'écran
    if (corners) {
      seg(0, 0, corners[0], corners[1]); seg(W, 0, corners[2], corners[1]);
      seg(W, H, corners[2], corners[3]); seg(0, H, corners[0], corners[3]);
    }
    // un cadre derrière la photo, relié au premier cadre : le couloir continue
    var zb = 1.25;
    var bx1 = px(-A * 0.8, zb), bx2 = px(A * 0.8, zb), by1 = py(-A * 0.8, zb), by2 = py(A * 0.8, zb);
    rect(bx1, by1, bx2, by2);
    var f = 1 - 0.085;
    if (f - c > 0.03) {
      seg(px(-A, f), py(-A, f), bx1, by1); seg(px(A, f), py(-A, f), bx2, by1);
      seg(px(A, f), py(A, f), bx2, by2); seg(px(-A, f), py(A, f), bx1, by2);
    }
    // grand losange, loin derrière
    var zl = 1.6;
    var lw = Math.min(base.ch * 1.25, W * 0.46) * zl;
    var lh = base.ch * 0.78 * zl;
    d.push('M' + px(0, zl).toFixed(1) + ' ' + py(-lh, zl).toFixed(1) +
           'L' + px(lw, zl).toFixed(1) + ' ' + py(0, zl).toFixed(1) +
           'L' + px(0, zl).toFixed(1) + ' ' + py(lh, zl).toFixed(1) +
           'L' + px(-lw, zl).toFixed(1) + ' ' + py(0, zl).toFixed(1) + 'Z');

    heroPath.setAttribute('d', d.join(''));
    svg.style.opacity = String(1 - smoothstep(0.55, 1, k));
  }

  // ---------- Grands titres : ils s'élargissent en entrant dans l'écran ----------

  var giants = Array.prototype.slice.call(document.querySelectorAll('.giant'));
  var stretch = [];

  function fitGiants() {
    giants.forEach(function (g, i) {
      var span = g.firstElementChild;
      g.style.fontSize = '100px';
      span.style.fontStretch = '125%';
      var natural = span.getBoundingClientRect().width;
      var size = Math.min(100 * g.clientWidth / natural, window.innerHeight * 0.32);
      g.style.fontSize = size.toFixed(1) + 'px';
      stretch[i] = 125;
    });
  }

  function stretchGiants(y) {
    giants.forEach(function (g, i) {
      var t = reduce ? 1 : clamp((geo.H - (geo.giantTops[i] - y)) / (geo.H * 0.55), 0, 1);
      var e = 1 - Math.pow(1 - t, 3);
      var s = Math.round((62 + 63 * e) * 4) / 4; // au quart de pour cent près
      if (s !== stretch[i]) {
        stretch[i] = s;
        g.firstElementChild.style.fontStretch = s + '%';
      }
    });
  }

  // ---------- Parcours : les villes défilent sur le côté ----------

  var pin = document.querySelector('.journey-pin');
  var track = document.querySelector('.journey-track');
  var progress = document.querySelector('.journey-progress span');
  var travel = 0;
  var lastJourney = -1;

  function measureJourney() {
    if (reduce) return;
    travel = Math.max(0, track.scrollWidth - window.innerWidth);
    pin.style.setProperty('--pin', (travel + window.innerHeight) + 'px');
    lastJourney = -1;
  }

  function updateJourney(y) {
    if (reduce) return;
    var p = clamp((y - geo.pinTop) / geo.pinTotal, 0, 1);
    if (p === lastJourney) return;
    lastJourney = p;
    track.style.transform = 'translate3d(' + (-p * travel).toFixed(1) + 'px,0,0)';
    progress.style.transform = 'scaleX(' + p.toFixed(4) + ')';
  }

  // ---------- Photos : carrousel en éventail ----------

  var cf = document.querySelector('.cf');
  var items = Array.prototype.slice.call(cf.querySelectorAll('.cf-item'));
  var cfLines = cf.querySelector('.cf-lines');
  var countEl = document.querySelector('.cf-count');
  var current = 0;
  var n = items.length;

  function go(k) {
    current = ((k % n) + n) % n;
    items.forEach(function (item, j) {
      var d = ((j - current) % n + n) % n;
      if (d > n / 2) d -= n;
      var ad = Math.abs(d);
      item.style.transform = 'translateX(' + (d * 60) + '%) translateZ(' + (-ad * 170) + 'px) rotateY(' + clamp(-d * 34, -50, 50) + 'deg)';
      item.style.opacity = ad > 3 ? '0' : ad === 3 ? '0.55' : '1';
      item.style.filter = ad ? 'brightness(' + (1 - Math.min(ad, 3) * 0.2).toFixed(2) + ')' : 'none';
      item.style.zIndex = String(100 - ad);
      item.style.pointerEvents = ad > 3 ? 'none' : 'auto';
      item.classList.toggle('on', d === 0);
      item.setAttribute('aria-hidden', d === 0 ? 'false' : 'true');
    });
    countEl.innerHTML = '<b>' + String(current + 1).padStart(2, '0') + '</b> / ' + String(n).padStart(2, '0');
  }

  // le même dessin qu'en couverture : la photo du centre au bout d'un couloir
  function drawCfLines() {
    var W = cf.clientWidth;
    var pw = items[0].offsetWidth;
    var ph = items[0].offsetHeight;
    var x1 = W / 2 - pw / 2 - 16, x2 = W / 2 + pw / 2 + 16;
    var y1 = -16, y2 = ph + 16;
    var top = -ph * 0.25, bottom = ph * 1.25;
    var d = 'M' + x1 + ' ' + y1 + 'H' + x2 + 'V' + y2 + 'H' + x1 + 'Z' +
      'M0 ' + top + 'L' + x1 + ' ' + y1 + 'M' + W + ' ' + top + 'L' + x2 + ' ' + y1 +
      'M' + W + ' ' + bottom + 'L' + x2 + ' ' + y2 + 'M0 ' + bottom + 'L' + x1 + ' ' + y2 +
      'M0 ' + ph / 2 + 'H' + x1 + 'M' + x2 + ' ' + ph / 2 + 'H' + W;
    cfLines.style.top = top + 'px';
    cfLines.style.height = (bottom - top) + 'px';
    cfLines.setAttribute('viewBox', '0 ' + top + ' ' + W + ' ' + (bottom - top));
    cfLines.innerHTML = '<path d="' + d + '"/>';
  }

  items.forEach(function (item, k) {
    item.addEventListener('click', function () { go(k); });
  });
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

  // ---------- Contact ----------

  var mailBox = document.querySelector('.mail-box');
  var mail = mailBox.querySelector('.mail');
  var mailLines = mailBox.querySelector('.mail-lines');

  function drawMail() {
    var b = mailBox.getBoundingClientRect();
    var m = mail.getBoundingClientRect();
    var W = b.width, H = b.height;
    var x1 = m.left - b.left, y1 = m.top - b.top, x2 = x1 + m.width, y2 = y1 + m.height;
    var d = 'M' + x1 + ' ' + y1 + 'H' + x2 + 'V' + y2 + 'H' + x1 + 'Z' +
      'M0 0L' + x1 + ' ' + y1 + 'M' + W + ' 0L' + x2 + ' ' + y1 +
      'M' + W + ' ' + H + 'L' + x2 + ' ' + y2 + 'M0 ' + H + 'L' + x1 + ' ' + y2 +
      'M0 ' + H / 2 + 'H' + x1 + 'M' + x2 + ' ' + H / 2 + 'H' + W;
    mailLines.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    mailLines.innerHTML = '<path d="' + d + '"/>';
  }

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

  // ---------- Boucle d'animation ----------
  // Elle ne tourne que pendant un mouvement (souris, défilement), puis s'arrête.

  var running = false;
  var until = 0;

  function kick() {
    until = performance.now() + 1000;
    if (!running) {
      running = true;
      requestAnimationFrame(frame);
    }
  }

  function frame(now) {
    var a = reduce ? 1 : 0.1;
    soft.nx += (mouse.nx - soft.nx) * a;
    soft.ny += (mouse.ny - soft.ny) * a;
    soft.x += (mouse.x - soft.x) * (reduce ? 1 : 0.25);
    soft.y += (mouse.y - soft.y) * (reduce ? 1 : 0.25);
    dot.style.transform = 'translate(' + soft.x.toFixed(1) + 'px,' + soft.y.toFixed(1) + 'px)';

    var y = window.scrollY;
    if (y < geo.heroBottom) drawHero(y);
    stretchGiants(y);
    updateJourney(y);

    var settled = Math.abs(mouse.nx - soft.nx) < 0.0005 && Math.abs(mouse.ny - soft.ny) < 0.0005 &&
                  Math.abs(mouse.x - soft.x) < 0.5 && Math.abs(mouse.y - soft.y) < 0.5;
    if (now < until || !settled) requestAnimationFrame(frame);
    else running = false;
  }

  function layout() {
    measureHero();
    fitGiants();
    measureJourney();
    drawCfLines();
    drawMail();

    geo.W = stage.clientWidth;
    geo.H = stage.clientHeight;
    geo.heroTop = docTop(hero);
    geo.heroTotal = Math.max(1, hero.offsetHeight - stage.offsetHeight);
    geo.heroBottom = geo.heroTop + hero.offsetHeight;
    geo.pinTop = docTop(pin);
    geo.pinTotal = Math.max(1, pin.offsetHeight - window.innerHeight);
    geo.giantTops = giants.map(docTop);
    svg.setAttribute('viewBox', '0 0 ' + geo.W + ' ' + geo.H);
    lastHero = '';
    lastJourney = -1;
    kick();
  }

  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('resize', layout);
  if (document.fonts) document.fonts.ready.then(layout);
  window.addEventListener('load', layout);

  go(0);
  layout();
})();
