// HomeWise — decisões de apresentação tomadas antes da primeira pintura (carregado no <head>).
// Tema salvo, modo de animação (automático: segue o "movimento reduzido" do sistema) e abertura.
(function () {
  var root = document.documentElement;
  root.classList.add('hw-js');
  try { if (localStorage.getItem('homewise-theme') === 'light') root.dataset.theme = 'light'; } catch (e) {}

  // As animações fazem parte da experiência padrão. Só são reduzidas quando o dispositivo pede.
  var systemReduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  root.dataset.motion = systemReduced ? 'reduced' : 'full';
  try { localStorage.removeItem('homewise-motion'); sessionStorage.removeItem('homewise-opening'); } catch (e) {} // preferências antigas

  // A abertura (inicial e hotsite) roda em todo carregamento, inclusive F5 / Ctrl+R.
  // Sem âncora no endereço, a recarga começa no topo para a composição inicial aparecer inteira.
  var path = location.pathname;
  var isHotsite = /\/hotsite\//.test(path);
  var isHome = /(^|\/)(index\.html)?$/.test(path) && !isHotsite;
  if (isHome) root.classList.add('hw-show-opening');
  if ((isHome || isHotsite) && (!location.hash || location.hash === '#abertura') && 'scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  // Transições entre páginas (View Transitions): puladas quando o sistema pede movimento reduzido.
  var skip = function (event) { if (root.dataset.motion !== 'full' && event.viewTransition) event.viewTransition.skipTransition(); };
  window.addEventListener('pageswap', skip);
  window.addEventListener('pagereveal', skip);
})();
