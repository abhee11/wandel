import {z} from 'zod';
/** A composed section described as data. The renderer owns all markup; text is set with textContent only. */
export const blockTypes=['card','stack','row','grid','heading','text','eyebrow','link','button','icon','stat','tile','field','choice','list','quote','image','disclosure','divider'] as const;
export const blockContainers=['card','stack','row','grid','disclosure'] as const;
export const blockTones=['none','pink','peach','yellow','lime','mint','sky','lilac','gray'] as const;
const httpImage=z.string().max(2048).refine(value=>{try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password;}catch{return false;}},'Use an HTTP(S) image link.');
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
 src:httpImage.nullable().optional()
}).strict();
export const BlockSchema=z.object({
 accent:z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
 nodes:z.array(BlockNodeSchema).min(1).max(120)
}).strict().superRefine((block,ctx)=>{
 block.nodes.forEach((node,i)=>{
  const issue=(message:string)=>ctx.addIssue({code:'custom',path:['nodes',i],message});
  if(i===0?node.parent!==-1:node.parent<0||node.parent>=i)issue(i===0?'The first part is the root (parent -1).':'Each part needs an earlier part as its parent.');
  else if(i>0&&!(blockContainers as readonly string[]).includes(block.nodes[node.parent].type))issue(`A ${block.nodes[node.parent].type} cannot contain other parts; use card, stack, row, grid or disclosure as the parent.`);
  if(['heading','text','eyebrow','link','button','quote','tile','field','stat'].includes(node.type)&&!node.text?.trim())issue(`A ${node.type} needs text.`);
  if(node.type==='choice'&&(node.options?.length||0)<2)issue('A choice needs at least two options.');
  if(node.type==='list'&&!node.items?.length)issue('A list needs items.');
  if(node.type==='icon'&&!node.icon)issue('An icon part needs an icon name.');
 });
});
export type Block=z.infer<typeof BlockSchema>;
export type BlockNode=z.infer<typeof BlockNodeSchema>;
