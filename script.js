// Interações compartilhadas pelas páginas HomeWise.
const themeButton = document.createElement('button');
themeButton.type = 'button';
themeButton.className = 'theme-toggle';
document.body.append(themeButton);
function setTheme(theme) {
  const light = theme === 'light';
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  themeButton.textContent = light ? '☾ Tema escuro' : '☀ Tema claro';
  themeButton.setAttribute('aria-label', light ? 'Ativar tema escuro' : 'Ativar tema claro');
  themeButton.setAttribute('aria-pressed', String(light));
}
let savedTheme;
try { savedTheme = localStorage.getItem('homewise-theme'); } catch {}
setTheme(savedTheme === 'light' ? 'light' : 'dark');
themeButton.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  setTheme(theme);
  try { localStorage.setItem('homewise-theme', theme); } catch {}
});

let modal = document.getElementById('modal');
if (!modal) {
  modal = document.createElement('div');
  modal.id = 'modal';
  modal.className = 'modal';
  modal.innerHTML = '<div class="modal-box"><button class="close" data-close aria-label="Fechar">×</button><h2 id="modalTitle"></h2><p id="modalText"></p><br><button class="btn btn-primary" data-close>Fechar</button></div>';
  document.body.append(modal);
}
modal.setAttribute('role', 'dialog');
modal.setAttribute('aria-modal', 'true');
modal.setAttribute('aria-labelledby', 'modalTitle');
modal.setAttribute('aria-describedby', 'modalText');
modal.setAttribute('aria-hidden', 'true');
modal.querySelector('.close').setAttribute('aria-label', 'Fechar janela');
let previousFocus;
function openModal(title, text) {
  previousFocus = document.activeElement;
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalText').textContent = text;
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  modal.querySelector('[data-close]').focus();
}
function closeModal() {
  if (!modal.classList.contains('show')) return;
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  previousFocus?.focus();
}
document.querySelectorAll('.links').forEach((nav, index) => {
  nav.id = 'navigation-' + index;
  nav.setAttribute('aria-label', 'Navegação principal');
  nav.querySelector('.active')?.setAttribute('aria-current', 'page');
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'menu-toggle';
  toggle.textContent = '☰ Menu';
  toggle.setAttribute('aria-controls', nav.id);
  toggle.setAttribute('aria-expanded', 'false');
  nav.before(toggle);
  const close = () => {nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); toggle.textContent = '☰ Menu';};
  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.textContent = isOpen ? '× Fechar' : '☰ Menu';
  });
  nav.addEventListener('click', event => {if (event.target.closest('a')) close();});
  document.addEventListener('keydown', event => {if (event.key === 'Escape' && nav.classList.contains('is-open')) {close(); toggle.focus();}});
  window.matchMedia('(min-width: 851px)').addEventListener('change', close);
});
document.addEventListener('click', event => {
  if (event.target.closest('[data-close]') || event.target === modal) closeModal();
  const plan = event.target.closest('[data-plan]');
  if (plan) {event.preventDefault(); window.location.href = 'carrinho.html?plano=' + encodeURIComponent(plan.dataset.plan);}
  if (event.target.closest('[data-download]')) {event.preventDefault(); openModal('HomeWise em breve', 'O aplicativo ainda não possui um link de download disponível. Enquanto isso, conheça os recursos na página Como funciona.');}
  if (event.target.closest('[data-support]')) {event.preventDefault(); openModal('Suporte HomeWise', 'Consulte as perguntas frequentes para saber mais sobre instalação, dispositivos e planos. O canal de atendimento ainda não está disponível neste projeto.');}
  const placeholder = event.target.closest('a[href*="SEU_LINKEDIN_AQUI"]');
  if (placeholder) {event.preventDefault(); showToast('O perfil desta pessoa ainda não foi informado.');}
});
document.querySelectorAll('.faq-q').forEach((button, index) => {
  const answer = button.parentElement.querySelector('.faq-a');
  answer.id = 'faq-answer-' + index;
  button.type = 'button';
  button.setAttribute('aria-controls', answer.id);
  const sync = () => {const open = button.parentElement.classList.contains('open'); button.setAttribute('aria-expanded', String(open)); answer.hidden = !open;};
  sync();
  button.addEventListener('click', () => {button.parentElement.classList.toggle('open'); sync();});
});
let toastTimer;
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeModal();
  if (event.key !== 'Tab' || !modal.classList.contains('show')) return;
  const controls = Array.from(modal.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]')).filter(element => !element.disabled);
  const first = controls[0], last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last.focus();}
  else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first.focus();}
});
