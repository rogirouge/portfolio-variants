(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }

  // ---------- Entrée : la photo se pose, le nom monte ----------

  function loaded() { root.classList.add('loaded'); }
  var heroImg = document.querySelector('.hero-photo img');
  if (heroImg.complete) setTimeout(loaded, 60);
  else { heroImg.addEventListener('load', loaded); setTimeout(loaded, 1500); }

  // ---------- L'heure à Hanoï ----------

  var clock = document.querySelector('[data-clock]');
  var fmt = new Intl.DateTimeFormat('fr-FR', { timeZone: clock.dataset.clock, hour: '2-digit', minute: '2-digit', hour12: false });
  function tickClock() { clock.textContent = fmt.format(new Date()); }
  tickClock();
  setInterval(tickClock, 15000);

  // ---------- Menu ----------

  var menuButton = document.querySelector('.menu-button');
  var menu = document.getElementById('menu');
  menu.inert = true;

  function setMenu(open) {
    document.body.classList.toggle('menu-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.textContent = open ? 'Fermer' : 'Menu';
    menu.inert = !open;
    if (!open) hideFloat();
    if (open) menu.querySelector('a').focus({ preventScroll: true });
  }
  menuButton.addEventListener('click', function () { setMenu(!document.body.classList.contains('menu-open')); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  // ---------- Les phrases s'allument mot à mot ----------

  var statements = [];
  each('.statement', function (el) {
    // on découpe les nœuds de texte en mots, en gardant l'italique
    (function split(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var w = document.createElement('span');
            w.className = 'w';
            w.textContent = part;
            frag.appendChild(w);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          split(child);
        }
      });
    })(el);
    statements.push({ el: el, words: Array.prototype.slice.call(el.querySelectorAll('.w')), lit: -1 });
  });

  function updateStatements() {
    var vh = window.innerHeight;
    statements.forEach(function (s) {
      var r = s.el.getBoundingClientRect();
      // tous les mots sont allumés quand le bas de la phrase atteint le milieu de l'écran
      var p = reduce ? 1 : clamp((vh * 0.88 - r.top) / (r.height + vh * 0.3), 0, 1);
      var lit = Math.round(p * s.words.length);
      if (lit === s.lit) return;
      s.lit = lit;
      s.words.forEach(function (w, i) { w.classList.toggle('on', i < lit); });
    });
  }

  // ---------- Apparition des blocs ----------

  var rv = document.querySelectorAll('.kicker, .cols, .stop, .skills > div, .pipeline, .contact-big, .mail, .contact-links');
  Array.prototype.forEach.call(rv, function (el) { el.classList.add('rv'); });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    Array.prototype.forEach.call(rv, function (el) { io.observe(el); });
  } else {
    Array.prototype.forEach.call(rv, function (el) { el.classList.add('in'); });
  }

  // ---------- Photo qui suit le curseur (parcours et menu) ----------

  var float = document.querySelector('.float');
  var floatImg = float.querySelector('img');
  var mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  var fpos = { x: mouse.x, y: mouse.y, r: 0 };
  var cur = { x: mouse.x, y: mouse.y };
  var cursor = document.querySelector('.cursor');

  function showFloat(src) {
    if (!finePointer) return;
    if (floatImg.getAttribute('src') !== src) floatImg.setAttribute('src', src);
    float.classList.add('on');
  }
  function hideFloat() { float.classList.remove('on'); }

  each('.stop[data-img], .menu a[data-img]', function (el) {
    el.addEventListener('mouseenter', function () { showFloat(el.dataset.img); });
    el.addEventListener('mouseleave', hideFloat);
  });

  window.addEventListener('mousemove', function (e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    cursor.classList.add('on');
  });
  document.addEventListener('mouseleave', function () { cursor.classList.remove('on'); });
  document.addEventListener('mouseover', function (e) {
    cursor.classList.toggle('big', !!e.target.closest('a, button, .stop'));
  });

  // ---------- Galerie : défilement de côté ----------

  var gallery = document.querySelector('.gallery');
  var track = document.querySelector('.gallery-track');
  var bar = document.querySelector('.gallery-progress span');
  var pinned = !reduce;
  var travel = 0;

  function layoutGallery() {
    if (!pinned) return;
    root.classList.add('pin');
    track.style.transform = '';
    travel = Math.max(0, track.scrollWidth - document.documentElement.clientWidth);
    gallery.style.height = (window.innerHeight + travel) + 'px';
  }

  function updateGallery() {
    if (!pinned) return;
    var r = gallery.getBoundingClientRect();
    var p = travel ? clamp(-r.top / travel, 0, 1) : 0;
    track.style.transform = 'translate3d(' + (-p * travel).toFixed(1) + 'px,0,0)';
    bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
  }

  // ---------- Parallaxe de l'accueil ----------

  var hero = document.querySelector('.hero');
  var heroName = document.querySelector('.hero-name');

  function updateHero() {
    if (reduce) return;
    var y = window.scrollY;
    var h = hero.offsetHeight;
    if (y > h) return;
    heroImg.parentElement.style.transform = 'translate3d(0,' + (y * 0.35).toFixed(1) + 'px,0)';
    heroName.style.transform = 'translate3d(0,' + (y * -0.12).toFixed(1) + 'px,0)';
    heroName.style.opacity = String(clamp(1 - y / (h * 0.85), 0, 1).toFixed(3));
  }

  // ---------- Boucle d'animation ----------

  var scrolled = true;
  window.addEventListener('scroll', function () { scrolled = true; }, { passive: true });

  function frame() {
    if (scrolled) {
      scrolled = false;
      updateStatements();
      updateGallery();
      updateHero();
    }
    if (finePointer) {
      var k = reduce ? 1 : 0.14;
      var dx = mouse.x - fpos.x;
      fpos.x += dx * k;
      fpos.y += (mouse.y - fpos.y) * k;
      // la photo penche un peu dans le sens du mouvement
      fpos.r = lerp(fpos.r, clamp(dx * 0.06, -10, 10), 0.12);
      float.style.transform = 'translate3d(' + (fpos.x + 28).toFixed(1) + 'px,' + (fpos.y - 120).toFixed(1) + 'px,0) rotate(' + fpos.r.toFixed(2) + 'deg)';
      cur.x = lerp(cur.x, mouse.x, reduce ? 1 : 0.35);
      cur.y = lerp(cur.y, mouse.y, reduce ? 1 : 0.35);
      cursor.style.transform = 'translate3d(' + cur.x.toFixed(1) + 'px,' + cur.y.toFixed(1) + 'px,0)';
    }
    requestAnimationFrame(frame);
  }

  function layout() {
    layoutGallery();
    scrolled = true;
  }
  window.addEventListener('resize', layout);
  window.addEventListener('load', layout);
  if (document.fonts) document.fonts.ready.then(layout);
  layout();
  requestAnimationFrame(frame);

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
