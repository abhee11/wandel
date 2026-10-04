import { z } from 'zod';
const id = z.string().min(1).max(100);
const label = z.string().min(1).max(300);
export const LocatorSchema = z.object({
  owned: id.optional(), tag: z.string().max(40), role: z.string().max(60), name: z.string().max(300), text: z.string().max(300),
  attrs: z.record(z.enum(['id','data-testid','data-test','data-qa']), z.string().max(300)),
  parent: z.object({ tag: z.string(), id: z.string(), role: z.string(), label: z.string() }), previous: z.string().max(100), next: z.string().max(100)
}).strict();
export type Locator = z.infer<typeof LocatorSchema>;
export const copyTags=['div','span','p','button','section','article','header','footer','nav','main','aside','h1','h2','h3','h4','ul','ol','li','label','input','textarea','strong','em','small','br','#text'] as const;
export const copyStyles=['display','box-sizing','width','height','min-width','max-width','padding','margin','gap','flex-direction','align-items','justify-content','grid-template-columns','color','background-color','border','border-radius','box-shadow','font-family','font-size','font-weight','font-style','line-height','text-align','letter-spacing','white-space','opacity'] as const;
export const CopyNodeSchema=z.object({id,parent:z.number().int().min(-1).max(149),tag:z.enum(copyTags),text:z.string().max(2000),style:z.record(z.enum(copyStyles),z.string().max(300).refine(v=>! /url\s*\(|expression|[<>\\]/i.test(v))),inputType:z.enum(['text','email','number','tel','url','search','date','checkbox','radio','password']).optional(),placeholder:z.string().max(300).optional()}).strict();
export type CopyNode=z.infer<typeof CopyNodeSchema>;
export const CopySchema=z.array(CopyNodeSchema).min(1).max(150).superRefine((nodes,ctx)=>{nodes.forEach((n,i)=>{if((i===0?n.parent!==-1||n.tag==='#text':n.parent<0||n.parent>=i||nodes[n.parent]?.tag==='#text'))ctx.addIssue({code:'custom',message:'Invalid copy tree'});});});
export const NodeSchema = z.object({ id, kind: z.enum(['button','panel','text','field']), text: label, copy:CopySchema.optional() }).strict();
export const StyleSchema = z.object({display:z.enum(['flex','grid','block']).optional(),flexDirection:z.enum(['column','row']).optional(),gap:z.number().min(0).max(200).optional(),padding:z.number().min(0).max(200).optional(),color:z.string().regex(/^#[0-9a-f]{6}$/i).optional(),backgroundColor:z.string().regex(/^#[0-9a-f]{6}$/i).optional(),width:z.number().min(1).max(4000).optional(),height:z.number().min(1).max(4000).optional(),fontSize:z.number().min(6).max(200).optional(),x:z.number().min(-10000).max(10000).optional(),y:z.number().min(-10000).max(10000).optional()}).strict();
export type StylePatch = z.infer<typeof StyleSchema>;
export const OperationSchema = z.discriminatedUnion('kind', [
  z.object({ id, kind: z.literal('insert'), target: LocatorSchema, position: z.enum(['before','after','inside','below']), node: NodeSchema }).strict(),
  z.object({id,kind:z.literal('mirror'),target:LocatorSchema,source:LocatorSchema}).strict(),
  z.object({id,kind:z.literal('trigger'),target:LocatorSchema,source:id}).strict(),
  z.object({ id, kind: z.literal('text'), target: LocatorSchema, text: label }).strict(),
  z.object({id,kind:z.literal('style'),target:LocatorSchema,style:StyleSchema}).strict(),
  z.object({id,kind:z.literal('remove'),target:LocatorSchema}).strict()
]);
export type Operation = z.infer<typeof OperationSchema>;
export const StateSchema = z.object({ id, title: label, parent: id.nullable(), view: z.enum(['base','panel']), operations: z.array(OperationSchema).max(200) }).strict();
export const WorkflowSchema = z.object({
  schemaVersion: z.literal(1), id, name: label, origin: z.string(), route: z.string(), createdAt: z.string(), updatedAt: z.string(),
  entry: id, maxStates: z.number().int().min(2).max(30), states: z.array(StateSchema).min(1).max(30),
  edges: z.array(z.object({ id, from: id, source: id, to: id }).strict()).max(300)
}).strict();
export type Workflow = z.infer<typeof WorkflowSchema>;
export type FlowState = z.infer<typeof StateSchema>;
export const RecordSchema = z.object({ draft: WorkflowSchema, enabled: z.boolean(), currentVersion: z.number().int().nonnegative().default(0), versions: z.array(z.object({ number: z.number().int().positive(), savedAt: z.string(), workflow: WorkflowSchema })) });
export type SavedRecord = z.infer<typeof RecordSchema>;
export type Selection = { locator: Locator; label: string; tag: string; owned: boolean };
export type Snapshot = { workflow: Workflow; stateId: string; selected: Selection | null; picking: boolean; dragging:boolean; replay: boolean; enabled: boolean; dirty: boolean; canUndo: boolean; canRedo: boolean; canBack: boolean; unresolved: string[]; currentVersion: number; versions: { number: number; savedAt: string; name: string }[]; library: { id: string; name: string; versions: number }[] };
export type Command =
 | { type: 'snapshot' | 'pick' | 'undo' | 'redo' | 'replay' | 'edit' | 'back' | 'save' | 'saveTemporary' | 'duplicate' | 'delete' | 'new' | 'remove' | 'reset' | 'drag' | 'pause' | 'duplicateElement' | 'escape' | 'mirror' }
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
