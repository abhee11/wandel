// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {Session} from '../extension/content/session';
import {Repository,BrowserStorage} from '../extension/storage/store';
import {shortcutKey} from '../extension/shared/keyboard';
it('normalizes real keys and ignores missing, empty and non-string keyboard fields',()=>{
 expect(shortcutKey(new KeyboardEvent('keydown',{key:'D'}))).toBe('d');
 for(const key of [undefined,null,42,{},'']){const event=new Event('keydown');Object.defineProperty(event,'key',{value:key});expect(shortcutKey(event)).toBeNull();}
});
it('ignores malformed host key events without crashing or consuming them, then still handles real shortcuts',async()=>{
 localStorage.clear();document.body.innerHTML='<main><section><button id="source">Source</button></section></main>';
 const session=new Session(document.querySelector('main')!,new Repository(new BrowserStorage()),new URL('https://example.com'));
 const errors:unknown[]=[];const capture=(event:ErrorEvent)=>{errors.push(event.error);event.preventDefault();};window.addEventListener('error',capture);
 try{
  await session.init();await session.dispatch({type:'edit'});document.getElementById('source')!.click();const before=JSON.stringify(session.workflow);
  for(const type of ['keydown','keyup'])for(const key of [undefined,null,42,{},'']){
   const event=new Event(type,{bubbles:true,cancelable:true});Object.defineProperty(event,'key',{value:key});window.dispatchEvent(event);expect(event.defaultPrevented).toBe(false);
  }
  await session.dispatch({type:'snapshot'});expect(errors).toEqual([]);expect(JSON.stringify(session.workflow)).toBe(before);expect(session.mode()).toBe('edit');
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'i',bubbles:true}));await session.dispatch({type:'snapshot'});expect(session.mode()).toBe('interact');
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'e',bubbles:true}));await session.dispatch({type:'snapshot'});document.getElementById('source')!.click();
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'d',metaKey:true,bubbles:true}));await session.dispatch({type:'snapshot'});expect(session.workflow.states[0].operations.some(op=>op.kind==='insert'&&op.node.copy)).toBe(true);expect(errors).toEqual([]);
 }finally{session.destroy();window.removeEventListener('error',capture);document.body.innerHTML='';localStorage.clear();}
});
