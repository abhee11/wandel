import {describe,expect,it} from 'vitest';
import {refersBack,stableNames} from '../extension/assistant/stableRefs';
const id=()=>crypto.randomUUID();
const screen=()=>{const a='e_'+id(),b='e_'+id();return {json:JSON.stringify({token:id(),workflowId:id(),selected:a,elements:[{ref:a,name:'Cards'},{ref:b,name:'Review'}],groups:[{members:[a,b]}]}),a,b};};
describe('the same screen reaches the AI as the same text',()=>{
 it('names random ids by order of appearance',()=>{expect(stableNames(screen().json).text).toBe(stableNames(screen().json).text);});
 it('maps the plan back to the real handles, including generated refs that embed one',()=>{
  const {json,a,b}=screen(),named=stableNames(json);
  const plan=JSON.stringify({targets:['e_3','e_4'],relativeTo:'new:copy/e_3',text:'Keep e_12 and node_e_3 as written'});
  expect(JSON.parse(named.restore(plan))).toEqual({targets:[a,b],relativeTo:'new:copy/'+a,text:'Keep e_12 and node_e_3 as written'});
 });
 it('treats requests that point back at the chat as follow-ups',()=>{
  expect(refersBack('Add a promo banner above the cards')).toBe(false);
  expect(refersBack('make it bigger')).toBe(true);expect(refersBack('Fix the last change')).toBe(true);
 });
});
