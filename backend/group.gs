function telegramApi_(method,payload){
 const token=PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
 const response=UrlFetchApp.fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'post',contentType:'application/json',payload:JSON.stringify(payload),muteHttpExceptions:true});
 const body=JSON.parse(response.getContentText());if(response.getResponseCode()!==200||!body.ok)throw Error('Telegram временно недоступен.');return body.result;
}
function privateRequestGroup_(chat){const info=telegramApi_('getChat',{chat_id:chat});if(!info||!['group','supergroup'].includes(info.type)||info.username)throw Error('Нужна закрытая группа.');return info;}
function connectRequestGroup_(message){
 const props=PropertiesService.getScriptProperties();if(String(message.from?.id)!==props.getProperty('TELEGRAM_CHAT_ID'))return;
 if(!['group','supergroup'].includes(message.chat.type))return;
 privateRequestGroup_(message.chat.id);props.setProperty('TELEGRAM_GROUP_ID',String(message.chat.id));
 const sheet=requestSheet_();sheet.getRange('D2:D').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Новая','В работе','Связались','Завершена','Оформляем','Подключён','Отказ'],true).setAllowInvalid(false).build());sheet.getRange(1,20,1,3).setValues([['Сообщение Telegram','Ответственный Telegram','Изменён статус']]);
 telegramSend_(message.chat.id,'Группа подключена. Новые заявки будут приходить сюда с контактами и кнопками. Доступ к заявкам есть у участников этой закрытой группы. Добавляйте только сотрудников.');
}
function requestButtons_(values){
 const status=values[3],id=values[0];let buttons=[];
 if(status==='Новая')buttons=[{text:'Взять в работу',callback_data:'req:'+id+':w'}];
 if(status==='В работе')buttons=[{text:'Связались',callback_data:'req:'+id+':c'}];
 if(status==='Связались')buttons=[{text:'Завершена',callback_data:'req:'+id+':d'}];
 return {inline_keyboard:buttons.length?[buttons]:[]};
}
function requestCardText_(values){return telegramRequestText_(values)+'\n\nСтатус: '+values[3]+(values[20]?'\nОтветственный: '+values[20]:'');}
function sendRequestCard_(sheet,row,chat,values,message){
 if(String(chat)!==PropertiesService.getScriptProperties().getProperty('TELEGRAM_GROUP_ID'))return telegramSend_(chat,message);
 privateRequestGroup_(chat);
 const result=telegramApi_('sendMessage',{chat_id:chat,text:requestCardText_(values),reply_markup:requestButtons_(values),protect_content:true,link_preview_options:{is_disabled:true}});
 if(!result?.message_id)throw Error('Не подтверждено сообщение Telegram.');sheet.getRange(row,20).setValue(String(result.message_id));return true;
}
function handleRequestButton_(query){
 const answer=text=>{try{telegramApi_('answerCallbackQuery',{callback_query_id:query.id,text});}catch(_){};};
 const chat=String(query.message?.chat?.id||''),props=PropertiesService.getScriptProperties(),match=String(query.data||'').match(/^req:([a-f0-9-]{36}):([wcd])$/);
 if(!match||chat!==props.getProperty('TELEGRAM_GROUP_ID')||query.from?.is_bot){answer('Нет доступа.');return;}
 privateRequestGroup_(chat);const member=telegramApi_('getChatMember',{chat_id:chat,user_id:query.from.id});
 if(!['creator','administrator','member'].includes(member?.status)&&!(member?.status==='restricted'&&member.is_member)){answer('Нет доступа.');return;}
 const sheet=requestSheet_(),rows=sheet.getDataRange().getValues(),index=rows.findIndex((row,i)=>i>0&&row[0]===match[1]);
 if(index<1){answer('Заявка не найдена.');return;}const values=rows[index];
 if(String(values[19])!==String(query.message.message_id)||!JSON.parse(values[17]||'[]').includes(chat)){answer('Эта карточка неактуальна.');return;}
 const next={w:'В работе',c:'Связались',d:'Завершена'}[match[2]],previous={w:'Новая',c:'В работе',d:'Связались'}[match[2]],actor=String(query.from.id);
 const assigned=String(values[20]||'').split(' ')[0];
 if(assigned&&actor!==assigned&&actor!==props.getProperty('TELEGRAM_CHAT_ID')){answer('Заявку уже ведёт другой сотрудник.');return;}
 if(values[3]!==next){if(values[3]!==previous){answer('Статус уже изменён.');return;}
  const who=values[20]||actor+' '+String(query.from.first_name||'Сотрудник').replace(/[\r\n]/g,' ').slice(0,80);
  sheet.getRange(index+1,21,1,2).setValues([[who,new Date().toISOString()]]);sheet.getRange(index+1,4).setValue(next);SpreadsheetApp.flush();values[3]=next;values[20]=who;
 }
 try{telegramApi_('editMessageText',{chat_id:chat,message_id:query.message.message_id,text:requestCardText_(values),reply_markup:requestButtons_(values),link_preview_options:{is_disabled:true}});}catch(_){answer('Статус сохранён. Нажмите кнопку повторно для обновления карточки.');return;}
 answer('Статус: '+next);
}
