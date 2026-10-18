import {it,expect,vi,afterEach} from 'vitest';
import {ChromeBridge} from '../extension/sidepanel/bridge';
afterEach(()=>vi.unstubAllGlobals());
const flush=()=>new Promise(r=>setTimeout(r,0));
function setup(){
 let active=1,activate=(_:{tabId:number;windowId?:number})=>{};
 const ports:{disconnect:ReturnType<typeof vi.fn>;onDisconnect:{addListener:ReturnType<typeof vi.fn>}}[]=[];
 const sendMessage=vi.fn(async()=>({snapshot:{}})),executeScript=vi.fn(async()=>[]);
 vi.stubGlobal('chrome',{runtime:{onMessage:{addListener:vi.fn()}},scripting:{executeScript},tabs:{onActivated:{addListener:(fn:typeof activate)=>{activate=fn;}},onUpdated:{addListener:vi.fn()},query:async()=>[{id:active,windowId:4}],connect:vi.fn(()=>{const port={disconnect:vi.fn(),onDisconnect:{addListener:vi.fn()}};ports.push(port);return port;}),sendMessage}});
 return {ports,sendMessage,executeScript,switchTab:(id:number)=>{active=id;activate({tabId:id});},otherWindow:()=>activate({tabId:9,windowId:8})};
}
it('keeps the panel bound to its owner tab and disconnects when switching away',async()=>{
 const mock=setup();const bridge=new ChromeBridge(1);bridge.subscribe(()=>{});await flush();
 expect(mock.sendMessage).toHaveBeenLastCalledWith(1,{type:'DX_COMMAND',command:{type:'edit'}},{frameId:0});
 mock.sendMessage.mockClear();mock.switchTab(2);await flush();expect(mock.ports[0].disconnect).toHaveBeenCalledOnce();expect(mock.sendMessage).not.toHaveBeenCalled();
 mock.switchTab(1);await flush();expect(mock.sendMessage).toHaveBeenLastCalledWith(1,{type:'DX_COMMAND',command:{type:'edit'}},{frameId:0});
});
it('recovers a missing content script on an already-open app',async()=>{
 const mock=setup();mock.sendMessage.mockRejectedValueOnce(new Error('Receiving end does not exist'));
 const bridge=new ChromeBridge(1);bridge.subscribe(()=>{});await flush();
 expect(mock.executeScript).toHaveBeenCalledWith({target:{tabId:1,frameIds:[0]},files:['content.js']});
 expect(mock.sendMessage).toHaveBeenLastCalledWith(1,{type:'DX_COMMAND',command:{type:'edit'}},{frameId:0});expect(bridge.connectionError).toBe('');
});
it('reports unavailable site access and allows retry',async()=>{
 const mock=setup();mock.sendMessage.mockRejectedValueOnce(new Error('Missing script'));mock.executeScript.mockRejectedValueOnce(new Error('Access denied'));
 const bridge=new ChromeBridge(1);bridge.subscribe(()=>{});await flush();expect(bridge.connectionError).toContain('site access');
 await bridge.retry();expect(bridge.connectionError).toBe('');
});
it('does not connect or inject when a panel starts while a different tab is active',async()=>{
 const mock=setup();mock.switchTab(2);new ChromeBridge(1).subscribe(()=>{});await flush();expect(mock.sendMessage).not.toHaveBeenCalled();expect(mock.executeScript).not.toHaveBeenCalled();
});

it('handles a lost port and reconnects on explicit retry without replaying a mutation',async()=>{
 const mock=setup(),bridge=new ChromeBridge(1);const listener=vi.fn();bridge.subscribe(listener);await flush();
 const read=vi.fn(()=>({message:'Page moved into back/forward cache'}));Object.defineProperty(chrome.runtime,'lastError',{get:read,configurable:true});
 mock.ports[0].onDisconnect.addListener.mock.calls[0][0]();expect(read).toHaveBeenCalled();expect(listener).toHaveBeenLastCalledWith(null);expect(bridge.connectionError).toContain('Retry');
 await bridge.retry();expect(bridge.connectionError).toBe('');expect(mock.sendMessage).toHaveBeenLastCalledWith(1,{type:'DX_COMMAND',command:{type:'edit'}},{frameId:0});
});

