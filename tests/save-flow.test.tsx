// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {SaveFlow} from '../extension/sidepanel/SaveFlow';
import {accountAPI,AccountError,startUpgrade} from '../extension/sidepanel/accountClient';
import {createWorkflow} from '../extension/prototype/engine';
import type {Snapshot} from '../extension/shared/model';
vi.mock('../extension/sidepanel/accountClient',async importOriginal=>{const original=await importOriginal<typeof import('../extension/sidepanel/accountClient')>();return {...original,accountAPI:vi.fn(),signIn:vi.fn(),startUpgrade:vi.fn()};});
let root:Root,element:HTMLDivElement;
let snapshot:Snapshot;
const send=vi.fn(),get=vi.fn(),set=vi.fn();
beforeEach(()=>{vi.clearAllMocks();(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;element=document.createElement('div');document.body.append(element);root=createRoot(element);snapshot={workflow:createWorkflow(new URL('https://example.com')),stateId:'',selected:null,picking:true,dragging:false,replay:false,enabled:true,dirty:true,canUndo:false,canRedo:false,canBack:false,unresolved:[],currentVersion:0,versions:[],library:[]};send.mockResolvedValue(snapshot);get.mockResolvedValue({});set.mockResolvedValue(undefined);vi.stubGlobal('chrome',{storage:{session:{get,set}}});});
afterEach(async()=>{await act(async()=>root.unmount());element.remove();vi.unstubAllGlobals();});
async function mount(){await act(async()=>root.render(<SaveFlow snapshot={snapshot} bridge={{send,subscribe:()=>()=>{}}} onClose={()=>{}}/>));}
async function click(text:string){const button=Array.from(element.querySelectorAll('button')).find(b=>b.textContent?.includes(text));expect(button).toBeTruthy();await act(async()=>button!.click());}
it('offers upgrades only after a blocked account save, and still allows a temporary save',async()=>{
 vi.mocked(accountAPI).mockImplementation(async(path)=>{if(path==='/me')return {user:{id:'a'}};throw new AccountError('DEPTH_LIMIT_REACHED','Free saves allow five steps.');});
 await mount();expect(accountAPI).not.toHaveBeenCalled();expect(element.textContent).not.toContain('Upgrade with Stripe');
 await click('Save to my account');expect(element.textContent).toContain('Upgrade with Stripe');expect(send).not.toHaveBeenCalledWith(expect.objectContaining({type:'acknowledgeSave'}));
 await click('Upgrade with Stripe');expect(startUpgrade).toHaveBeenCalledOnce();
 const requests=vi.mocked(accountAPI).mock.calls.length;await click('Save temporarily');expect(send).toHaveBeenCalledWith({type:'saveTemporary'});expect(vi.mocked(accountAPI).mock.calls.length).toBe(requests);expect(element.textContent).toContain('cleared when Chrome exits');
});
it('reuses the same save request on an uncertain network retry and acknowledges only after success',async()=>{
 let failed=false;const record={draft:snapshot.workflow,enabled:true,currentVersion:1,versions:[{number:1,savedAt:new Date().toISOString(),workflow:snapshot.workflow}]};
 vi.mocked(accountAPI).mockImplementation(async(path)=>{if(path==='/me')return {user:{id:'a'}};if(!failed){failed=true;throw new AccountError('CONNECTION_FAILED','Connection lost');}return {record,revision:1,savedRevision:1};});
 await mount();await click('Save to my account');expect(set).not.toHaveBeenCalled();await click('Save to my account');
 const saves=vi.mocked(accountAPI).mock.calls.filter(([path])=>path==='/workflows');expect(saves).toHaveLength(2);expect(saves[0][2]).toEqual(saves[1][2]);expect(send).toHaveBeenCalledWith({type:'acknowledgeSave',record,expected:snapshot.workflow});expect(element.textContent).toContain('Saved to your account as v1');
});

async function rename(value:string){const input=element.querySelector<HTMLInputElement>('[aria-label="Save workflow name"]')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});}
it('saves the name typed in the dialog before either storage destination, without relying on blur',async()=>{
 send.mockImplementation(async command=>{if(command.type==='rename')snapshot={...snapshot,workflow:{...snapshot.workflow,name:command.text}};return snapshot;});
 vi.mocked(accountAPI).mockImplementation(async(path)=>path==='/me'?{user:{id:'a'}}:{record:{draft:snapshot.workflow,currentVersion:1,versions:[]},revision:1,savedRevision:1});
 await mount();expect(document.activeElement?.getAttribute('aria-label')).toBe('Save workflow name');
 await rename('Risk Analysis Flow');await click('Save to my account');
 expect(vi.mocked(accountAPI).mock.calls.find(([path])=>path==='/workflows')?.[2]).toMatchObject({workflow:{name:'Risk Analysis Flow'}});
 await rename('Risk Analysis revised');await click('Save temporarily');
 const commands=send.mock.calls.map(([command])=>command);expect(commands.at(-2)).toEqual({type:'rename',text:'Risk Analysis revised'});expect(commands.at(-1)).toEqual({type:'saveTemporary'});
});
it('keeps an empty name editable and rejects saving it before touching storage or accounts',async()=>{
 await mount();await rename('   ');await click('Save temporarily');expect(send).not.toHaveBeenCalled();expect(accountAPI).not.toHaveBeenCalled();expect(element.textContent).toContain('Give your flow a name');
});
it('shows sharing and interactive preview directly in the save dialog',async()=>{
 await mount();expect(element.querySelector('details')?.open).toBe(true);await click('Try flow on app');expect(send).toHaveBeenCalledWith({type:'replay'});expect(element.textContent).toContain('Record walkthrough');
});
it('does not rename or save a different workflow if the active app changed',async()=>{
 await mount();send.mockResolvedValue({...snapshot,workflow:{...snapshot.workflow,id:'different'}});await rename('My flow');await click('Save to my account');expect(accountAPI).not.toHaveBeenCalled();expect(element.textContent).toContain('active workflow changed');expect(send).not.toHaveBeenCalledWith(expect.objectContaining({type:'rename'}));
});
