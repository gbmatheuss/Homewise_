import {firebaseReady, selectedPlan, plans, planQuery, authMessage} from './firebase.js';
const byId = id => document.getElementById(id);
const form = byId('auth-form'), fields = byId('auth-fields'), status = byId('auth-status');
const password = byId('auth-password'), confirm = byId('auth-confirm');
let mode = 'register', busy = false, client;
byId('auth-plan').textContent = selectedPlan;
byId('auth-price').textContent = 'R$ ' + plans[selectedPlan] + ' / mês';
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
      // A criação da conta já foi concluída mesmo se a atualização do nome falhar.
      try {await sdk.updateProfile(user, {displayName: name});} catch {}
    } else { await sdk.signInWithEmailAndPassword(auth, email, password.value); }
    form.reset();
    location.replace('carrinho.html' + planQuery);
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
  if (client.auth.currentUser) {location.replace('carrinho.html' + planQuery);}
  else {fields.disabled = false; message('');}
} catch (error) {message('Não foi possível carregar o acesso. Verifique sua conexão e recarregue a página. ' + authMessage(error), true);}
