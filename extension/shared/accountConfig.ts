// These values are public build configuration. Secret keys never enter the extension.
const publicValue=(read:()=>string|undefined)=>{try{return read();}catch{return undefined;}};
export const accountConfig={
 publishableKey:publicValue(()=>process.env.WANDEL_PUBLIC_CLERK_KEY)||'',
 syncHost:publicValue(()=>process.env.WANDEL_PUBLIC_CLERK_SYNC_HOST)||'http://127.0.0.1',
 appOrigin:publicValue(()=>process.env.WANDEL_PUBLIC_APP_ORIGIN)||'http://127.0.0.1:5174',
 apiOrigin:publicValue(()=>process.env.WANDEL_PUBLIC_API_ORIGIN)||'http://127.0.0.1:4320'
};
