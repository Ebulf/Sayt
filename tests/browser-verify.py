from pathlib import Path
import html
import json
import re
import sys
import subprocess
import tempfile

root = Path(__file__).resolve().parent.parent
test = r'''
<script>
window.addEventListener('load', async () => {
 const checks=[];
 const assert=(ok,label)=>{if(!ok)throw Error(label);checks.push(label)};
 const d=document, q=window.DESIGN_QA;
 try {
 await document.fonts.ready;
 assert(document.fonts.check('400 16px Onest')&&document.fonts.check('700 64px "Golos Text"'),'actual local typefaces loaded');
 for(const scenario of ['phone','tablet','router','number']) {
  q.reset();d.querySelector(`[data-scenario="${scenario}"]`).click();
  assert(d.activeElement.dataset.scenario===scenario,scenario+' keyboard focus retained');
  d.getElementById('next').click();assert(d.querySelector('[data-wop]'),scenario+' operator step');
  d.querySelector('[data-wop="Т2"]').click();d.getElementById('next').click();
  assert(d.querySelector('[data-package]'),scenario+' package step');
 }
 q.reset();
 for(const width of [320,390,768,1024,1440]) {
  const frame=d.createElement('iframe');frame.style.cssText=`width:${width}px;height:900px;border:0`;frame.src='index.html';
  const ready=new Promise(resolve=>frame.onload=resolve);d.body.append(frame);await ready;await frame.contentDocument.fonts.ready;
  const fw=frame.contentWindow, fd=frame.contentDocument;
  for(const op of new Set(CONTENT.tariffs.map(t=>t.operator))) {
   fw.DESIGN_QA.selectOperator(op);
   assert(fd.querySelectorAll('.product-card').length>0,op+' cards '+width);
   for(const el of fd.querySelectorAll('.traffic-value,.art-fee,.device-strip,.device,.hero-fee,.hero-traffic'))
    if(el.scrollWidth>el.clientWidth+1)throw Error(width+' '+op+' overflow: '+el.className+' '+el.textContent+' '+el.scrollWidth+'/'+el.clientWidth);
   for(const glyph of fd.querySelectorAll('.device-glyph'))assert(fw.getComputedStyle(glyph).backgroundColor==='rgb(255, 255, 255)',op+' visible device icon '+width);
   assert(fd.documentElement.scrollWidth<=width+1,op+' no horizontal overflow '+width);
  }
  frame.remove();
 }
 for(const scenario of ['phone','tablet','router','number']){q.reset();d.querySelector('[data-quick-scenario="'+scenario+'"]').click();assert(d.querySelector('[data-wop]'),'quick '+scenario+' opens operator step');assert(d.activeElement.dataset.quickScenario===scenario,'quick '+scenario+' focus stays visible');const featuredId=Number(d.querySelector('.hero-sim').dataset.detail);assert(q.getVisibleIds().includes(featuredId),'hero offer matches '+scenario);if(['router','tablet'].includes(scenario))assert(CONTENT.tariffs.find(t=>t.id===featuredId).deviceTags.includes(scenario==='router'?'Модем / роутер':'Планшет'),'hero confirmed device '+scenario);assert(d.querySelector('[data-quick-scenario="'+scenario+'"]').getAttribute('aria-pressed')==='true','quick '+scenario+' selected');}
 q.reset();const operatorNodes=[...d.querySelectorAll('[data-op]')];for(const button of operatorNodes){const before=button.getBoundingClientRect();button.click();assert(d.querySelectorAll('[data-op]')[operatorNodes.indexOf(button)]===button,'operator node preserved '+button.dataset.op);assert(d.activeElement===button,'operator focus preserved '+button.dataset.op);const style=getComputedStyle(button);assert(parseFloat(style.borderWidth)>=2,'operator selection border '+button.dataset.op);assert(style.borderColor!=='rgb(221, 221, 221)','operator border colored '+button.dataset.op);assert(getComputedStyle(button.querySelector('.selection-mark')).visibility==='visible','operator selection check '+button.dataset.op);const after=button.getBoundingClientRect();assert(before.width===after.width&&before.height===after.height,'operator size stable '+button.dataset.op);}
 q.reset();d.querySelector('[data-quick-scenario="phone"]').click();const preview=d.querySelector('.hero-sim');const wizardButton=d.querySelector('[data-wop="МТС"]');for(let i=0;i<10;i++)wizardButton.click();assert(wizardButton===d.querySelector('[data-wop="МТС"]'),'rapid choices preserve control');assert(preview===d.querySelector('.hero-sim'),'rapid choices preserve offer preview');assert(d.getElementById('step-pane').getAnimations().length===0,'no restarting wizard animations on operator selection');
 q.reset();const start=d.querySelector('.closing a');const startTarget=d.querySelector(start.getAttribute('href'));assert(startTarget&&startTarget.getBoundingClientRect().height>0,'closing action points to visible selector');if(matchMedia('(prefers-reduced-motion: reduce)').matches)assert(d.getAnimations().length===0,'reduced motion disables animations');
 q.reset();const faq=d.querySelector('.faq summary');faq.click();assert(faq.parentElement.open,'FAQ opens');faq.click();assert(!faq.parentElement.open,'FAQ closes');
 const trigger=d.querySelector('.product-art');trigger.focus();trigger.click();
 assert(d.querySelector('dialog').open,'native detail dialog opens');
 assert(d.getElementById('modalcontent').scrollHeight>0,'detail visible');
 d.getElementById('close').click();await new Promise(r=>setTimeout(r,50));
 assert(d.activeElement===trigger,'dialog restores keyboard focus');
 const save=d.querySelector('[data-save]');const saveId=save.dataset.save;save.focus();save.click();assert(d.activeElement.dataset.save===saveId,'save keeps keyboard focus');d.getElementById('basket').click();
 assert(d.querySelector('[data-remove]'),'saved tariff appears');
 d.querySelector('[data-remove]').click();assert(q.cartCount()===0,'saved tariff removal');
 d.getElementById('close').click();
 const hero=d.querySelector('.hero-sim');const heroId=hero.dataset.detail;hero.focus();hero.click();d.querySelector('#modalcontent [data-save]').click();d.getElementById('close').click();await new Promise(r=>setTimeout(r,50));assert(d.activeElement.classList.contains('hero-sim')&&d.activeElement.dataset.detail===heroId,'hero dialog restores replacement focus '+d.activeElement.tagName+' '+d.activeElement.className+' '+JSON.stringify(d.activeElement.dataset));const focusStyle=getComputedStyle(d.activeElement);assert(parseFloat(focusStyle.outlineWidth)>=3,'offer preview visible keyboard focus');
 d.querySelector('[data-contact="WhatsApp"]').click();
 assert(d.querySelector('dialog').open&&d.getElementById('modalcontent').textContent.includes('не подключён'),'contact honestly explains missing URL');
 document.body.innerHTML='<pre id="browser-result">'+JSON.stringify({status:'PASS',checks})+'</pre>';
 } catch(e) { document.body.innerHTML='<pre id="browser-result">'+JSON.stringify({status:'FAIL',error:e.message,checks})+'</pre>'; }
});
</script>
'''
(root/'reports').mkdir(exist_ok=True)
entry = root / 'reports/browser-review.html'
entry.write_text((root/'index.html').read_text(encoding='utf-8').replace('<head>','<head><base href="../">').replace('</body>',test+'</body>'),encoding='utf-8')
profile = tempfile.mkdtemp(prefix='tarify-browser-')
run = subprocess.run([
 'C:/Program Files/Google/Chrome/Application/chrome.exe',
 '--headless=new','--disable-gpu','--no-first-run',*(['--force-prefers-reduced-motion'] if '--reduced' in sys.argv else []),
 '--allow-file-access-from-files','--window-size=1440,900',
 '--virtual-time-budget=25000','--dump-dom','--user-data-dir='+profile,
 entry.as_uri()
],capture_output=True,text=True,encoding='utf-8',timeout=35)
match = re.search(r'<pre id="browser-result">(.*?)</pre>',run.stdout,re.S)
if not match:
 raise RuntimeError('Chrome did not complete the browser checks: '+run.stderr[-1000:])
result=json.loads(html.unescape(match.group(1)))
(root/('reports/browser-verification-reduced.json' if '--reduced' in sys.argv else 'reports/browser-verification.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
if result['status']!='PASS':
 raise SystemExit(1)
