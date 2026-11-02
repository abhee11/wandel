import {Session} from '../../extension/content/session';
import {Repository,BrowserStorage} from '../../extension/storage/store';
/** Applies plans through the real context → compile → render → verify path; no AI involved. */
const session=new Session(document.getElementById('page')!,new Repository(new BrowserStorage()),new URL(location.href),{assistantEnabled:true,historyStore:{read:async id=>JSON.parse(sessionStorage.getItem('wandel:history:'+id)||'null'),write:async(id,value)=>sessionStorage.setItem('wandel:history:'+id,JSON.stringify(value))}});
const ready=session.init().then(()=>session.dispatch({type:'edit'}));
const base={relativeTo:null,element:null,description:null,labels:[],position:null,styleRef:null,style:null,destination:null,newViewTitle:null,resultRef:null,text:null};
const context=async()=>{await ready;return (await session.dispatch({type:'assistantContext',instruction:'fixture',chat:true})).assistant!.context!;};
const apply=async(actions:Record<string,unknown>[])=>{const c=await context();try{await session.dispatch({type:'assistantApply',plan:{status:'edit',scope:'region',message:'fixture',reply:'fixture',question:null,candidates:[],memory:null,actions:actions.map(action=>({...base,...action}))},token:c.token});return 'OK';}catch(error){return error instanceof Error?error.message:String(error);}};
type Part=Record<string,unknown>&{parent:number;type:string};
const N=(parent:number,type:string,extra:Record<string,unknown>={}):Part=>({parent,type,text:null,detail:null,icon:null,variant:null,tone:null,level:null,columns:null,justify:null,selected:null,options:null,items:null,action:null,src:null,...extra});
/** Appends a subtree, re-basing its parent indexes onto an existing list. */
const graft=(into:Part[],parent:number,parts:Part[])=>{const offset=into.length;parts.forEach((part,i)=>into.push({...part,parent:i===0?parent:part.parent+offset}));return into;};
/** The generate/run/transcript content of the mockup's My Record card. */
const recordBody=():Part[]=>[N(-1,'stack',{level:4}),
 N(0,'row',{level:3}),N(1,'stat',{icon:'clock',text:'47m 12s'}),N(1,'stat',{icon:'document',text:'2,847 words'}),N(1,'stat',{icon:'video',text:'1 video'}),
 N(0,'stack',{level:1}),N(5,'heading',{level:3,text:'What would you like to generate?'}),N(5,'text',{level:3,text:'Runs on the whole session by default. Open the transcript to pick specific chunks.'}),
 N(0,'grid',{columns:5,level:2}),N(8,'tile',{icon:'feedback',text:'Feedback',detail:'Rubric scores and coaching notes',selected:true}),N(8,'tile',{icon:'book',text:'Summary',detail:'Short recap and next steps'}),N(8,'tile',{icon:'video',text:'Clip',detail:'Best moments as a video clip'}),N(8,'tile',{icon:'check',text:'IEP goals',detail:'Goals, accommodations, action items'}),N(8,'tile',{icon:'chat',text:'Participant Reflection',detail:'Questions drawn from the session'}),
 N(0,'card',{tone:'lilac'}),N(14,'eyebrow',{text:"Here's what will run"}),N(14,'heading',{level:2,text:'{selection} Report on the whole session'}),N(14,'stack',{level:3}),
 N(17,'field',{text:'Scope',detail:'Whole session · 47m 12s · 5 chunks',action:'Select chunks'}),N(17,'field',{text:'Rubrics',detail:'All 5: Engagement, Questioning, Pacing, Teachers lead…, Collaborative…',action:'Edit'}),N(17,'field',{text:'Metrics',detail:'Talk Time, Questions, Participant Questions',action:'Edit'}),
 N(17,'row',{level:2}),N(21,'text',{text:'Repeat'}),N(21,'choice',{options:['This session only','After every activity'],detail:'This session only'}),
 N(14,'row',{justify:'between'}),N(24,'text',{level:3,text:'Defaults come from your team settings. Adjust only if you need to.'}),N(24,'row',{level:2}),N(26,'button',{variant:'ghost',text:'Adjust'}),N(26,'button',{variant:'primary',text:'Generate'}),
 N(0,'disclosure',{text:'Transcript',detail:'5 chunks · 47m 12s · Whole session selected',action:'Select chunks'}),N(29,'list',{items:['Opening and warm-up','MLA citation mini-lesson','Group practice','Share-out','Wrap-up and exit ticket']})];
