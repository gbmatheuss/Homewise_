import {firebaseReady, plans, selectedPlan, selectedCycle, formatPlanPrice, planQuery, authMessage, salvarPerfilWeb} from './firebase.js';
const byId = id => document.getElementById(id);
const form = byId('auth-form'), fields = byId('auth-fields'), status = byId('auth-status');
const password = byId('auth-password'), confirm = byId('auth-confirm');
let mode = 'register', busy = false, client;
// Contexto da página, decidido só pela URL desta visita (nada é lido de localStorage/sessionStorage):
// • Fluxo de contratação: a URL traz um plano válido (?plano=…&ciclo=…), vindo de precos.html ou do
//   redirecionamento do checkout → mostra o plano escolhido e, depois de entrar, segue para o checkout.
// • Acesso direto (ícone de conta, ?destino=perfil, ou login.html sem plano) → texto genérico, sem
//   card de plano, e depois de entrar vai para o perfil. O destino é sempre um valor fixo (sem
//   redirecionamento aberto).
const params = new URLSearchParams(location.search);
const planFlow = params.get('destino') !== 'perfil' && Object.hasOwn(plans, params.get('plano') ?? '');
const afterAuth = planFlow ? 'carrinho.html' + planQuery : 'perfil.html';
if (planFlow) {
  byId('auth-layout').classList.remove('is-generic');
  byId('auth-badge').textContent = '● Primeiro, sua conta';
  byId('auth-lead').textContent = 'Crie sua conta ou entre para continuar com o plano escolhido.';
  byId('auth-plan').textContent = `${selectedPlan} (${selectedCycle === 'anual' ? 'Ciclo anual • 15% OFF' : 'Ciclo mensal'})`;
  byId('auth-price').textContent = formatPlanPrice(selectedPlan, selectedCycle);
  byId('auth-plan-card').hidden = false;
}
function message(text, error = false) { status.textContent = text; status.dataset.error = String(error); }
function setMode(next) {
  if (busy) return;
  mode = next;
  const register = mode === 'register';
  byId('name-field').hidden = byId('confirm-field').hidden = !register;
  byId('auth-name').required = confirm.required = register;
  byId('auth-name').disabled = confirm.disabled = !register;
  confirm.setCustomValidity('');
  password.minLength = register ? 6 : 1;
  password.autocomplete = register ? 'new-password' : 'current-password';
  byId('password-help').hidden = !register;
  byId('reset-password').hidden = register;
  byId('auth-title').textContent = register ? 'Crie sua conta' : 'Entre na sua conta';
  byId('auth-submit').textContent = register ? 'Criar conta e continuar' : 'Entrar e continuar';
  for (const tab of ['register', 'login']) {
    byId('tab-' + tab).setAttribute('aria-pressed', String(tab === mode));
    byId('tab-' + tab).classList.toggle('btn-primary', tab === mode);
  }
  message('');
}
byId('tab-login').onclick = () => setMode('login');
byId('tab-register').onclick = () => setMode('register');
function validateConfirmation() { confirm.setCustomValidity(mode === 'register' && confirm.value !== password.value ? 'As senhas precisam ser iguais.' : ''); }
confirm.addEventListener('input', validateConfirmation);
password.addEventListener('input', validateConfirmation);
function lock(value) {busy = value; fields.disabled = value; byId('tab-login').disabled = byId('tab-register').disabled = value; form.setAttribute('aria-busy', String(value));}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !client) return;
  validateConfirmation();
  if (!form.reportValidity()) return;
  const name = byId('auth-name').value.trim();
  if (mode === 'register' && name.length < 3) { message('Informe seu nome completo.', true); return; }
  lock(true); message(mode === 'register' ? 'Criando sua conta…' : 'Entrando…');
  try {
    const {auth, sdk} = client;
    const email = byId('auth-email').value.trim();
    if (mode === 'register') {
      const {user} = await sdk.createUserWithEmailAndPassword(auth, email, password.value);
      // A conta já foi criada mesmo se o nome ou o perfil não forem salvos: avisa em vez de ignorar.
      let profileSaved = true;
      try {await sdk.updateProfile(user, {displayName: name});} catch {profileSaved = false;}
      try {
        await salvarPerfilWeb(user.uid, {
          nome: name,
          email: email.toLowerCase(),
          dispositivo_id: '',
          criado_em: new Date()
        });
      } catch {profileSaved = false;}
      if (!profileSaved) {
        form.reset();
        message('Conta criada, mas não foi possível salvar todos os dados do perfil. Você pode continuar normalmente; complete o perfil depois pelo aplicativo. Redirecionando…', true);
        setTimeout(() => location.replace(afterAuth), 4000);
        return;
      }
    } else { await sdk.signInWithEmailAndPassword(auth, email, password.value); }
    form.reset();
    location.replace(afterAuth);
  } catch (error) {message(authMessage(error), true); lock(false);}
});
byId('reset-password').onclick = async () => {
  const email = byId('auth-email');
  if (!email.reportValidity() || busy || !client) return;
  lock(true); message('Enviando instruções…');
  try {
    await client.sdk.sendPasswordResetEmail(client.auth, email.value.trim());
    message('Se houver uma conta com esse e-mail, você receberá instruções para redefinir a senha.');
  } catch (error) {message(authMessage(error), true);} finally {lock(false);}
};
try {
  client = await firebaseReady;
  if (client.auth.currentUser) {location.replace(afterAuth);}
  else {fields.disabled = false; message('');}
} catch (error) {message('Não foi possível carregar o acesso. Verifique sua conexão e recarregue a página. ' + authMessage(error), true);}
