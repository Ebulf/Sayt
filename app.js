
'use strict';
const localIcons={check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"/></svg>',search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>',arrow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>','arrow-left':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12H5m6-6-6 6 6 6"/></svg>',menu:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m6 6 12 12M6 18 18 6"/></svg>',smartphone:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></svg>',router:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M6 13V8m12 5V8M7 16h.01M11 16h.01M8 5a7 7 0 0 1 8 0M10 8a3 3 0 0 1 4 0"/></svg>',sim:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 2h10l4 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><rect x="9" y="10" width="8" height="8" rx="1"/><path d="M13 10v8M9 14h8"/></svg>'};
const icon=name=>localIcons[name]||window.SITE_ICONS?.[name]||localIcons.sim;
const $=id=>document.getElementById(id),all=window.CONTENT?.tariffs||[],ops=[...new Set(all.map(t=>t.operator))],chosen=new Set();
const state={operator:'',scenario:'all',package:'all',query:'',category:'',sort:'original',maxfee:'',mingb:'',minminutes:'',limit:9,step:0};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const logo=op=>window.CARD_OPERATOR_LOGOS?.[op]||window.OPERATOR_LOGOS?.[op]||'';
const plainOperator=op=>['М-сеть','Миранда'].includes(op);
const operatorMark=(op,cls='')=>plainOperator(op)?`<strong>${esc(op)}</strong>`:`<img class="${cls}" src="${esc(logo(op))}" alt="${esc(op)}">`;
const brandStyles={
 'МегаФон':['#00864b','#654092','#ffffff'], 'МТС':['#e51c35','#9b122d','#ffffff'],
 'Билайн':['#ffdb00','#e7bd00','#18151f'], 'Т2':['#24212d','#704394','#ffffff'],
 'Yota':['#00768f','#054c62','#ffffff'], 'М-сеть':['#b01e47','#66234a','#ffffff'],
 'Миранда':['#285485','#433875','#ffffff']};
const deviceOptions=[['Смартфон','devicePhone','Телефон'],['Планшет','deviceTablet','Планшет'],['Модем / роутер','deviceModem','Модем'],['Модем / роутер','deviceRouter','Роутер'],['Умные устройства','deviceSmart','Умные']];
function devices(t){const entries=deviceOptions.filter(([tag])=>(t.deviceTags||[]).includes(tag));return entries.length?`<div class="device-strip" style="--device-count:${entries.length}" aria-label="Подтверждённые устройства">${entries.map(([,key,label])=>`<span class="device"><span class="device-glyph">${icon(key)}</span><span>${label}</span></span>`).join('')}</div>`:'<div class="device-unknown">Устройства уточняются</div>';}
function card(t){const colors=brandStyles[t.operator]||['#44344f','#6d5580','#fff'];return `<article class="tariff product-card" data-tariff-id="${t.id}" style="--op-main:${colors[0]};--op-secondary:${colors[1]};--op-text:${colors[2]}"><button class="product-art" data-detail="${t.id}" aria-label="Открыть условия: ${esc(t.name)}"><span class="connection-tag">${esc(t.category||'Условия в описании')}</span><span class="sim-art"><span class="traffic-value">${esc(t.trafficLabel||t.trafficText||'Уточняется')}</span><span class="price-logo"><span class="art-fee ${String(t.feeLabel||'').length>12?'long-fee':''}">${esc(t.feeLabel||t.feeText||'Уточняется')}</span><span class="art-logo">${operatorMark(t.operator)}</span></span>${devices(t)}</span></button><div class="product-body"><h3>${esc(t.name)}</h3><p class="product-minutes">${esc(t.minutesLabel||t.minutesText||'Минуты уточняются')}</p><div class="product-bottom"><span class="setup-price">Подключение<strong>Уточняется отдельно</strong></span><button class="save" data-save="${t.id}" aria-label="${chosen.has(t.id)?'Убрать из выбора':'Сохранить тариф'} ${esc(t.name)}" aria-pressed="${chosen.has(t.id)}">${icon(chosen.has(t.id)?'check':'bag')}</button></div><button class="product-details" data-detail="${t.id}">Полное описание ${icon('arrow')}</button></div></article>`;}
const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
let cardObserver;
function revealCards(){
 cardObserver?.disconnect();
 if(reduced()||!window.IntersectionObserver)return;
 cardObserver=new IntersectionObserver(entries=>{
  let order=0;
  for(const entry of entries){if(!entry.isIntersecting||!entry.target.isConnected)continue;
   cardObserver.unobserve(entry.target);
   entry.target.animate?.([{opacity:.45,transform:'translateY(16px)'},{opacity:1,transform:'none'}],{duration:460,delay:Math.min(order++,3)*55,fill:'backwards',easing:'cubic-bezier(.16,1,.3,1)'});
  }
 },{threshold:.08});
 document.querySelectorAll('.product-card').forEach(card=>cardObserver.observe(card));
}
window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener('change',event=>{if(event.matches){cardObserver?.disconnect();document.getAnimations().forEach(animation=>animation.cancel());}});
function animatePane(el){if(!el?.animate||reduced())return;el.getAnimations?.().forEach(animation=>animation.cancel());el.animate([{opacity:.92},{opacity:1}],{duration:180,easing:'ease-out'});}
function matches(){const q=state.query.trim().toLocaleLowerCase('ru');let rows=all.filter(t=>{
if(state.operator&&t.operator!==state.operator)return false;
if(state.category&&!t.categories?.includes(state.category))return false;
if(state.scenario==='number'&&!t.categories?.some(x=>['На свой номер','Переход с номером'].includes(x)))return false;
if(state.scenario==='router'&&!t.deviceTags?.includes('Модем / роутер'))return false;
if(state.scenario==='tablet'&&!t.deviceTags?.includes('Планшет'))return false;
if(state.scenario==='phone'&&t.deviceTags?.length&&!t.deviceTags.includes('Смартфон'))return false;
if(state.package==='internet'&&t.gb!==-1&&!(t.gb>=100))return false;
if(state.package==='calls'&&t.min!==-1&&!(t.min>=2000))return false;
if(state.maxfee!==''&&(t.fee==null||(t.feeMax??t.fee)>Number(state.maxfee)))return false;
if(state.mingb!==''&&(t.gb==null||(t.gb!==-1&&t.gb<Number(state.mingb))))return false;
if(state.minminutes!==''&&(t.min==null||(t.min!==-1&&t.min<Number(state.minminutes))))return false;
return !q||[t.name,t.operator,t.region,t.feeText,t.trafficText,t.minutesText,...(t.facts||[]),...(t.notes||[])].join(' ').toLocaleLowerCase('ru').includes(q);
});if(state.sort!=='original')rows.sort((a,b)=>a.fee==null?(b.fee==null?0:1):b.fee==null?-1:state.sort==='asc'?a.fee-b.fee:b.fee-a.fee);return rows;}
function operatorColor(op){return op==='Билайн'?'#8a6900':brandStyles[op]?.[0]||'#181818';}
function renderOperators(){
 const container=$('operators');
 if(!container.children.length)container.innerHTML=['',...ops].map(op=>`<button class="op" data-op="${esc(op)}" style="--operator-color:${operatorColor(op)}">${op&&!plainOperator(op)?`<img alt="" src="${esc(logo(op))}">`:''}<span>${esc(op||'Любой оператор')}</span><span class="selection-mark">${icon('check')}</span></button>`).join('');
 container.querySelectorAll('[data-op]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.op===state.operator)));
}
function render(){renderOperators();const rows=matches();const scen={all:'Все сценарии',phone:'Для телефона',number:'Со своим номером',router:'Для роутера',tablet:'Для планшета'};$('results').textContent=`Найдено ${rows.length} из ${all.length} · ${scen[state.scenario]}`;
$('cards').innerHTML=rows.length?rows.slice(0,state.limit).map(card).join(''):`<div class="empty"><h3>По этим условиям тарифов нет</h3><p>Попробуйте другого оператора, увеличьте бюджет или сбросьте подбор. Неизвестная совместимость не считается подтверждённой.</p><button class="primary" data-reset>Сбросить подбор</button></div>`;
$('more').hidden=rows.length<=state.limit;renderSummary(rows);renderHero(rows);revealCards();}
function renderHero(rows){
 const featured=rows.find(t=>t.fee>0&&t.gb!=null&&t.min!=null)||rows[0];
 const container=$('hero-display');
 if(!container.querySelector('.hero-sim'))container.innerHTML=`<button class="hero-sim"><span class="preview-logo"></span><span class="preview-package"><span class="hero-traffic"></span><small class="hero-minutes"></small></span><span class="preview-price"><strong class="hero-fee"></strong><small>Условия ${icon('arrow')}</small></span></button><p class="hero-no-results" hidden>Измените параметры — найдём другое предложение</p>`;
 const button=container.querySelector('.hero-sim');button.hidden=!featured;container.querySelector('.hero-no-results').hidden=!!featured;
 if(featured){button.dataset.detail=featured.id;button.setAttribute('aria-label','Условия: '+featured.name);const mark=button.querySelector('.preview-logo');if(mark.dataset.operator!==featured.operator){mark.innerHTML=operatorMark(featured.operator);mark.dataset.operator=featured.operator;}button.querySelector('.hero-traffic').textContent=featured.trafficLabel||featured.trafficText||'Интернет уточняется';button.querySelector('.hero-minutes').textContent=featured.minutesLabel||featured.minutesText||'Минуты уточняются';button.querySelector('.hero-fee').textContent=featured.feeLabel||featured.feeText||'Плата уточняется';}
 document.querySelectorAll('[data-quick-scenario]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.quickScenario===state.scenario)));
 const link=document.querySelector('.hero-next');link.href=state.scenario==='all'?'#catalog':'#route';link.firstChild.textContent=state.scenario==='all'?'К тарифам ':'Продолжить ';
 document.querySelector('.selection').hidden=state.scenario==='all';
}
function renderSummary(rows){const t=rows.find(x=>x.fee>0&&x.gb!=null&&x.min!=null)||rows.find(x=>x.fee>0)||rows[0];if(!t){$('route-summary').innerHTML='<div><p>Ваш маршрут</p><h3 class="summary-heading">Изменим пару параметров?</h3><p class="route-empty">Сейчас совпадений нет. Попробуйте другую сеть или вернитесь на шаг назад.</p></div><button class="route-reset" data-reset>Начать подбор заново</button>';return;}
$('route-summary').innerHTML=`<div><div class="summary-topline">${operatorMark(t.operator)}<p>Один из ${rows.length}<br>подходящих вариантов</p></div><h3 class="summary-heading">${esc(t.name)}</h3><div class="summary-numbers"><div><strong>${esc(t.trafficLabel||t.trafficText||'Уточняется')}</strong><small>интернета</small></div><div><strong>${esc(t.minutesLabel||t.minutesText||'Уточняется')}</strong><small>разговоров</small></div></div></div><div><p class="summary-fee-label">Абонентская плата</p><p class="summary-fee">${esc(t.feeLabel||t.feeText||'Уточняется')}</p><p class="summary-caption">Подключение уточняется отдельно.<br>${state.scenario==='router'?'Совместимость с роутером указана в карточке; ограничения — в описании.':'Регион и ограничения — в описании.'}</p><div class="summary-bottom"><button data-detail="${t.id}">Условия ${icon('arrow')}</button><a href="#catalog">Все тарифы</a></div></div>`;}

function renderWizard(motion=false){
 const steps=$('steps');if(!steps.children.length)steps.innerHTML=['Задача','Оператор','Пакет'].map((name,i)=>`<span class="step"><i>${i+1}</i>${name}</span>`).join('');
 [...steps.children].forEach((el,i)=>{el.classList.toggle('active',i===state.step);el.classList.toggle('done',i<state.step);if(i===state.step)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
 const pane=$('step-pane');const changed=pane.dataset.step!==String(state.step);
 if(changed){
 if(state.step===0)pane.innerHTML=`<h2>Для чего нужна связь?</h2><div class="choices">${[['phone','smartphone','Для телефона','Интернет и разговоры'],['tablet','deviceTablet','Для планшета','Большой экран'],['router','router','Для роутера','Дом, дача, работа'],['number','sim','На свой номер','Сохранить привычное']].map(([id,ic,title,sub])=>`<button class="choice" data-scenario="${id}"><span class="choice-icon">${icon(ic)}</span><strong>${title}</strong><small>${sub}</small><span class="selection-mark">${icon('check')}</span></button>`).join('')}</div><p class="stage-note"></p>`;
 else if(state.step===1)pane.innerHTML=`<h2>Выберите оператора</h2><div class="op-choices">${['',...ops].map(op=>`<button class="op-choice" data-wop="${esc(op)}" style="--operator-color:${operatorColor(op)}">${op&&!plainOperator(op)?`<img alt="" src="${esc(logo(op))}">`:icon(op?'sim':'signal')}<span>${esc(op||'Любая сеть')}</span><span class="selection-mark">${icon('check')}</span></button>`).join('')}</div><p class="stage-note">Проверьте покрытие выбранной сети в вашем регионе</p>`;
 else pane.innerHTML=`<h2>Что важнее в тарифе?</h2><div class="package-choices">${[['all','Баланс','Любой объём интернета и минут'],['internet','Интернет','От 100 ГБ или безлимит'],['calls','Разговоры','От 2000 минут или безлимит']].map(([id,title,sub])=>`<button class="package" data-package="${id}"><strong>${title}</strong><small>${sub}</small><span class="selection-mark">${icon('check')}</span></button>`).join('')}</div><p class="stage-note">Бюджет, гигабайты и минуты можно уточнить в каталоге</p>`;
 pane.dataset.step=String(state.step);
 }
 pane.querySelectorAll('[data-scenario]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scenario===state.scenario)));
 pane.querySelectorAll('[data-wop]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.wop===state.operator)));
 pane.querySelectorAll('[data-package]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.package===state.package)));
 if(state.step===0)pane.querySelector('.stage-note').textContent=['router','tablet'].includes(state.scenario)?'Показываем предложения с явно указанной совместимостью':'Возможность подключения и совместимость уточняются по каждому тарифу';
 $('back').disabled=state.step===0;$('next').innerHTML=(state.step===2?'Показать тарифы':'Дальше')+icon('arrow');
 if(changed&&motion)animatePane(pane);
}
let statusTimer;function notify(message){$('status').textContent=message;clearTimeout(statusTimer);statusTimer=setTimeout(()=>$('status').textContent='',4000);}
function restoreControlFocus(previous){if(previous?.isConnected){previous.focus({preventScroll:true});return;}let replacement;if(previous?.dataset.save)replacement=document.querySelector(`[data-save="${Number(previous.dataset.save)}"]`);else if(previous?.dataset.detail){const kind=previous.classList.contains('hero-sim')?'.hero-sim':previous.classList.contains('hero-second')?'.hero-second':'.product-art';replacement=document.querySelector(`${kind}[data-detail="${Number(previous.dataset.detail)}"]`);}if(!replacement)replacement=$('basket');replacement.focus({preventScroll:true});}
let modalTrigger,scrollLock;
function lockPage(){if(scrollLock)return;const root=document.documentElement,body=document.body;scrollLock={x:scrollX,y:scrollY,body:body.getAttribute('style'),root:root.getAttribute('style')};root.style.overflow='hidden';root.style.scrollbarGutter='stable';Object.assign(body.style,{position:'fixed',top:-scrollLock.y+'px',left:-scrollLock.x+'px',width:'100%',overflow:'hidden'});}
function unlockPage(){if(!scrollLock)return;const saved=scrollLock;scrollLock=null;for(const [el,value] of [[document.body,saved.body],[document.documentElement,saved.root]]){if(value===null)el.removeAttribute('style');else el.setAttribute('style',value);}const behavior=document.documentElement.style.scrollBehavior;document.documentElement.style.scrollBehavior='auto';window.scrollTo(saved.x,saved.y);document.documentElement.style.scrollBehavior=behavior;}
function open(html){
 const modal=$('modal'),opening=!modal.open;
 if(opening){modalTrigger=document.activeElement;lockPage();}
 $('modalcontent').innerHTML=html;
 const title=$('modaltitle');
 if(title)title.tabIndex=-1;
 if(opening){modal.showModal();(title||$('close')).focus({preventScroll:true});}
}
function close(){$('modal').close();}
$('modal').addEventListener('close',()=>{if(!$('modal').open){unlockPage();restoreControlFocus(modalTrigger);}});

function characteristics(t){
 const rows=[['Территория действия',t.region||'Не указана — уточняется перед подключением'],['Вариант подключения',(t.categories||[]).join(' / ')||'Уточняется'],['Интернет-трафик',t.trafficText||'Уточняется'],['Пакет минут',t.minutesText||'Уточняется'],['SMS',t.sms||'Не указаны'],['Поддерживаемые устройства',t.device||'Совместимость уточняется'],['Абонентская плата',t.feeText||t.feeLabel||'Уточняется'],['Стоимость подключения','В исходной карточке не указана. Уточняется отдельно.']];
 const groups=[['Раздача интернета',/раздач|wi.?fi|вай.?фай/i],['Скорость и ограничения',/скорост|мбит|кбит|торрент|torrent|vpn|ограничен.*интернет/i],['Оформление и регистрация',/паспорт|оформл|регистрац|активац|саморег/i],['Платежи и баланс',/списан|баланс|пополн|абонент|плат[аеёж]/i],['Дополнительные условия',/.*/]];
 for(const [label,pattern] of groups){const facts=(t.facts||[]).filter(fact=>pattern.test(fact)&&!groups.slice(0,groups.findIndex(x=>x[0]===label)).some(([,previous])=>previous.test(fact)));if(facts.length)rows.push([label,facts]);}
 return `<dl class="characteristics">${rows.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${Array.isArray(value)?value.map(x=>`<p>${esc(x)}</p>`).join(''):esc(value)}</dd></div>`).join('')}</dl>`;
}
function detail(id){const t=all.find(t=>t.id===Number(id));if(!t)return;const table=t.regionalTable;open(`<div class="detail-intro">${operatorMark(t.operator)}<div><p>${esc(t.operator)}</p><h2 id="modaltitle">${esc(t.name)}</h2></div></div><div class="detail-price"><strong>${esc(t.feeLabel||t.feeText||'Плата уточняется')}</strong><span>Подключение уточняется отдельно</span></div><div class="detail-actions"><button class="primary" data-apply>Оставить заявку ${icon("arrow")}</button><button class="detail-save" data-save="${t.id}">${chosen.has(t.id)?"Убрать из выбора":"Сохранить тариф"}</button></div><h3 class="characteristics-title">Характеристики тарифа</h3>${characteristics(t)}${table?`<h3>Региональные условия из карточки</h3><div class="tablewrap"><table><thead><tr>${table.headers.map(x=>`<th scope="col">${esc(x)}</th>`).join('')}</tr></thead><tbody>${table.rows.map(row=>`<tr>${row.map(x=>`<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:''}<h3>Важно перед подключением</h3><ul class="condition-notes">${(t.notes||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul><a class="source" href="assets/${esc(t.source)}" target="_blank" rel="noopener">Открыть исходную карточку ${icon('arrow')}</a>${window.TARIFF_REQUESTS.form(t)}`);window.TARIFF_REQUESTS.init();}
function basket(){open(`<h2 id="modaltitle">Мой выбор · ${chosen.size}</h2>${chosen.size?all.filter(t=>chosen.has(t.id)).map(t=>`<div class="basketrow"><p><strong>${esc(t.name)}</strong>${esc(t.feeLabel||t.feeText)}<br><small>Подключение уточняется отдельно</small></p><button data-remove="${t.id}">Убрать</button></div>`).join(''):'<p>Здесь появятся сохранённые тарифы. Откройте каталог и нажмите значок сумки рядом с понравившимся вариантом.</p>'}<p class="notice">Ваш выбор хранится до перезагрузки страницы. Откройте условия выбранного тарифа, чтобы оставить заявку.</p>`);}
function reset(){Object.assign(state,{operator:'',scenario:'all',package:'all',query:'',category:'',sort:'original',maxfee:'',mingb:'',minminutes:'',limit:9,step:0});for(const id of ['search','category','maxfee','mingb','minminutes'])$(id).value='';$('sort').value='original';render();renderWizard();document.dispatchEvent(new Event('tariff-filter-reset'));}
function refreshSavedControls(){
 $('basketcount').textContent=chosen.size;
 document.querySelectorAll('[data-save]').forEach(button=>{const id=Number(button.dataset.save),selected=chosen.has(id);button.setAttribute('aria-pressed',String(selected));if(button.classList.contains('save')){button.innerHTML=icon(selected?'check':'bag');const t=all.find(t=>t.id===id);button.setAttribute('aria-label',(selected?'Убрать из выбора ':'Сохранить тариф ')+(t?.name||''));}else button.textContent=selected?'Убрать из выбора':'Сохранить тариф';});
}
function add(id){chosen.add(Number(id));refreshSavedControls();}
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
document.addEventListener('click',event=>{const b=event.target.closest('button');if(!b){const card=event.target.closest('[data-tariff-id]');if(card)detail(card.dataset.tariffId);return;}
if(b.dataset.quickScenario){state.scenario=b.dataset.quickScenario;state.step=1;state.limit=9;render();renderWizard();b.focus({preventScroll:true});}
if(b.dataset.op!==undefined){state.operator=b.dataset.op;state.limit=9;render();renderWizard();}
if(b.dataset.wop!==undefined){state.operator=b.dataset.wop;state.limit=9;render();renderWizard();}
if(b.dataset.scenario){state.scenario=b.dataset.scenario;state.limit=9;render();renderWizard();}
if(b.dataset.package){state.package=b.dataset.package;state.limit=9;render();renderWizard();}
if(b.dataset.detail)detail(b.dataset.detail);
if(b.hasAttribute("data-apply")){document.querySelector(".request-panel").scrollIntoView({behavior:reduced()?"auto":"smooth",block:"start"});$("request-name").focus({preventScroll:true});}
if(b.dataset.save){const id=Number(b.dataset.save);if(chosen.has(id)){chosen.delete(id);notify('Тариф убран из выбора');}else{chosen.add(id);notify('Тариф сохранён');}refreshSavedControls();}
if(b.dataset.remove){chosen.delete(Number(b.dataset.remove));refreshSavedControls();basket();const target=$('modalcontent').querySelector('[data-remove]')||$('modalcontent').querySelector('h2');if(target){target.tabIndex=-1;target.focus();}}
if(b.hasAttribute('data-reset')||b.id==='reset')reset();
const focusAttribute=['data-op','data-wop','data-scenario','data-package'].find(key=>b.hasAttribute(key));if(focusAttribute){const next=[...document.querySelectorAll('['+focusAttribute+']')].find(el=>el.getAttribute(focusAttribute)===b.getAttribute(focusAttribute));next?.focus({preventScroll:true});}
if(b.dataset.contact)open(`<h2 id="modaltitle">Связаться через ${esc(b.dataset.contact)}</h2><p>Канал пока не подключён: реальная ссылка не предоставлена. Эта кнопка показывает оформление будущего контакта.</p><p>Сообщение не отправляется. Пока можно подобрать тариф и сохранить свой выбор локально.</p>`);
});
$('next').onclick=()=>{if(state.step<2){if(state.scenario==='all'){notify('Выберите, для чего нужна связь');document.querySelector('[data-scenario]')?.focus();return;}state.step++;renderWizard(true,1);render();}else{$('catalog').scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'});notify(`Подобрано вариантов: ${matches().length}. Сравните условия ниже.`);}};
$('back').onclick=()=>{if(state.step>0){state.step--;renderWizard(true,-1);}};
for(const id of ['search','maxfee','mingb','minminutes'])$(id).addEventListener('input',event=>{state[id==='search'?'query':id]=event.target.value;state.limit=9;render();});
$('category').onchange=event=>{state.category=event.target.value;state.limit=9;render();};$('sort').onchange=event=>{state.sort=event.target.value;render();};$('more').onclick=()=>{state.limit+=9;render();};$('basket').onclick=basket;$('close').onclick=close;
$('menu-toggle').onclick=()=>{const expanded=$('menu-toggle').getAttribute('aria-expanded')!=='true';$('menu-toggle').setAttribute('aria-expanded',String(expanded));$('mobile-menu').classList.toggle('open',expanded);};
$('mobile-menu').addEventListener('click',event=>{if(event.target.closest('a')){$('mobile-menu').classList.remove('open');$('menu-toggle').setAttribute('aria-expanded','false');}});
$('modal').addEventListener('click',event=>{if(event.target===$('modal')){const box=$('modal').getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)close();}});

const channels=[['Telegram','telegram'],['VK','vk'],['WhatsApp','whatsapp'],['MAX','max']];
function socialButtons(labels=false){return channels.map(([name,key])=>`<button class="social social-${key}" data-contact="${name}" aria-label="Связаться через ${name}" title="${name}">${key==='max'?'<img src="assets/max.svg" alt="">':icon(key)}</button>`).join('');}
document.querySelectorAll('.head-actions').forEach(group=>{group.querySelectorAll('[data-contact]').forEach(el=>el.remove());group.insertAdjacentHTML('afterbegin',socialButtons());});
document.querySelectorAll('.footer .socials').forEach(group=>group.innerHTML=socialButtons(true));
$('mobile-menu').insertAdjacentHTML('beforeend','<div class="mobile-socials">'+socialButtons(true)+'</div>');
$('modal').setAttribute('aria-labelledby','modaltitle');
$('hero-operators').innerHTML=ops.map(op=>`<span>${operatorMark(op)}${plainOperator(op)?'':`<span class="operator-name">${esc(op)}</span>`}</span>`).join('');
render();renderWizard();
const linkedTariff=new URLSearchParams(location.search).get('tariff');
if(linkedTariff&&/^\d+$/.test(linkedTariff))detail(Number(linkedTariff));

window.DESIGN_QA={selectOperator(name){state.operator=name;state.limit=64;render();renderWizard();},search(query){state.query=query;state.limit=64;$('search').value=query;render();},reset,openDetails:detail,openCart:basket,add,cartCount(){return chosen.size;},getVisibleIds(){return Array.from(document.querySelectorAll('[data-tariff-id]'),el=>Number(el.dataset.tariffId));}};
