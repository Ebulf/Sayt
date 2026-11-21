function activeReceivers_(){const group=PropertiesService.getScriptProperties().getProperty('TELEGRAM_GROUP_ID');if(group)return [group];return catalogBook_().getSheetByName('Получатели').getDataRange().getValues().slice(1).filter(row=>row[2]===true).map(row=>String(row[0]));}
function telegramSend_(chat,text,extra={}){const token=PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');if(!token)throw Error('Нет ключа Telegram.');const response=UrlFetchApp.fetch('https://api.telegram.org/bot'+token+'/sendMessage',{method:'post',contentType:'application/json',payload:JSON.stringify({chat_id:chat,text,link_preview_options:{is_disabled:true},protect_content:true,...extra}),muteHttpExceptions:true});return response.getResponseCode()===200&&JSON.parse(response.getContentText()).ok===true;}
function telegramRequestText_(row){
 const text=value=>String(value??'').replace(/^'(?=[=+@-])/,'');
 if(row[15]!=='telegram-full-v1')return 'Новая заявка '+text(row[1])+'\n'+text(row[12])+'\nКонтакты клиента — в закрытой таблице:\n'+requestSheet_().getParent().getUrl();
 const channels={phone:'Позвонить',telegram:'Telegram',whatsapp:'WhatsApp'};
 return ['Новая заявка '+text(row[1]),'', 'Тариф: '+text(row[12]),'Оператор: '+text(row[11]),'Абонентская плата: '+text(row[13]),'', 'Имя: '+text(row[4]),'Телефон: '+text(row[5]),'Регион: '+text(row[6]),'Связь: '+(channels[row[7]]||text(row[7])),row[8]?'Telegram: @'+text(row[8]).replace(/^@/,''):'',row[9]?'Комментарий: '+text(row[9]):'', '', 'Тариф на сайте: '+text(row[16])].filter((line,i,lines)=>line||lines[i-1]).join('\n');
}
function notifyRequest_(sheet,row){
 const owner=PropertiesService.getScriptProperties().getProperty('TELEGRAM_CHAT_ID'),values=sheet.getRange(row,1,1,19).getValues()[0];
 const targets=values[17]?JSON.parse(values[17]):owner?[owner]:[],delivered=values[18]?JSON.parse(values[18]):[],active=activeReceivers_(),message=telegramRequestText_(values);
 for(const chat of targets){if(delivered.includes(chat))continue;if(!active.includes(chat)){delivered.push(chat);continue;}if(sendRequestCard_(sheet,row,chat,values,message)){delivered.push(chat);sheet.getRange(row,19).setValue(JSON.stringify(delivered));}}
 sheet.getRange(row,15).setValue(targets.length&&targets.every(chat=>delivered.includes(chat))?'Доставлено':targets.length?'Ожидает':'Нет получателей');
}
function pollTelegram(){
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
 try{const props=PropertiesService.getScriptProperties(),token=props.getProperty('TELEGRAM_BOT_TOKEN');if(!token)return;
 const offset=Number(props.getProperty('TELEGRAM_OFFSET')||0),response=UrlFetchApp.fetch('https://api.telegram.org/bot'+token+'/getUpdates?offset='+offset+'&limit=100',{muteHttpExceptions:true});if(response.getResponseCode()!==200)return;
 const updates=JSON.parse(response.getContentText()).result||[];
 for(const update of updates){try{acceptTelegramUpdate_(update);}catch(_){return;}props.setProperty('TELEGRAM_OFFSET',String(update.update_id+1));}
 }finally{lock.releaseLock();}
}
function acceptTelegramUpdate_(update){
 if(update.callback_query){handleRequestButton_(update.callback_query);return;}
 if(update.message&&/^\/connect(?:@EbulfTarifyRequestsBot)?$/.test(update.message.text||'')){connectRequestGroup_(update.message);return;}
 const message=update.message;if(!message||message.chat?.type!=='private'||typeof message.text!=='string')return;
 const chat=String(message.chat.id),book=catalogBook_(),sheet=book.getSheetByName('Получатели'),receivers=sheet.getDataRange().getValues(),existing=receivers.findIndex((row,index)=>index>0&&String(row[0])===chat);
 if(message.text==='/stop'){if(existing>0)sheet.getRange(existing+1,3).setValue(false);telegramSend_(chat,'Уведомления отключены. Для повторного подключения попросите владельца выдать новую служебную ссылку.');return;}
 if(!message.text.startsWith('/start'))return;
 const match=message.text.match(/^\/start(?:@[A-Za-z0-9_]+)?\s+([a-f0-9]{32})$/);
 if(!match){telegramSend_(chat,existing>0&&receivers[existing][2]===true?'Уведомления уже подключены. Новые заявки будут приходить сюда.':'Этот бот предназначен для сотрудников. Попросите владельца сайта прислать служебную ссылку подключения.');return;}
 const hash=Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,match[1])),invites=book.getSheetByName('Приглашения'),rows=invites.getDataRange().getValues(),index=rows.findIndex((row,i)=>i>0&&row[0]===hash);
 if(index<0||Number(rows[index][2])<Date.now()||rows[index][3]&&String(rows[index][3])!==chat){telegramSend_(chat,'Ссылка недействительна или уже использована. Попросите владельца выдать новую.');return;}
 if(existing>0)sheet.getRange(existing+1,3).setValue(true);else sheet.appendRow([chat,String(rows[index][1]),true,new Date().toISOString()]);
 invites.getRange(index+1,4).setValue(chat);SpreadsheetApp.flush();telegramSend_(chat,'Уведомления подключены. Новые заявки будут приходить вам и владельцу сайта. В уведомлениях будут тариф, контакты клиента и комментарий. Не передавайте их посторонним.');
}
