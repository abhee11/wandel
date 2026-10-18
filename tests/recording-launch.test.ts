import {it,expect,vi,afterEach} from 'vitest';
import {registerRecordingLauncher} from '../extension/background/recording';
afterEach(()=>vi.unstubAllGlobals());
function setup(){let listener:any;const sendMessage=vi.fn(async(_id,request)=>({snapshot:{workflow:{id:'flow',name:'My journey'},enabled:true},capabilities:['panel-lifecycle-v1']}));const create=vi.fn().mockResolvedValue({id:9});vi.stubGlobal('chrome',{runtime:{id:'ext',getURL:(p:string)=>'chrome-extension://ext/'+p,onMessage:{addListener:(fn:any)=>listener=fn}},tabs:{sendMessage,create}});registerRecordingLauncher();return {listener,sendMessage,create};}
const sender={id:'ext',url:'chrome-extension://ext/sidepanel.html?tabId=12'};
it('preserves the current prototype in Interact and minimizes it before opening the recorder',async()=>{
 const {listener,sendMessage,create}=setup();const reply=vi.fn();expect(listener({type:'WANDEL_RECORD_WALKTHROUGH',workflowId:'flow'},sender,reply)).toBe(true);await vi.waitFor(()=>expect(create).toHaveBeenCalledOnce());
 expect(sendMessage.mock.calls.map(call=>call[1].command)).toEqual([{type:'snapshot'},{type:'interact'},{type:'minimizePanel'}]);expect(sendMessage.mock.calls.every(call=>call[0]===12)).toBe(true);expect(create).toHaveBeenCalledWith({url:'chrome-extension://ext/recorder.html?tabId=12&name=My+journey'});expect(reply).toHaveBeenCalledWith({ok:true});
});
it('does not launch for stale workflows or host content-script senders',async()=>{
 const {listener,sendMessage,create}=setup();const reply=vi.fn();expect(listener({type:'WANDEL_RECORD_WALKTHROUGH',workflowId:'flow'},{...sender,tab:{id:12},url:'https://app.example/'},reply)).toBeUndefined();expect(sendMessage).not.toHaveBeenCalled();
 listener({type:'WANDEL_RECORD_WALKTHROUGH',workflowId:'old-flow'},sender,reply);await vi.waitFor(()=>expect(reply).toHaveBeenCalled());expect(create).not.toHaveBeenCalled();expect(sendMessage).toHaveBeenCalledTimes(1);
});
it('keeps capture closed if preparation fails',async()=>{
 const {listener,sendMessage,create}=setup();sendMessage.mockImplementationOnce(async()=>({snapshot:{workflow:{id:'flow',name:'Name'},enabled:true},capabilities:['panel-lifecycle-v1']}));sendMessage.mockResolvedValueOnce({error:'Cannot minimize'} as any);const reply=vi.fn();listener({type:'WANDEL_RECORD_WALKTHROUGH',workflowId:'flow'},sender,reply);await vi.waitFor(()=>expect(reply).toHaveBeenCalledWith({error:'Cannot minimize'}));expect(create).not.toHaveBeenCalled();
});
