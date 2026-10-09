(function () {
  var body = document.body;
  var toggle = document.querySelector('.menu-toggle');
  var menu = document.getElementById('menu');

  function setMenu(open) {
    body.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'fermer' : 'menu';
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

  // cote du schéma : largeur de la fenêtre et étape courante
  // (mêmes seuils que les media queries de style.css)
  var steps = [560, 720, 880, 1040, 1200, 1360, 1520];
  var vw = document.getElementById('vw');
  var stage = document.getElementById('stage');

  function updateDim() {
    var w = window.innerWidth;
    vw.textContent = w;
    stage.textContent = 1 + steps.filter(function (s) { return w >= s; }).length;
  }
  window.addEventListener('resize', updateDim);
  updateDim();

  document.getElementById('year').textContent = new Date().getFullYear();
})();
