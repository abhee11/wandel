import {it,expect,vi,afterEach,beforeEach} from 'vitest';
import {OpenAIAssistant} from '../platform/server/assistant';
import {usageCost} from '../platform/server/usage';
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();delete process.env.WANDEL_FLEX;});
beforeEach(()=>{process.env.WANDEL_FLEX='1';});
const reply=(tier:string)=>new Response(JSON.stringify({status:'completed',service_tier:tier,usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:10},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({next:null,reply:null,spoken:null,memory:null,status:'answer',scope:'page',message:'Hello.',question:null,candidates:[],actions:[]})}]}]}),{status:200});
const context={token:'t',workflowId:'w',stateId:'s',route:'/',selected:null,hover:null,styleReference:null,elements:[],recent:[],lastGroup:null,lastView:null,views:[],limitations:[]} as any;
it('with WANDEL_FLEX=1, plans on the flex tier, and falls back to the standard tier when flex has no capacity',async()=>{
 vi.spyOn(console,'info').mockImplementation(()=>{});
 const sent:any[]=[];const fetchMock=vi.fn(async(_url:string,init:any)=>{const body=JSON.parse(init.body);sent.push(body);return body.service_tier==='flex'&&sent.length===1?new Response(JSON.stringify({error:{code:'resource_unavailable',message:'Flex capacity unavailable'}}),{status:429}):reply(body.service_tier||'default');});
 vi.stubGlobal('fetch',fetchMock);
 const assistant=new OpenAIAssistant('sk-test','gpt-6.1-sol');
 await assistant.plan({instruction:'Say hello',context});
 expect(sent.map(b=>b.service_tier)).toEqual(['flex',undefined]);
 sent.length=0;fetchMock.mockImplementation(async(_url:string,init:any)=>{const body=JSON.parse(init.body);sent.push(body);return reply(body.service_tier);});
 await assistant.plan({instruction:'Say hello',context});expect(sent.map(b=>b.service_tier)).toEqual(['flex']);
 process.env.WANDEL_FLEX='0';sent.length=0;await assistant.plan({instruction:'Say hello',context});expect(sent[0].service_tier).toBeUndefined();
});
it('prices flex calls at the flex rate',()=>{
 expect(usageCost('gpt-6.1-sol',{input:1e6,cached:0,output:0,tier:'flex'})).toBe(1);
 expect(usageCost('gpt-6.1-sol',{input:1e6,cached:0,output:0})).toBe(2);
});
