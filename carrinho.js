const purchaseForm = document.getElementById('purchase-form');
const maskField = (id, format) => document.getElementById(id).addEventListener('input', event => {event.target.value = format(event.target.value.replace(/\D/g, ''));});
maskField('cpf', digits => digits.slice(0,11).replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3}\.\d{3})(\d)/,'$1.$2').replace(/(\d{3}\.\d{3}\.\d{3})(\d)/,'$1-$2'));
maskField('cep', digits => digits.slice(0,8).replace(/^(\d{5})(\d)/,'$1-$2'));
maskField('telefone', digits => {digits=digits.slice(0,11); if(digits.length<=2)return digits; const local=digits.slice(2); const split=local.length>8?5:4; return '('+digits.slice(0,2)+') '+local.slice(0,split)+(local.length>split?'-'+local.slice(split):'');});
const birthday = document.getElementById('nascimento');
const today = new Date();
birthday.max = today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
const plans = {'Básico':'19,90','Plus':'29,90','Premium':'49,90'};
const selected = new URLSearchParams(location.search).get('plano');
if(Object.hasOwn(plans, selected)){document.getElementById('selected-plan').textContent=selected;document.getElementById('plan-price').textContent='R$ '+plans[selected]+' / mês';}
purchaseForm.addEventListener('submit',event=>{event.preventDefault();document.getElementById('cart-status').textContent='Campos preenchidos. A compra e o pagamento ainda não estão disponíveis.';});
