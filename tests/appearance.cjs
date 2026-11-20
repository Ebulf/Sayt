// Capture actual browser rendering, including Chromium's forced dark mode.
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'reports');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const profile=path.join(out,'appearance-profile');fs.mkdirSync(profile,{recursive:true});
 const portFile=path.join(profile,'DevToolsActivePort');if(fs.existsSync(portFile))fs.unlinkSync(portFile);
 const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--allow-file-access-from-files','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 let ws;
 try{
  for(let i=0;i<100&&!fs.existsSync(portFile);i++)await sleep(100);
  const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
  const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
  let seq=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){const{resolve,reject}=pending.get(m.id);pending.delete(m.id);m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result);}};
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>(await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true})).result.value;
  await call('Page.enable');
  const report=[];
  for(const dark of [false,true]){
   await call('Emulation.setAutoDarkModeOverride',{enabled:dark});
   await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
   await call('Page.navigate',{url:process.env.REVIEW_URL||'file:///'+root.replaceAll('\\','/')+'/index.html'});
   await sleep(600);await evaluate('document.fonts.ready.then(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))))');await sleep(700);
   const prefix=(process.argv[2]||'appearance')+(dark?'-forced-dark':'-normal');
   const capture=async name=>fs.writeFileSync(path.join(out,prefix+name+'.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
   await capture('-hero');
   if(!dark&&process.argv.includes('--motion')){
    for(const reduced of [false,true]){
     await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'}]});
     const folder=path.join(out,reduced?'hero-reduced':'hero-normal');fs.mkdirSync(folder,{recursive:true});
     await evaluate(`(()=>{const els=[...document.querySelectorAll('.campaign-image,.campaign-copy h1,.campaign-copy>p,.hero-display')];els.forEach(e=>e.style.animation='none');void document.body.offsetWidth;els.forEach(e=>e.style.animation='');})()`);
     const start=Date.now(),frames=[];
     for(const ms of [0,120,300,600,900,1800,4900]){
      await sleep(Math.max(0,ms-(Date.now()-start)));
      const active=await evaluate('document.getAnimations().map(a=>({name:a.animationName,state:a.playState,time:a.currentTime}))');
      fs.writeFileSync(path.join(folder,'frame-'+ms+'.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
      frames.push({time:Date.now()-start,active});
     }
     fs.writeFileSync(path.join(folder,'report.json'),JSON.stringify({reduced,frames},null,2));
    }
    await call('Emulation.setEmulatedMedia',{features:[]});
   }
   await evaluate('document.documentElement.style.scrollBehavior="auto";window.scrollTo(0,document.querySelector(".operator-ribbon").offsetTop-30)');await sleep(600);
   const logos=await evaluate('JSON.stringify([...document.querySelectorAll(".hero-operators img")].map(i=>({name:i.alt,loaded:i.complete&&i.naturalWidth>0,rect:i.getBoundingClientRect().toJSON()})))');
   await capture('-logos');
   report.push({dark,logos:JSON.parse(logos),colorScheme:await evaluate('getComputedStyle(document.documentElement).colorScheme')});
   if(!dark){await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await evaluate('window.scrollTo(0,0)');await sleep(500);await capture('-mobile');}
  }
  fs.writeFileSync(path.join(out,(process.argv[2]||'appearance')+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report.map(r=>({dark:r.dark,colorScheme:r.colorScheme,loaded:r.logos.every(x=>x.loaded)}))));
 }finally{ws?.close();chrome.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
