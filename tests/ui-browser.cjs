// Capture actual browser rendering, including Chromium's forced dark mode.
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'reports');
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fixture=fs.readFileSync(path.join(root,'index.html'),'utf8').replace('<head>','<head><base href="../">').replace('<script src="catalog.js','<script>const originalFetch=window.fetch.bind(window);window.fetch=(url,options)=>String(url).includes("?action=catalog")?Promise.resolve({ok:true,json:async()=>({ok:true,tariffs:window.CONTENT.tariffs})}):originalFetch(url,options);</script><script src="catalog.js');fs.writeFileSync(path.join(out,'ui-preview.html'),fixture);

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
  const results=[];
  for(const width of [1920,1440,768,500,390,320]){
   await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
   await call('Page.navigate',{url:'file:///'+root.replaceAll('\\','/')+'/reports/ui-preview.html'});await sleep(900);await evaluate('document.fonts.ready');
   const assert=async(expression,label)=>{if(!await evaluate(expression))throw Error(label+' '+width);results.push(label+' '+width)};
   await assert('document.documentElement.scrollWidth<=innerWidth','no page overflow');
   await assert('getComputedStyle(document.querySelector(".operator-ribbon")).display==="none"','duplicate operator ribbon hidden');
   await assert('getComputedStyle(document.querySelector(".campaign-copy h1")).fontSize===getComputedStyle(document.querySelector(".campaign-copy h1 span")).fontSize','headline lines same size');
   await assert('document.getElementById("search").offsetHeight===document.getElementById("sort-control").offsetHeight','filter heights consistent');
   fs.writeFileSync(path.join(out,'ui-hero-'+width+'.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
   await evaluate('document.getElementById("sort-control").click();document.getElementById("sort-control").scrollIntoView({block:"center"})');
   await assert('document.getElementById("sort-options").hidden===false','sort list opens');
   fs.writeFileSync(path.join(out,'ui-filter-'+width+'.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
   await call('Input.dispatchKeyEvent',{type:'keyDown',key:'End',code:'End'});await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter'});
   await assert('document.getElementById("sort").value==="desc"','keyboard chooses descending');
   await evaluate('document.getElementById("reset").click()');await assert('document.getElementById("sort-value").textContent==="Как в каталоге"','reset syncs label');
   await evaluate('document.documentElement.style.scrollBehavior="auto";window.scrollTo(0,600)');const before=await evaluate('scrollY');
   await evaluate('DESIGN_QA.openDetails(CONTENT.tariffs[0].id)');
   await assert('document.body.style.position==="fixed"','background locked');
   await assert('document.activeElement.id==="modaltitle"','dialog initially focuses title');
   await assert('getComputedStyle(document.getElementById("close")).borderTopWidth==="0px"','close button has no double frame');
   fs.writeFileSync(path.join(out,'ui-dialog-top-'+width+'.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
   await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8});
   await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8});
   await assert('document.activeElement.id==="close" && document.activeElement.matches(":focus-visible")','keyboard can reach close button with visible focus');

   const top=await evaluate('document.querySelector(".campaign-copy").getBoundingClientRect().top');
   await call('Input.dispatchMouseEvent',{type:'mouseWheel',x:Math.round(width/2),y:400,deltaY:650,deltaX:0});await sleep(180);
   await assert('document.getElementById("modal").scrollTop>0','dialog scrolls');
   await assert('document.querySelector(".campaign-copy").getBoundingClientRect().top==='+top,'background remains still');
   fs.writeFileSync(path.join(out,'ui-modal-'+width+'.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
   await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await sleep(120);
   await assert('!document.getElementById("modal").open && document.body.style.position!=="fixed"','Escape unlocks');
   await assert('Math.abs(scrollY-'+before+')<2','scroll position restored');
  }
  fs.writeFileSync(path.join(out,'ui-verification.json'),JSON.stringify({status:'PASS',results},null,2));console.log(JSON.stringify({status:'PASS',checks:results.length,widths:[1920,1440,768,500,390,320]}));
 }finally{ws?.close();chrome.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
