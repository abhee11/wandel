import {z} from 'zod';
/** Semantic project brief, separate from short-lived DOM references. */
export const AssistantMemorySchema=z.object({goal:z.string().max(300),summary:z.string().max(900),decisions:z.array(z.string().max(160)).max(6),preferences:z.array(z.string().max(160)).max(6),pending:z.string().max(300),focus:z.string().max(160)}).strict();
export type AssistantMemory=z.infer<typeof AssistantMemorySchema>;
export const emptyAssistantMemory=():AssistantMemory=>({goal:'',summary:'',decisions:[],preferences:[],pending:'',focus:''});
