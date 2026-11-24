// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {Session} from '../extension/content/session';import {Repository,BrowserStorage} from '../extension/storage/store';
import {copiedElement} from '../extension/content/tabClipboard';
// The AI's copy move fills the same clipboard a user's "Copy from page" does, so paste works on any screen.
it('assistantCopy puts the element on Wandel\'s clipboard without changing the page',async()=>{
 const m=new Map();(globalThis as any).chrome={runtime:{id:'x',sendMessage:async()=>({})},storage:{local:{get:async(k:string)=>({[k]:m.get(k)}),set:async(v:any)=>{for(const [k,x] of Object.entries(v))m.set(k,x);},remove:async()=>{},onChanged:{addListener(){}}},onChanged:{addListener(){}},session:{get:async()=>({}),set:async()=>{},remove:async()=>{}}}};
 document.body.innerHTML='<main><section><h2>Card</h2><p>Body text here</p><button>Go</button></section></main>';
 const s=new Session(document.querySelector('main')!,new Repository(new BrowserStorage()),new URL('https://x.test/'),{assistantEnabled:true});await s.init();await s.dispatch({type:'edit'});
 const c=(await s.dispatch({type:'assistantContext',instruction:'copy the card'})).assistant!.context!;
 const ref=c.elements.find(e=>e.tag==='section')!.ref;
 const before=document.querySelector('main')!.innerHTML;
 await s.dispatch({type:'assistantCopy',ref});
 expect(copiedElement()?.label).toBe('CardBody text hereGo');expect(copiedElement()?.copy[0].tag).toBe('section');expect(m.has('wandelCopiedElement')).toBe(true);
 expect(document.querySelector('main')!.innerHTML).toBe(before);s.destroy();
});
