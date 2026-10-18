import { z } from 'zod';
const id = z.string().min(1).max(100);
const label = z.string().min(1).max(300);
export const LocatorSchema = z.object({
  textPath:z.array(z.number().int().min(0).max(10000)).min(1).max(32).optional(),
  ancestorTags:z.array(z.string().max(40)).max(32).optional(),
  owned: id.optional(), tag: z.string().max(40), role: z.string().max(60), name: z.string().max(300), text: z.string().max(300),
  attrs: z.record(z.enum(['id','data-testid','data-test','data-qa','data-block-id','alt','src','name','type','placeholder']), z.string().max(2048)),
  parent: z.object({ tag: z.string(), id: z.string(), role: z.string(), label: z.string() }), previous: z.string().max(100), next: z.string().max(100)
}).strict();
export type Locator = z.infer<typeof LocatorSchema>;
export const copyTags=['div','span','p','button','a','section','article','header','footer','nav','main','aside','h1','h2','h3','h4','ul','ol','li','label','input','textarea','strong','em','small','br','img','#text'] as const;
export const copyStyles=['display','box-sizing','width','height','min-width','max-width','padding','margin','gap','flex-direction','align-items','justify-content','grid-template-columns','color','background-color','border','border-radius','box-shadow','font-family','font-size','font-weight','font-style','line-height','text-align','text-decoration-line','letter-spacing','white-space','opacity'] as const;
export const ImageSourceSchema=z.string().max(700000).refine(value=>{if(/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(value))return true;try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}},'Use an HTTP(S) image or an uploaded PNG, JPEG, WebP or GIF.');
export const LinkURLSchema=z.string().max(2048).refine(value=>{try{const url=new URL(value);return ['https:','http:','mailto:','tel:'].includes(url.protocol)&&!url.username&&!url.password;}catch{return false;}},'Use an HTTP(S), email or phone link.');
export const CopyNodeSchema=z.object({id,href:LinkURLSchema.optional(),role:z.enum(['button','link']).optional(),src:ImageSourceSchema.optional(),alt:z.string().max(300).optional(),parent:z.number().int().min(-1).max(799),tag:z.enum(copyTags),text:z.string().max(2000),style:z.record(z.enum(copyStyles),z.string().max(300).refine(v=>! /url\s*\(|expression|[<>\\]/i.test(v))),inputType:z.enum(['text','email','number','tel','url','search','date','checkbox','radio','password']).optional(),placeholder:z.string().max(300).optional()}).strict();
export type CopyNode=z.infer<typeof CopyNodeSchema>;
export const CopySchema=z.array(CopyNodeSchema).min(1).max(800).superRefine((nodes,ctx)=>{nodes.forEach((n,i)=>{if((i===0?n.parent!==-1||n.tag==='#text':n.parent<0||n.parent>=i||nodes[n.parent]?.tag==='#text'))ctx.addIssue({code:'custom',message:'Invalid copy tree'});});});
export const DataKeySchema=z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,79}$/);
export const DataValueSchema=z.string().max(300);
export const DataEntrySchema=z.object({key:DataKeySchema,value:DataValueSchema}).strict();
export const FieldTypeSchema=z.enum(['text','email','number','url','tel','password','date','time','checkbox','radio','textarea','select']);
export type FieldType=z.infer<typeof FieldTypeSchema>;
export const NodeSchema = z.object({ id, kind: z.enum(['button','panel','text','field']), text: label, binding:DataKeySchema.optional(),appearance:CopyNodeSchema.shape.style.optional(),inputAppearance:CopyNodeSchema.shape.style.optional(),required:z.boolean().optional(),inputType:FieldTypeSchema.optional(),options:z.array(label).min(1).max(20).optional(),radioGroup:z.string().max(80).optional(),control:z.object({kind:z.enum(['switch','menu','tabs']),options:z.array(label).min(1).max(8),contents:z.array(label).max(8).optional()}).strict().optional(),choices:z.object({options:z.array(label).min(2).max(8),selected:z.number().int().min(0).max(7),headingTag:z.enum(['h2','h3','h4']),headingStyle:CopyNodeSchema.shape.style,buttonStyle:CopyNodeSchema.shape.style,sectionStyle:CopyNodeSchema.shape.style}).strict().refine(v=>v.selected<v.options.length).optional(),widget:z.enum(['theme','viewport']).optional(),isolated:z.boolean().optional(),copy:CopySchema.optional() }).strict();
export const StyleSchema = z.object({display:z.enum(['flex','grid','block']).optional(),flexDirection:z.enum(['column','row']).optional(),gap:z.number().min(0).max(200).optional(),padding:z.number().min(0).max(200).optional(),color:z.string().regex(/^#[0-9a-f]{6}$/i).optional(),backgroundColor:z.string().regex(/^#[0-9a-f]{6}$/i).optional(),width:z.number().min(1).max(4000).optional(),height:z.number().min(1).max(4000).optional(),fontSize:z.number().min(6).max(200).optional(),x:z.number().min(-10000).max(10000).optional(),y:z.number().min(-10000).max(10000).optional()}).strict();
export type StylePatch = z.infer<typeof StyleSchema>;
export const OperationSchema = z.discriminatedUnion('kind', [
  z.object({id,kind:z.literal('appearance'),target:LocatorSchema,style:CopyNodeSchema.shape.style}).strict(),
  z.object({id,kind:z.literal('image'),target:LocatorSchema,src:ImageSourceSchema,fit:z.enum(['cover','contain'])}).strict(),
  z.object({ id, kind: z.literal('insert'), target: LocatorSchema, position: z.enum(['before','after','inside','below']), node: NodeSchema }).strict(),
  z.object({id,kind:z.literal('mirror'),target:LocatorSchema,source:LocatorSchema}).strict(),
  z.object({id,kind:z.literal('trigger'),target:LocatorSchema,source:id}).strict(),
  z.object({ id, kind: z.literal('text'), target: LocatorSchema, text: label }).strict(),
  z.object({id,kind:z.literal('style'),target:LocatorSchema,style:StyleSchema}).strict(),
  z.object({id,kind:z.literal('remove'),target:LocatorSchema}).strict()
]);
export type Operation = z.infer<typeof OperationSchema>;
export const NativeDesignSchema=z.object({surface:CopyNodeSchema.shape.style,heading:CopyNodeSchema.shape.style,text:CopyNodeSchema.shape.style,button:CopyNodeSchema.shape.style,field:CopyNodeSchema.shape.style,card:CopyNodeSchema.shape.style,table:CopyNodeSchema.shape.style.optional(),tableHeader:CopyNodeSchema.shape.style.optional()}).strict();
export const VisitedScreenSchema=z.object({id,url:LinkURLSchema.refine(v=>/^https?:/.test(v)),route:z.string().max(2048),title:label,thumbnail:z.string().max(400000).regex(/^data:image\/png;base64,[a-zA-Z0-9+/=]+$/),nodes:CopySchema,capturedAt:z.string().max(50),truncated:z.boolean()}).strict();
export type VisitedScreen=z.infer<typeof VisitedScreenSchema>;
export type ScreenLibrary={screens:VisitedScreen[];candidate:VisitedScreen|null;browsing:boolean;error:string};
export const StateSchema = z.object({ liveURL:LinkURLSchema.refine(v=>/^https?:/.test(v)).optional(),id, title: label, parent: id.nullable(), view: z.enum(['base','panel']), presentation:z.literal('screen').optional(),screen:z.object({id,url:LinkURLSchema,title:label,thumbnail:VisitedScreenSchema.shape.thumbnail,capturedAt:z.string().max(50)}).strict().optional(),design:NativeDesignSchema.optional(), operations: z.array(OperationSchema).max(200) }).strict();
export const ConnectionConditionSchema=z.object({target:LocatorSchema,test:z.enum(['checked','unchecked','filled','valid','equals']),value:z.string().max(300).optional()}).strict().refine(c=>c.test!=='equals'||c.value!==undefined,'Enter a comparison value.');
export const ConnectionEventSchema=z.enum(['click','change','enter']);
export const ConnectionSpecSchema=z.object({to:id.optional(),newTitle:label.optional(),screen:VisitedScreenSchema.optional(),event:ConnectionEventSchema,conditions:z.array(ConnectionConditionSchema).max(8),otherwise:id.optional()}).strict().refine(c=>[c.to,c.newTitle,c.screen].filter(Boolean).length===1,'Choose one existing view, capture a screen or create a new view.');
export type ConnectionCondition=z.infer<typeof ConnectionConditionSchema>;
export type ConnectionEvent=z.infer<typeof ConnectionEventSchema>;
export const WorkflowSchema = z.object({
  schemaVersion: z.literal(1), id, name: label, origin: z.string(), route: z.string(), createdAt: z.string(), updatedAt: z.string(),
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
export type Snapshot = {liveSession?:boolean;panelMinimized?:boolean;panelRestoring?:boolean;connectionWorkspace?:ConnectionWorkspace|null;visited?:string[];mode?:'edit'|'interact'|'replay'|'closed';styleSource?:Selection|null; workflow: Workflow; stateId: string; selected: Selection | null; picking: boolean; dragging:boolean; replay: boolean; enabled: boolean; dirty: boolean; canUndo: boolean; canRedo: boolean; canBack: boolean; unresolved: string[]; currentVersion: number; versions: { number: number; savedAt: string; name: string }[]; library: { id: string; name: string; versions: number }[] };
export type Command =
 | { type: 'validateSelection' | 'snapshot' | 'pick' | 'undo' | 'redo' | 'replay' | 'edit' | 'back' | 'save' | 'saveTemporary' | 'duplicate' | 'delete' | 'new' | 'remove' | 'reset' | 'drag' | 'pause' | 'duplicateElement' | 'escape' | 'mirror' | 'selectSection' | 'selectParent' | 'signIn' }
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
 | { type: 'enabled'; value: boolean };
export const uid = () => crypto.randomUUID();
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export const routeOf = (url: URL) => url.pathname + url.search + url.hash;
