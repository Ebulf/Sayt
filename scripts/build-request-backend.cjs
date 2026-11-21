const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'assets/content.js'),'utf8'),context);
const catalog=Object.fromEntries(context.window.CONTENT.tariffs.map(t=>[t.id,t]));
fs.mkdirSync(path.join(root,'reports'),{recursive:true});
const seed='const CATALOG_SEED = '+JSON.stringify(catalog)+';\n';
const read=name=>fs.readFileSync(path.join(root,'backend',name),'utf8');
fs.writeFileSync(path.join(root,'reports/request-backend.gs'),seed+read('catalog.gs')+'\n'+read('requests.gs')+'\n'+read('telegram.gs')+'\n'+read('group.gs'));
console.log('Prepared live catalog and request backend with '+Object.keys(catalog).length+' original tariffs.');
