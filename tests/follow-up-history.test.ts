import {describe,expect,it} from 'vitest';
import {continuesChat} from '../extension/assistant/stableRefs';
import {continueRequest} from '../extension/assistant/conversation';
const asked=[{role:'user',text:'Add a filter to this table for Salary, Location, Status, Date Saved and Excitement',status:'sent'},{role:'assistant',text:'For Excitement, should the filter use a minimum rating, such as 3 stars or more, or let you select multiple exact ratings, such as 3 and 5 stars?'}];
const built=[{role:'user',text:'Exact ratings',status:'sent'},{role:'assistant',text:'Added an Exact excitement rating dropdown. Next, I can connect the dropdown to the job rows so it filters them.'}];
describe('answers and suggested steps keep the conversation',()=>{
 it('an answer to a question Wandel asked is a follow-up',()=>{expect(continuesChat('Let me pick several exact ratings like 3 and 5 stars together please',asked)).toBe(true);});
 it('a short reply is a follow-up',()=>{expect(continuesChat('Panel behind a Filters button',[...asked.slice(0,1),{role:'assistant',text:'Filters will sit in a panel.'}])).toBe(true);});
 it('the step Wandel just suggested is a follow-up',()=>{expect(continuesChat('connect the dropdown to the job rows so it filters them',built)).toBe(true);expect(continuesChat('Connect the dropdown to the job rows and show matching jobs only',built)).toBe(true);});
 it('a new, unrelated request is still planned from the page alone',()=>{expect(continuesChat('Add a promo banner above the table with a headline and a sign up button',built)).toBe(false);expect(continuesChat('Add a promo banner above the cards',[])).toBe(false);});
});
describe('answers stay attached to the original request',()=>{
 it('adds each answer without nesting',()=>{let r=continueRequest('Add five filters','Panel');r=continueRequest(r,'Immediately');expect(r).toBe('Continue this request: Add five filters\nUser clarification: Panel\nUser clarification: Immediately');});
 it('stays within the server limit and keeps the original request',()=>{let r='Add filters for Salary, Location, Status, Date Saved and Excitement';for(let i=0;i<40;i++)r=continueRequest(r,'answer number '+i+' '+'x'.repeat(60));expect(r.length).toBeLessThanOrEqual(1600);expect(r).toContain('Salary, Location, Status, Date Saved and Excitement');expect(r).toContain('answer number 39');});
});
