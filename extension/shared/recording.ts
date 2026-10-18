export const MAX_RECORDING_BYTES=20*1024*1024;
export const MAX_RECORDING_MS=3*60*1000;
export const RECORDING_TTL_DAYS=7;
export const MAX_HOSTED_RECORDINGS=5;
export type SharedRecording={id:string;name:string;bytes:number;createdAt:string;expiresAt:string;url:string};
