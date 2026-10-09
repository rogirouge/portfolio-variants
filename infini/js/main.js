(function () {
  'use strict';

  var root = document.documentElement;
  var corridor = root.classList.contains('corridor');

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  var rooms = Array.prototype.slice.call(document.querySelectorAll('.room'));
  var N = rooms.length;
  var bar = document.querySelector('.bar');
  var where = document.querySelector('.bar-where');

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
  go(0);

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

  // Sans le couloir (animations réduites), la page reste une suite de sections : rien d'autre à faire.
  if (!corridor) return;

  // ---------- Le couloir ----------
  // z = combien de salles on a traversées (scrollY / hauteur d'écran).
  // La salle k est agrandie de Z^(z-k) depuis le centre : à z = k elle remplit l'écran,
  // à z = k-1 elle tient exactement dans la fenêtre de la salle d'avant.

  var Z = 3.4;     // l'écran est Z fois plus grand que la fenêtre
  var H = 1;       // hauteur d'écran = longueur de défilement d'une salle
  var W = 0;
  var z = 0;
  var here = -1;
  var intro = 0;   // décalage de z pendant l'entrée, au chargement

  var track = document.querySelector('.track');
  var snaps = [];
  for (var i = 0; i <= N; i++) snaps.push(track.appendChild(document.createElement('div')));

  rooms.forEach(function (r) { r.tabIndex = -1; });

  // ----- Les lignes de fuite, dessinées dans un carré 100 × 100 étiré sur l'écran -----

  function f(v) { return +v.toFixed(3); }

  function linesPath() {
    var a = 50 - 50 / Z;
    var b = 50 + 50 / Z;
    var d = 'M0 0L' + f(a) + ' ' + f(a) + 'M100 0L' + f(b) + ' ' + f(a) +
            'M100 100L' + f(b) + ' ' + f(b) + 'M0 100L' + f(a) + ' ' + f(b);
    // plafond, sol et murs rayés de lignes qui filent vers la fenêtre
    [0.25, 0.5, 0.75].forEach(function (t) {
      var x = 100 * t;
      var w = a + (b - a) * t;
      d += 'M' + x + ' 0L' + f(w) + ' ' + f(a) + 'M' + x + ' 100L' + f(w) + ' ' + f(b) +
           'M0 ' + x + 'L' + f(a) + ' ' + f(w) + 'M100 ' + x + 'L' + f(b) + ' ' + f(w);
    });
    // des cadres à mi-profondeur : en avançant, ils glissent vers les bords comme des portes qu'on passe
    [0.34, 0.67].forEach(function (t) {
      var s = Math.pow(Z, -t);
      var p = f(50 - 50 * s);
      var q = f(50 + 50 * s);
      d += 'M' + p + ' ' + p + 'H' + q + 'V' + q + 'H' + p + 'Z';
    });
    return d;
  }

  var svgNS = 'http://www.w3.org/2000/svg';
  var paths = [];
  var windows = [];
  rooms.forEach(function (r) {
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'lines');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(svgNS, 'path');
    var win = document.createElementNS(svgNS, 'rect');
    win.setAttribute('class', 'window');
    [p, win].forEach(function (el) {
      el.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(el);
    });
    r.insertBefore(svg, r.firstChild);
    paths.push(p);
    windows.push(win);
  });

  function drawLines() {
    var d = linesPath();
    var a = f(50 - 50 / Z);
    var s = f(100 / Z);
    paths.forEach(function (p) { p.setAttribute('d', d); });
    windows.forEach(function (w) {
      w.setAttribute('x', a);
      w.setAttribute('y', a);
      w.setAttribute('width', s);
      w.setAttribute('height', s);
    });
  }

  // ----- Le texte de chaque bandeau doit tenir entre le bord de l'écran et la fenêtre -----

  function textWidth(el) {
    var range = document.createRange();
    range.selectNodeContents(el);
    return range.getBoundingClientRect().width;
  }

  function fits(band) {
    var bw = band.clientWidth;
    var bh = band.clientHeight;
    var kids = band.children;
    for (var i = 0; i < kids.length; i++) {
      var c = kids[i];
      if (c.offsetTop < 0 || c.offsetTop + c.offsetHeight > bh + 1) return false;
      if (c.offsetLeft < -1 || c.offsetLeft + c.offsetWidth > bw + 1) return false;
      if (c.scrollWidth > c.clientWidth + 1) return false;
    }
    return true;
  }

  function fitBand(band, base) {
    var cs = getComputedStyle(band);
    var innerW = band.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var innerH = band.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    var giants = Array.prototype.slice.call(band.querySelectorAll('.giant'));
    var size = base;
    band.style.fontSize = size + 'px';

    // un grand titre prend toute la hauteur permise, puis on élargit ou resserre ses lettres pour la largeur
    var cap = innerH * (band.classList.contains('side') ? 0.9 : 0.52);
    giants.forEach(function (g) {
      g.style.fontSize = '100px';
      g.style.fontStretch = '62%';
      g.w62 = textWidth(g);
      g.style.fontStretch = '125%';
      g.w125 = textWidth(g);
    });
    function setGiants() {
      giants.forEach(function (g) {
        var px = cap;
        var need = innerW * 100 / px;     // largeur disponible, ramenée à une taille de 100px
        var st;
        if (need >= g.w125) st = 125;
        else if (need <= g.w62) { st = 62; px = 100 * innerW / g.w62 * 0.98; }
        else st = 62 + 63 * (need - g.w62) / (g.w125 - g.w62) * 0.97;
        g.style.fontSize = px.toFixed(1) + 'px';
        g.style.fontStretch = st.toFixed(1) + '%';
      });
    }
    setGiants();

    // trop haut ou trop large : on réduit d'abord le petit texte, puis les grands titres
    for (var i = 0; i < 60 && !fits(band); i++) {
      if (size > 11 || !giants.length) {
        size *= 0.94;
        band.style.fontSize = size.toFixed(2) + 'px';
        if (size < 7) break;
      } else {
        cap *= 0.93;
        setGiants();
      }
    }
  }

  // le carrousel occupe le sol de la salle « Photos »
  function fitCarousel() {
    var band = cf.parentElement;
    var cs = getComputedStyle(band);
    var innerH = band.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    var h = innerH - 44 - 12;                 // moins les boutons
    var pw = clamp((h - 32) * 0.75, 90, 320); // moins la légende
    cf.style.setProperty('--pw', pw.toFixed(1) + 'px');
    cf.style.height = (pw * 4 / 3 + 32).toFixed(1) + 'px';
  }

  // ----- Rendu : quelles salles sont visibles, à quelle échelle -----

  var shown = [];

  function render() {
    var y = window.scrollY;
    // au bout du couloir on retrouve l'accueil : on revient en haut de la page sans que rien ne bouge à l'écran
    if (y >= N * H - 0.5) {
      y -= N * H;
      window.scrollTo({ top: y, behavior: 'instant' });
    }
    z = Math.max(0, y / H) + intro;

    var k0 = Math.floor(z);
    var next = [];
    for (var k = Math.max(0, k0); k <= k0 + 3; k++) {
      var r = rooms[k % N];
      var s = Math.pow(Z, z - k);
      r.style.transform = 'scale(' + s.toFixed(5) + ')';
      r.style.zIndex = String(k - k0 + 1);
      next.push(r);
    }
    shown.forEach(function (r) {
      if (next.indexOf(r) < 0) { r.classList.remove('shown'); r.style.transform = ''; }
    });
    next.forEach(function (r) { r.classList.add('shown'); });
    shown = next;

    var h = Math.round(Math.max(0, z)) % N;
    if (h !== here) {
      if (here >= 0) rooms[here].classList.remove('here');
      here = h;
      rooms[here].classList.add('here');
      where.textContent = rooms[here].dataset.name;
      bar.classList.toggle('on-red', rooms[here].classList.contains('red'));
    }
  }

  // ----- Mouvement : on ne redessine que pendant le défilement -----

  var pending = false;
  var stopTimer = 0;

  function schedule() {
    if (!pending) {
      pending = true;
      requestAnimationFrame(function () { pending = false; render(); });
    }
    // pendant le mouvement, les salles passent sur la carte graphique ; à l'arrêt, le texte est redessiné net
    root.classList.add('moving');
    clearTimeout(stopTimer);
    stopTimer = setTimeout(function () { root.classList.remove('moving'); }, 180);
  }
  window.addEventListener('scroll', schedule, { passive: true });

  // ----- Liens internes : on vole jusqu'à la salle -----

  function roomIndex(hash) {
    if (!hash || hash.length < 2) return -1;
    var target = document.getElementById(decodeURIComponent(hash.slice(1)));
    var room = target && target.closest('.room');
    return room ? rooms.indexOf(room) : -1;
  }

  function goTo(j, smooth) {
    window.scrollTo({ top: j * H, behavior: smooth ? 'smooth' : 'instant' });
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var j = roomIndex(a.getAttribute('href'));
    if (j < 0) return;
    e.preventDefault();
    history.pushState(null, '', a.getAttribute('href'));
    goTo(j, true);
    rooms[j].focus({ preventScroll: true });
  });
  window.addEventListener('popstate', function () {
    var j = roomIndex(location.hash);
    goTo(j < 0 ? 0 : j, true);
  });

  // au clavier, la tabulation fait entrer dans la salle qui contient l'élément
  document.addEventListener('focusin', function (e) {
    var room = e.target.closest && e.target.closest('.room');
    if (!room) return;
    var j = rooms.indexOf(room);
    if (j !== here) goTo(j, true);
  });

  // ----- Mise en page -----

  function layout() {
    var oldH = H;
    var wasZ = H > 1 ? window.scrollY / oldH : -1;
    W = root.clientWidth;
    H = window.innerHeight;
    Z = W <= 700 ? 4.2 : 3.4;
    root.style.setProperty('--m', ((1 - 1 / Z) / 2).toFixed(4));
    snaps.forEach(function (s) { s.style.height = H + 'px'; });
    drawLines();
    fitCarousel();
    var base = clamp(W / 85, 13, 19);
    rooms.forEach(function (r) {
      r.querySelectorAll('.band').forEach(function (b) { fitBand(b, base); });
    });
    if (wasZ >= 0 && oldH !== H) window.scrollTo({ top: wasZ * H, behavior: 'instant' });
    render();
  }

  // sur téléphone, la barre d'adresse qui apparaît ou disparaît change un peu la hauteur : on l'ignore
  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    if (root.clientWidth === W && Math.abs(window.innerHeight - H) < 150) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 120);
  });
  if (document.fonts) document.fonts.ready.then(layout);

  layout();

  // arrivée par un lien vers une section précise
  var start = roomIndex(location.hash);
  if (start > 0) goTo(start, false);

  // ----- Entrée : on s'approche du couloir, l'accueil grandit depuis le fond noir -----

  if (window.scrollY === 0 && start <= 0) {
    var t0 = performance.now();
    intro = -1;
    (function step(now) {
      var t = clamp((now - t0) / 1500, 0, 1);
      intro = -Math.pow(1 - t, 3);
      render();
      if (t < 1) requestAnimationFrame(step);
    })(t0);
  }
})();