it('releases a stalled page command without automatically replaying it',async()=>{
 const mock=setup(),bridge=new ChromeBridge(1);bridge.subscribe(()=>{});await flush();
 vi.useFakeTimers();
 try{mock.sendMessage.mockImplementationOnce(()=>new Promise(()=>{}));const result=bridge.send({type:'replay'});const assertion=expect(result).rejects.toThrow('page did not respond');await vi.advanceTimersByTimeAsync(10000);await assertion;expect(mock.sendMessage).toHaveBeenCalledTimes(3);}finally{vi.useRealTimers();}
});

it('rejects a settings command before mutation when the page still runs the older script',async()=>{
 const mock=setup(),bridge=new ChromeBridge(1);bridge.subscribe(()=>{});await flush();mock.sendMessage.mockClear();
 await expect(bridge.send({type:'settingsPrompt',prompt:'Add a theme in Advanced'})).rejects.toThrow('older Wandel script');
 expect(mock.sendMessage).toHaveBeenCalledTimes(1);expect(mock.sendMessage).toHaveBeenCalledWith(1,{type:'DX_COMMAND',command:{type:'snapshot'}},{frameId:0});
});
it('refuses manual editor actions on an outdated page before making a change',async()=>{
 const mock=setup(),bridge=new ChromeBridge(1);bridge.subscribe(()=>{});await flush();mock.sendMessage.mockClear();
 await expect(bridge.send({type:'interact'})).rejects.toThrow('older Wandel script');
 expect(mock.sendMessage).toHaveBeenCalledTimes(1);
});
it('requires the connection capability before saving a visual rule to an older content script',async()=>{
 const mock=setup(),bridge=new ChromeBridge(1);bridge.subscribe(()=>{});await flush();mock.sendMessage.mockClear();
 await expect(bridge.send({type:'connect',to:'view',event:'click',conditions:[]})).rejects.toThrow('older Wandel script');expect(mock.sendMessage).toHaveBeenCalledTimes(1);
});

it('requires the side-panel connection capability before editing a connection draft',async()=>{
 const mock=setup(),bridge=new ChromeBridge(1);bridge.subscribe(()=>{});await flush();mock.sendMessage.mockClear();await expect(bridge.send({type:'connectionAction',change:{action:'pick'}})).rejects.toThrow('older Wandel script');expect(mock.sendMessage).toHaveBeenCalledTimes(1);
});

it('keeps the source connection when a companion browser in another window becomes active',async()=>{
 const mock=setup(),bridge=new ChromeBridge(1),listener=vi.fn();bridge.subscribe(listener);await flush();listener.mockClear();mock.otherWindow();await flush();expect(mock.ports[0].disconnect).not.toHaveBeenCalled();expect(listener).not.toHaveBeenCalledWith(null);await bridge.send({type:'snapshot'});expect(mock.sendMessage).toHaveBeenLastCalledWith(1,{type:'DX_COMMAND',command:{type:'snapshot'}},{frameId:0});
});

it('does not reconnect or pause the source when returning from destination browsing',async()=>{
 const mock=setup(),bridge=new ChromeBridge(1),listener=vi.fn();bridge.subscribe(listener);await flush();listener.mockClear();mock.sendMessage.mockClear();mock.switchTab(1);await flush();expect(mock.ports[0].disconnect).not.toHaveBeenCalled();expect(listener).not.toHaveBeenCalledWith(null);expect(mock.sendMessage).not.toHaveBeenCalled();
});
it('resumes a minimized panel without sending Edit and resetting its interaction state',async()=>{
 const mock=setup();mock.sendMessage.mockResolvedValue({snapshot:{panelMinimized:true}} as any);const bridge=new ChromeBridge(1);bridge.subscribe(()=>{});await flush();expect(mock.sendMessage).toHaveBeenLastCalledWith(1,{type:'DX_COMMAND',command:{type:'snapshot'}},{frameId:0});expect(mock.sendMessage.mock.calls.some(call=>(call as any)[1]?.command?.type==='edit')).toBe(false);
});
