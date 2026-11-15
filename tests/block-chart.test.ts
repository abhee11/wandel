// @vitest-environment jsdom
import {expect,it} from 'vitest';
import {mountBlock,blockInteract} from '../extension/content/block';
import {BlockSchema,chartPoints} from '../extension/shared/block';
import {chatMarkdown,chatFileName} from '../extension/assistant/chatExport';
const block=(node:Record<string,unknown>)=>BlockSchema.parse({accent:'#5b5bd6',data:null,nodes:[{parent:-1,type:'card'},{parent:0,type:'chart',...node}]});
it('reads points written as "Label: number" and refuses a chart without them',()=>{
 expect(chartPoints(['Feedback: 68','Action | 84','Reflection: 76%'])).toEqual([{label:'Feedback',value:68},{label:'Action',value:84},{label:'Reflection',value:76}]);
 expect(BlockSchema.safeParse({nodes:[{parent:-1,type:'card'},{parent:0,type:'chart',items:['Feedback','Action']}]}).success).toBe(false);
 expect(BlockSchema.safeParse({nodes:[{parent:-1,type:'card'},{parent:0,type:'chart',items:['A: 1','B: 2'],options:['pie']}]}).success).toBe(false);
});
it('draws bars with their values, and its own switch turns them into a line and back',()=>{
 const host=document.createElement('section');document.body.append(host);
 mountBlock(host,block({text:'Value vs feedback',items:['Feedback: 68','Action: 84','Reflection: 76'],options:['bar','line']}),()=>{});
 const svg=()=>host.querySelector('svg')!;
 expect(svg().querySelectorAll('rect').length).toBe(3);
 expect(svg().getAttribute('aria-label')).toBe('Bar chart: Feedback 68, Action 84, Reflection 76');
 expect([...svg().querySelectorAll('text')].map(t=>t.textContent)).toEqual(expect.arrayContaining(['68','84','76','Feedback','Action','Reflection']));
 expect(host.textContent).toContain('Sample data');
 const line=host.querySelector<HTMLElement>('button[data-dx-chart-kind="line"]')!;
 expect(blockInteract(line)).toBe(true);
 expect(svg().querySelectorAll('rect').length).toBe(0);
 expect(svg().querySelector('polyline')).not.toBeNull();
 expect(svg().querySelectorAll('circle').length).toBe(3);
 expect(line.getAttribute('aria-pressed')).toBe('true');
 blockInteract(host.querySelector<HTMLElement>('button[data-dx-chart-kind="bar"]')!);
 expect(svg().querySelectorAll('rect').length).toBe(3);
});
it('shows no switch for a single kind, and a line chart when that is the kind',()=>{
 const host=document.createElement('section');document.body.append(host);
 mountBlock(host,block({items:['Mon: 3','Tue: 5'],options:['line']}),()=>{});
 expect(host.querySelector('button[data-dx-chart-kind]')).toBeNull();
 expect(host.querySelector('polyline')).not.toBeNull();
});
it('exports the chat as Markdown with pages, failures and flags',()=>{
 const text=chatMarkdown([{role:'user',text:'Add a chart',page:'/groups/1'},{role:'assistant',text:'Added it.',edited:true,review:'No values visible.'},{role:'user',text:'line too',status:'failed',error:'Failed to fetch'}],{name:'My test',origin:'https://app.example.test',exportedAt:new Date('2026-11-15T04:30:00Z')});
 expect(text).toContain('# Wandel chat · My test');
 expect(text).toContain('*Page: /groups/1*');
 expect(text).toContain('**You**\n> Add a chart');
 expect(text).toContain('Flagged by the visual check: No values visible.');
 expect(text).toContain('**You** *(not completed)*');
 expect(text).toContain('Error: Failed to fetch');
 expect(chatFileName('My test!',new Date('2026-11-15T00:00:00Z'))).toBe('wandel-chat-my-test-2026-11-15.md');
});
