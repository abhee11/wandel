import {z} from 'zod';
import {CopySchema,NativeDesignSchema,type CopyNode} from '../shared/model';
/** What App knowledge may hold about an app: its layout, design and the words of its controls. Never its content: no
 * names, numbers, messages or anything a person typed. The extension blanks before sending (blank.ts); the server checks
 * the same rules again here, so nothing slips through a buggy or older extension. */
export const LABEL_WORDS=4,LABEL_CHARS=48;
const EMAIL=/[^\s@]+@[^\s@]+\.[^\s@]+/,PHONE=/\+?\d[\d\s().-]{7,}\d/,LONG_NUMBER=/\d{4,}/;
/** A UI label: a few words, no email, phone number or long number. */
export function isLabel(text:string){const t=text.replace(/\s+/g,' ').trim();return t.length<=LABEL_CHARS&&t.split(' ').filter(Boolean).length<=LABEL_WORDS&&!EMAIL.test(t)&&!PHONE.test(t)&&!LONG_NUMBER.test(t);}
/** Text after blanking: no letter but X/x and no digit but 0 is left; punctuation and spaces may stay. */
export const isBlanked=(text:string)=>!/[\p{L}\p{N}]/u.test(text.replace(/[Xx0]/g,''));
const label=z.string().max(LABEL_CHARS).refine(isLabel,'Only short UI labels can be stored.');
export const ScreenSummarySchema=z.object({
 title:label,
 regions:z.array(z.enum(['navigation','sidebar','header','main','footer'])).max(10),
 headings:z.array(label).max(24),
 navigation:z.array(label).max(40),
 actions:z.array(label).max(40),
 components:z.array(z.object({kind:z.enum(['cards','table','form','list','tabs','dialog','chart']),label:label.optional(),count:z.number().int().min(1).max(500)}).strict()).max(24),
}).strict();
export type ScreenSummary=z.infer<typeof ScreenSummarySchema>;
/** A screen is known by its address pattern: /groups/:id?activityContainerId (query names only, never values). */
export const PatternSchema=z.string().min(1).max(300).regex(/^\/[^\s?#]*(\?[A-Za-z0-9_.&-]*)?$/,'A screen pattern is a path with query names only.');
export const ScreenSchema=z.object({pattern:PatternSchema,summary:ScreenSummarySchema,hash:z.string().regex(/^[0-9a-f]{16,64}$/)}).strict();
export const DesignSchema=NativeDesignSchema;
/** A component's copy may keep the words of its labels; every other text must already be blanked. */
export const ComponentCopySchema=CopySchema.superRefine((nodes,ctx)=>{nodes.forEach((n,i)=>{
 for(const value of [n.text,n.alt||'',n.placeholder||''])if(value&&!isBlanked(value)&&!isLabel(value))ctx.addIssue({code:'custom',path:[i],message:'Component text must be blanked except short labels.'});
 if(n.href||n.src)ctx.addIssue({code:'custom',path:[i],message:'Components are stored without links or images.'});
});});
export const ComponentSchema=z.object({name:label,pattern:PatternSchema.nullable(),copy:ComponentCopySchema}).strict();
export const RuleSchema=z.object({text:z.string().trim().min(3).max(200).refine(t=>!EMAIL.test(t)&&!PHONE.test(t),'Rules can’t hold contact details.')}).strict();
export type ComponentCopy=CopyNode[];
