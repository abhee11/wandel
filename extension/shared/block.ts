import {z} from 'zod';
/** A composed section described as data. The renderer owns all markup; text is set with textContent only. */
export const blockTypes=['card','stack','row','grid','heading','text','eyebrow','link','button','icon','stat','tile','field','choice','select','crumbs','input','textarea','tabs','badge','avatar','progress','stream','toggle','checkbox','table','alert','menu','custom','list','quote','image','disclosure','divider'] as const;
export const blockContainers=['card','stack','row','grid','disclosure'] as const;
export const blockTones=['none','pink','peach','yellow','lime','mint','sky','lilac','gray'] as const;
const httpImage=z.string().max(2048).refine(value=>{try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password;}catch{return false;}},'Use an HTTP(S) image link.');
const dataKey=z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,59}$/);
const valueKey=z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,59}(\.count)?$/);
const dataEntry=z.object({key:dataKey,value:z.string().max(4000)}).strict();
/** How a part reads and writes prototype data. Every field is optional, so a static part carries none of it. */
export const BlockLogicSchema=z.object({
 bind:dataKey.nullable().optional(),
 when:z.object({key:valueKey,is:z.string().max(120).nullable().optional(),not:z.boolean().nullable().optional()}).strict().nullable().optional(),
 set:z.array(dataEntry).max(8).nullable().optional(),
 requires:z.array(valueKey).max(8).nullable().optional(),
 repeat:dataKey.nullable().optional(),
 add:z.object({list:dataKey,fields:z.array(dataEntry).min(1).max(8)}).strict().nullable().optional(),
 remove:z.boolean().nullable().optional()
}).strict();
export type BlockLogic=z.infer<typeof BlockLogicSchema>;
export const BlockNodeSchema=z.object({
 id:z.string().min(1).max(100).optional(),
 parent:z.number().int().min(-1).max(119),
 type:z.enum(blockTypes),
 text:z.string().max(600).nullable().optional(),
 detail:z.string().max(400).nullable().optional(),
 icon:z.string().max(40).nullable().optional(),
 variant:z.enum(['primary','outline','ghost']).nullable().optional(),
 tone:z.enum(blockTones).nullable().optional(),
 level:z.number().int().min(1).max(4).nullable().optional(),
 columns:z.number().int().min(1).max(6).nullable().optional(),
 justify:z.enum(['start','between','end','center']).nullable().optional(),
 selected:z.boolean().nullable().optional(),
 options:z.array(z.string().min(1).max(80)).max(6).nullable().optional(),
 items:z.array(z.string().min(1).max(300)).max(10).nullable().optional(),
 action:z.string().max(60).nullable().optional(),
 src:httpImage.nullable().optional(),
 value:z.number().min(0).max(100).nullable().optional(),
 min:z.number().min(-1e6).max(1e6).nullable().optional(),
 max:z.number().min(-1e6).max(1e6).nullable().optional(),
 seconds:z.number().min(0.5).max(60).nullable().optional(),
 html:z.string().max(20000).nullable().optional(),
 css:z.string().max(12000).nullable().optional(),
 logic:BlockLogicSchema.nullable().optional()
}).strict();
export const BlockSchema=z.object({
 accent:z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
 data:z.array(dataEntry).max(20).nullable().optional(),
 nodes:z.array(BlockNodeSchema).min(1).max(120)
}).strict().superRefine((block,ctx)=>{
 block.nodes.forEach((node,i)=>{
  const issue=(message:string)=>ctx.addIssue({code:'custom',path:['nodes',i],message});
  if(i===0?node.parent!==-1:node.parent<0||node.parent>=i)issue(i===0?'The first part is the root (parent -1).':'Each part needs an earlier part as its parent.');
  else if(i>0&&!(blockContainers as readonly string[]).includes(block.nodes[node.parent].type))issue(`A ${block.nodes[node.parent].type} cannot contain other parts; use card, stack, row, grid or disclosure as the parent.`);
  if(['heading','text','eyebrow','link','button','quote','tile','field','stat'].includes(node.type)&&!node.text?.trim())issue(`A ${node.type} needs text.`);
  if((node.type==='choice'||node.type==='select')&&(node.options?.length||0)<2)issue(`A ${node.type} needs at least two options.`);
  if(node.type==='list'&&!node.items?.length)issue('A list needs items.');
  if((node.type==='input'||node.type==='textarea')&&!node.text?.trim()&&!node.detail?.trim())issue(`${node.type==='input'?'An input':'A textarea'} needs a label (text) or a placeholder (detail).`);
  if(node.type==='tabs'&&(node.options?.length||0)<2)issue('Tabs need at least two options.');
  if(node.type==='badge'&&!node.text?.trim())issue('A badge needs text.');
  if(node.type==='avatar'&&!node.text?.trim()&&!node.items?.length)issue('An avatar needs a name (text) or several names (items).');
  if(['progress','stream','toggle','checkbox','alert'].includes(node.type)&&!node.text?.trim())issue(`A ${node.type} needs text.`);
  if(node.type==='stream'&&!(typeof node.min==='number'&&typeof node.max==='number'&&node.min<node.max))issue('A stream needs a min below its max.');
  if(node.type==='table'&&(!node.options?.length||!node.items?.length))issue('A table needs column headings (options) and rows (items).');
  if(node.type==='custom'&&!node.html?.trim())issue('A custom part needs its html.');
  if(node.type==='menu'&&!node.options?.length)issue('A menu needs its options.');
  if(node.type==='crumbs'&&(node.items?.length||0)<2)issue('A crumbs part needs at least two items.');
  if(node.type==='crumbs'&&node.options&&node.options.length<2)issue('A crumbs switcher needs at least two options.');
  if(node.type==='icon'&&!node.icon)issue('An icon part needs an icon name.');
 });
});
export type Block=z.infer<typeof BlockSchema>;
export type BlockNode=z.infer<typeof BlockNodeSchema>;
