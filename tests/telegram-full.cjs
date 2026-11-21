const assert=require('node:assert/strict'),{fixture}=require('./apps-script-fixture.cjs');
const f=fixture(),c=f.context();c.run('reports/request-backend.gs');c.setupCatalog();
const row=['uuid','K-261121-test',new Date(),'Новая','Иван <test>',"'+79991234567",'Москва','telegram',"'@test_user",'=Тестовый комментарий',1001,'МегаФон','Тестовый тариф','250 ₽/мес','Ожидает','telegram-full-v1','https://ebulf.github.io/Sayt/?tariff=1001','["10"]','[]'];
const text=c.telegramRequestText_(row);for(const value of ['Иван <test>','+79991234567','Москва','@test_user','=Тестовый комментарий','250 ₽/мес','Тестовый тариф'])assert(text.includes(value));assert(!text.includes("'+799"));assert(!text.includes('docs.google.com'));
const sheet=f.book.getSheetByName('Заявки');sheet.appendRow(row);c.notifyRequest_(sheet,2);assert.equal(c.sent[0].text,text);assert.equal(c.sent[0].protect_content,true);assert(!c.sent[0].parse_mode);assert.equal(sheet.rows[1][14],'Доставлено');
const old=[...row];old[15]='Согласие на обработку контактов для ответа на заявку';assert(!c.telegramRequestText_(old).includes('Иван'));assert(!c.telegramRequestText_(old).includes('+7999'));
const long=[...row];long[4]='Я'.repeat(80);long[9]='😀'.repeat(1000);assert(c.telegramRequestText_(long).length<4096);
console.log('PASS: full Telegram request, phone restored, plain text safe, private delivery, old consent keeps contact details hidden, maximum payload fits.');
