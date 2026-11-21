const CATALOG_HEADERS = ['ID','Статус','Версия','Изменён','Данные'];
const CATALOG_OPERATORS = ['МегаФон','Т2','МТС','Билайн','Yota','М-сеть','Миранда'];
const CATALOG_CATEGORIES = ['На свой номер','Переход с номером','Новая SIM-карта'];
const CATALOG_DEVICES = ['Смартфон','Планшет','Модем / роутер','Умные устройства'];
function catalogBook_(){const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');if(!id)throw Error('Хранилище не подключено.');return SpreadsheetApp.openById(id);}
function catalogSheet_(){const sheet=catalogBook_().getSheetByName('Каталог');if(!sheet)throw Error('Каталог ещё не подготовлен.');return sheet;}
function catalogRows_(){const rows=catalogSheet_().getDataRange().getValues();return rows.slice(1).filter(row=>row[0]).map((row,index)=>({row:index+2,id:Number(row[0]),status:String(row[1]),revision:Number(row[2]),updatedAt:String(row[3]),tariff:JSON.parse(row[4])}));}
function activeTariff_(id){const entry=catalogRows_().find(item=>item.id===id&&item.status==='active');if(!entry)throw Error('tariff');return entry.tariff;}
function setupCatalog(){
 const book=catalogBook_();let sheet=book.getSheetByName('Каталог');
 if(!sheet){sheet=book.insertSheet('Каталог');sheet.appendRow(CATALOG_HEADERS);const now=new Date().toISOString();const rows=Object.values(CATALOG_SEED).map(t=>[t.id,'active',1,now,JSON.stringify(t)]);sheet.getRange(2,1,rows.length,5).setValues(rows);sheet.setFrozenRows(1);sheet.setColumnWidth(5,500);sheet.getRange(1,1,1,5).setBackground('#b71932').setFontColor('white');}
 let receivers=book.getSheetByName('Получатели');if(!receivers){receivers=book.insertSheet('Получатели');receivers.appendRow(['Чат','Имя','Включён','Добавлен']);const owner=PropertiesService.getScriptProperties().getProperty('TELEGRAM_CHAT_ID');if(owner)receivers.appendRow([owner,'Владелец',true,new Date().toISOString()]);receivers.setFrozenRows(1);}
 if(!book.getSheetByName('Приглашения'))book.insertSheet('Приглашения').appendRow(['Хеш','Имя','Срок','Использовано']);
 const requests=book.getSheetByName('Заявки');requests.getRange(1,18,1,2).setValues([['Получатели заявки','Доставлено в чаты']]);
 if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='pollTelegram'))ScriptApp.newTrigger('pollTelegram').timeBased().everyMinutes(1).create();
 console.log('Каталог подготовлен: '+catalogRows_().length+' тарифов.');
}
function validateTariff_(input,original){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Некорректная карточка.');
 const text=(key,max,required=false)=>{const value=typeof input[key]==='string'?input[key].trim():'';if(value.length>max||(required&&!value)||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))throw Error('Проверьте поле «'+key+'».');return value;};
 const number=(key,unlimited=false)=>{if(input[key]===null||input[key]==='')return null;const value=Number(input[key]);if(!Number.isFinite(value)||value>1000000||value<0&&!(unlimited&&value===-1))throw Error('Проверьте число «'+key+'».');return value;};
 const list=(key,allowed)=>{const value=input[key];if(!Array.isArray(value)||value.length>allowed.length||value.some(x=>!allowed.includes(x)))throw Error('Проверьте варианты «'+key+'».');return [...new Set(value)];};
 const lines=key=>{if(!Array.isArray(input[key])||input[key].length>100||input[key].some(x=>typeof x!=='string'||x.length>2000))throw Error('Слишком длинные условия.');return input[key].map(x=>x.trim()).filter(Boolean);};
 const operator=text('operator',50,true);if(!CATALOG_OPERATORS.includes(operator))throw Error('Выберите оператора.');
 const tariff=Object.assign({},original||{}, {name:text('name',180,true),operator,fee:number('fee'),feeMax:number('feeMax'),setup:number('setup'),gb:number('gb',true),min:number('min',true),sms:text('sms',200),region:text('region',3000),categories:list('categories',CATALOG_CATEGORIES),deviceTags:list('deviceTags',CATALOG_DEVICES),facts:lines('facts'),notes:lines('notes')});
 if(tariff.fee!==null&&tariff.feeMax!==null&&tariff.feeMax<tariff.fee)throw Error('Верхняя цена меньше нижней.');
 const derived=(key,unchanged,automatic)=>{const value=text(key,3000);return original&&unchanged&&value===String(original[key]||'')?automatic:value;};
 const feeAuto=tariff.fee===null?'Уточняется':tariff.feeMax!==null&&tariff.feeMax!==tariff.fee?tariff.fee+'–'+tariff.feeMax+' ₽/мес':tariff.fee+' ₽/мес';
 tariff.feeLabel=tariff.fee===null?'Уточняется':tariff.feeMax!==null&&tariff.feeMax!==tariff.fee?tariff.fee+'–'+tariff.feeMax+' ₽/мес':tariff.fee+' ₽/мес';tariff.feeText=derived('feeText',original?.feeText===original?.feeLabel,feeAuto)||tariff.feeLabel;
 tariff.trafficLabel=tariff.gb===-1?'Безлимит':tariff.gb===null?'Уточняется':tariff.gb+' ГБ';tariff.trafficText=derived('trafficText',[original?.trafficLabel,'Безлимитный интернет'].includes(original?.trafficText),tariff.gb===-1?'Безлимитный интернет':tariff.trafficLabel)||tariff.trafficLabel;
 tariff.minutesLabel=tariff.min===-1?'Безлимит':tariff.min===null?'Уточняется':tariff.min+' мин';tariff.minutesText=derived('minutesText',original?.minutesText===original?.minutesLabel,tariff.minutesLabel)||tariff.minutesLabel;
 tariff.setupText=text('setupText',3000);tariff.setupLabel=tariff.setup===null?'Стоимость подключения':tariff.setup+' ₽';
 tariff.category=tariff.categories[0]||'Условия в описании';tariff.device=derived('device',original?.device===(original?.deviceTags||[]).join(', ')||original?.device==='Совместимость уточняется',tariff.deviceTags.join(', ')||'Совместимость уточняется')||(tariff.deviceTags.join(', ')||'Совместимость уточняется');
 if(input.regionalTable!==null){const table=input.regionalTable;if(!table||!Array.isArray(table.headers)||table.headers.length>12||!Array.isArray(table.rows)||table.rows.length>100||[table.headers,...table.rows].some(row=>!Array.isArray(row)||row.length!==table.headers.length||row.some(cell=>typeof cell!=='string'||cell.length>1000)))throw Error('Проверьте региональную таблицу.');tariff.regionalTable=table;}else delete tariff.regionalTable;
 if(!original){tariff.source='';tariff.available=null;tariff.checkedAt=new Date().toISOString().slice(0,10);}
 if(JSON.stringify(tariff).length>40000)throw Error('Описание слишком длинное.');return tariff;
}
