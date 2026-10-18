// @vitest-environment jsdom
import {it,expect,beforeEach,afterEach,vi} from 'vitest';
import {captureDesign,inferDestination,nativeOperations,inspectLayout} from '../extension/content/nativeDesign';
import {describe} from '../extension/content/locator';
import {promptOperations} from '../extension/ai/batch';
import {Renderer} from '../extension/content/renderer';
import {Session} from '../extension/content/session';
import {Repository,BrowserStorage} from '../extension/storage/store';
import {createWorkflow,validateWorkflow} from '../extension/prototype/engine';
import {compileFlow} from '../extension/ai/flow';
import {RecordSchema,OperationSchema} from '../extension/shared/model';
let session:Session|undefined;
beforeEach(()=>{localStorage.clear();document.body.innerHTML='<main><section id="advanced" role="dialog" style="font-family:Georgia;color:rgb(240,240,240);background-color:rgb(30,30,30)"><h2 style="font-family:Georgia;font-size:26px">Advanced</h2><p style="color:rgb(240,240,240)">Preferences</p><input style="border-radius:18px;background-color:rgb(45,45,45);color:white"><article style="border-radius:20px;background-color:rgb(45,45,45)">Example card</article><footer><button style="background-color:rgb(140,60,240);border-radius:30px;font-family:Georgia">Save</button><button>Cancel</button></footer></section></main>';});
afterEach(()=>session?.destroy());
const target=()=>document.getElementById('advanced')!;
const root=()=>document.querySelector('main')!;
it('finds a named visible destination, rejects duplicates, ignores hidden sections',()=>{
 expect(inferDestination('Add a menu in the Advanced section',root())).toBe(target());
 const duplicate=target().cloneNode(true) as HTMLElement;duplicate.removeAttribute('id');root().append(duplicate);
 expect(()=>inferDestination('Add a menu in the Advanced section',root())).toThrow('More than one');
 duplicate.hidden=true;expect(inferDestination('Add a menu in the Advanced section',root())).toBe(target());
 expect(()=>inferDestination('Add in the Billing section',root())).toThrow('Open that section');
});
it('inherits button and field styles, inserts above the footer, restores host DOM and roundtrips the artifact',()=>{
 const before=root().innerHTML;const locator=describe(target()).locator;
 const plan={steps:[{kind:'insert',target:'selected',position:'inside',element:'button',text:'Preview',style:null},{kind:'insert',target:'selected',position:'inside',element:'field',text:'Contact email',style:null,required:true,inputType:'email'}]};
 const ops=nativeOperations(promptOperations('Add preview and email',plan,target(),locator,root(),new Map()),target());
 const w=createWorkflow(new URL('https://example.com'));w.states[0].operations=ops;
 const saved=RecordSchema.parse(JSON.parse(JSON.stringify({draft:w,enabled:true,currentVersion:1,versions:[]})));
 const renderer=new Renderer(root(),()=>{});expect(renderer.reconcile(saved.draft,w.entry)).toEqual([]);
 const added=[...target().querySelectorAll<HTMLElement>('[data-dx-owned]')];
 expect(added[0].style.borderRadius).toBe('30px');expect(added[1].nextElementSibling?.tagName).toBe('FOOTER');
 const input=added[1].querySelector('input')!;expect(input.style.borderRadius).toBe('18px');expect(input.required).toBe(true);expect(input.type).toBe('email');
 renderer.reset();expect(root().innerHTML).toBe(before);
});
it.each(['switch','menu','tabs'] as const)('renders an isolated functional %s and preserves the definition on export',kind=>{
 const w=createWorkflow(new URL('https://example.com'));let calls=0;root().addEventListener('click',()=>calls++);
 w.states[0].operations=nativeOperations([OperationSchema.parse({id:'op',kind:'insert',target:describe(target()).locator,position:'inside',node:{id:'control',kind:'panel',text:'Preferences',control:{kind,options:['One','Two'],contents:['First panel','Second panel']}}})],target());
 const renderer=new Renderer(root(),()=>{});renderer.reconcile(RecordSchema.parse({draft:JSON.parse(JSON.stringify(w)),enabled:true,currentVersion:0,versions:[]}).draft,w.entry);
 const host=renderer.owned.get('control')!;
 if(kind==='switch'){const b=host.querySelector('button')!;b.click();expect(b.getAttribute('aria-checked')).toBe('true');}
 if(kind==='menu'){const s=host.querySelector('select')!;s.selectedIndex=1;s.dispatchEvent(new Event('change',{bubbles:true}));expect(host.textContent).toContain('Second panel');}
 if(kind==='tabs'){const b=host.querySelectorAll('button')[1];b.click();expect(b.getAttribute('aria-selected')).toBe('true');expect(host.querySelector('[role=tabpanel]')!.textContent).toBe('Second panel');}
 expect(calls).toBe(0);renderer.reset();
});
it('inherits design across generated screens, blocks invalid progression, saves, reloads and replays',async()=>{
 const repo=new Repository(new BrowserStorage());session=new Session(root(),repo,new URL('https://example.com'));await session.init();await session.dispatch({type:'edit'});target().click();
 const flow={name:'Contact flow',entryLabel:'Start',variables:[{key:'email',value:''}],screens:[{id:'entry',title:'Contact',body:'Sample email',fields:[],boundFields:[{label:'Email',key:'email',required:true,inputType:'email'}],actionLabel:null,actions:[{label:'Continue',to:'done',effects:[]}]},{id:'done',title:'Complete',body:'Ready',fields:[],actionLabel:null,actions:[]}]};
 await session.dispatch({type:'prompt',prompt:'Add a contact workflow',plan:{steps:[],flow}});
 const w=session.workflow;expect(w.states[1].design?.surface['background-color']).toBe('rgb(30, 30, 30)');
 await session.dispatch({type:'save'});const record=await repo.get(w.id);expect(RecordSchema.safeParse(record).success).toBe(true);
 await session.dispatch({type:'replay'});[...root().querySelectorAll('button')].find(b=>b.textContent==='Start')!.click();
 const view=session.renderer.owned.get('view:'+session.stateId)!;expect(view.style.backgroundColor).toBe('rgb(30, 30, 30)');
 const input=view.querySelector('input')!;const next=[...view.querySelectorAll('button')].find(b=>b.textContent==='Continue')!;
 next.click();expect(session.stateId).toBe(w.states[1].id);expect(input.getAttribute('aria-invalid')).toBe('true');
 input.value='test@example.com';input.dispatchEvent(new Event('input',{bubbles:true}));next.click();expect(session.stateId).toBe(w.states[2].id);
 session.destroy();session=new Session(root(),repo,new URL('https://example.com'));await session.init();await session.dispatch({type:'load',id:w.id});await session.dispatch({type:'replay'});
 expect(session.workflow.states[2].design).toEqual(w.states[2].design);expect(JSON.stringify(await repo.get(w.id))).not.toContain('test@example.com');
 validateWorkflow(session.workflow);
});
it('reports clipping and rejects unsafe serialized styles',()=>{
 const node=document.createElement('button');node.dataset.dxLabel='Preview';node.style.overflowX='hidden';root().append(node);
 vi.spyOn(node,'getBoundingClientRect').mockReturnValue({width:100,height:30,left:0,top:0,right:100,bottom:30,x:0,y:0,toJSON(){}});Object.defineProperty(node,'scrollWidth',{value:200});Object.defineProperty(node,'clientWidth',{value:100});
 expect(inspectLayout([node])).toContain('Preview: content is clipped.');
 expect(OperationSchema.safeParse({id:'x',kind:'insert',target:describe(target()).locator,position:'inside',node:{id:'n',kind:'panel',text:'Bad',appearance:{'background-color':'url(https://example.com)'}}}).success).toBe(false);
});
it('keeps the application palette in all five layout alternatives',async()=>{
 const {layoutCopies}=await import('../extension/content/layouts');
 const copies=layoutCopies(target());
 expect(copies).toHaveLength(5);
 for(const copy of copies){expect(copy[0].style['background-color']).toBe('rgb(30, 30, 30)');const button=copy.find(n=>n.tag==='button')!;expect(button.style['border-radius']).toBe('30px');expect(button.style['background-color']).toBe('rgb(140, 60, 240)');}
});
it('does not treat a fixed dialog as clipped by the background page',()=>{
 document.body.innerHTML='<main style="overflow:hidden"><div style="position:fixed"><button>Choice</button></div></main>';
 const main=document.querySelector('main')!,button=document.querySelector('button')!;
 const rect=(width:number,height:number)=>({width,height,left:0,top:0,right:width,bottom:height,x:0,y:0,toJSON(){}});
 vi.spyOn(main,'getBoundingClientRect').mockReturnValue(rect(20,20));
 vi.spyOn(button,'getBoundingClientRect').mockReturnValue(rect(100,40));
 expect(inspectLayout([button])).toEqual([]);
});
