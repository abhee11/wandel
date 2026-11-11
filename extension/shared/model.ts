import {AssistantMemorySchema,type AssistantMemory} from './assistantMemory';
import {PrototypePageSchema,ChartSchema} from './prototypePage';
import {BlockSchema} from './block';
import {CopyIconSchema} from '../content/copyIcon';
import type {AssistantSnapshot} from '../assistant/schema';
import { z } from 'zod';
const id = z.string().min(1).max(100);
const label = z.string().min(1).max(300);
export const LocatorSchema = z.object({
  popup:z.object({role:z.enum(["listbox","menu"]),id:z.string().max(2048),label:z.string().max(2048)}).strict().optional(),
  structure:z.object({anchorId:z.string().min(1).max(2048),path:z.array(z.number().int().min(0).max(10000)).max(32)}).strict().optional(),
  textPath:z.array(z.number().int().min(0).max(10000)).min(1).max(32).optional(),
  ancestorTags:z.array(z.string().max(40)).max(32).optional(),
  owned: id.optional(), tag: z.string().max(40), role: z.string().max(60), name: z.string().max(300), text: z.string().max(300),
  attrs: z.record(z.enum(['id','class','data-testid','data-test','data-qa','data-block-id','alt','src','name','type','placeholder','aria-label']), z.string().max(2048)),
  parent: z.object({ tag: z.string(), id: z.string(), role: z.string(), label: z.string() }), previous: z.string().max(100), next: z.string().max(100)
}).strict();
export type Locator = z.infer<typeof LocatorSchema>;
export const copyTags=['div','span','p','button','a','section','article','header','footer','nav','main','aside','h1','h2','h3','h4','ul','ol','li','label','input','textarea','strong','em','small','br','img','#text'] as const;
export const copyStyles=['display','box-sizing','width','height','min-width','max-width','padding','margin','gap','flex-direction','flex-wrap','align-self','justify-self','row-gap','column-gap','order','flex-grow','flex-shrink','flex-basis','min-height','max-height','border-color','border-width','border-style','align-items','justify-content','grid-template-columns','color','background-color','background-image','border','border-radius','box-shadow','font-family','font-size','font-weight','font-style','line-height','text-align','text-decoration-line','letter-spacing','white-space','opacity','list-style-type','object-fit','position','top','right','bottom','left','z-index','float','clear','vertical-align','background-position','background-size','background-repeat','text-indent','visibility','overflow-x','overflow-y','text-overflow','mask-image','-webkit-mask-image','-webkit-line-clamp','-webkit-box-orient'] as const;
// A copied control may be drawn by an inline SVG background (a checkbox circle); it is inert and loads nothing.
export const svgBackground=(v:string)=>v.length<=8000&&/^url\("data:image\/svg\+xml[^"\\<>]*"\)$/.test(v);
export const ImageSourceSchema=z.string().max(700000).refine(value=>{if(/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(value))return true;
 // An SVG shown as an image cannot run scripts or load other resources; pages often draw controls this way.
 if(/^data:image\/svg\+xml(;charset=[\w-]+)?(;base64)?,/i.test(value)&&value.length<=20000)return true;try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}},'Use an HTTP(S) image or an uploaded PNG, JPEG, WebP or GIF.');
