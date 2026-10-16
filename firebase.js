// Configuração pública do aplicativo. Senhas são gerenciadas pelo Firebase Auth.
export const plans = {'Básico': '19,90', Plus: '29,90', Premium: '49,90'};
const requested = new URLSearchParams(location.search).get('plano');
export const selectedPlan = Object.hasOwn(plans, requested) ? requested : 'Plus';
export const planQuery = '?plano=' + encodeURIComponent(selectedPlan);
export const firebaseReady = (async () => {
  const [{initializeApp}, sdk] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js')
  ]);
  const app = initializeApp({
    apiKey: 'AIzaSyCww4Tnkn-PbM_F-YQlqAMjHNeIQX9klDI',
    authDomain: 'academia-aura.firebaseapp.com',
    projectId: 'academia-aura',
    storageBucket: 'academia-aura.firebasestorage.app',
    messagingSenderId: '267073767631',
    appId: '1:267073767631:web:3940160d54309bb1a00fba',
    measurementId: 'G-90P71HPFP1'
  });
  const auth = sdk.getAuth(app);
  auth.languageCode = 'pt-BR';
  await auth.authStateReady();
  return {auth, sdk};
})();
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
  return messages[error.code] || 'Não foi possível concluir. Tente novamente em instantes.';
}
