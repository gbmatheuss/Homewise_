import {
  firebaseReady,
  selectedPlan,
  selectedCycle,
  plans,
  planIds,
  idToPlanName,
  formatPlanPrice,
  buildPlanQuery,
  authMessage,
  obterPerfilWeb,
  salvarPerfilWeb
} from './firebase.js';

const purchaseForm = document.getElementById('purchase-form');
const planSelect = document.getElementById('cart-plan-select');
const cycleSelect = document.getElementById('cart-cycle-select');
const statusEl = document.getElementById('cart-status');
const cancelBtn = document.getElementById('cancel-sub-btn');
const activeBanner = document.getElementById('active-sub-banner');

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

planSelect.value = currentPlan;
cycleSelect.value = currentCycle;

function updateSummaryUI() {
  document.getElementById('selected-plan').textContent = `Plano HomeWise ${currentPlan}`;
  document.getElementById('plan-price').textContent = formatPlanPrice(currentPlan, currentCycle);
  const benefitsList = document.getElementById('plan-benefits');
  benefitsList.innerHTML = '';
  for (const item of planBenefitsMap[currentPlan] || []) {
    const li = document.createElement('li');
    li.textContent = item;
    benefitsList.append(li);
  }
  const newUrl = location.pathname + buildPlanQuery(currentPlan, currentCycle);
  history.replaceState(null, '', newUrl);
}

updateSummaryUI();

planSelect.addEventListener('change', () => {
  if (Object.hasOwn(plans, planSelect.value)) {
    currentPlan = planSelect.value;
    updateSummaryUI();
  }
});

cycleSelect.addEventListener('change', () => {
  currentCycle = cycleSelect.value === 'anual' ? 'anual' : 'mensal';
  updateSummaryUI();
});

function renderActiveBanner(perfil) {
  const planoAtivoId = perfil?.plano;
  const statusAssinatura = perfil?.status_assinatura;
  if (planoAtivoId && statusAssinatura !== 'cancelada' && idToPlanName[planoAtivoId]) {
    const nomePlano = idToPlanName[planoAtivoId];
    const ciclo = perfil.ciclo_assinatura === 'anual' ? 'Anual' : 'Mensal';
    activeBanner.hidden = false;
    activeBanner.textContent = `Assinatura atual ativa: HomeWise ${nomePlano} (${ciclo})`;
    cancelBtn.hidden = false;
  } else {
    activeBanner.hidden = true;
    cancelBtn.hidden = true;
  }
}

function validarCPF(cpfFormatado) {
  const cpf = cpfFormatado.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let t = 9; t < 11; t++) {
    let soma = 0;
    for (let i = 0; i < t; i++) soma += Number(cpf[i]) * (t + 1 - i);
    const digito = ((soma * 10) % 11) % 10;
    if (Number(cpf[t]) !== digito) return false;
  }
  return true;
}

try {
  const {auth, sdk} = await firebaseReady;
  sdk.onAuthStateChanged(auth, async user => {
    authenticatedUser = user;
    document.getElementById('protected-cart').hidden = !user;
    document.getElementById('account-bar').hidden = !user;
    if (!user) {
      location.replace('login.html' + buildPlanQuery(currentPlan, currentCycle));
      return;
    }
    document.getElementById('account-status').textContent = '';
    document.getElementById('account-email').textContent = 'Conectado como ' + user.email;
    if (!document.getElementById('nome').value) {
      document.getElementById('nome').value = user.displayName || '';
    }

    const perfil = await obterPerfilWeb(user.uid);
    if (perfil) {
      if (perfil.nome && !document.getElementById('nome').value) document.getElementById('nome').value = perfil.nome;
      if (perfil.cpf && !document.getElementById('cpf').value) document.getElementById('cpf').value = perfil.cpf;
      if (perfil.telefone && !document.getElementById('telefone').value) document.getElementById('telefone').value = perfil.telefone;
      if (perfil.cep && !document.getElementById('cep').value) document.getElementById('cep').value = perfil.cep;
      if (perfil.endereco_detalhado) {
        const end = perfil.endereco_detalhado;
        if (end.rua) document.getElementById('endereco').value = end.rua;
        if (end.numero) document.getElementById('numero').value = end.numero;
        if (end.complemento) document.getElementById('complemento').value = end.complemento;
        if (end.bairro) document.getElementById('bairro').value = end.bairro;
        if (end.cidade) document.getElementById('cidade').value = end.cidade;
        if (end.estado) document.getElementById('estado').value = end.estado;
      }
      renderActiveBanner(perfil);
    }
  });

  document.getElementById('sign-out').onclick = async event => {
    event.target.disabled = true;
    try {
      await sdk.signOut(auth);
    } catch (error) {
      document.getElementById('account-status').textContent = authMessage(error);
      event.target.disabled = false;
    }
  };
} catch {
  document.getElementById('account-status').textContent = 'Não foi possível verificar sua conta. Verifique sua conexão e recarregue a página.';
}

