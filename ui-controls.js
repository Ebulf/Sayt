'use strict';
(() => {
 const widgets=[];
 for(const id of ['category','sort']){
  const select=document.getElementById(id),label=document.querySelector(`label[for="${id}"]`);
  const wrap=document.createElement('div');wrap.className='filter-select';select.before(wrap);
  const trigger=document.createElement('button');trigger.type='button';trigger.id=id+'-control';trigger.setAttribute('role','combobox');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls',id+'-options');
  if(label){label.id=id+'-label';label.htmlFor=trigger.id;trigger.setAttribute('aria-labelledby',label.id+' '+id+'-value');}
  const value=document.createElement('span');value.id=id+'-value';trigger.append(value);trigger.insertAdjacentHTML('beforeend','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>');
  const list=document.createElement('div');list.id=id+'-options';list.className='filter-options';list.setAttribute('role','listbox');list.setAttribute('aria-label',label?.textContent||id);list.hidden=true;
  const options=[...select.options].map((option,index)=>{const item=document.createElement('div');item.className='filter-option';item.id=id+'-option-'+index;item.setAttribute('role','option');item.tabIndex=-1;item.append(document.createTextNode(option.textContent));item.insertAdjacentHTML('beforeend','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m5 12 4 4 10-10"/></svg>');item.onclick=()=>choose(index);list.append(item);return item;});
  function sync(){value.textContent=select.options[select.selectedIndex]?.textContent||'';options.forEach((item,index)=>item.setAttribute('aria-selected',String(index===select.selectedIndex)));}
  function close(focus=false){list.hidden=true;trigger.setAttribute('aria-expanded','false');if(focus)trigger.focus({preventScroll:true});}
  function show(){widgets.forEach(widget=>widget.close());sync();list.hidden=false;trigger.setAttribute('aria-expanded','true');options[Math.max(0,select.selectedIndex)].focus({preventScroll:true});}
  function choose(index){select.selectedIndex=index;select.dispatchEvent(new Event('change',{bubbles:true}));sync();close(true);}
  trigger.onclick=()=>list.hidden?show():close();trigger.onkeydown=event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();show();}};
  list.onkeydown=event=>{const index=options.indexOf(document.activeElement);let target=index;if(event.key==='ArrowDown')target=Math.min(index+1,options.length-1);else if(event.key==='ArrowUp')target=Math.max(0,index-1);else if(event.key==='Home')target=0;else if(event.key==='End')target=options.length-1;else if(event.key==='Enter'||event.key===' '){event.preventDefault();choose(index);return;}else if(event.key==='Escape'){event.preventDefault();close(true);return;}else if(event.key==='Tab'){close(true);return;}else return;event.preventDefault();options[target].focus({preventScroll:true});};
  select.hidden=true;select.tabIndex=-1;wrap.append(trigger,list);select.addEventListener('change',sync);widgets.push({close,sync});sync();
  document.addEventListener('pointerdown',event=>{if(!wrap.contains(event.target))close();});
 }
 document.addEventListener('tariff-filter-reset',()=>widgets.forEach(widget=>{widget.close();widget.sync();}));
})();
