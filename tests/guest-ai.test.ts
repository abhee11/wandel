import {it,expect,vi} from 'vitest';
import {database} from '../platform/server/db';
import {guestPlan} from '../platform/server/guestAI';
import {randomUUID} from 'node:crypto';
const plan={steps:[{kind:'text',target:'selected',position:'after',element:'text',text:'Updated heading',style:null}]};
const data=(guestId=randomUUID())=>({guestId,requestId:randomUUID(),prompt:'Rename this heading',selection:{tag:'h2',label:'Hello'}});
const date=new Date('2026-10-05'),pepper='test-guest-pepper';
it('reserves two previews durably, caches retries, and rejects third without calling AI',async()=>{const db=database(':memory:'),ai={plan:vi.fn().mockResolvedValue(plan)},input=data();try{
 expect((await guestPlan(db,ai,pepper,'ip',input,date)).remaining).toBe(1);
 await guestPlan(db,ai,pepper,'ip',input,date);expect(ai.plan).toHaveBeenCalledTimes(1);
 await guestPlan(db,ai,pepper,'ip',{...input,requestId:randomUUID()},date);
 await expect(guestPlan(db,ai,pepper,'ip',{...input,requestId:randomUUID()},date)).rejects.toMatchObject({code:'GUEST_LIMIT'});expect(ai.plan).toHaveBeenCalledTimes(2);
 }finally{db.close();}});
it('rejects irrelevant, oversized and workflow prompts before spending tokens',async()=>{const db=database(':memory:'),ai={plan:vi.fn()};try{for(const prompt of ['Write me a poem','Reimagine this '+ 'x'.repeat(600),'Add a multi-step workflow to this button'])await expect(guestPlan(db,ai,pepper,'ip',{...data(),prompt},date)).rejects.toThrow();expect(ai.plan).not.toHaveBeenCalled();}finally{db.close();}});
it('caps new guest identities by IP and counts failed provider attempts',async()=>{const db=database(':memory:'),ai={plan:vi.fn().mockRejectedValue(new Error('Provider failed'))};try{
 for(let i=0;i<10;i++)await expect(guestPlan(db,ai,pepper,'same-ip',data(),date)).rejects.toMatchObject({code:'GUEST_AI_FAILED'});
 await expect(guestPlan(db,ai,pepper,'same-ip',data(),date)).rejects.toMatchObject({code:'GUEST_BUSY'});expect(ai.plan).toHaveBeenCalledTimes(10);
 }finally{db.close();}});
it('rejects provider output outside the guest boundary',async()=>{const db=database(':memory:'),ai={plan:vi.fn().mockResolvedValue({steps:[{...plan.steps[0],target:'form'}]})};try{await expect(guestPlan(db,ai,pepper,'ip',data(),date)).rejects.toMatchObject({code:'GUEST_AI_FAILED'});}finally{db.close();}});
