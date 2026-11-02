import {Session} from '../../extension/content/session';
import {Repository,BrowserStorage} from '../../extension/storage/store';
import {action,response,type AssistantPlan} from '../../extension/assistant/schema';
import {interpret} from '../../extension/assistant/interpret';
import {connectionControls} from '../../extension/assistant/routeConnection';
const root=document.getElementById('app')!,initial=root.innerHTML;
let session:Session;
const output=document.getElementById('results')!;document.getElementById('narrow')!.onclick=()=>{const stage=document.getElementById('stage')!;stage.style.width=stage.style.width?'':'480px';stage.style.maxWidth='100%';stage.style.marginInline='auto';};
async function reset(){session?.destroy();root.innerHTML=initial;root.removeAttribute('style');session=new Session(root,new Repository(new BrowserStorage()),new URL('https://example.test/audit'),{assistantEnabled:true});await session.init();await session.dispatch({type:'edit'});output.textContent='Ready.';}
await reset();
const context=async()=>(await session.dispatch({type:'assistantContext'})).assistant!.context!;
async function apply(plan:AssistantPlan){const c=await context();await session.dispatch({type:'assistantApply',token:c.token,plan});}
document.getElementById('reset')!.onclick=()=>void reset();
document.getElementById('run')!.onclick=async()=>{const checks:string[]=[];const check=(ok:boolean,label:string)=>{if(!ok)throw new Error(label);checks.push('PASS · '+label);output.textContent=checks.join('\n');};try{
 await reset();let c=await context();const source=c.elements.find(e=>e.attributes.id==='summary')!;
 await apply(response('edit','Copy',[action('duplicate',[source.ref],{text:'Feedback & Support',labels:['Create']})]));check(root.querySelectorAll('article').length===3,'Duplicate retains the complete card and renames its heading/button');
 c=await context();const group=c.groups!.find(g=>g.members.length===3);if(!group)throw new Error('Card groups '+JSON.stringify(c.groups)+'; captured '+c.elements.map(e=>e.attributes.id||e.tag).join(','));await apply(response('edit','Grid',[action('layout',[group.ref],{layout:'grid',columns:2})]));
 c=await context();const nav=c.regions!.find(r=>r.kind==='navigation');if(!nav)throw new Error('Missing navigation '+JSON.stringify(c.regions));await apply(response('edit','Header',[action('layout',[nav.ref],{layout:'header'})]));
 c=await context();const save=c.elements.find(e=>e.attributes.id==='save')!,name=c.elements.find(e=>e.attributes.id==='name')!;
 if(!save||!name)throw new Error('Missing field anchors: '+c.elements.map(e=>e.attributes.id||e.tag).join(','));await apply(response('edit','Email',[action('create',[save.ref],{element:'field',text:'Email',inputType:'email',required:true,position:'before',styleRef:name.ref})]));
 await apply({...response('edit','Theme',[action('theme',[(await context()).page!],{theme:{background:'#fff7ed',surface:'#ffffff',text:'#2b1608',accent:'#b84621',accentText:'#ffffff',secondary:'#ffedd5',tertiary:'#fff7ed'}})]),scope:'page'});
 await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
 const cards=[...root.querySelectorAll<HTMLElement>('article')],boxes=cards.map(n=>n.getBoundingClientRect());check(Math.abs(boxes[0].y-boxes[1].y)<2&&boxes[2].y>boxes[0].y,'Grid renders two columns with the third card on the next row');
 check(cards.every(card=>{const h=card.querySelector('h2')!.getBoundingClientRect(),p=card.querySelector('p')!.getBoundingClientRect();return h.bottom<=p.top+1;}),'Wrapped headings do not overlap descriptions');check(boxes.every(b=>{const stage=document.getElementById('stage')!.getBoundingClientRect();return b.x>=stage.x&&b.right<=stage.right+1;}),'Cards remain inside the preview container');
 const rail=document.getElementById('rail')!.getBoundingClientRect(),content=document.getElementById('content')!.getBoundingClientRect();check(rail.width>=root.clientWidth-2&&rail.bottom<=content.top+1,'Navigation becomes a full-width header above the content');
 const email=root.querySelector<HTMLInputElement>('input[type=email]')!;email.value='invalid';check(email.required&&!email.checkValidity()&&email.style.borderRadius==='10px','Required email validation and native input styling work');email.value='';
 check(getComputedStyle(cards[0]).backgroundColor==='rgb(255, 255, 255)'&&getComputedStyle(cards[0].querySelector('button')!).backgroundColor==='rgb(184, 70, 33)','Theme preserves white card surfaces and applies the orange accent');
 await session.dispatch({type:'interact'});await session.dispatch({type:'edit'});c=await context();check(interpret('Duplicate it again',c)?.actions[0].targets[0]===c.lastCard,'Conversation retains the copied card after theme/layout changes');check(connectionControls(c,'Connect the Save button to /profile')[0]?.name==='Save','Named connection source resolves without a selected element');
 await session.dispatch({type:'saveTemporary'});const record=(await session.repository.get(session.workflow.id))!;await session.dispatch({type:'loadRecord',record});check(root.querySelectorAll('article').length===3&&!!root.querySelector('input[type=email]'),'Save/reload preserves the copied card, layout, theme and field');
 await session.dispatch({type:'interact'});output.textContent=checks.join('\n')+'\nMeasured in a '+document.getElementById('stage')!.clientWidth+'px container at '+innerWidth+' × '+innerHeight+' viewport.';
}catch(error){output.textContent=checks.join('\n')+'\nFAIL · '+(error as Error).message;}};

document.getElementById('connection')!.onclick=async()=>{try{
 const card=[...root.querySelectorAll('article')].find(n=>n.querySelector('h2')?.textContent==='Feedback & Support');if(!card)throw new Error('Run audit first.');await session.dispatch({type:'edit'});(card.querySelector('button') as HTMLButtonElement).click();
 await session.dispatch({type:'connect',newTitle:'Profile preview',event:'click',conditions:[]});const to=session.workflow.edges.at(-1)!.to;await session.dispatch({type:'saveTemporary'});const record=(await session.repository.get(session.workflow.id))!;await session.dispatch({type:'loadRecord',record});await session.dispatch({type:'interact'});
 const restored=[...root.querySelectorAll('article')].find(n=>n.querySelector('h2')?.textContent==='Feedback & Support')!;(restored.querySelector('button') as HTMLButtonElement).click();
 if(session.stateId!==to)throw new Error('The saved connection did not navigate.');output.textContent='PASS · The copied Create button navigated to Profile preview in Interact after save/reload. This is a prototype view, not the production Profile page.';
 }catch(error){output.textContent='FAIL · '+(error as Error).message;}};
