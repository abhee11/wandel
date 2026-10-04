import {it,expect,vi,afterEach} from 'vitest';
import {ChromeBridge} from '../extension/sidepanel/bridge';
afterEach(()=>vi.unstubAllGlobals());
const flush=()=>new Promise(r=>setTimeout(r,0));
function setup(){
 let active=1,activate=(_:{tabId:number})=>{};
 const ports:{disconnect:ReturnType<typeof vi.fn>}[]=[];
 const sendMessage=vi.fn(async()=>({snapshot:{}})),executeScript=vi.fn(async()=>[]);
 vi.stubGlobal('chrome',{runtime:{onMessage:{addListener:vi.fn()}},scripting:{executeScript},tabs:{onActivated:{addListener:(fn:typeof activate)=>{activate=fn;}},onUpdated:{addListener:vi.fn()},query:async()=>[{id:active}],connect:vi.fn(()=>{const port={disconnect:vi.fn()};ports.push(port);return port;}),sendMessage}});
 return {ports,sendMessage,executeScript,switchTab:(id:number)=>{active=id;activate({tabId:id});}};
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