export const LinkURLSchema=z.string().max(2048).refine(value=>{try{const url=new URL(value);return ['https:','http:','mailto:','tel:'].includes(url.protocol)&&!url.username&&!url.password;}catch{return false;}},'Use an HTTP(S), email or phone link.');
export const NavigationURLSchema=z.string().min(1).max(2048).refine(value=>{if(/[\\\x00-\x20]/.test(value))return false;if(value.startsWith('/')&&!value.startsWith('//'))return true;return LinkURLSchema.safeParse(value).success;},'Use an application route or an HTTP(S), email or phone link.');
export const ThemeSchema=z.object({secondary:z.string().regex(/^#[0-9a-f]{6}$/i).optional(),tertiary:z.string().regex(/^#[0-9a-f]{6}$/i).optional(),background:z.string().regex(/^#[0-9a-f]{6}$/i),surface:z.string().regex(/^#[0-9a-f]{6}$/i),text:z.string().regex(/^#[0-9a-f]{6}$/i),accent:z.string().regex(/^#[0-9a-f]{6}$/i),accentText:z.string().regex(/^#[0-9a-f]{6}$/i)}).strict();
export const CopyNodeSchema=z.object({id,disabled:z.boolean().optional(),icon:CopyIconSchema.optional(),href:LinkURLSchema.optional(),role:z.enum(['button','link']).optional(),src:ImageSourceSchema.optional(),alt:z.string().max(300).optional(),parent:z.number().int().min(-1).max(799),tag:z.enum(copyTags),text:z.string().max(2000),style:z.record(z.enum(copyStyles),z.string().max(8000).refine(v=>svgBackground(v)||v.length<=300&&! /url\s*\(|expression|[<>\\]/i.test(v))),inputType:z.enum(['text','email','number','tel','url','search','date','checkbox','radio','password']).optional(),placeholder:z.string().max(300).optional()}).strict();
export type CopyNode=z.infer<typeof CopyNodeSchema>;
export const CopySchema=z.array(CopyNodeSchema).min(1).max(800).superRefine((nodes,ctx)=>{nodes.forEach((n,i)=>{if((i===0?n.parent!==-1||n.tag==='#text':n.parent<0||n.parent>=i||nodes[n.parent]?.tag==='#text'))ctx.addIssue({code:'custom',message:'Invalid copy tree'});});});
export const DataKeySchema=z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,79}$/);
export const DataValueSchema=z.string().max(300);
export const DataEntrySchema=z.object({key:DataKeySchema,value:DataValueSchema}).strict();
export const FieldTypeSchema=z.enum(['text','email','number','url','tel','password','date','time','checkbox','radio','textarea','select']);
export type FieldType=z.infer<typeof FieldTypeSchema>;
export const NodeSchema = z.object({ id, semanticTag:z.enum(['header','nav','a']).optional(),href:NavigationURLSchema.optional(), kind: z.enum(['button','panel','text','field']), text: z.string().max(300), binding:DataKeySchema.optional(),appearance:CopyNodeSchema.shape.style.optional(),inputAppearance:CopyNodeSchema.shape.style.optional(),required:z.boolean().optional(),inputType:FieldTypeSchema.optional(),options:z.array(label).min(1).max(20).optional(),radioGroup:z.string().max(80).optional(),control:z.object({kind:z.enum(['switch','menu','tabs']),options:z.array(label).min(1).max(8),contents:z.array(label).max(8).optional()}).strict().optional(),choices:z.object({options:z.array(label).min(2).max(8),selected:z.number().int().min(0).max(7),headingTag:z.enum(['h2','h3','h4']),headingStyle:CopyNodeSchema.shape.style,buttonStyle:CopyNodeSchema.shape.style,sectionStyle:CopyNodeSchema.shape.style}).strict().refine(v=>v.selected<v.options.length).optional(),widget:z.enum(['theme','viewport']).optional(),isolated:z.boolean().optional(),copy:CopySchema.optional(),chart:ChartSchema.optional(),block:BlockSchema.optional(),grid:z.object({start:z.number().int().min(1).max(24),span:z.number().int().min(1).max(12)}).strict().optional() }).strict();
export const StyleSchema = z.object({
 position:z.enum(['static','relative','absolute','fixed','sticky']).optional(),inlineSize:z.enum(['auto','100%']).optional(),blockSize:z.enum(['auto','100%']).optional(),maxInlineSize:z.enum(['none','100%']).optional(),minInlineSize:z.enum(['auto','0']).optional(),boxSizing:z.enum(['border-box','content-box']).optional(),
 top:z.union([z.number().min(-4000).max(4000),z.literal('auto')]).optional(),right:z.union([z.number().min(-4000).max(4000),z.literal('auto')]).optional(),bottom:z.union([z.number().min(-4000).max(4000),z.literal('auto')]).optional(),left:z.union([z.number().min(-4000).max(4000),z.literal('auto')]).optional(),
 display:z.enum(['flex','grid','block','inline-flex','inline-block']).optional(),flexDirection:z.enum(['column','row','row-reverse','column-reverse']).optional(),
 flexBasis:z.enum(['auto','0']).optional(),
 alignContent:z.enum(['start','end','center','stretch','space-between','space-around','space-evenly']).optional(),
 alignItems:z.enum(['stretch','center','flex-start','flex-end','baseline']).optional(),justifyContent:z.enum(['flex-start','flex-end','center','space-between','space-around','space-evenly']).optional(),
 alignSelf:z.enum(['auto','stretch','center','flex-start','flex-end']).optional(),justifySelf:z.enum(['auto','stretch','center','start','end']).optional(),flexWrap:z.enum(['nowrap','wrap','wrap-reverse']).optional(),
 fontFamily:z.string().min(1).max(120).regex(/^[a-z0-9 ,\"'-]+$/i).optional(),boxShadow:z.string().min(1).max(200).regex(/^[a-z0-9 #().,%/+-]+$/i).refine(v=>! /url|expression|var\s*\(/i.test(v)).optional(),borderStyle:z.enum(['none','solid','dashed','dotted','double']).optional(),borderBottomStyle:z.enum(['none','solid','dashed','dotted','double']).optional(),borderBottomColor:z.string().regex(/^#[0-9a-f]{6}$/i).optional(),borderBottomWidth:z.number().min(0).max(20).optional(),
 textAlign:z.enum(['left','center','right','justify','start','end']).optional(),
 gridColumn:z.enum(['auto','1 / -1']).optional(),
 gridTemplateColumns:z.string().min(1).max(160).regex(/^[a-z0-9 ().,%/+-]+$/i).refine(v=>! /url|expression|var\s*\(/i.test(v)).optional(),
 gap:z.number().min(0).max(200).optional(),rowGap:z.number().min(0).max(200).optional(),columnGap:z.number().min(0).max(200).optional(),padding:z.number().min(0).max(200).optional(),
 paddingTop:z.number().min(0).max(200).optional(),paddingRight:z.number().min(0).max(800).optional(),paddingBottom:z.number().min(0).max(200).optional(),paddingLeft:z.number().min(0).max(800).optional(),
 margin:z.number().min(-200).max(400).optional(),marginTop:z.number().min(-200).max(400).optional(),marginRight:z.number().min(-200).max(400).optional(),marginBottom:z.number().min(-200).max(400).optional(),marginLeft:z.number().min(-200).max(400).optional(),
 color:z.string().regex(/^#[0-9a-f]{6}$/i).optional(),backgroundColor:z.string().regex(/^#[0-9a-f]{6}$/i).optional(),borderColor:z.string().regex(/^#[0-9a-f]{6}$/i).optional(),borderRadius:z.number().min(0).max(200).optional(),borderWidth:z.number().min(0).max(20).optional(),
 width:z.number().min(1).max(4000).optional(),height:z.number().min(1).max(4000).optional(),maxWidth:z.number().min(1).max(4000).optional(),minHeight:z.number().min(0).max(4000).optional(),
 fontSize:z.number().min(6).max(200).optional(),fontWeight:z.number().int().min(100).max(900).optional(),lineHeight:z.number().min(0.8).max(4).optional(),opacity:z.number().min(0).max(1).optional(),order:z.number().int().min(-100).max(100).optional(),flexGrow:z.number().min(0).max(10).optional(),flexShrink:z.number().min(0).max(10).optional(),
 x:z.number().min(-10000).max(10000).optional(),y:z.number().min(-10000).max(10000).optional()
}).strict();
export type StylePatch = z.infer<typeof StyleSchema>;
const LayoutChangeSchema=z.object({id,direction:z.enum(['sidebar','header']),source:LocatorSchema}).strict();
export const OperationSchema = z.discriminatedUnion('kind', [
  z.object({id,kind:z.literal('theme'),target:LocatorSchema,theme:ThemeSchema}).strict(),
  z.object({id,kind:z.literal('appearance'),target:LocatorSchema,style:CopyNodeSchema.shape.style}).strict(),
  z.object({id,kind:z.literal('image'),target:LocatorSchema,src:ImageSourceSchema,fit:z.enum(['cover','contain'])}).strict(),
  z.object({id,kind:z.literal('iconOnly'),target:LocatorSchema,text:z.string().min(1).max(300)}).strict(),
  z.object({id,kind:z.literal('tooltip'),target:LocatorSchema,text:z.string().min(1).max(600)}).strict(),
  z.object({id,kind:z.literal('icon'),target:LocatorSchema,icon:CopyIconSchema}).strict(),
  z.object({ id, kind: z.literal('insert'), target: LocatorSchema, position: z.enum(['before','after','inside','below']), node: NodeSchema.refine(node=>node.kind==='panel'||!!node.text.trim(),{message:'A visible text or control label is required.'}) }).strict(),
  z.object({id,kind:z.literal('reorder'),target:LocatorSchema,anchor:LocatorSchema,position:z.enum(['before','after','inside']),layoutChange:LayoutChangeSchema.optional()}).strict(),
  z.object({id,kind:z.literal('mirror'),target:LocatorSchema,source:LocatorSchema}).strict(),
  z.object({id,kind:z.literal('trigger'),target:LocatorSchema,source:id}).strict(),
  z.object({ id, kind: z.literal('text'), target: LocatorSchema, text: z.string().max(300) }).strict(),
  z.object({id,kind:z.literal('style'),target:LocatorSchema,style:StyleSchema,arrangement:z.object({direction:z.enum(['horizontal','vertical','grid']),columns:z.number().int().min(1).max(6),gap:z.number().min(0).max(200)}).strict().optional(),layoutChange:LayoutChangeSchema.optional()}).strict(),
  z.object({id,kind:z.literal('remove'),target:LocatorSchema}).strict(),
  // Free-form CSS declarations on any element, real or prototype; checked for safe values when applied.
  z.object({id,kind:z.literal('css'),target:LocatorSchema,css:z.string().min(1).max(3000)}).strict(),
  // When something happens on the target, change other elements: the general way to make anything expand, toggle, reveal or switch.
  // A copied option in a pick-one group: clicking it or its original moves the selected look, renames the group's title and closes the menu.
  z.object({id,kind:z.literal('choice'),target:LocatorSchema,container:LocatorSchema.optional(),group:z.string().max(400),original:LocatorSchema,carrier:LocatorSchema,background:z.string().max(200),labels:z.array(LocatorSchema).max(3),text:z.string().min(1).max(300),originalText:z.string().max(300)}).strict(),
  z.object({id,kind:z.literal('behavior'),target:LocatorSchema,event:z.enum(['click','hover','load']),when:z.object({target:LocatorSchema.optional(),text:z.string().min(1).max(200).optional(),key:z.string().min(1).max(80).optional(),is:z.string().max(200).optional(),present:z.boolean()}).strict().refine(value=>!!value.target||!!value.text||!!value.key,'A condition needs an element, text or value to look for.').optional(),effects:z.array(z.object({action:z.enum(['show','hide','toggle','text','style','toast']),target:LocatorSchema,value:z.string().max(600).optional(),seconds:z.number().min(1).max(15).optional(),look:z.record(z.string().max(40),z.string().max(300)).optional()}).strict()).min(1).max(10)}).strict()
]);
export type Operation = z.infer<typeof OperationSchema>;
export const NativeDesignSchema=z.object({surface:CopyNodeSchema.shape.style,heading:CopyNodeSchema.shape.style,text:CopyNodeSchema.shape.style,button:CopyNodeSchema.shape.style,field:CopyNodeSchema.shape.style,card:CopyNodeSchema.shape.style,table:CopyNodeSchema.shape.style.optional(),tableHeader:CopyNodeSchema.shape.style.optional()}).strict();
export const VisitedScreenSchema=z.object({id,url:LinkURLSchema.refine(v=>/^https?:/.test(v)),route:z.string().max(2048),title:label,thumbnail:z.string().max(400000).regex(/^data:image\/png;base64,[a-zA-Z0-9+/=]+$/),nodes:CopySchema,capturedAt:z.string().max(50),truncated:z.boolean()}).strict();
export type VisitedScreen=z.infer<typeof VisitedScreenSchema>;
export type ScreenLibrary={screens:VisitedScreen[];candidate:VisitedScreen|null;browsing:boolean;error:string};
export const StateSchema = z.object({ variant:z.literal(true).optional(),pageContent:PrototypePageSchema.optional(),virtualRoute:z.string().max(200).regex(/^\/(?!\/)[a-zA-Z0-9/_-]*$/).optional(),tagged:z.boolean().optional(),liveURL:LinkURLSchema.refine(v=>/^https?:/.test(v)).optional(),id, title: label, parent: id.nullable(), view: z.enum(['base','panel']), presentation:z.enum(['screen','modal','drawer']).optional(),copied:z.object({closes:z.boolean(),side:z.enum(['left','right']).optional(),radius:z.string().max(60).regex(/^[\d.\spx%]+$/).optional()}).strict().optional(),screen:z.object({id,url:LinkURLSchema,title:label,thumbnail:VisitedScreenSchema.shape.thumbnail,capturedAt:z.string().max(50)}).strict().optional(),design:NativeDesignSchema.optional(), operations: z.array(OperationSchema).max(200) }).strict();
export const ConnectionConditionSchema=z.object({target:LocatorSchema,test:z.enum(['checked','unchecked','filled','valid','equals']),value:z.string().max(300).optional()}).strict().refine(c=>c.test!=='equals'||c.value!==undefined,'Enter a comparison value.');
export const ConnectionEventSchema=z.enum(['click','change','enter','finish']);
export const ConnectionSpecSchema=z.object({to:id.optional(),newTitle:label.optional(),screen:VisitedScreenSchema.optional(),event:ConnectionEventSchema,conditions:z.array(ConnectionConditionSchema).max(8),otherwise:id.optional()}).strict().refine(c=>[c.to,c.newTitle,c.screen].filter(Boolean).length===1,'Choose one existing view, capture a screen or create a new view.');
export type ConnectionCondition=z.infer<typeof ConnectionConditionSchema>;
export type ConnectionEvent=z.infer<typeof ConnectionEventSchema>;
/** Background the user pastes for a prototype (a PRD, spec, brand rules or sample data). Sent with every request while on; never published in a share link. */
export const PROJECT_CONTEXT_LIMIT=40000;
export const ProjectContextSchema=z.object({text:z.string().max(PROJECT_CONTEXT_LIMIT),on:z.boolean()}).strict();
export type ProjectContext=z.infer<typeof ProjectContextSchema>;
export const WorkflowSchema = z.object({
  projectContext:ProjectContextSchema.optional(),
  /** Edits that already weren't showing when a link was shared, so they don't stop someone opening it. */
  shareBaseline:z.array(z.string().max(400)).max(300).optional(),
  assistantMemory:AssistantMemorySchema.optional(),schemaVersion: z.literal(1), id, name: label, origin: z.string(), route: z.string(), createdAt: z.string(), updatedAt: z.string(),
  variables:z.array(DataEntrySchema).max(100).optional(),
  entry: id, maxStates: z.number().int().min(2).max(30), states: z.array(StateSchema).min(1).max(30),
  edges: z.array(z.object({ id, from: id, source: id, to: id, event:ConnectionEventSchema.optional(),conditions:z.array(ConnectionConditionSchema).max(8).optional(),otherwise:id.optional(), effects:z.array(DataEntrySchema).max(12).optional() }).strict()).max(300)
}).strict();
export type Workflow = z.infer<typeof WorkflowSchema>;
export type FlowState = z.infer<typeof StateSchema>;
export const RecordSchema = z.object({ draft: WorkflowSchema, enabled: z.boolean(), currentVersion: z.number().int().nonnegative().default(0), versions: z.array(z.object({ number: z.number().int().positive(), savedAt: z.string(), workflow: WorkflowSchema })) });
export type SavedRecord = z.infer<typeof RecordSchema>;
export type Selection = { locator: Locator; label: string; tag: string; owned: boolean };
export type ConnectionWorkspace = {busy?:boolean;pendingScreen?:Pick<VisitedScreen,'id'|'title'|'route'|'thumbnail'>;source:Selection;from:string;to:string;newTitle:string;event:ConnectionEvent;conditions:ConnectionCondition[];otherwise:string;saved:string;picking:boolean;fields:Selection[];events:ConnectionEvent[];message:string;error:boolean};
export type ConnectionAction = {action:'close'|'pick'|'cancelPick'|'save'|'test'} | {action:'destination'|'title'|'event'|'otherwise';value:string} | {action:'remove';index:number} | {action:'condition';index:number;test:ConnectionCondition['test'];value?:string} | {action:'screen';screen:VisitedScreen};
export type Snapshot = {sharedExperience?:boolean;sharedWaiting?:boolean;designEvidence?:import('../content/designEvidence').DesignEvidence;publicSnapshot?:{html:string;workflow:Workflow;masked:boolean;skippedScreens:number;bytes:number};staleTab?:boolean;watching?:boolean;watched?:{id:string;kind:string;title:string;outline:string;trigger:string}|null;watchError?:string;revealed?:boolean;previewOriginal?:boolean;navigationError?:string;resumeChoice?:{name:string;page:string};assistant?:AssistantSnapshot;liveSession?:boolean;panelMinimized?:boolean;panelRestoring?:boolean;connectionWorkspace?:ConnectionWorkspace|null;visited?:string[];mode?:'edit'|'interact'|'replay'|'closed';styleSource?:Selection|null; workflow: Workflow; stateId: string; selected: Selection | null; picking: boolean; dragging:boolean; replay: boolean; enabled: boolean; dirty: boolean; canUndo: boolean; canRedo: boolean; canBack: boolean; unresolved: string[]; currentVersion: number; versions: { number: number; savedAt: string; name: string }[]; library: { id: string; name: string; versions: number }[] };
export type Command =
 | {type:'previewOriginal';value:boolean}
 | {type:'compareOriginal'}
 | {type:'tagPage';title:string}
 | {type:'createPage';route:string;title?:string}
 | {type:'checkpointDraft';navigating?:boolean}
 | {type:'cancelWorkflowNavigation';workflowId:string}
 | {type:'assistantContext';inspect?:string[];instruction?:string;chat?:boolean}
 | {type:'assistantReset'}
 | {type:'assistantRemember';memory:AssistantMemory}
 | {type:'assistantProjectContext';context:ProjectContext|null}
 | {type:'assistantStyle';ref:string}
 | {type:'assistantApply';plan:unknown;token:string}
 | {type:'assistantRollback';token:string}
 | {type:'assistantCandidate';ref:string}
 | {type:'assistantCandidates';refs:string[]}
 | { type: 'designEvidence' | 'resumeWorkflow' | 'continueWorkflowHere' | 'dismissResumeChoice' | 'validateSelection' | 'snapshot' | 'pick' | 'undo' | 'redo' | 'replay' | 'edit' | 'back' | 'save' | 'saveTemporary' | 'duplicate' | 'delete' | 'remove' | 'reset' | 'drag' | 'pause' | 'duplicateElement' | 'escape' | 'mirror' | 'selectSection' | 'selectParent' | 'signIn' }
 | {type:'new';discard?:boolean}
 | {type:'revealChange'}
 | {type:'openControl';ref:string;confirmed?:boolean}
 | {type:'watch'}
 | {type:'watchClear'}
 | {type:'copyPrompt';prompt:string;context?:{workflowId:string;stateId:string;selection:string}}
 | {type:'minimizePanel'|'restorePanel'|'interact'|'closeEditor'|'copyStyle'|'pasteStyle'|'cancelStyle'}
 | {type:'insertElement';kind:'button'|'text'|'field'|'panel';text?:string;inputType?:FieldType;position:'before'|'after'|'inside'|'below'}
 | ({type:'connect'}&z.infer<typeof ConnectionSpecSchema>)
 | {type:'replayConnection';id:string}
 | {type:'importScreen';screen:VisitedScreen}
 | {type:'connectionAction';change:ConnectionAction}
 | {type:'connectionAnchor';ratio:number}
 | {type:'appearance';style:CopyNode['style']}
 | {type:'alignText';horizontal?:'left'|'center'|'right';vertical?:'top'|'middle'|'bottom'}
 | {type:'fieldSettings';inputType:FieldType;required?:boolean;options?:string[];radioGroup?:string}
 | {type:'selectDestination';prompt:string}
 | {type:'settingsPlayback'}
 | {type:'settingsPrompt';prompt:string}
 | {type:'layouts';count?:number}
 | {type:'image';src:string;fit:'cover'|'contain'}
 | {type:'loadRecord';record:SavedRecord}
 | {type:'acknowledgeSave';record:SavedRecord;expected:Workflow}
 | { type: 'prompt'; prompt: string; scope?:'element'|'section'|'page'; usePlanner?:boolean; plan?: unknown; context?: { workflowId: string; stateId: string; selection: string } }
 | { type: 'rename' | 'text' | 'child'; text: string }
 | { type: 'state' | 'link' | 'load'; id: string }
 | { type: 'restore'; version: number }
 | { type:'style'; style:StylePatch; group?:string }
 | { type:'reloadTab' }
 | { type:'publicSnapshot'; mask:boolean }
 | { type:'move'; target:Locator; anchor:Locator; position:'before'|'after'|'inside' }
 | { type: 'enabled'; value: boolean };
export const uid = () => crypto.randomUUID();
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export const routeOf = (url: URL) => url.pathname + url.search + url.hash;
