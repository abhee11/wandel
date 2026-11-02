/** Runs each assistant action kind through the real apply path and checks the rendered result and Undo. */
export {};
const w=window as any;
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
w.listElements=async()=>{const c=await w.context();return c.elements.map((e:any)=>[e.ref,e.tag,(e.text||e.name||'').slice(0,50)]);};
const q=<T extends Element=HTMLElement>(s:string)=>document.querySelector<T>(s as any) as T|null;
const all=(s:string)=>[...document.querySelectorAll<HTMLElement>(s)];
const byText=(sel:string,re:RegExp)=>all(sel).find(e=>re.test(e.textContent||''))||null;
const rect=(e:Element|null)=>{if(!e)return null;const r=e.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)};};
const overlaps=()=>{const cards=all('article,section.Card,[data-dx-owned]').filter(e=>!e.parentElement?.closest('article,section.Card,[data-dx-owned]')).map(e=>e.getBoundingClientRect()).filter(r=>r.width&&r.height);for(let i=0;i<cards.length;i++)for(let j=i+1;j<cards.length;j++){const a=cards[i],b=cards[j];if(a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1)return true;}return false;};
// The page's visible state: text, owned parts, card geometry and the Plan card's color.
const state=()=>[document.getElementById('page')!.innerText,all('[data-dx-owned]').length,JSON.stringify(all('article,section.Card,button').map(rect)),getComputedStyle(byText('article',/Plan/)!).backgroundColor].join('|');
const ref=(c:any,tag:string,re:RegExp)=>{const e=c.elements.find((e:any)=>e.tag===tag&&re.test(e.text||e.name||''));if(!e)throw new Error(`No ${tag} ${re}`);return e.ref;};
type Case={name:string;actions:(c:any)=>Record<string,unknown>[];check:()=>string|true};
const theme={background:'#fff8f0',surface:'#ffffff',text:'#1f1a33',accent:'#c2410c',accentText:'#ffffff'};
const chart={title:'Feedback over time',description:'Responses collected each week.',unit:'responses',xLabel:'Week',yLabel:'Responses',points:[{label:'W1',value:4},{label:'W2',value:7},{label:'W3',value:5}]};
const cases:Case[]=[
 {name:'text: rename a heading',actions:c=>[{kind:'text',targets:[ref(c,'h4',/^Plan and Setup$/)],text:'Plan & Setup'}],check:()=>byText('h4',/^Plan & Setup$/)?true:'heading not renamed'},
 {name:'style: card background',actions:c=>[{kind:'style',targets:[ref(c,'article',/^Plan and Setup/)],style:{backgroundColor:'#fff3e0'}}],check:()=>getComputedStyle(byText('article',/Plan and Setup/)!).backgroundColor==='rgb(255, 243, 224)'?true:'color is '+getComputedStyle(byText('article',/Plan and Setup/)!).backgroundColor},
 {name:'style: copy look from another element (styleRef)',actions:c=>[{kind:'style',targets:[ref(c,'button',/^Weekly$/)],styleRef:ref(c,'button',/^Save changes$/)}],check:()=>{const a=getComputedStyle(byText('button',/^Weekly$/)!),b=getComputedStyle(byText('button',/^Save changes$/)!);return a.backgroundColor===b.backgroundColor?true:`weekly ${a.backgroundColor} vs save ${b.backgroundColor}`;}},
 {name:'move: nudge a button',actions:c=>[{kind:'move',targets:[ref(c,'button',/^Save changes$/)],style:{x:40,y:0}}],check:()=>/40px/.test(getComputedStyle(byText('button',/^Save changes$/)!).translate)?true:'translate '+getComputedStyle(byText('button',/^Save changes$/)!).translate},
 {name:'remove: delete a paragraph',actions:c=>[{kind:'remove',targets:[ref(c,'p',/^Get insights/)]}],check:()=>{const p=byText('p',/^Get insights/);return !p||p.offsetParent===null?true:'paragraph still visible';}},
 {name:'create button inside a card',actions:c=>[{kind:'create',element:'button',targets:[ref(c,'article',/^Plan and Setup/)],position:'inside',text:'Open plan'}],check:()=>{const b=byText('button',/^Open plan$/);return b&&byText('article',/Plan and Setup/)!.contains(b)&&b.offsetWidth?true:'button missing or outside card';}},
 {name:'create text after a heading',actions:c=>[{kind:'create',element:'text',targets:[ref(c,'h4',/^Settings$/)],position:'after',text:'Reports go to all teachers.'}],check:()=>byText('[data-dx-owned]',/^Reports go to all teachers\.$/)?true:'text missing'},
 {name:'create field in a section',actions:c=>[{kind:'create',element:'field',targets:[ref(c,'section',/^Settings/)],position:'inside',text:'Report email',inputType:'email'}],check:()=>{const i=q<HTMLInputElement>('section.settings input');return i&&i.offsetWidth?true:'no input';}},
 {name:'create link',actions:c=>[{kind:'create',element:'link',targets:[ref(c,'p',/^Choose how often/)],position:'after',text:'Open library',href:'/library'}],check:()=>byText('a,[role=link]',/^Open library$/)?true:'link missing'},
 {name:'create section (panel) below a card',actions:c=>[{kind:'create',element:'panel',targets:[ref(c,'article',/^My Record/)],position:'below',text:'Highlights'}],check:()=>{const p=byText('[data-dx-owned]',/Highlights/);if(!p)return 'panel missing';return overlaps()?'overlaps another card':true;}},
 {name:'create chart spanning two cards',actions:c=>[{kind:'create',element:'chart',targets:[ref(c,'article',/^Plan and Setup/),ref(c,'article',/^Assign Participant/)],position:'below',chart}],check:()=>{const s=byText('[data-dx-owned]',/Feedback over time/);if(!s)return 'chart missing';return overlaps()?'overlaps another card':true;}},
 {name:'create block inside a card',actions:c=>[{kind:'create',element:'block',targets:[ref(c,'section',/^Settings/)],position:'inside',block:{accent:'#7c4dff',nodes:[w.N(-1,'row',{level:3}),w.N(0,'stat',{icon:'clock',text:'47m'}),w.N(0,'stat',{icon:'document',text:'2,847 words'})]}}],check:()=>byText('[data-dx-owned]',/2,847 words/)?(overlaps()?'overlaps another card':true):'block missing'},
 {name:'duplicate a card beside',actions:c=>[{kind:'duplicate',targets:[ref(c,'article',/^Plan and Setup/)],element:'panel',text:'Section Summary',description:'Key points at a glance.',position:'beside'}],check:()=>{const a=rect(byText('article',/^Plan and Setup/)),b=rect(byText('[data-dx-owned]',/^Section Summary/));return a&&b&&a.y===b.y&&a.w===b.w&&a.h===b.h&&b.x>a.x?true:`orig ${JSON.stringify(a)} copy ${JSON.stringify(b)}`;}},
 {name:'reorder: move a button before another',actions:c=>[{kind:'reorder',targets:[ref(c,'button',/^Save changes$/)],relativeTo:ref(c,'button',/^Weekly$/),position:'before'}],check:()=>{const s=byText('button',/^Save changes$/)!,wk=byText('button',/^Weekly$/)!;return s.compareDocumentPosition(wk)&Node.DOCUMENT_POSITION_FOLLOWING?true:'order unchanged';}},
 {name:'layout: arrange a section horizontally',actions:c=>[{kind:'layout',targets:[ref(c,'section',/^Settings/)],layout:'horizontal'}],check:()=>{const h=rect(byText('h4',/^Settings$/))!,p=rect(byText('p',/^Choose how often/))!;return p.x>=h.x+h.w&&p.y<h.y+h.h&&h.y<p.y+p.h?true:`heading ${JSON.stringify(h)} text ${JSON.stringify(p)}`;}},
 {name:'theme: recolor a region',actions:c=>[{kind:'theme',targets:[ref(c,'section',/^Settings/)],theme}],check:()=>{const b=getComputedStyle(byText('button',/^Save changes$/)!).backgroundColor;return b==='rgb(194, 65, 12)'?true:'button color '+b;}},
 {name:'icon: add an icon to a button',actions:c=>[{kind:'icon',targets:[ref(c,'button',/^Save changes$/)],element:'button',text:'check'}],check:()=>byText('button',/Save changes/)!.querySelector('svg')?true:'no icon'},
 {name:'iconOnly: icon-only button',actions:c=>[{kind:'icon',targets:[ref(c,'button',/^Save changes$/)],element:'button',text:'check'},{kind:'iconOnly',targets:[ref(c,'button',/^Save changes$/)],element:'button',text:'Save changes'}],check:()=>{const b=all('button').find(b=>b.getAttribute('aria-label')==='Save changes'||/Save changes/.test(b.textContent||''))!;const r=b.getBoundingClientRect();return b.querySelector('svg')&&r.width<72&&b.getAttribute('aria-label')==='Save changes'?true:`width ${Math.round(r.width)}`;}},
 {name:'tooltip on a button',actions:c=>[{kind:'tooltip',targets:[ref(c,'button',/^Weekly$/)],element:'button',text:'Generate every Monday'}],check:()=>{const b=byText('button',/^Weekly$/)!;return b.title==='Generate every Monday'||b.getAttribute('aria-describedby')||document.body.innerHTML.includes('Generate every Monday')?true:'no tooltip';}},
 {name:'choices + default: option group',actions:c=>[{kind:'create',element:'panel',targets:[ref(c,'section',/^Settings/)],position:'inside',text:'Frequency',resultRef:'new:freq'},{kind:'choices',targets:['new:freq'],labels:['Daily','Weekly','Monthly'],styleRef:ref(c,'button',/^Weekly$/)},{kind:'default',targets:['new:freq'],text:'Monthly'}],check:()=>{const g=byText('[data-dx-owned]',/Daily/);if(!g)return 'group missing';const sel=[...g.querySelectorAll('[aria-pressed=true],[aria-checked=true],[aria-selected=true]')].map(e=>e.textContent?.trim());return sel.length===1&&/^Monthly/.test(sel[0]||'')?true:'selected '+JSON.stringify(sel);}},
 {name:'connect: button to a new screen',actions:c=>[{kind:'connect',targets:[ref(c,'button',/^Save changes$/)],newViewTitle:'Saved confirmation'}],check:()=>w.session.snapshot().workflow.edges.length===1&&w.session.snapshot().workflow.states.length===2?true:`edges ${w.session.snapshot().workflow.edges.length}`},
 {name:'connect: card to an app page',actions:c=>[{kind:'connect',targets:[ref(c,'article',/^Plan and Setup/)],destination:'/library/templates'}],check:()=>w.session.snapshot().workflow.states.some((s:any)=>/library\/templates/.test(s.liveURL||''))?true:'no live screen'},
];
w.runBasic=async(only?:string)=>{
 const results:any[]=[];
 for(const t of cases.filter(t=>!only||t.name.includes(only))){
  await w.session.dispatch({type:'new',discard:true});await wait(150);
  const base=state();let outcome:string,check:string|true='—';
  try{const c=await w.context();outcome=await w.apply(t.actions(c));}catch(e){outcome='THREW '+(e instanceof Error?e.message:String(e));}
  await wait(400);
  if(outcome==='OK'||outcome.startsWith('Preview kept'))check=t.check();
  const undoable=w.session.snapshot().canUndo;while(w.session.snapshot().canUndo)await w.session.dispatch({type:'undo'});await wait(200);
  results.push({name:t.name,outcome:outcome.slice(0,220),check,undoRestored:state()===base,undoable});
 }
 return results;
};
w.applyOnly=async(name:string)=>{await w.session.dispatch({type:'new',discard:true});const t=cases.find(t=>t.name.includes(name))!;const c=await w.context();return w.apply(t.actions(c));};
