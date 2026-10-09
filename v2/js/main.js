(function () {
  var body = document.body;
  var toggle = document.querySelector('.toggle');
  var menu = document.getElementById('menu');

  function setMenu(open) {
    body.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
  }

  toggle.addEventListener('click', function () {
    setMenu(!body.classList.contains('menu-open'));
  });

  menu.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') setMenu(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setMenu(false);
  });

  // la phrase de la couverture suit la largeur de la fenêtre
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
  window.addEventListener('resize', updateScale);
  updateScale();

  // léger parallaxe sur les photos
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var bgs = document.querySelectorAll('.bg');
  var ticking = false;

  function parallax() {
    bgs.forEach(function (bg) {
      var r = bg.parentNode.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      var progress = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
      bg.style.transform = 'translate3d(0,' + (progress * -100).toFixed(1) + 'px,0)';
    });
    ticking = false;
  }

  if (!reduce) {
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(parallax); }
    }, { passive: true });
    parallax();
  }
})();
