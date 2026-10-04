import { z } from 'zod';
import { StyleSchema } from '../shared/model';
export const BatchSchema=z.object({steps:z.array(z.object({
  kind:z.enum(['insert','text','style','remove']),target:z.enum(['selected','form','submit']),
  position:z.enum(['before','after','inside','below']),element:z.enum(['button','panel','text','field']),
  text:z.string().max(300),style:StyleSchema.nullable()
}).strict()).min(1).max(20)}).strict();
export type Batch=z.infer<typeof BatchSchema>;
