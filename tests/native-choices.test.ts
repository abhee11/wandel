// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {nativeChoices} from '../extension/content/nativeChoices';
import {describe} from '../extension/content/locator';
import {OperationSchema,RecordSchema,type Operation} from '../extension/shared/model';
import {Renderer} from '../extension/content/renderer';
import {createWorkflow} from '../extension/prototype/engine';
it('matches the nearby heading and pill, inserts above footer, and provides isolated choice behavior',()=>{
 document.body.innerHTML='<main><div id="dialog"><section style="display:flex;flex-direction:column;gap:24px"><h3 style="font-size:22px;font-weight:700">Metrics</h3><button type="button" aria-pressed="true" style="border-radius:99px;background-color:rgb(245,235,255);color:rgb(130,50,255);padding:12px 24px">Talk Time</button></section><footer><button>Cancel</button><button>Save</button></footer></div></main>';
 const target=document.getElementById('dialog')!,root=document.querySelector('main')!;let hostClicks=0;target.addEventListener('click',()=>hostClicks++);
 const ops:Operation[]=['Feedback length','Concise — Off','Normal — On','Elaborated — Off'].map((text,i)=>({id:'op'+i,kind:'insert',target:describe(target).locator,position:'inside',node:{id:'node'+i,kind:i?'button':'panel',text}}));
 const result=nativeChoices('Add a section with three toggle options',ops,target);expect(result).toHaveLength(1);const op=OperationSchema.parse(result[0]);expect(op.kind).toBe('insert');
 const w=createWorkflow(new URL('https://example.com'));w.states[0].operations=[op];const saved=RecordSchema.parse(JSON.parse(JSON.stringify({draft:w,enabled:true,currentVersion:0,versions:[]})));
 const renderer=new Renderer(root,()=>{});renderer.reconcile(saved.draft,w.entry);
 const group=target.querySelector<HTMLElement>('[data-dx-interactive]')!;expect(group.style.flexDirection).toBe('column');expect(group.style.gap).toBe('24px');expect(group.nextElementSibling?.tagName).toBe('FOOTER');expect(group.querySelector('h3')!.style.fontSize).toBe('22px');
 const buttons=group.querySelectorAll<HTMLButtonElement>('button');expect(buttons[0].style.borderRadius).toBe('99px');expect(buttons[1].getAttribute('aria-checked')).toBe('true');buttons[0].click();expect(buttons[0].getAttribute('aria-checked')).toBe('true');expect(buttons[1].getAttribute('aria-checked')).toBe('false');expect(hostClicks).toBe(0);
 renderer.reset();expect(target.querySelector('[data-dx-interactive]')).toBeNull();expect(target.querySelector('[aria-pressed]')).not.toBeNull();
});
it('does not guess a theme from Save buttons when no matching choice section exists',()=>{
 document.body.innerHTML='<main><h3>Settings</h3><button>Save</button></main>';const target=document.querySelector('main')!;const ops:Operation[]=['Choices','One','Two'].map((text,i)=>({id:'o'+i,kind:'insert',target:describe(target).locator,position:'inside',node:{id:'n'+i,kind:i?'button':'panel',text}}));expect(nativeChoices('Add a section of toggle options',ops,target)).toBe(ops);
});

it('anchors choice sections in a selected dialog even when AI supplies form targets',async()=>{
 const {promptOperations}=await import('../extension/ai/batch');
 document.body.innerHTML='<main><div role="dialog"><section><h3>Metrics</h3><button aria-pressed="true">Talk Time</button></section><footer><button>Save</button></footer></div></main>';
 const target=document.querySelector<HTMLElement>('[role=dialog]')!;
 const plan={steps:['Feedback length','Concise — Off','Normal — On','Elaborated — Off'].map((text,i)=>({kind:'insert',target:'form',position:'inside',element:i?'button':'panel',text,style:null}))};
 const ops=promptOperations('Add a section with three toggle options',plan,target,describe(target).locator,document.body,new Map());
 expect(ops).toHaveLength(1);expect(ops[0].kind==='insert'&&ops[0].node.choices?.selected).toBe(1);
});
it('turns the exact AI multi-option switch output into native matching choices',async()=>{
 const {promptOperations}=await import('../extension/ai/batch');
 document.body.innerHTML='<main><div id="dialog"><section><h3 style="font-size:22px">Metrics</h3><button aria-pressed="true" style="border-radius:99px;color:rgb(140,60,240)">Talk Time</button></section><footer><button>Cancel</button><button>Save</button></footer></div></main>';
 const target=document.getElementById('dialog')!;
 const plan={steps:[{kind:'insert',target:'selected',position:'inside',element:'panel',text:'Feedback length',style:null,control:{kind:'switch',options:['Concise','Normal','Elaborated'],contents:[]}}],flow:null,section:null};
 const ops=promptOperations('Add a section with three toggle options',plan,target,describe(target).locator,document.body,new Map());
 expect(ops).toHaveLength(1);expect(ops[0].kind==='insert'&&ops[0].node.choices?.options).toEqual(['Concise','Normal','Elaborated']);
});
it.each([
 'Add another section called Feedback length which has three options: 1. Concise - toggle (like others); 2. Normal; 3. Elaborated',
 'Add a “Feedback length” category below Metrics and above Cancel/Save. Match the existing headings, spacing and purple pill controls. Include Concise, Normal and Elaborated. Allow only one choice at a time, with Normal selected initially.'
])('builds the exact category prompt without AI, with native controls and undo: %s',async(prompt)=>{
 const {Session}=await import('../extension/content/session');const {Repository,BrowserStorage}=await import('../extension/storage/store');const {vi}=await import('vitest');
 localStorage.clear();document.body.innerHTML='<main><div id="dialog" role="dialog"><h2>Advanced</h2><section><h3 style="font-size:22px">Metrics</h3><button aria-pressed="true" style="border-radius:99px;color:rgb(140,60,240)">Talk Time</button></section><footer><button>Cancel</button><button>Save</button></footer></div></main>';
 const root=document.querySelector('main')!,plan=vi.fn().mockRejectedValue(new Error('AI unavailable')),session=new Session(root,new Repository(new BrowserStorage()),new URL('https://example.com'),{requestPlan:plan});
 try{await session.init();await session.dispatch({type:'edit'});document.getElementById('dialog')!.click();
 await session.promptHere(prompt,'element');
 expect(plan).not.toHaveBeenCalled();expect(session.workflow.states).toHaveLength(1);
 const group=root.querySelector('[role=radiogroup]')!;expect(group).not.toBeNull();const controls=group.querySelectorAll('button');expect([...controls].map(b=>b.getAttribute('aria-label'))).toEqual(['Concise','Normal','Elaborated']);expect(controls[0].style.borderRadius).toBe('99px');if(prompt.includes('initially'))expect(controls[1].getAttribute('aria-checked')).toBe('true');controls[1].click();expect(controls[1].getAttribute('aria-checked')).toBe('true');expect(group.parentElement!.nextElementSibling!.tagName).toBe('FOOTER');
 await session.dispatch({type:'undo'});expect(root.querySelector('[role=radiogroup]')).toBeNull();expect(root.querySelector('[aria-pressed]')).not.toBeNull();
 }finally{session.destroy();}
});
