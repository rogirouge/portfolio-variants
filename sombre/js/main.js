(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover)').matches;
  var mouse = { x: 0, y: 0, nx: 0, ny: 0 };

  // ---------- Point qui suit la souris ----------

  var dot = document.querySelector('.dot');
  var dotPos = { x: -100, y: -100 };

  window.addEventListener('mousemove', function (e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.nx = e.clientX / window.innerWidth - 0.5;
    mouse.ny = e.clientY / window.innerHeight - 0.5;
    dot.classList.add('on');
  });
  document.addEventListener('mouseleave', function () { dot.classList.remove('on'); });
  document.addEventListener('mouseover', function (e) {
    dot.classList.toggle('big', !!e.target.closest('a, button, .card, .cf-item'));
  });

  // ---------- Couverture : lignes de perspective ----------

  var cover = document.querySelector('.cover');
  var svg = document.querySelector('.lines');
  var card = document.querySelector('.card');
  var tilt = { x: 0, y: 0 };

  function line(x1, y1, x2, y2) { return 'M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + 'L' + x2.toFixed(1) + ' ' + y2.toFixed(1); }

  function drawLines() {
    var w = cover.clientWidth;
    var h = cover.clientHeight;
    var cx = w / 2 + tilt.x * 40;
    var cy = h / 2 + tilt.y * 30;
    var s = card.offsetHeight * 0.72;   // côté du carré autour de la photo
    var a = s / 2;
    var b = s * 0.3;                    // profondeur du cube
    var d = [];

    d.push(line(0, cy, w, cy), line(cx, 0, cx, h));
    // carré de face et carré du fond
    d.push('M' + (cx - a) + ' ' + (cy - a) + 'h' + s + 'v' + s + 'h' + -s + 'Z');
    d.push('M' + (cx - a + b) + ' ' + (cy - a - b) + 'h' + s + 'v' + s + 'h' + -s + 'Z');
    d.push(line(cx - a, cy - a, cx - a + b, cy - a - b), line(cx + a, cy - a, cx + a + b, cy - a - b),
           line(cx + a, cy + a, cx + a + b, cy + a - b), line(cx - a, cy + a, cx - a + b, cy + a - b));
    // fuyantes vers les coins de l'écran
    d.push(line(cx - a, cy - a, 0, 0), line(cx + a, cy - a, w, 0), line(cx + a, cy + a, w, h), line(cx - a, cy + a, 0, h));
    // grand losange
    var lx = Math.min(s * 2.1, w * 0.46);
    var ly = s * 1.25;
    d.push('M' + cx + ' ' + (cy - ly) + 'L' + (cx + lx) + ' ' + cy + 'L' + cx + ' ' + (cy + ly) + 'L' + (cx - lx) + ' ' + cy + 'Z');

    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.innerHTML = '<path d="' + d.join('') + '"/>';
    card.style.transform = 'translate(' + (tilt.x * 40).toFixed(1) + 'px,' + (tilt.y * 30).toFixed(1) + 'px)';
  }

  // la photo du centre change au survol ou au toucher
  var cardImgs = card.querySelectorAll('img');
  var cardIndex = 0;
  cardImgs[0].classList.add('on');
  function nextCard() {
    cardImgs[cardIndex].classList.remove('on');
    cardIndex = (cardIndex + 1) % cardImgs.length;
    cardImgs[cardIndex].classList.add('on');
  }
  card.addEventListener(finePointer ? 'mouseenter' : 'click', nextCard);

  // ---------- Ruban : mots et photos suivent le défilement ----------

  var ribbon = document.querySelector('.ribbon');
  var track = document.querySelector('.track');
  var words = track.querySelectorAll('a');
  var morphImgs = document.querySelectorAll('.morph img');
  var liquid = document.getElementById('liquid-map');
  var centers = [];

  function measureWords() {
    centers = Array.prototype.map.call(words, function (a) { return a.offsetLeft + a.offsetWidth / 2; });
  }

  function updateRibbon() {
    var r = ribbon.getBoundingClientRect();
    var total = ribbon.offsetHeight - window.innerHeight;
    var p = Math.min(1, Math.max(0, -r.top / total));
    var f = p * (words.length - 1);
    var i = Math.min(words.length - 2, Math.floor(f));
    var t = f - i;
    // on reste un peu sur chaque mot avant de passer au suivant
    var e = t < 0.35 ? 0 : t > 0.65 ? 1 : (t - 0.35) / 0.3;
    e = e * e * (3 - 2 * e);
    var c = centers[i] + (centers[i + 1] - centers[i]) * e;
    track.style.transform = 'translateX(' + (window.innerWidth / 2 - c).toFixed(1) + 'px)';

    var active = e < 0.5 ? i : i + 1;
    words.forEach(function (a, k) { a.classList.toggle('on', k === active); });
    morphImgs.forEach(function (img, k) {
      img.style.opacity = k === i ? String(1 - e) : k === i + 1 ? String(e) : '0';
    });
    if (!reduce) liquid.setAttribute('scale', (Math.sin(e * Math.PI) * 90).toFixed(1));
  }

  // ---------- Carrousel de photos en éventail ----------

  var cf = document.querySelector('.cf');
  var items = cf.querySelectorAll('.cf-item');
  var dots = document.querySelector('.cf-dots');
  var current = 0;

  items.forEach(function (item, k) {
    var b = document.createElement('button');
    b.setAttribute('aria-label', 'Photo ' + (k + 1));
    b.addEventListener('click', function () { go(k); });
    dots.appendChild(b);
    item.addEventListener('click', function () { go(k); });
  });

  function go(k) {
    current = (k + items.length) % items.length;
    items.forEach(function (item, j) {
      // distance la plus courte, pour que le carrousel tourne en boucle
      var n = items.length;
      var d = ((j - current) % n + n + Math.floor(n / 2)) % n - Math.floor(n / 2);
      var ad = Math.abs(d);
      var rot = Math.max(-45, Math.min(45, -d * 32));
      item.style.transform = 'translateX(' + (d * 58) + '%) translateZ(' + (-ad * 160) + 'px) rotateY(' + rot + 'deg)';
      item.style.opacity = ad > 3 ? '0' : String(1 - ad * 0.18);
      item.style.zIndex = String(100 - ad);
      item.style.filter = ad ? 'brightness(' + (1 - ad * 0.22) + ')' : 'none';
      item.style.pointerEvents = ad > 3 ? 'none' : 'auto';
      item.classList.toggle('on', d === 0);
      dots.children[j].classList.toggle('on', d === 0);
    });
  }

  document.querySelector('.cf-prev').addEventListener('click', function () { go(current - 1); });
  document.querySelector('.cf-next').addEventListener('click', function () { go(current + 1); });
  cf.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') go(current - 1);
    if (e.key === 'ArrowRight') go(current + 1);
  });

  // glisser du doigt ou à la souris
  var startX = null;
  cf.addEventListener('pointerdown', function (e) { startX = e.clientX; });
  window.addEventListener('pointerup', function (e) {
    if (startX === null) return;
    var dx = e.clientX - startX;
    if (Math.abs(dx) > 40) go(current + (dx < 0 ? 1 : -1));
    startX = null;
  });

  go(0);

  // ---------- Phrase de la couverture : suit la largeur de la fenêtre ----------

  var steps = [
    [0, '1 serveur. Ça suffit tant que personne ne vient.'],
    [560, 'un serveur web et une base de données à part.'],
    [720, '2 serveurs derrière un répartiteur de charge.'],
    [880, '3 serveurs.'],
    [1040, '4 serveurs et une réplique de la base.'],
    [1200, '4 serveurs, une réplique et un CDN.'],
    [1360, '4 serveurs, un CDN et de la supervision.'],
    [1520, '6 serveurs, en auto-scaling.']
  ];
  var vw = document.getElementById('vw');
  var scaleText = document.getElementById('scale-text');

  function updateScale() {
    var w = window.innerWidth;
    var text = steps[0][1];
    steps.forEach(function (s) { if (w >= s[0]) text = s[1]; });
    vw.textContent = w.toLocaleString('fr-FR');
    scaleText.textContent = text;
  }

  // ---------- Boucle d'animation ----------

  function frame() {
    var k = reduce ? 1 : 0.12;
    dotPos.x += (mouse.x - dotPos.x) * (reduce ? 1 : 0.25);
    dotPos.y += (mouse.y - dotPos.y) * (reduce ? 1 : 0.25);
    dot.style.transform = 'translate(' + dotPos.x.toFixed(1) + 'px,' + dotPos.y.toFixed(1) + 'px)';

    var tx = tilt.x + (mouse.nx - tilt.x) * k;
    var ty = tilt.y + (mouse.ny - tilt.y) * k;
    if (Math.abs(tx - tilt.x) > 0.0005 || Math.abs(ty - tilt.y) > 0.0005) {
      tilt.x = tx;
      tilt.y = ty;
      drawLines();
    }
    requestAnimationFrame(frame);
  }

  function onResize() {
    measureWords();
    drawLines();
    updateRibbon();
    updateScale();
  }

  window.addEventListener('resize', onResize);
  window.addEventListener('scroll', updateRibbon, { passive: true });
  document.fonts && document.fonts.ready.then(onResize);
  onResize();
  requestAnimationFrame(frame);
})();
