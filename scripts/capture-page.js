// Turns the page you are looking at into a test fixture for Wandel's conversation replays, with every word blanked.
// Paste into the browser console (DevTools → Console) on the page, then press Enter. A file downloads:
// wandel-capture-<host>-<time>.html. Only structure and looks are kept: text becomes placeholder letters of the same
// length, images and links are emptied, form values and scripts are removed. Words listed in KEEP stay readable,
// so a test can say "the card labelled My Record". Check the file before sharing it.
(()=>{
 const KEEP=(window.WANDEL_KEEP||['My Record','Activity 4','Activity 5','Plan and Setup']).map(w=>w.toLowerCase());
 const props=['display','visibility','position','top','right','bottom','left','z-index','flex-direction','flex-wrap','flex-grow','flex-shrink','justify-content','align-items','gap','grid-template-columns','font-size','font-weight','font-family','line-height','color','background-color','background-image','border','border-radius','box-shadow','padding','margin','width','height','max-width','min-height','text-align','text-transform','opacity','overflow'];
 const blank=(text)=>{const lower=text.toLowerCase();if(KEEP.some(k=>lower.trim()===k||lower.includes(k)&&lower.trim().length<=k.length+12))return text;
  return text.replace(/[A-Za-z]/g,c=>c===c.toUpperCase()?'X':'x').replace(/\d/g,'0');};
 const source=[document.body,...document.body.querySelectorAll('*')];
 const copy=document.body.cloneNode(true),copies=[copy,...copy.querySelectorAll('*')];
 source.forEach((el,i)=>{const d=copies[i];if(!d||el.closest('svg')&&el.tagName.toLowerCase()!=='svg')return;const cs=getComputedStyle(el);
  d.setAttribute('style',props.map(p=>{let v=cs.getPropertyValue(p);if(p==='background-image'&&/url\(/.test(v))v='none';return v&&!['normal','auto','none','0px','rgba(0, 0, 0, 0)'].includes(v)||p==='display'?p+':'+v:'';}).filter(Boolean).join(';'));});
 copy.querySelectorAll('script,noscript,iframe,link,style,template,object,embed,video,audio,canvas').forEach(n=>n.remove());
 copy.querySelectorAll('img').forEach(n=>{n.removeAttribute('srcset');n.setAttribute('src','data:image/gif;base64,R0lGODlhAQABAAAAACw=');});
 copy.querySelectorAll('input,textarea,select').forEach(n=>{n.removeAttribute('value');if(n.tagName==='TEXTAREA')n.textContent='';});
 copy.querySelectorAll('*').forEach(n=>{for(const a of [...n.attributes]){const name=a.name.toLowerCase();
  if(name==='style'||name==='class'||name==='id'||name==='role'||name==='type'||name.startsWith('aria-')&&!['aria-label','aria-description','aria-valuetext'].includes(name))continue;
  if(name==='href'){n.setAttribute('href','#');continue;}
  if(['aria-label','aria-description','aria-valuetext','title','alt','placeholder','value','label'].includes(name)){n.setAttribute(name,blank(a.value));continue;}
  if(name.startsWith('data-')||name==='src'||name==='action'||name==='name'||name==='for'||name==='tabindex'||name==='disabled'||name==='checked'||name==='selected')continue;
  n.removeAttribute(a.name);}});
 const walker=document.createTreeWalker(copy,NodeFilter.SHOW_TEXT);for(let t=walker.nextNode();t;t=walker.nextNode())t.data=blank(t.data);
 copy.querySelectorAll('[data-dx-owned],[data-dx-ignore]').forEach(n=>n.remove());
 const path=location.pathname.replace(/\d{3,}/g,'N')+location.search.replace(/=([^&]*)/g,(m,v)=>'='+(/^\d+$/.test(v)?v:'x'));
 const html='<!-- '+location.origin+path+' -->\n'+copy.outerHTML.replace(/^<body/,'<div data-site-root').replace(/<\/body>$/,'</div>');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([html],{type:'text/html'}));a.download='wandel-capture-'+location.hostname+'-'+Date.now()+'.html';document.body.append(a);a.click();a.remove();
 return 'Saved '+Math.round(html.length/1024)+' KB with every word blanked except: '+KEEP.join(', ');
})();
