// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import {Playground} from '../platform/web/Playground';
it('automatically moves, resizes, adds and types a theme prompt, then hands over without overwriting edits',async()=>{
 vi.useFakeTimers();(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 const element=document.createElement('div');document.body.append(element);const root=createRoot(element);
 try{
 await act(async()=>root.render(<Playground/>));
 const card=()=>element.querySelector<HTMLElement>('.w-card')!;
 const before=card().style.left;
 await act(async()=>vi.advanceTimersByTime(1700));expect(card().style.left).not.toBe(before);
 await act(async()=>vi.advanceTimersByTime(3800));expect(card().style.width).toBe(`${250/9}%`);
 await act(async()=>vi.advanceTimersByTime(3700));expect(element.textContent).toContain('Start something new');
 await act(async()=>vi.advanceTimersByTime(3500));expect(element.querySelector<HTMLTextAreaElement>('.w-prompt textarea')!.value).toContain('Make this a green');
 await act(async()=>vi.advanceTimersByTime(2000));expect(element.querySelector('.w-canvas.mint')).not.toBeNull();expect(element.textContent).toContain('Find your');
 await act(async()=>element.querySelector('.w-canvas')!.dispatchEvent(new Event('pointerdown',{bubbles:true})));
 expect(element.textContent).toContain('Replay demo');const state=element.querySelector('.w-canvas')!.innerHTML;
 await act(async()=>vi.advanceTimersByTime(25000));expect(element.querySelector('.w-canvas')!.innerHTML).toBe(state);
 const replay=Array.from(element.querySelectorAll('button')).find(button=>button.textContent?.includes('Replay demo'))!;
 await act(async()=>replay.click());expect(element.querySelector('.w-canvas.paper')).not.toBeNull();
 }finally{await act(async()=>root.unmount());element.remove();vi.useRealTimers();}
});

it('demonstrates the complete risk flow and lets a visitor continue from Details',async()=>{
 vi.useFakeTimers();(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 const element=document.createElement('div');document.body.append(element);const root=createRoot(element);
 try{
  await act(async()=>root.render(<Playground/>));
  await act(async()=>vi.advanceTimersByTime(20500));expect(element.querySelector('.w-canvas')!.textContent).toContain('Risk Analysis');expect(element.textContent).toContain('Customers');
  await act(async()=>vi.advanceTimersByTime(2500));expect(element.querySelector('.w-canvas')!.textContent).toContain('View Details');
  await act(async()=>vi.advanceTimersByTime(3000));expect(element.querySelector('.w-canvas')!.textContent).toContain('Customer details');
  const approve=Array.from(element.querySelectorAll('.w-button')).find(b=>b.textContent?.includes('Approve'))!;
  await act(async()=>approve.dispatchEvent(new Event('pointerdown',{bubbles:true,cancelable:true})));expect(element.querySelector('.w-canvas')!.textContent).toContain('Approved.');
  const content=element.querySelector('.w-canvas')!.textContent;await act(async()=>vi.advanceTimersByTime(40000));expect(element.querySelector('.w-canvas')!.textContent).toBe(content);
 }finally{await act(async()=>root.unmount());element.remove();vi.useRealTimers();}
});
