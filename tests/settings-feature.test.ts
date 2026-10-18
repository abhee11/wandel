// @vitest-environment jsdom
import {it,expect,beforeEach,afterEach} from 'vitest';
import {Session} from '../extension/content/session';
import {Repository,BrowserStorage} from '../extension/storage/store';
import {advancedTarget} from '../extension/content/settingsFeature';
import {parseSharedWorkflow} from '../extension/sidepanel/WorkflowShare';
let session:Session;
const prompt='Add another option in the advanced setting to add a theme - dark & light and another option which opens a panel to resize the screen';
const fixture=()=>{document.body.innerHTML='<main><div role="dialog"><nav><button>Advanced</button><button>My account</button></nav><section id="settings"><div><h4>Test timeout</h4><input value="20"></div><div><h4>Wait before step</h4><input value="0"></div><div><h4>Default run mode</h4><input type="radio"><input type="radio"></div></section></div></main>';};
beforeEach(()=>{localStorage.clear();fixture();});afterEach(()=>session?.destroy());
const click=(label:string)=>{const b=[...document.querySelectorAll<HTMLButtonElement>('[data-dx-interactive] button')].find(b=>b.textContent===label);expect(b).toBeTruthy();b!.click();};
async function setup(){session=new Session(document.querySelector('main')!,new Repository(new BrowserStorage()),new URL('https://example.com/settings'));await session.init();await session.dispatch({type:'edit'});await session.dispatch({type:'settingsPrompt',prompt});}
it('locates content instead of the Advanced navigation tab and adds working settings without selection',async()=>{
 expect(advancedTarget(document.querySelector('main')!).id).toBe('settings');await setup();const target=document.getElementById('settings')!;
 expect(target.querySelectorAll('[data-dx-interactive]')).toHaveLength(2);expect(document.querySelector('nav [data-dx-owned]')).toBeNull();
 click('Dark');expect(target.style.backgroundColor).toBe('rgb(30, 32, 40)');click('Light');expect(target.style.backgroundColor).toBe('rgb(255, 255, 255)');click('Resize preview');const slider=document.querySelector<HTMLInputElement>('[aria-label="Preview width slider"]')!;slider.value='500';slider.dispatchEvent(new Event('input',{bubbles:true}));expect(target.style.width).toBe('500px');click('Mobile · 375');expect(target.style.width).toBe('375px');
 const custom=document.querySelector<HTMLInputElement>('[aria-label="Custom preview width"]')!;custom.value='620';custom.dispatchEvent(new Event('input',{bubbles:true}));expect(target.style.width).toBe('620px');
 await session.dispatch({type:'undo'});expect(target.style.width).toBe('');expect(target.style.backgroundColor).toBe('');expect(target.querySelector('[data-dx-interactive]')).toBeNull();
});
it('round-trips a shared definition and restores widget behavior on a fresh page',async()=>{
 await setup();const record={draft:session.workflow,enabled:true,currentVersion:0,versions:[]};const exported=JSON.stringify(record);session.destroy();fixture();
 session=new Session(document.querySelector('main')!,new Repository(new BrowserStorage()),new URL('https://example.com/settings'));await session.init();await session.dispatch({type:'loadRecord',record:parseSharedWorkflow(exported,'https://example.com','/settings')});await session.dispatch({type:'edit'});click('Dark');expect(document.getElementById('settings')!.style.backgroundColor).toBe('rgb(30, 32, 40)');expect(()=>parseSharedWorkflow(exported,'https://other.example','/settings')).toThrow('Open https://example.com/settings');
});
it('rejects ambiguous Advanced sections and does not insert anything',async()=>{
 document.querySelector('main')!.append(document.querySelector('[role="dialog"]')!.cloneNode(true));expect(()=>advancedTarget(document.querySelector('main')!)).toThrow('unambiguous');
});
it('accepts the on-page prompt and restores styles after playback',async()=>{
 session=new Session(document.querySelector('main')!,new Repository(new BrowserStorage()),new URL('https://example.com/settings'));await session.init();await session.dispatch({type:'edit'});
 await session.promptHere(prompt,'section');
 await session.dispatch({type:'settingsPlayback'});
 expect(document.getElementById('settings')!.style.width).toBe('');
 expect(document.getElementById('settings')!.style.backgroundColor).toBe('');
},10000);
it('ignores settings inside a hidden ancestor',()=>{
 const copy=document.querySelector('[role="dialog"]')!.cloneNode(true) as HTMLElement;copy.style.display='none';document.querySelector('main')!.append(copy);
 expect(advancedTarget(document.querySelector('main')!).id).toBe('settings');
});
