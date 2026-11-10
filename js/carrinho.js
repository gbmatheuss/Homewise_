// Checkout DEMONSTRATIVO do HomeWise (TCC).
// • Não grava assinatura, plano nem dados no Firestore: o documento usuarios/{uid} é compartilhado
//   com o aplicativo, e conceder ou cancelar uma assinatura exige confirmação de pagamento em um
//   backend confiável (ex.: Cloud Function + gateway), que este projeto não possui.
// • O perfil é lido SOMENTE para exibir a situação da assinatura; nenhum dado pessoal dele é exibido.
// • Dados pessoais e endereço são exemplos fictícios fixos (carrinho.html); não há consultas externas
//   (ViaCEP removido). O cartão de teste é validado apenas no navegador e apagado ao concluir.
import {
  firebaseReady,
  selectedPlan,
  selectedCycle,
  plans,
  idToPlanName,
  formatPlanPrice,
  buildPlanQuery,
  authMessage,
  lerPerfilWeb
} from './firebase.js';

const byId = id => document.getElementById(id);
const purchaseForm = byId('purchase-form');
const planSelect = byId('cart-plan-select');
const cycleSelect = byId('cart-cycle-select');
const statusEl = byId('cart-status');
const subBanner = byId('active-sub-banner');
const submitBtn = byId('submit-purchase');

const planBenefitsMap = {
  'Básico': [
    'Monitoramento em tempo real (1 central)',
    'Alertas inteligentes de vazamento e pico',
    'Relatórios básicos (diário e semanal)',
    '1 residência vinculada'
  ],
  Plus: [
    'Tudo do plano Básico',
    'Relatórios completos (mensal e anual)',
    'Metas mensais de economia',
    'Comparativo e linha de base de consumo',
    'Até 3 residências vinculadas'
  ],
  Premium: [
    'Tudo do plano Plus',
    'Múltiplas centrais e sensores por residência',
    'Automação e diagnóstico avançado de rede',
    'Suporte técnico prioritário',
    'Residências ilimitadas'
  ]
};

let currentPlan = selectedPlan;
let currentCycle = selectedCycle;
let paymentMethod = 'pix';
let authenticatedUser = null;
let busy = false;

function setStatus(text, error = false) {
  statusEl.textContent = text;
  statusEl.dataset.error = String(error);
}

planSelect.value = currentPlan;
cycleSelect.value = currentCycle;

function updateSummaryUI() {
  byId('selected-plan').textContent = `Plano HomeWise ${currentPlan}`;
  byId('plan-price').textContent = formatPlanPrice(currentPlan, currentCycle);
  const benefitsList = byId('plan-benefits');
  benefitsList.innerHTML = '';
  for (const item of planBenefitsMap[currentPlan] || []) {
    const li = document.createElement('li');
    li.textContent = item;
    benefitsList.append(li);
  }
  history.replaceState(null, '', location.pathname + buildPlanQuery(currentPlan, currentCycle));
}
updateSummaryUI();

planSelect.addEventListener('change', () => {
  if (busy || !Object.hasOwn(plans, planSelect.value)) return;
  currentPlan = planSelect.value;
  updateSummaryUI();
});
cycleSelect.addEventListener('change', () => {
  if (busy) return;
  currentCycle = cycleSelect.value === 'anual' ? 'anual' : 'mensal';
  updateSummaryUI();
});

/* ------------------------------------------------------------------ */
/* Situação da assinatura (somente leitura, sem dados pessoais)        */
/* ------------------------------------------------------------------ */
// Estados conhecidos no código do projeto. Só "ativa" é exibida como ativa;
// qualquer outro valor (inclusive desconhecido) é mostrado como não ativo, sem suposições.
const STATUS_LABELS = {
  ativa: 'ativa',
  cancelada: 'cancelada',
  pendente: 'com pagamento pendente',
  expirada: 'expirada',
  suspensa: 'suspensa'
};
function renderSubscription(perfil, failed = false) {
  subBanner.classList.remove('is-active', 'is-inactive', 'is-error');
  if (failed) {
    subBanner.hidden = false;
    subBanner.classList.add('is-error');
    subBanner.textContent = 'Não foi possível consultar a assinatura da sua conta agora. Isso não afeta a simulação.';
    return;
  }
  const status = typeof perfil?.status_assinatura === 'string' ? perfil.status_assinatura.trim().toLowerCase() : '';
  const nomePlano = idToPlanName[perfil?.plano];
  if (!status && !nomePlano) { subBanner.hidden = true; return; }
  const ciclo = perfil?.ciclo_assinatura === 'anual' ? 'Anual' : perfil?.ciclo_assinatura === 'mensal' ? 'Mensal' : '';
  const plano = nomePlano ? `HomeWise ${nomePlano}${ciclo ? ` (${ciclo})` : ''}` : 'Assinatura HomeWise';
  subBanner.hidden = false;
  if (status === 'ativa' && nomePlano) {
    subBanner.classList.add('is-active');
    subBanner.textContent = `Assinatura atual ativa: ${plano}.`;
  } else {
    subBanner.classList.add('is-inactive');
    subBanner.textContent = status
      ? `${plano}: ${STATUS_LABELS[status] || `situação "${status}" (não confirmada como ativa)`}.`
      : `${plano}: situação não informada.`;
  }
}

