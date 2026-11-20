const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'assets/content.js'),'utf8'),context);
const catalog=Object.fromEntries(context.window.CONTENT.tariffs.map(t=>[t.id,{operator:t.operator,name:t.name,fee:t.feeLabel||t.feeText}]));
fs.mkdirSync(path.join(root,'reports'),{recursive:true});
fs.writeFileSync(path.join(root,'reports/request-backend.gs'),'const TARIFF_CATALOG = '+JSON.stringify(catalog,null,2)+';\n\n'+fs.readFileSync(path.join(root,'backend/requests.gs'),'utf8'));
console.log('Prepared Apps Script backend with '+Object.keys(catalog).length+' real tariffs.');
