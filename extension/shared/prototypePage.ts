import {z} from 'zod';
/** Static, illustrative data only. No executable markup or data-source access. */
export const ChartSchema=z.object({title:z.string().min(1).max(160),description:z.string().max(300),unit:z.string().min(1).max(60),xLabel:z.string().max(60).nullable().optional(),yLabel:z.string().max(60).nullable().optional(),points:z.array(z.object({label:z.string().min(1).max(60),value:z.number().finite().min(0).max(1e9)}).strict()).min(2).max(12)}).strict();
export type Chart=z.infer<typeof ChartSchema>;
export const PrototypePageSchema=z.object({
 route:z.string().max(200).regex(/^\/(?!\/)[a-zA-Z0-9/_-]*$/).nullable(),
 heading:z.string().min(1).max(160),description:z.string().max(400),footer:z.string().min(1).max(200),
 chart:ChartSchema
}).strict();
export type PrototypePage=z.infer<typeof PrototypePageSchema>;
export function prototypePageIds(state:string,count:number){return ['back','header','description','chart','chart-title','chart-description','footer',...Array.from({length:count},(_,i)=>'point-'+i)].map(part=>'page:'+state+':'+part);}