/* ------------------------------------------------------------------ */
/* Conta (Firebase Authentication)                                     */
/* ------------------------------------------------------------------ */
try {
  const {auth, sdk} = await firebaseReady;
  let session = 0;
  sdk.onAuthStateChanged(auth, async user => {
    const mine = ++session;
    authenticatedUser = user;
    byId('protected-cart').hidden = !user;
    byId('account-bar').hidden = !user;
    if (!user) {
      location.replace('login.html' + buildPlanQuery(currentPlan, currentCycle));
      return;
    }
    byId('account-status').textContent = '';
    byId('account-email').textContent = 'Conectado como ' + user.email;
    // Leitura separada do formulário: apenas plano/ciclo/status são usados.
    let perfil = null;
    try {
      perfil = await lerPerfilWeb(user.uid);
    } catch (error) {
      console.error('[HomeWise] falha ao consultar a assinatura:', error);
      if (mine === session) renderSubscription(null, true);
      return;
    }
    if (mine !== session) return; // a conta mudou enquanto a leitura acontecia
    renderSubscription(perfil && {plano: perfil.plano, ciclo_assinatura: perfil.ciclo_assinatura, status_assinatura: perfil.status_assinatura});
  });

  byId('sign-out').onclick = async event => {
    event.target.disabled = true;
    try {
      await sdk.signOut(auth);
    } catch (error) {
      byId('account-status').textContent = authMessage(error);
      event.target.disabled = false;
    }
  };
} catch (error) {
  console.error('[HomeWise] falha ao iniciar a autenticação:', error);
  byId('account-status').textContent = 'Não foi possível verificar sua conta. Verifique sua conexão e recarregue a página.';
}

/* ------------------------------------------------------------------ */
/* Cartão de teste: máscaras e validação (somente no navegador)        */
/* ------------------------------------------------------------------ */
const cardFields = ['card-name', 'card-number', 'card-expiry', 'card-cvv'].map(byId);
const maskField = (el, format) => el.addEventListener('input', () => { el.value = format(el.value.replace(/\D/g, '')); });
maskField(byId('card-number'), d => d.slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 '));
maskField(byId('card-expiry'), d => d.slice(0, 4).replace(/^(\d{2})(\d)/, '$1/$2'));
maskField(byId('card-cvv'), d => d.slice(0, 4));
// Qualquer edição limpa o erro personalizado daquele campo.
cardFields.forEach(el => el.addEventListener('input', () => el.setCustomValidity('')));

function luhn(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}
function cardProblem() {
  const name = byId('card-name').value.trim();
  const number = byId('card-number').value.replace(/\D/g, '');
  const exp = byId('card-expiry').value.replace(/\D/g, '');
  const cvv = byId('card-cvv').value.replace(/\D/g, '');
  if (name.length < 3) return ['card-name', 'Informe o nome impresso no cartão (fictício).'];
  if (number.length !== 16 || !luhn(number)) return ['card-number', 'Número de cartão inválido. Use um número fictício de teste, como 4111 1111 1111 1111.'];
  const month = Number(exp.slice(0, 2)), year = 2000 + Number(exp.slice(2, 4));
  const now = new Date();
  if (exp.length !== 4 || month < 1 || month > 12) return ['card-expiry', 'Informe a validade no formato MM/AA.'];
  if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) return ['card-expiry', 'A validade informada já passou.'];
  if (cvv.length < 3) return ['card-cvv', 'O CVV deve ter 3 ou 4 dígitos.'];
  return null;
}

