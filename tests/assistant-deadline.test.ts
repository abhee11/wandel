import {afterEach,expect,it,vi} from 'vitest';
import {withDeadline} from '../extension/assistant/deadline';
afterEach(()=>vi.useRealTimers());
it('times out even if token retrieval or the network never settles or ignores abort',async()=>{
 vi.useFakeTimers();let bounded!:AbortSignal;
 const pending=withDeadline(signal=>{bounded=signal;return new Promise(()=>{});},new AbortController().signal,100);
 const rejection=expect(pending).rejects.toThrow('instruction is kept');await vi.advanceTimersByTimeAsync(100);await rejection;expect(bounded.aborted).toBe(true);
});
it('cancels a pending request immediately and removes its deadline',async()=>{
 vi.useFakeTimers();const controller=new AbortController(),pending=withDeadline(()=>new Promise(()=>{}),controller.signal,100);const rejection=expect(pending).rejects.toThrow('canceled');controller.abort();await rejection;expect(vi.getTimerCount()).toBe(0);
});
it('returns successful results and cleans up the timer',async()=>{
 vi.useFakeTimers();expect(await withDeadline(async()=>({text:'Feedback'}),new AbortController().signal)).toEqual({text:'Feedback'});expect(vi.getTimerCount()).toBe(0);
});
