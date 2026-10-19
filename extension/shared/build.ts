declare const WANDEL_FREE:boolean;
export const freeBuild=typeof WANDEL_FREE!=='undefined'&&WANDEL_FREE;

// Conversational editing is part of regular Wandel; the offline build stays local-only.
export const assistantEnabled=!freeBuild;
