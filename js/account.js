// Destino do ícone de conta do cabeçalho (criado por js/script.js).
// Usa o mesmo Firebase Authentication de js/firebase.js; não existe outro sistema de login.
// • Sem login (ou se o Firebase não carregar): login.html.
// • Com login: perfil.html.
// O Firebase é carregado quando o navegador fica ocioso, ou antes, se o visitante apontar/focar o ícone,
// para não disputar a rede com as animações de abertura das páginas públicas.
const link = document.querySelector('.account-link');
// ?destino=perfil: depois de entrar, login.html leva ao perfil em vez do checkout.
const LOGIN = 'login.html?destino=perfil', PROFILE = 'perfil.html';
let resolved = false;

function apply(user) {
  resolved = true;
  link.removeAttribute('aria-busy');
  link.classList.toggle('is-signed-in', Boolean(user));
  link.href = user ? PROFILE : LOGIN;
  const label = user ? 'Minha conta' : 'Entrar na sua conta';
  link.setAttribute('aria-label', label);
  link.title = user && user.email ? `${label} (${user.email})` : label;
}

let started;
function start() {
  started ??= import('./firebase.js')
    .then(({firebaseReady}) => firebaseReady)
    .then(({auth, sdk}) => {
      // authStateReady() já foi aguardado em firebase.js: o primeiro valor não é provisório.
      apply(auth.currentUser);
      sdk.onAuthStateChanged(auth, apply);
    })
    .catch(error => {
      console.error('[HomeWise] não foi possível verificar a conta:', error);
      apply(null);
    });
  return started;
}

if (link) {
  ['pointerenter', 'focus', 'touchstart'].forEach(type => link.addEventListener(type, start, {once: true, passive: true}));
  const idle = window.requestIdleCallback || (cb => setTimeout(cb, 1200));
  if (document.readyState === 'complete') idle(start, {timeout: 3000});
  else window.addEventListener('load', () => idle(start, {timeout: 3000}), {once: true});

  // Clique antes da verificação terminar: espera o estado real (no máximo 8 s) para não levar
  // quem já está logado à tela de login. Cliques com Ctrl/Cmd/Shift/botão do meio seguem o padrão.
  link.addEventListener('click', async event => {
    if (resolved || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    link.setAttribute('aria-busy', 'true');
    await Promise.race([start(), new Promise(r => setTimeout(r, 8000))]);
    location.href = resolved ? link.href : LOGIN;
  });
}
