// Configuração pública do aplicativo HomeWise sincronizada com o app mobile (homewise-65bb1).
export const plans = {'Básico': '19,90', Plus: '29,90', Premium: '49,90'};
export const annualPlans = {'Básico': '16,90', Plus: '25,40', Premium: '42,40'};
export const annualTotals = {'Básico': '202,80', Plus: '304,80', Premium: '508,80'};
export const planIds = {'Básico': 'basico', Plus: 'plus', Premium: 'premium'};
export const idToPlanName = {basico: 'Básico', plus: 'Plus', premium: 'Premium'};

const params = new URLSearchParams(location.search);
const requestedPlan = params.get('plano');
const requestedCycle = params.get('ciclo');
export const selectedPlan = Object.hasOwn(plans, requestedPlan) ? requestedPlan : 'Plus';
export const selectedCycle = requestedCycle === 'anual' ? 'anual' : 'mensal';

export function buildPlanQuery(planName = selectedPlan, cycle = selectedCycle) {
  return '?plano=' + encodeURIComponent(planName) + '&ciclo=' + encodeURIComponent(cycle);
}

export const planQuery = buildPlanQuery(selectedPlan, selectedCycle);

export function formatPlanPrice(planName = selectedPlan, cycle = selectedCycle) {
  const table = cycle === 'anual' ? annualPlans : plans;
  const val = table[planName] || plans.Plus;
  return cycle === 'anual'
    ? `R$ ${val} / mês (anual: R$ ${annualTotals[planName]})`
    : `R$ ${val} / mês`;
}

export const firebaseReady = (async () => {
  const [{initializeApp}, sdk, firestoreSdk] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js')
  ]);
  const app = initializeApp({
    apiKey: 'AIzaSyArdNHN_NkjKYtqo2M0_t5Rg1ot6_lBO38',
    authDomain: 'homewise-65bb1.firebaseapp.com',
    projectId: 'homewise-65bb1',
    storageBucket: 'homewise-65bb1.firebasestorage.app',
    messagingSenderId: '1038567423475',
    appId: '1:1038567423475:web:b07801fb6f742604526686',
    measurementId: 'G-2F2LDCFJHQ'
  });
  const auth = sdk.getAuth(app);
  const db = firestoreSdk.getFirestore(app);
  auth.languageCode = 'pt-BR';
  await auth.authStateReady();
  return {auth, sdk, db, firestoreSdk};
})();

// Contrato de dados conhecido (compartilhado com o app): documento usuarios/{uid} com
// nome, email, dispositivo_id, cpf, telefone, cep, residencia, endereco_detalhado,
// plano ("basico" | "plus" | "premium"), plano_nome, ciclo_assinatura, status_assinatura.
// O site NÃO grava plano/status_assinatura: isso exige confirmação de pagamento no servidor.

// Lê o perfil. Erros (rede, permissão) são propagados para que a interface possa informá-los.
export async function lerPerfilWeb(uid) {
  const {db, firestoreSdk} = await firebaseReady;
  const snap = await firestoreSdk.getDoc(firestoreSdk.doc(db, 'usuarios', uid));
  return snap.exists() ? snap.data() : null;
}

// Usado apenas na criação da conta (dados cadastrais básicos, sem assinatura).
export async function salvarPerfilWeb(uid, dados) {
  const {db, firestoreSdk} = await firebaseReady;
  await firestoreSdk.setDoc(
    firestoreSdk.doc(db, 'usuarios', uid),
    {...dados, uid, atualizado_em: new Date()},
    {merge: true}
  );
}

export function authMessage(error) {
  const messages = {
    'auth/email-already-in-use': 'Este e-mail já possui uma conta. Entre ou recupere sua senha.',
    'auth/invalid-email': 'Informe um e-mail válido.',
    'auth/weak-password': 'Escolha uma senha mais forte, com pelo menos 6 caracteres.',
    'auth/password-does-not-meet-requirements': 'A senha não atende à política de segurança. Use letras maiúsculas, minúsculas, números e símbolos.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'E-mail ou senha incorretos.',
    'auth/user-disabled': 'Esta conta está desativada.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    'auth/network-request-failed': 'Não foi possível conectar. Verifique sua internet e tente novamente.',
    'auth/operation-not-allowed': 'O acesso por e-mail e senha precisa ser habilitado no Firebase Authentication.',
    'auth/unauthorized-domain': 'Este domínio precisa ser autorizado no Firebase Authentication.'
  };
  return messages[error?.code] || 'Não foi possível concluir. Tente novamente em instantes.';
}
