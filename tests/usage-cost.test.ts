import {describe,expect,it} from 'vitest';
import {claudeUsage,responsesUsage,usageCost} from '../platform/server/usage';
describe('AI usage cost',()=>{
 it('charges cached OpenAI input at the cached rate',()=>{
  const u=responsesUsage({usage:{input_tokens:12000,input_tokens_details:{cached_tokens:10000},output_tokens:500}})!;
  expect(u).toEqual({input:2000,cached:10000,output:500});
  expect(usageCost('gpt-6.1-sol',u)).toBeCloseTo((2000*2+10000*0.2+500*10)/1e6,6);
 });
 it('counts Claude cache writes at 1.25× input',()=>{
  const u=claudeUsage({usage:{input_tokens:100,cache_read_input_tokens:0,cache_creation_input_tokens:8000,output_tokens:300}})!;
  expect(usageCost('claude-sonnet-5-5',u)).toBeCloseTo((100*2+8000*2.5+300*10)/1e6,6);
 });
 it('returns null for an unknown model',()=>expect(usageCost('mystery',{input:1,cached:0,output:1})).toBeNull());
});
