// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {AppDocsSection} from '../extension/appdocs/AppDocsSection';
import {CODEBASE_PROMPT} from '../extension/appdocs/docs';
afterEach(()=>{vi.unstubAllGlobals();document.body.innerHTML='';});
function fakeStorage(){
 const data:Record<string,unknown>={},listeners:((changes:Record<string,unknown>,area:string)=>void)[]=[];
 const fire=(keys:string[])=>listeners.forEach(fn=>fn(Object.fromEntries(keys.map(k=>[k,{newValue:data[k]}])),'local'));
 return {data,chrome:{storage:{local:{
  get:async(key:string)=>({[key]:data[key]}),
  set:async(items:Record<string,unknown>)=>{Object.assign(data,structuredClone(items));fire(Object.keys(items));},
  remove:async(key:string)=>{delete data[key];fire([key]);}},
  onChanged:{addListener:(fn:any)=>listeners.push(fn),removeListener:()=>{}}}}};
}
const textFile=(parts:string[],name:string,type:string)=>{const file=new File(parts,name,{type});Object.defineProperty(file,'text',{value:async()=>parts.join('')});return file;};
const settle=()=>act(async()=>{for(let i=0;i<5;i++)await new Promise(r=>setTimeout(r,0));});
it('copies the prompt, adds an uploaded file with secrets removed, lists it and removes it',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 const store=fakeStorage(),copied:string[]=[];
 vi.stubGlobal('chrome',store.chrome);vi.stubGlobal('confirm',()=>true);
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{copied.push(text);}}});
 const element=document.createElement('div');document.body.append(element);const root=createRoot(element);
 try{
  await act(async()=>root.render(<AppDocsSection origin="https://app.acme.test"/>));await settle();
  expect(element.querySelector('summary')?.textContent).toBe('Codebase context');
  const button=(label:string)=>[...element.querySelectorAll('button')].find(b=>b.textContent===label||b.getAttribute('aria-label')===label) as HTMLButtonElement;
  await act(async()=>button('Copy prompt for your coding AI').click());
  expect(copied).toEqual([CODEBASE_PROMPT]);
  const input=element.querySelector('input[type=file]') as HTMLInputElement;
  const file=textFile(['## Routes\n- /invoices: InvoiceList\nSTRIPE_KEY=sk_live_abcdefgh12345678'],'wandel-context.md','text/markdown');
  Object.defineProperty(input,'files',{configurable:true,value:[file]});
  await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})));await settle();
  const saved=(store.data['appDocs:https://app.acme.test'] as any).files;
  expect(saved.map((f:any)=>f.name)).toEqual(['wandel-context.md']);
  expect(saved[0].text).not.toContain('sk_live');
  expect(element.querySelector('[role=status]')?.textContent).toMatch(/Added 1 file\. Removed 1 thing/);
  expect(element.querySelector('summary')?.textContent).toBe('Codebase context · 1 file');
  await act(async()=>button('Remove wandel-context.md').click());await settle();
  expect(store.data['appDocs:https://app.acme.test']).toBeUndefined();
  expect(element.querySelector('summary')?.textContent).toBe('Codebase context');
 }finally{act(()=>root.unmount());}
});
it('refuses a file type that is not Markdown or text',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 const store=fakeStorage();vi.stubGlobal('chrome',store.chrome);
 const element=document.createElement('div');document.body.append(element);const root=createRoot(element);
 try{
  await act(async()=>root.render(<AppDocsSection origin="https://app.acme.test"/>));await settle();
  const input=element.querySelector('input[type=file]') as HTMLInputElement;
  Object.defineProperty(input,'files',{configurable:true,value:[textFile(['x'],'diagram.png','image/png')]});
  await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})));await settle();
  expect(element.querySelector('[role=alert]')?.textContent).toMatch(/Only Markdown or text files/);
  expect(store.data['appDocs:https://app.acme.test']).toBeUndefined();
 }finally{act(()=>root.unmount());}
});