const accent='#7c4dff';
const find=(c:Awaited<ReturnType<typeof context>>,test:(e:typeof c.elements[number])=>boolean)=>c.elements.find(test)?.ref;
const steps={
 /** Case 2: fill the real My Record card, replacing its empty state. */
 async fillRecord(){const c=await context();return apply([{kind:'remove',targets:[find(c,e=>e.tag==='p'&&/long enough/.test(e.text||''))]},{kind:'create',targets:[find(c,e=>e.tag==='article'&&/My Record/.test(e.text||e.name||''))],element:'block',position:'inside',block:{accent,nodes:recordBody()}}]);},
 /** Case 1: a new prototype page built over several requests. */
 async newPage(){await ready;await session.dispatch({type:'createPage',route:'/report',title:'ELA Grade 9'});return 'OK';},
 async pageHeader(){const c=await context();return apply([{kind:'create',targets:[find(c,e=>e.owned&&/^view:/.test(e.attributes['data-dx-owned']||'')||e.tag==='section'&&e.owned)],element:'block',position:'inside',block:{accent,nodes:[N(-1,'row',{justify:'between'}),N(0,'row',{level:3}),N(1,'heading',{level:3,text:'MLA Citations'}),N(1,'icon',{icon:'chevron-down'}),N(1,'link',{text:'+ New Activity'}),N(0,'row',{level:2}),N(5,'text',{text:'02/12/26'}),N(5,'icon',{icon:'copy'})]}}]);},
 async takeaways(){const c=await context();return apply([{kind:'create',targets:[find(c,e=>e.tag==='section'&&e.owned)],element:'block',position:'inside',block:{accent,nodes:[N(-1,'card',{tone:'yellow'}),N(0,'row',{justify:'between'}),N(1,'row',{level:2}),N(2,'heading',{level:3,text:'Takeaways'}),N(2,'stat',{icon:'book',text:'Last updated at 8:00 on Oct 23, 2024'}),N(1,'icon',{icon:'info'}),N(0,'text',{text:'The Reflections from your students highlight a significant challenge in navigating their personal identities through their creative work. Many students expressed nostalgia for their home countries and traditions, indicating that they are grappling with the complexities of adaptation and self-expression in a new environment.'}),N(0,'row',{justify:'end'}),N(7,'button',{variant:'outline',text:'Reflect',icon:'arrow-up-right'})]}}]);},
 async recordCard(){const c=await context();const nodes=graft([N(-1,'card',{tone:'pink'}),N(0,'row',{justify:'between'}),N(1,'heading',{level:3,text:'My Record'}),N(1,'icon',{icon:'info'})],0,recordBody());return apply([{kind:'create',targets:[find(c,e=>e.tag==='section'&&e.owned)],element:'block',position:'inside',block:{accent,nodes}}]);},
 async bottomRow(){const c=await context();return apply([{kind:'create',targets:[find(c,e=>e.tag==='section'&&e.owned)],element:'block',position:'inside',block:{accent,nodes:[N(-1,'grid',{columns:3,level:3}),
  N(0,'card',{tone:'lime'}),N(1,'heading',{level:3,text:'Participant Reflection'}),N(1,'text',{variant:'primary',text:'Analyze the emotions and motivations of the main characters (the tree and the boy) using textual evidence.'}),N(1,'list',{items:["Tell me about something you're working on.",'How do you feel about your work?','What do you want to work on next?']}),N(1,'row',{level:2}),N(5,'button',{variant:'ghost',text:'Customize'}),N(5,'button',{variant:'outline',text:'Assign'}),
  N(0,'card',{tone:'sky'}),N(8,'eyebrow',{text:'Clip'}),N(8,'row',{level:1}),N(10,'heading',{level:3,text:'Direct vs. Indirect Quotes'}),N(10,'stat',{icon:'chat',text:'0'}),N(8,'text',{level:3,text:'8/28/26'}),N(8,'quote',{text:'The speeches are very similar, which I found surprising, since they seem different at first.'}),N(8,'image',{detail:'Teacher at a chalkboard'}),
  N(0,'card',{tone:'mint'}),N(16,'heading',{level:3,text:'Plan and Setup'}),N(16,'text',{text:"Changes saved! Let's make this activity great."})]}}]);}
};
// Mirrors the content script's page lifecycle.
window.addEventListener('pagehide',()=>session.pageLeaving());
Object.assign(window,{session,ready,context,apply,steps,N});
