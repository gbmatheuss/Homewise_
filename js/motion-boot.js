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
  // Só na RECARGA sem âncora a página começa no topo; Voltar/Avançar mantêm a posição do histórico.
  var path = location.pathname;
  var isHotsite = /\/hotsite\//.test(path);
  var isHome = /(^|\/)(index\.html)?$/.test(path) && !isHotsite;
  if (isHome) root.classList.add('hw-show-opening');
  var navType = '';
  try { navType = performance.getEntriesByType('navigation')[0].type; } catch (e) {}
  if ('scrollRestoration' in history) {
    history.scrollRestoration = (isHome || isHotsite) && navType === 'reload' && (!location.hash || location.hash === '#abertura') ? 'manual' : 'auto';
    // Ao sair, devolve a restauração ao navegador para que Voltar/Avançar recuperem a posição.
    window.addEventListener('pagehide', function () { history.scrollRestoration = 'auto'; });
  }

  // Recuperação: se js/motion.js não iniciar (bloqueado, erro de rede ou de script), a página volta
  // à apresentação estática, sem abertura e com todo o conteúdo visível. motion.js é um script
  // clássico no fim do <body>, então já rodou quando DOMContentLoaded dispara.
  document.addEventListener('DOMContentLoaded', function () {
    if (root.classList.contains('hw-motion-on')) return;
    root.dataset.motion = 'static';
    root.classList.remove('hw-show-opening');
  });

  // Transições entre páginas (View Transitions): puladas quando o sistema pede movimento reduzido.
  var skip = function (event) { if (root.dataset.motion !== 'full' && event.viewTransition) event.viewTransition.skipTransition(); };
  window.addEventListener('pageswap', skip);
  window.addEventListener('pagereveal', skip);
})();
