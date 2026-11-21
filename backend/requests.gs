// Run setupRequests once as the spreadsheet owner, then deploy as a web app.
// CATALOG_SEED is used only for the first migration; the active catalog lives in the private sheet.
const REQUEST_HEADERS = ['ID', 'Номер заявки', 'Дата', 'Статус', 'Имя', 'Телефон', 'Регион', 'Связь', 'Telegram', 'Комментарий', 'ID тарифа', 'Оператор', 'Тариф', 'Абонентская плата', 'Уведомление', 'Согласие', 'Ссылка на тариф'];

function setupRequests() {
 const properties = PropertiesService.getScriptProperties();
 let id = properties.getProperty('SPREADSHEET_ID');
 const book = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.create('Тарифы от Кристины — заявки');
 properties.setProperty('SPREADSHEET_ID', book.getId());
 let sheet = book.getSheetByName('Заявки');
 if (!sheet) sheet = book.insertSheet('Заявки');
 if (!sheet.getLastRow()) sheet.appendRow(REQUEST_HEADERS);
 sheet.setFrozenRows(1);
 sheet.getRange(1, 1, 1, REQUEST_HEADERS.length).setBackground('#b71932').setFontColor('#ffffff').setFontWeight('bold');
 sheet.getRange('D2:D').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Новая', 'В работе', 'Связались', 'Завершена', 'Оформляем', 'Подключён', 'Отказ'], true).setAllowInvalid(false).build());
 [100,170,150,130,180,150,160,110,140,280,85,120,280,170,130,200,300].forEach((width,index)=>sheet.setColumnWidth(index+1,width));
 sheet.getRange(1,1,sheet.getMaxRows(),REQUEST_HEADERS.length).setWrap(true);
 sheet.setRowHeight(1,40);
 if(!sheet.getFilter())sheet.getRange(1,1,sheet.getMaxRows(),REQUEST_HEADERS.length).createFilter();
 if (!ScriptApp.getProjectTriggers().some(trigger => trigger.getHandlerFunction() === 'retryNotifications')) ScriptApp.newTrigger('retryNotifications').timeBased().everyMinutes(5).create();
 console.log('Таблица заявок: ' + book.getUrl());
 return book.getUrl();
}

function requestSheet_() {
 const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
 if (!id) throw Error('unavailable');
 const sheet = SpreadsheetApp.openById(id).getSheetByName('Заявки');
 if (!sheet) throw Error('unavailable');
 return sheet;
}

function cleanText_(value, max) {
 if (typeof value !== 'string' || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) throw Error('invalid');
 return value.trim();
}

function cellText_(value) { return /^[\s]*[=+\-@]/.test(value) ? "'" + value : value; }

function validateRequest_(data) {
 if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('invalid');
 if (data.website) throw Error('invalid');
 if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(data.requestId || '')) throw Error('invalid');
 if (data.consent !== true) throw Error('invalid');
 const name = cleanText_(data.name, 80), phone = cleanText_(data.phone, 25), region = cleanText_(data.region, 100);
 if (!name || !region || !/^\+?[\d\s()-]+$/.test(phone) || !/^\d{10,15}$/.test(phone.replace(/\D/g, ''))) throw Error('invalid');
 if (!['phone','telegram','whatsapp'].includes(data.channel)) throw Error('invalid');
 const handle = cleanText_(data.handle || '', 40), comment = cleanText_(data.comment || '', 1000);
 if (!name || !region || data.consent !== true || !/^\+?[\d\s()-]+$/.test(phone) || phone.replace(/\D/g,'').length < 10 || phone.replace(/\D/g,'').length > 15) throw Error('invalid');
 if (handle && !/^@?[A-Za-z0-9_]{5,32}$/.test(handle)) throw Error('invalid');
 if (!Number.isSafeInteger(data.tariffId) || data.tariffId<1) throw Error('tariff');
 return {requestId:data.requestId.toLowerCase(), name, phone, region, channel:data.channel, handle, comment, tariffId:Number(data.tariffId),privacyVersion:data.privacyVersion==='telegram-full-v1'?'telegram-full-v1':''};
}

function doGet(event) {
 if(event?.parameter?.action==='catalog'){try{return json_({ok:true,tariffs:catalogRows_().filter(row=>row.status==='active').map(row=>row.tariff)});}catch(_){return json_({ok:false,code:'unavailable'});}}
 // No endpoint exposes application rows or customer details.
 return json_({ok:true, service:'tariff-requests'});
}

function doPost(event) {
 try {
  if (!event || !event.postData || event.postData.contents.length > 8000) throw Error('invalid');
  let data; try { data=JSON.parse(event.postData.contents); } catch (_) { throw Error('invalid'); }
  const result = storeRequest_(validateRequest_(data));
  return json_({ok:true, reference:result.reference});
 } catch (error) {
  const code = ['invalid','tariff','rate','unavailable'].includes(error.message) ? error.message : 'unavailable';
  return json_({ok:false, code});
 }
}

function storeRequest_(request) {
 const lock = LockService.getScriptLock();
 if (!lock.tryLock(15000)) throw Error('unavailable');
 let sheet, row, reference;
 try {
  sheet = requestSheet_();
  const existing = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow()-1, 1).createTextFinder(request.requestId).matchEntireCell(true).findNext() : null;
  if (existing) return {reference:String(sheet.getRange(existing.getRow(), 2).getValue())};
  request.tariff=activeTariff_(request.tariffId);
  const cache = CacheService.getScriptCache();
  const phoneKey = 'phone:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, request.phone.replace(/\D/g, '')));
  if (cache.get(phoneKey)) throw Error('rate');
  const hour = Utilities.formatDate(new Date(), 'UTC', 'yyyyMMddHH'), countKey='volume:' + hour;
  const count = Number(cache.get(countKey) || 0);
  if (count >= 100) throw Error('unavailable');
  reference = 'K-' + Utilities.formatDate(new Date(), 'Europe/Moscow', 'yyMMdd') + '-' + request.requestId.slice(0,8);
  const values = [request.requestId, reference, new Date(), 'Новая', request.name, request.phone, request.region, request.channel, request.handle, request.comment, request.tariffId, request.tariff.operator, request.tariff.name, request.tariff.feeLabel||request.tariff.feeText, 'Ожидает', request.privacyVersion||'Согласие на обработку контактов для ответа на заявку', 'https://ebulf.github.io/Sayt/?tariff=' + request.tariffId, JSON.stringify(activeReceivers_()),'[]'];
  sheet.appendRow(values.map(value => typeof value === 'string' ? cellText_(value) : value));
  SpreadsheetApp.flush(); row = sheet.getLastRow();
  cache.put(phoneKey, '1', 60); cache.put(countKey, String(count+1), 3600);
  // Keep the delivery lock until the per-recipient acknowledgement is saved.
  // Notification failure never reverses an already saved application.
  try { notifyRequest_(sheet, row); } catch (_) {}
 } finally { lock.releaseLock(); }
 return {reference};
}

function retryNotifications() {
 const lock = LockService.getScriptLock(); if (!lock.tryLock(1000)) return;
 try {
  const sheet=requestSheet_(), rows=sheet.getDataRange().getValues(); let sent=0;
  for (let index=1; index<rows.length && sent<20; index++) {
   if (rows[index][14] !== 'Ожидает') continue;
   try { notifyRequest_(sheet,index+1,rows[index][1],rows[index][12]); } catch (_) {}
   sent++;
  }
 } finally { lock.releaseLock(); }
}

function json_(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }
