import {Session} from '../../extension/content/session';
import {Repository,BrowserStorage} from '../../extension/storage/store';
/** One free (no AI) check of intended visibility and switcher navigation, run through the real
 * context → compile → render → verify path. visibility-check.html runs every case, each in a fresh frame. */
const session=new Session(document.getElementById('page')!,new Repository(new BrowserStorage()),new URL(location.href),{assistantEnabled:true,historyStore:{read:async id=>JSON.parse(sessionStorage.getItem('h:'+id)||'null'),write:async(id,value)=>sessionStorage.setItem('h:'+id,JSON.stringify(value))}});
const ready=session.init().then(()=>session.dispatch({type:'edit'}));
const base={relativeTo:null,element:null,description:null,labels:[],position:null,styleRef:null,style:null,destination:null,newViewTitle:null,resultRef:null,text:null};
const context=async()=>{await ready;return (await session.dispatch({type:'assistantContext',instruction:'fixture',chat:true})).assistant!.context!;};
const ref=async(test:(e:Awaited<ReturnType<typeof context>>['elements'][number])=>boolean)=>{const e=(await context()).elements.find(test);if(!e)throw new Error('Fixture element not found.');return e.ref;};
const apply=async(actions:Record<string,unknown>[])=>{const c=await context();try{await session.dispatch({type:'assistantApply',plan:{status:'edit',scope:'region',message:'fixture',reply:'fixture',question:null,candidates:[],memory:null,actions:actions.map(a=>({...base,...a}))},token:c.token});return 'OK';}catch(error){return error instanceof Error?error.message:String(error);}};
const snap=()=>session.dispatch({type:'snapshot'});
const frames=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,50))));
const card=()=>[...document.querySelectorAll<HTMLElement>('[data-dx-owned]')].find(n=>n.dataset.dxLabel==='Home Options');
const shown=(el?:HTMLElement)=>!!el&&getComputedStyle(el).display!=='none';
const press=(el:Element|null|undefined)=>{if(!el)throw new Error('Nothing to click.');(el as HTMLElement).click();};
const homeButton=()=>[...document.querySelectorAll('nav button')].find(b=>b.textContent==='Home');
const option=(text:string)=>[...document.querySelectorAll('#groups [role=option]')].find(o=>o.textContent!.includes(text));
const homeRefs=async()=>({home:await ref(e=>e.tag==='button'&&e.name==='Home'),section:await ref(e=>e.tag==='section')});
type Result={pass:boolean;detail:string};
const check=(pass:boolean,detail:string):Result=>({pass,detail});
const cases:Record<string,()=>Promise<Result>>={
 async 'Card hidden until Home is clicked, then shown below; Undo removes it'(){
  const {home,section}=await homeRefs();
  const applied=await apply([{kind:'create',element:'panel',text:'Home Options',targets:[section],position:'below',resultRef:'new:card'},{kind:'behavior',targets:['new:card'],event:'load',effects:[{action:'hide',targets:['new:card'],value:null}]},{kind:'behavior',targets:[home],event:'click',effects:[{action:'show',targets:['new:card'],value:null}]}]);
  if(applied!=='OK')return check(false,'Rolled back: '+applied);
  if(shown(card()))return check(false,'The card is visible before the click.');
  if((await snap()).unresolved.length)return check(false,'Warnings for intended hiding: '+(await snap()).unresolved.join(' | '));
  await session.dispatch({type:'interact'});press(homeButton());await frames();
  const el=card(),below=el&&el.getBoundingClientRect().top>=document.querySelector('section.cards')!.getBoundingClientRect().bottom;
  if(!shown(el)||!below)return check(false,'Home did not reveal the card below the section.');
  if((await snap()).unresolved.length)return check(false,'Revealed card reported: '+(await snap()).unresolved.join(' | '));
  await session.dispatch({type:'undo'});
  return check(!card(),card()?'Undo left the card.':'Hidden without rollback, revealed below, undone.');
 },
 async 'Toggle hides and shows again'(){
  const {home,section}=await homeRefs();
  const applied=await apply([{kind:'create',element:'panel',text:'Home Options',targets:[section],position:'below',resultRef:'new:card'},{kind:'behavior',targets:[home],event:'click',effects:[{action:'toggle',targets:['new:card'],value:null}]}]);
  if(applied!=='OK')return check(false,applied);
  await session.dispatch({type:'interact'});const seen=[shown(card())];press(homeButton());seen.push(shown(card()));press(homeButton());await frames();seen.push(shown(card()));
  return check(seen.join()==='true,false,true',`Visible: ${seen.join(' → ')}`);
 },
 async 'Hidden at load with nothing that shows it is reported'(){
  const {section}=await homeRefs();
  const applied=await apply([{kind:'create',element:'panel',text:'Home Options',targets:[section],position:'below',resultRef:'new:card'},{kind:'behavior',targets:['new:card'],event:'load',effects:[{action:'hide',targets:['new:card'],value:null}]}]);
  return check(/rolled back.*no click or hover shows it/i.test(applied),applied);
 },
 async 'A container the page hides still reports the new card'(){
  const {section}=await homeRefs();
  await apply([{kind:'create',element:'panel',text:'Home Options',targets:[section],position:'inside'}]);
  (document.querySelector('section.cards') as HTMLElement).style.display='none';document.getElementById('page')!.append(document.createElement('span'));
  await new Promise(resolve=>setTimeout(resolve,800));const issues=(await snap()).unresolved;
  return check(issues.some(issue=>/Home Options: hidden control; its container “Overview” is hidden/.test(issue)),issues.join(' | ')||'No warning.');
 },
 async 'New menu item with no destination shows a hidden card'(){
  const nav=await ref(e=>e.tag==='nav'),{section}=await homeRefs();
  const applied=await apply([{kind:'create',element:'link',text:'X',targets:[nav],position:'inside',resultRef:'new:x'},{kind:'create',element:'panel',text:'Home Options',targets:[section],position:'below',resultRef:'new:card'},{kind:'behavior',targets:['new:card'],event:'load',effects:[{action:'hide',targets:['new:card'],value:null}]},{kind:'behavior',targets:['new:x'],event:'click',effects:[{action:'show',targets:['new:card'],value:null}]}]);
  if(applied!=='OK')return check(false,applied);
  if(shown(card()))return check(false,'The card is visible before X is clicked.');
  await session.dispatch({type:'interact'});press([...document.querySelectorAll('nav [data-dx-owned]')].find(a=>a.textContent==='X'));await frames();
  return check(shown(card())&&!(await snap()).unresolved.length,shown(card())?'X added; the card stays hidden until X is clicked.':'Clicking X did not show the card.');
 },
 async 'Copy of an icon-only sidebar item named X shows a hidden card'(){
  const library=await ref(e=>e.tag==='a'&&/Library/.test(e.name||'')),{section}=await homeRefs();
  const applied=await apply([{kind:'duplicate',targets:[library],position:'after',text:'X',resultRef:'new:x'},{kind:'create',element:'panel',text:'Home Options',targets:[section],position:'below',resultRef:'new:card'},{kind:'behavior',targets:['new:card'],event:'load',effects:[{action:'hide',targets:['new:card'],value:null}]},{kind:'behavior',targets:['new:x'],event:'click',effects:[{action:'show',targets:['new:card'],value:null}]}]);
  if(applied!=='OK')return check(false,applied);
  const x=[...document.querySelectorAll<HTMLElement>('aside [data-dx-owned]')].find(n=>n.textContent?.trim()==='X');
  if(!x)return check(false,'The copied item has no visible X label.');
  if(shown(card()))return check(false,'The card is visible before X is clicked.');
  await session.dispatch({type:'interact'});press(x);await frames();
  return check(shown(card()),shown(card())?'X copied with a visible label; the card appears on click.':'Clicking X did not show the card.');
 },
 async 'New menu option opens its page, and General returns'(){
  const general=await ref(e=>e.tag==='li'&&e.name==='General');
  const applied=await apply([{kind:'duplicate',targets:[general],position:'end',text:'Test',resultRef:'new:test'},{kind:'connect',targets:['new:test'],newViewTitle:'Test',presentation:'page'}]);
  if(applied!=='OK')return check(false,applied);
  await session.dispatch({type:'interact'});const testPage=(await snap()).stateId,title=()=>document.getElementById('title')!.textContent;
  press(option('General'));await frames();const original=(await snap()).stateId,back=original!==testPage&&title()==='General';
  press(option('Test'));await frames();const again=(await snap()).stateId===testPage&&title()==='Test';
  return check(back&&again,`General returned: ${back}; Test opened its page again: ${again}`);
 }
};
const name=new URL(location.href).searchParams.get('case')||'';
void ready.then(async()=>{let result:Result;try{result=cases[name]?await cases[name]():check(false,'Unknown case');}catch(error){result=check(false,error instanceof Error?error.message:String(error));}parent.postMessage({wandelCase:name,...result},'*');});
Object.assign(window,{session,context,apply,cases});