const maskField = (id, format) => document.getElementById(id)?.addEventListener('input', event => {
  event.target.value = format(event.target.value.replace(/\D/g, ''));
});

maskField('cpf', digits => digits.slice(0, 11).replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3}\.\d{3})(\d)/, '$1.$2').replace(/(\d{3}\.\d{3}\.\d{3})(\d)/, '$1-$2'));
maskField('cep', digits => digits.slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2'));
maskField('telefone', digits => {
  digits = digits.slice(0, 11);
  if (digits.length <= 2) return digits;
  const local = digits.slice(2);
  const split = local.length > 8 ? 5 : 4;
  return '(' + digits.slice(0, 2) + ') ' + local.slice(0, split) + (local.length > split ? '-' + local.slice(split) : '');
});
maskField('card-number', digits => digits.slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 '));
maskField('card-expiry', digits => digits.slice(0, 4).replace(/^(\d{2})(\d)/, '$1/$2'));
maskField('card-cvv', digits => digits.slice(0, 4));

const cpfInput = document.getElementById('cpf');
cpfInput.addEventListener('input', () => {
  const digits = cpfInput.value.replace(/\D/g, '');
  if (digits.length === 11 && !validarCPF(cpfInput.value)) {
    cpfInput.setCustomValidity('Informe um CPF válido.');
  } else {
    cpfInput.setCustomValidity('');
  }
});

// Busca automática de CEP via ViaCEP
const cepInput = document.getElementById('cep');
const cepFeedback = document.getElementById('cep-feedback');
let lastLookedUpCep = '';
cepInput.addEventListener('input', async () => {
  const digits = cepInput.value.replace(/\D/g, '');
  if (digits.length !== 8 || digits === lastLookedUpCep) return;
  lastLookedUpCep = digits;
  cepFeedback.textContent = 'Buscando CEP…';
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const data = await res.json();
    if (data && !data.erro) {
      if (data.logradouro) document.getElementById('endereco').value = data.logradouro;
      if (data.bairro) document.getElementById('bairro').value = data.bairro;
      if (data.localidade) document.getElementById('cidade').value = data.localidade;
      if (data.uf) document.getElementById('estado').value = data.uf;
      cepFeedback.textContent = 'Endereço preenchido!';
    } else {
      cepFeedback.textContent = 'CEP não encontrado.';
    }
  } catch {
    cepFeedback.textContent = '';
  }
});

// Alternância de forma de pagamento
document.querySelectorAll('[data-pay-method]').forEach(btn => {
  btn.addEventListener('click', () => {
    paymentMethod = btn.dataset.payMethod === 'cartao' ? 'cartao' : 'pix';
    document.querySelectorAll('[data-pay-method]').forEach(other => {
      const active = other.dataset.payMethod === paymentMethod;
      other.setAttribute('aria-pressed', String(active));
      other.classList.toggle('btn-primary', active);
    });
    const isCard = paymentMethod === 'cartao';
    document.getElementById('payment-pix').hidden = isCard;
    document.getElementById('payment-card').hidden = !isCard;
    document.getElementById('card-name').required = isCard;
    document.getElementById('card-number').required = isCard;
    document.getElementById('card-expiry').required = isCard;
    document.getElementById('card-cvv').required = isCard;
  });
});

document.getElementById('copy-pix').addEventListener('click', async () => {
  const code = document.getElementById('pix-code').textContent;
  try {
    await navigator.clipboard.writeText(code);
    statusEl.textContent = 'Código PIX demonstrativo copiado para a área de transferência!';
  } catch {
    statusEl.textContent = 'Código PIX selecionado.';
  }
});

const birthday = document.getElementById('nascimento');
const today = new Date();
birthday.max = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

cancelBtn.addEventListener('click', async () => {
  if (!authenticatedUser) return;
  cancelBtn.disabled = true;
  statusEl.textContent = 'Cancelando assinatura…';
  try {
    await salvarPerfilWeb(authenticatedUser.uid, {
      plano: null,
      plano_nome: null,
      status_assinatura: 'cancelada'
    });
    renderActiveBanner(null);
    statusEl.textContent = 'Sua assinatura foi cancelada com sucesso. A alteração já está sincronizada com o aplicativo.';
  } catch {
    statusEl.textContent = 'Não foi possível cancelar a assinatura. Tente novamente.';
  } finally {
    cancelBtn.disabled = false;
  }
});

purchaseForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!authenticatedUser) {
    location.replace('login.html' + buildPlanQuery(currentPlan, currentCycle));
    return;
  }
  if (!validarCPF(cpfInput.value)) {
    cpfInput.setCustomValidity('Informe um CPF válido.');
    purchaseForm.reportValidity();
    return;
  }
  if (paymentMethod === 'cartao') {
    const cardDigits = document.getElementById('card-number').value.replace(/\D/g, '');
    const expDigits = document.getElementById('card-expiry').value.replace(/\D/g, '');
    const expMonth = Number(expDigits.slice(0, 2));
    if (cardDigits.length < 16 || expDigits.length < 4 || expMonth < 1 || expMonth > 12) {
      statusEl.textContent = 'Verifique o número (16 dígitos) e a validade (MM/AA) do cartão.';
      return;
    }
  }
  const submitBtn = document.getElementById('submit-purchase');
  submitBtn.disabled = true;
  statusEl.textContent = 'Processando simulação de pagamento e ativando sua assinatura…';

  const rua = document.getElementById('endereco').value.trim();
  const numero = document.getElementById('numero').value.trim();
  const complemento = document.getElementById('complemento').value.trim();
  const bairro = document.getElementById('bairro').value.trim();
  const cidade = document.getElementById('cidade').value.trim();
  const estado = document.getElementById('estado').value;
  const enderecoFormatado = `${rua}, ${numero}${complemento ? ' (' + complemento + ')' : ''} - ${bairro}, ${cidade}/${estado}`;
  const planoId = planIds[currentPlan] || 'plus';

  try {
    await new Promise(resolve => setTimeout(resolve, 800));
    const dadosAtualizados = {
      nome: document.getElementById('nome').value.trim(),
      cpf: cpfInput.value.trim(),
      telefone: document.getElementById('telefone').value.trim(),
      cep: cepInput.value.trim(),
      residencia: enderecoFormatado,
      endereco_detalhado: {rua, numero, complemento, bairro, cidade, estado},
      plano: planoId,
      plano_nome: currentPlan,
      ciclo_assinatura: currentCycle,
      status_assinatura: 'ativa',
      metodo_pagamento: paymentMethod,
      assinado_em: new Date()
    };
    await salvarPerfilWeb(authenticatedUser.uid, dadosAtualizados);
    renderActiveBanner(dadosAtualizados);
    const metodoLabel = paymentMethod === 'pix' ? 'PIX Instantâneo' : 'Cartão de Crédito';
    const valorFormatado = formatPlanPrice(currentPlan, currentCycle);
    statusEl.textContent = `Pagamento via ${metodoLabel} aprovado! Assinatura HomeWise ${currentPlan} (${currentCycle}) ativa e sincronizada com o aplicativo.`;
    if (typeof window.openModal === 'function') {
      window.openModal(
        'Pagamento Aprovado!',
        `Seu plano HomeWise ${currentPlan} (${valorFormatado}) foi ativado via ${metodoLabel} e já está sincronizado com o aplicativo HomeWise.`
      );
    }
  } catch {
    statusEl.textContent = 'Não foi possível salvar a assinatura na nuvem. Verifique sua conexão e tente novamente.';
  } finally {
    submitBtn.disabled = false;
  }
});
