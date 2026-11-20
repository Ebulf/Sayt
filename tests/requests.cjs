const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.resolve(__dirname,'..'),checks=[];
function backendChecks(){
 const rows=[[]],cache=new Map();let locked=false,failWrite=false,notifyFails=true;
 const range=(row,col,count=1)=>({
  createTextFinder:needle=>({matchEntireCell(){return this},findNext(){const index=rows.findIndex((r,i)=>i>0&&r[col-1]===needle);return index<0?null:{getRow:()=>index+1};}}),
  getValue:()=>rows[row-1][col-1],setValue:value=>{rows[row-1][col-1]=value;}
 });
 const sheet={getLastRow:()=>rows.length,getRange:range,appendRow:row=>{if(failWrite)throw Error('storage');rows.push(row);},getParent:()=>({getUrl:()=> 'https://docs.google.com/spreadsheets/d/test'}),getDataRange:()=>({getValues:()=>rows})};
 const context={console,PropertiesService:{getScriptProperties:()=>({getProperty:key=>({SPREADSHEET_ID:'test',TELEGRAM_BOT_TOKEN:'test-token',TELEGRAM_CHAT_ID:'test-chat'}[key])})},SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush(){}},LockService:{getScriptLock:()=>({tryLock(){assert(!locked);locked=true;return true;},releaseLock(){locked=false;}})},CacheService:{getScriptCache:()=>({get:key=>cache.get(key),put:(key,value)=>cache.set(key,value)})},Utilities:{DigestAlgorithm:{SHA_256:'sha'},computeDigest:phone=>phone,base64EncodeWebSafe:value=>value,formatDate:(_,zone,format)=>format==='yyMMdd'?'261121':'2026112100'},UrlFetchApp:{fetch:()=>{if(notifyFails)throw Error('offline');return{getResponseCode:()=>200,getContentText:()=>'{"ok":true}'};}},ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>text})}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'reports/request-backend.gs'),'utf8'),context);
 const catalog=vm.runInContext('TARIFF_CATALOG',context),id=Number(Object.keys(catalog)[0]);assert.equal(Object.keys(catalog).length,64);
 const data={requestId:'11111111-1111-4111-8111-111111111111',tariffId:id,name:'Тестовая заявка',phone:'+70000000000',region:'Тестовый регион',channel:'telegram',handle:'test_user',comment:'ТЕСТ. Не обрабатывать.',consent:true,fee:'1',tariff:'подмена'};
 const post=value=>JSON.parse(context.doPost({postData:{contents:typeof value==='string'?value:JSON.stringify(value)}}));
 for(const patch of [{consent:false},{name:' '},{region:''},{phone:'111'},{phone:'letters1234567890'},{tariffId:'__proto__'},{tariffId:-1},{requestId:'bad'},{website:'spam'},{handle:'bad space'},{comment:'=x'.repeat(501)}])assert.equal(post({...data,...patch}).ok,false);
 assert.equal(post('{').code,'invalid');assert.equal(post('x'.repeat(8001)).code,'invalid');assert.equal(rows.length,1);checks.push('server rejects invalid contacts, unknown tariff, missing consent, spam and oversized payloads');
 const accepted=post(data);assert.equal(accepted.ok,true);assert.equal(rows.length,2);assert.equal(rows[1][12],catalog[id].name);assert.equal(rows[1][13],catalog[id].fee);assert.equal(rows[1][14],'Ожидает');assert.equal(locked,false);checks.push('canonical tariff and fee, durable save before notification');
 assert.equal(post(data).reference,accepted.reference);assert.equal(rows.length,2);assert.equal(post({...data,requestId:'22222222-2222-4222-8222-222222222222'}).code,'rate');checks.push('duplicate requests return same reference; phone rate limit');
 notifyFails=false;context.retryNotifications();assert.equal(rows[1][14],'Доставлено');checks.push('failed Telegram notification retried from saved row');
 assert.equal(context.cellText_('=IMPORTXML("x")'),'\'=IMPORTXML("x")');assert.equal(context.cellText_('+70000000000'),"'+70000000000");checks.push('spreadsheet formula injection prevented');
 failWrite=true;cache.clear();const failed=post({...data,requestId:'33333333-3333-4333-8333-333333333333'});assert.equal(failed.ok,false);assert.equal(locked,false);assert.equal(rows.length,2);checks.push('storage failure never reports accepted and releases lock');
 const health=JSON.parse(context.doGet());assert.deepEqual(health,{ok:true,service:'tariff-requests'});checks.push('public endpoint never returns customer details');
}
async function frontendChecks(){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=await JSDOM.fromFile(path.join(root,'index.html'),{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.matchMedia=()=>({matches:false,addEventListener(){}});w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLElement.prototype.animate=()=>({cancel(){}});}});
 await new Promise(resolve=>dom.window.addEventListener('load',resolve,{once:true}));
 try{
  const w=dom.window,d=w.document,q=w.DESIGN_QA,first=w.CONTENT.tariffs[0];w.REQUEST_CONFIG={endpoint:""};q.openDetails(first.id);
  assert(d.querySelector('.request-submit').disabled);assert(d.querySelector('#request-status').textContent.includes('не отправляются'));checks.push('unconfigured preview cannot send or falsely confirm a request');
  w.REQUEST_CONFIG={endpoint:'https://script.google.com/macros/s/test-deployment/exec'};
  let calls=[],resolveFetch;w.fetch=(url,options)=>{calls.push({url,payload:JSON.parse(options.body)});return new Promise(resolve=>resolveFetch=resolve);};
  const fill=()=>{const f=d.querySelector('#tariff-request');Object.assign(f.elements.name,{value:'Тестовая заявка'});f.elements.phone.value='+70000000000';f.elements.region.value='Тестовый регион';f.elements.consent.checked=true;f.dispatchEvent(new w.Event('input',{bubbles:true}));return f;};
  q.openDetails(first.id);let form=d.querySelector('#tariff-request');form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(calls.length,0);
  form=fill();form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(calls.length,1);assert.equal(calls[0].payload.tariffId,first.id);assert(form.elements.name.disabled);form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(calls.length,1);
  d.querySelector('#close').click();q.openDetails(first.id);form=d.querySelector('#tariff-request');assert.equal(form.elements.name.value,'Тестовая заявка');assert(form.elements.name.disabled);checks.push('pending form survives closing and reopening; double submit prevented');
  resolveFetch({ok:true,json:async()=>({ok:true,reference:'K-261121-11111111'})});await new Promise(r=>setTimeout(r,20));assert(d.querySelector('.request-success'));assert.equal(d.activeElement.className,'request-success');checks.push('only server acknowledgement shows success and accessible request reference');
  q.openDetails(first.id);assert(d.querySelector('.request-success'));const second=w.CONTENT.tariffs[1];q.openDetails(second.id);form=fill();w.fetch=async()=>{throw Error('network');};form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,10));assert(!d.querySelector('.request-success'));assert(d.querySelector('.request-error'));assert.equal(form.elements.name.value,'Тестовая заявка');assert(!form.elements.name.disabled);
  const requestId=form.dataset.requestId;q.openDetails(second.id);form=d.querySelector('#tariff-request');assert.equal(form.dataset.requestId,requestId);assert.equal(form.elements.name.value,'Тестовая заявка');checks.push('network failure keeps draft and same idempotency key for retry');
  assert.deepEqual(errors,[]);
 }finally{dom.window.close();}
}
(async()=>{backendChecks();await frontendChecks();const report={status:'PASS',checks};fs.writeFileSync(path.join(root,'reports/request-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));})().catch(error=>{console.error(error);process.exitCode=1;});