/* ------------------------------------------------------------------ */
/* Forma de pagamento: só os campos do método ativo participam         */
/* ------------------------------------------------------------------ */
function setPaymentMethod(method) {
  paymentMethod = method === 'cartao' ? 'cartao' : 'pix';
  const isCard = paymentMethod === 'cartao';
  document.querySelectorAll('[data-pay-method]').forEach(btn => {
    const active = btn.dataset.payMethod === paymentMethod;
    btn.setAttribute('aria-pressed', String(active));
    btn.classList.toggle('btn-primary', active);
  });
  byId('payment-pix').hidden = isCard;
  byId('payment-card').hidden = !isCard;
  // Campos do método inativo ficam desabilitados (fora da validação do formulário),
  // e nenhum erro de uma tentativa anterior permanece em nenhum dos métodos.
  cardFields.forEach(el => {
    el.setCustomValidity('');
    el.disabled = !isCard;
    el.required = isCard;
  });
  setStatus('');
}
document.querySelectorAll('[data-pay-method]').forEach(btn => {
  btn.addEventListener('click', () => { if (!busy) setPaymentMethod(btn.dataset.payMethod); });
});
setPaymentMethod('pix');

byId('copy-pix').addEventListener('click', async () => {
  const codeEl = byId('pix-code');
  try {
    if (!navigator.clipboard?.writeText) throw new Error('API de área de transferência indisponível');
    await navigator.clipboard.writeText(codeEl.textContent);
    setStatus('Código PIX demonstrativo copiado para a área de transferência.');
  } catch {
    // Sem permissão de cópia: seleciona o código para o usuário copiar manualmente.
    const range = document.createRange();
    range.selectNodeContents(codeEl);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    setStatus('Não foi possível copiar automaticamente. O código foi selecionado: use Ctrl+C (ou "Copiar" no celular).', true);
  }
});

/* ------------------------------------------------------------------ */
/* Simulação de pagamento (sem gravação e sem ações concorrentes)      */
/* ------------------------------------------------------------------ */
let cardFieldsLocked = [];
function lock(value) {
  busy = value;
  purchaseForm.setAttribute('aria-busy', String(value));
  submitBtn.disabled = value;
  planSelect.disabled = cycleSelect.disabled = value;
  document.querySelectorAll('[data-pay-method], #copy-pix').forEach(b => { b.disabled = value; });
  if (value) {
    cardFieldsLocked = cardFields.filter(el => !el.disabled);
    cardFieldsLocked.forEach(el => { el.readOnly = true; });
  } else {
    cardFieldsLocked.forEach(el => { el.readOnly = false; });
    cardFieldsLocked = [];
  }
}

purchaseForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  if (!authenticatedUser) {
    location.replace('login.html' + buildPlanQuery(currentPlan, currentCycle));
    return;
  }
  const method = paymentMethod;
  if (method === 'cartao') {
    cardFields.forEach(el => el.setCustomValidity(''));
    if (!purchaseForm.reportValidity()) return;
    const problem = cardProblem();
    if (problem) {
      const [id, text] = problem;
      byId(id).setCustomValidity(text);
      byId(id).reportValidity();
      setStatus(text, true);
      return;
    }
  } else if (!purchaseForm.reportValidity()) {
    return;
  }
  const plan = currentPlan, cycle = currentCycle;
  lock(true);
  setStatus('Processando a simulação…');
  try {
    await new Promise(resolve => setTimeout(resolve, 900));
    const metodoLabel = method === 'pix' ? 'PIX' : 'cartão de crédito';
    const valor = formatPlanPrice(plan, cycle);
    cardFields.forEach(el => { el.value = ''; el.setCustomValidity(''); }); // o cartão de teste nunca é guardado
    setStatus(`Simulação concluída: HomeWise ${plan} (${cycle}) via ${metodoLabel}. Nenhum valor foi cobrado e nenhuma assinatura foi ativada.`);
    window.openModal?.(
      'Simulação concluída',
      `Este é um ambiente de demonstração acadêmica (TCC). O pagamento do plano HomeWise ${plan} (${valor}) via ${metodoLabel} foi apenas simulado: nenhum valor foi cobrado e a assinatura da sua conta não foi alterada.`
    );
  } finally {
    lock(false);
  }
});
