import {afterEach,it,expect,vi} from 'vitest';
import {requestAI,checkAIConnection} from '../extension/ai/planner';
import {formPreset} from '../extension/ai/batch';
afterEach(()=>vi.unstubAllGlobals());
it('requires a configured AI connection and explains unreachable servers',async()=>{
 const fetch=vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));vi.stubGlobal('fetch',fetch);
 await expect(requestAI('Add fields',{tag:'button',label:'Sign in'},'')).rejects.toThrow('Connect AI first');expect(fetch).not.toHaveBeenCalled();
 await expect(requestAI('Add fields',{tag:'button',label:'Sign in'},'test-token')).rejects.toThrow('Cannot reach the AI planner');
});
it('accepts nullable provider styles but rejects arbitrary operations',async()=>{
 const step={kind:'style',target:'form',position:'inside',element:'panel',text:'',style:{display:'flex',gap:12,width:null}};
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({steps:[step]})}));
 expect(await requestAI('Change the layout',{tag:'button',label:'Sign in'},'test-token')).toEqual({steps:[{...step,style:{display:'flex',gap:12}}]});
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({steps:[{...step,target:'document',script:'run()'}]})}));
 await expect(requestAI('Change the layout',{tag:'button',label:'Sign in'},'test-token')).rejects.toThrow();
});
it('does not mistake an Address button for a form-fields request',()=>{expect(formPreset('Add Address below this')).toBeNull();expect(formPreset('Add first name and last name fields')?.steps).toHaveLength(2);});

it('checks connection without sending any prompt or page data',async()=>{
 const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({ready:true,model:'configured-model'})});vi.stubGlobal('fetch',fetch);
 expect(await checkAIConnection('local-token')).toBe('configured-model');
 expect(fetch.mock.calls[0][0]).toBe('http://127.0.0.1:4319/health');
 expect(fetch.mock.calls[0][1].body).toBeUndefined();
 expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer local-token');
});
it('does not label an invalid or unauthorized server as connected',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,json:async()=>({error:'Planner access denied.'})}));
 await expect(checkAIConnection('bad-token')).rejects.toThrow('Planner access denied');
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({})}));
 await expect(checkAIConnection('local-token')).rejects.toThrow('Update and restart');
});
