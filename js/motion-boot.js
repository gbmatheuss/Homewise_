// HomeWise — decisões de apresentação tomadas antes da primeira pintura (carregado no <head>).
// Tema salvo, modo de animação ("Seguir sistema" | "Ativadas" | "Reduzidas") e abertura da sessão.
(function () {
  var root = document.documentElement;
  root.classList.add('hw-js');
  try { if (localStorage.getItem('homewise-theme') === 'light') root.dataset.theme = 'light'; } catch (e) {}

  var pref = 'system';
  try {
    var saved = localStorage.getItem('homewise-motion');
    if (saved === 'full' || saved === 'reduced') pref = saved;
  } catch (e) {}
  var systemReduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  root.dataset.motionPref = pref;
  root.dataset.motion = pref === 'system' ? (systemReduced ? 'reduced' : 'full') : pref;

  // Abertura da página inicial: primeira entrada da sessão ou pedido explícito (#abertura).
  var path = location.pathname;
  var isHome = /(^|\/)(index\.html)?$/.test(path) && !/\/hotsite\//.test(path);
  try {
    if (isHome && (location.hash === '#abertura' || !sessionStorage.getItem('homewise-opening'))) root.classList.add('hw-show-opening');
    sessionStorage.setItem('homewise-opening', '1');
  } catch (e) {}

  // Transições entre páginas (View Transitions): puladas quando as animações estão reduzidas.
  var skip = function (event) { if (root.dataset.motion !== 'full' && event.viewTransition) event.viewTransition.skipTransition(); };
  window.addEventListener('pageswap', skip);
  window.addEventListener('pagereveal', skip);
})();
