// Página "Minha conta": somente leitura. Usa o Firebase Authentication e o perfil usuarios/{uid}
// já existentes (js/firebase.js). Não grava nada: cadastro e assinatura são alterados pelo aplicativo.
import {firebaseReady, idToPlanName, authMessage, lerPerfilWeb} from './firebase.js';

const byId = id => document.getElementById(id);
const status = byId('profile-status'), card = byId('profile-card'), plan = byId('profile-plan');
const STATUS_LABELS = {ativa: 'ativa', cancelada: 'cancelada', pendente: 'com pagamento pendente', expirada: 'expirada', suspensa: 'suspensa'};

function renderPlan(perfil, failed = false) {
  plan.classList.remove('is-active', 'is-inactive', 'is-error');
  if (failed) {
    plan.classList.add('is-error');
    plan.textContent = 'Não foi possível consultar o plano da sua conta agora. Tente novamente em instantes.';
    return;
  }
  const situacao = typeof perfil?.status_assinatura === 'string' ? perfil.status_assinatura.trim().toLowerCase() : '';
  const nomePlano = idToPlanName[perfil?.plano];
  const ciclo = perfil?.ciclo_assinatura === 'anual' ? 'Anual' : perfil?.ciclo_assinatura === 'mensal' ? 'Mensal' : '';
  if (!situacao && !nomePlano) {
    plan.classList.add('is-inactive');
    plan.textContent = 'Nenhum plano contratado nesta conta.';
    return;
  }
  const nome = nomePlano ? `HomeWise ${nomePlano}${ciclo ? ` (${ciclo})` : ''}` : 'Assinatura HomeWise';
  if (situacao === 'ativa' && nomePlano) {
    plan.classList.add('is-active');
    plan.textContent = `Plano atual ativo: ${nome}.`;
  } else {
    plan.classList.add('is-inactive');
    plan.textContent = situacao
      ? `${nome}: ${STATUS_LABELS[situacao] || `situação "${situacao}" (não confirmada como ativa)`}.`
      : `${nome}: situação não informada.`;
  }
}

try {
  const {auth, sdk} = await firebaseReady;
  let session = 0, signingOut = false;
  sdk.onAuthStateChanged(auth, async user => {
    const mine = ++session;
    card.hidden = !user;
    if (!user) { location.replace(signingOut ? 'index.html' : 'login.html?destino=perfil'); return; }
    status.textContent = '';
    const firstName = (user.displayName || '').trim().split(/\s+/)[0];
    byId('profile-greeting').textContent = firstName ? firstName + '.' : 'bem-vindo.';
    byId('profile-name').textContent = user.displayName || '—';
    byId('profile-email').textContent = user.email || '—';
    let perfil = null;
    try {
      perfil = await lerPerfilWeb(user.uid);
    } catch (error) {
      console.error('[HomeWise] falha ao consultar o perfil:', error);
      if (mine === session) renderPlan(null, true);
      return;
    }
    if (mine !== session) return; // a conta mudou durante a leitura
    if (!user.displayName && typeof perfil?.nome === 'string' && perfil.nome.trim()) {
      byId('profile-name').textContent = perfil.nome.trim();
      byId('profile-greeting').textContent = perfil.nome.trim().split(/\s+/)[0] + '.';
    }
    renderPlan(perfil);
  });

  byId('profile-sign-out').onclick = async event => {
    event.currentTarget.disabled = true;
    signingOut = true;
    try {
      await sdk.signOut(auth); // onAuthStateChanged leva para a página inicial
    } catch (error) {
      signingOut = false;
      status.textContent = authMessage(error);
      byId('profile-sign-out').disabled = false;
    }
  };
} catch (error) {
  console.error('[HomeWise] falha ao iniciar a autenticação:', error);
  status.textContent = 'Não foi possível verificar sua conta. Verifique sua conexão e recarregue a página.';
}
