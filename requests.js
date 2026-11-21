'use strict';
(() => {
 const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const endpoint = () => window.REQUEST_CONFIG?.endpoint || '';
 const validEndpoint = url => /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url);
 const drafts = new Map();
 const draftFor = id => {
  if (!drafts.has(id)) drafts.set(id, {requestId:crypto.randomUUID(), startedAt:Date.now(), values:{}, pending:false, reference:'', error:''});
  return drafts.get(id);
 };
 function form(tariff) {
  return `<section class="request-panel" aria-labelledby="request-title"><div class="request-heading"><h3 id="request-title">Обсудим подключение?</h3><p>Оставьте контакты — уточним доступность и условия выбранного тарифа.</p></div><form id="tariff-request" data-tariff="${tariff.id}"><div class="request-offer"><strong>${escape(tariff.name)}</strong><span>${escape(tariff.feeLabel || tariff.feeText)} · абонентская плата</span><small>Подключение: ${tariff.setup==null?'уточняется отдельно':escape(tariff.setup)+' ₽'}. Заявка не обязывает к покупке.</small></div><div class="request-fields"><label class="field" for="request-name">Как к вам обращаться<input id="request-name" name="name" autocomplete="given-name" maxlength="80" required placeholder="Ваше имя"></label><label class="field" for="request-phone">Телефон для связи<input id="request-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="25" required placeholder="+7 999 123-45-67" aria-describedby="request-phone-hint"><small id="request-phone-hint">Укажите номер с кодом страны.</small></label><label class="field" for="request-region">Регион подключения<input id="request-region" name="region" autocomplete="address-level1" maxlength="100" required placeholder="Например, Московская область"></label><label class="field" for="request-channel">Как удобнее связаться<select id="request-channel" name="channel"><option value="phone">Позвонить</option><option value="telegram">Telegram</option><option value="whatsapp">WhatsApp</option></select></label><label class="field request-wide" for="request-handle" id="request-handle-field" hidden>Ваш Telegram<input id="request-handle" name="handle" autocomplete="off" maxlength="40" pattern="@?[A-Za-z0-9_]{5,32}" title="Имя пользователя Telegram: от 5 до 32 латинских букв, цифр или знаков подчёркивания" placeholder="@username"><small>Если есть имя пользователя — укажите его. Иначе попробуем найти вас по телефону.</small></label><label class="field request-wide" for="request-comment"><span>Комментарий <span class="optional">необязательно</span></span><textarea id="request-comment" name="comment" rows="3" maxlength="1000" placeholder="Например, хочу сохранить свой номер или подобрать тариф для дачи"></textarea></label></div><div class="request-trap" aria-hidden="true"><label>Сайт компании<input name="website" tabindex="-1" autocomplete="off"></label></div><label class="request-consent"><input name="consent" type="checkbox" required><span>Согласен на обработку указанных данных и передачу менеджерам через Telegram для ответа на заявку.</span></label><details class="request-privacy"><summary>Как используются данные</summary><p>Имя, телефон, регион, выбранный тариф и комментарий нужны для обратной связи и уточнения подключения. Заявки сохраняются в закрытой Google Таблице. Менеджерам с разрешённым доступом в Telegram передаются выбранный тариф, имя, телефон, регион, способ связи и комментарий. Паспортные данные здесь не требуются.</p></details><p id="request-status" class="request-status" role="status" aria-live="polite">${validEndpoint(endpoint()) ? 'После отправки покажем номер вашей заявки.' : 'Подключаем приём заявок. Сейчас форму можно посмотреть; данные никуда не отправляются.'}</p><button class="primary request-submit" type="submit" ${validEndpoint(endpoint()) ? '' : 'disabled'}>Оставить заявку ${window.SITE_ICONS?.arrow || ''}</button></form></section>`;
 }
 function init() {
  const el = document.getElementById('tariff-request');
  if (!el) return;
  const draft = draftFor(el.dataset.tariff);
  el.dataset.requestId = draft.requestId;
  el.dataset.startedAt = draft.startedAt;
  for (const [name,value] of Object.entries(draft.values)) {const input=el.elements[name]; if(input){if(input.type==='checkbox')input.checked=value;else input.value=value;}}
  const remember = () => {draft.values=Object.fromEntries(new FormData(el));draft.values.consent=el.elements.consent.checked;};
  el.addEventListener('input', remember); el.addEventListener('change', remember);
  document.getElementById('request-handle-field').hidden = el.elements.channel.value !== 'telegram';
  if (draft.reference) {showSuccess(el,draft.reference);return;}
  if (draft.pending) busy(el,true);
  else if (draft.error) showError(el,draft.error);
  el.elements.channel.addEventListener('change', () => {
   const field = document.getElementById('request-handle-field');
   field.hidden = el.elements.channel.value !== 'telegram';
   if (field.hidden) el.elements.handle.value = '';
  });
  el.elements.phone.addEventListener('input', () => el.elements.phone.setCustomValidity(''));
  el.addEventListener('submit', submit);
 }
 async function submit(event) {
  event.preventDefault();
  const el = event.currentTarget;
  const draft = draftFor(el.dataset.tariff);
  if (draft.pending || !validEndpoint(endpoint())) return;
  const digits = el.elements.phone.value.replace(/\D/g, '');
  el.elements.phone.setCustomValidity(/^\+?[\d\s()-]+$/.test(el.elements.phone.value.trim()) && digits.length >= 10 && digits.length <= 15 ? '' : 'Введите телефон с кодом страны: от 10 до 15 цифр.');
  if (!el.reportValidity()) return;
  const payload = Object.fromEntries(new FormData(el));
  Object.assign(payload, {requestId: el.dataset.requestId, tariffId: Number(el.dataset.tariff), privacyVersion: 'telegram-full-v1', consent: el.elements.consent.checked, startedAt: Number(el.dataset.startedAt)});
  draft.values={...payload}; draft.pending=true;draft.error='';busy(el,true);
  try {
   const response = await fetch(endpoint(), {method:'POST', credentials:'omit', body:JSON.stringify(payload), signal:AbortSignal.timeout(45000), headers:{'Content-Type':'text/plain;charset=utf-8'}});
   if (!response.ok) throw Error('network');
   const result = await response.json();
   if (!result.ok || !/^K-\d{6}-[a-f0-9]{8}$/i.test(result.reference || '')) {
    const error = Error(result.code || 'network'); throw error;
   }
   draft.reference=result.reference; draft.values={};
  } catch (error) {
   const messages = {rate:'Вы недавно оставили заявку. Подождите минуту и попробуйте снова.',invalid:'Проверьте контакты и согласие на обработку данных.',tariff:'Этот тариф сейчас недоступен для заявки. Выберите другое предложение.',unavailable:'Приём заявок временно недоступен. Попробуйте позже.'};
   draft.error = messages[error.message] || 'Не удалось подтвердить получение. Данные сохранены в форме. Нажмите «Повторить отправку» — повторная попытка не создаст дубликат.';
  } finally {
   draft.pending=false;
   const current=document.getElementById('tariff-request');
   if(current?.dataset.requestId===draft.requestId){busy(current,false);if(draft.reference)showSuccess(current,draft.reference);else showError(current,draft.error);}
  }
 }
 function busy(el,value){el.setAttribute('aria-busy',String(value));el.querySelectorAll('input,select,textarea,button').forEach(input=>input.disabled=value);if(value){const status=el.querySelector('#request-status');status.classList.remove('request-error');status.textContent='Отправляем заявку. Это может занять несколько секунд…';}}
 function showError(el,message){const status=el.querySelector('#request-status');status.textContent=message;status.classList.add('request-error');status.tabIndex=-1;status.focus();el.querySelector('[type="submit"]').textContent='Повторить отправку';}
 function showSuccess(el,reference){el.closest(".request-panel").querySelector(".request-heading")?.remove();el.innerHTML=`<div class="request-success" tabindex="-1"><span class="request-success-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 4 4 10-10"/></svg></span><h3 id="request-title">Заявка принята</h3><p>Ваш номер <strong>${escape(reference)}</strong>. Свяжемся с вами, чтобы уточнить условия подключения.</p><p>Оплата на этом этапе не требуется.</p></div>`;el.querySelector('.request-success').focus();}
 window.TARIFF_REQUESTS = Object.freeze({form, init});
})();
