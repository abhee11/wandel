const free=process.argv.includes('--free');
const assistant=process.argv.includes('--assistant');
const out=assistant?'dist-assistant':free?'dist-free':'dist';
import {loadEnvFile} from 'node:process';
try{if(!free)loadEnvFile('.env');}catch(e){if(e.code!=='ENOENT')throw e;}
import { build } from 'esbuild';
import { mkdir, copyFile, writeFile, cp } from 'node:fs/promises';
const publicConfig={CLERK_KEY:process.env.VITE_CLERK_PUBLISHABLE_KEY||process.env.CLERK_PUBLISHABLE_KEY||'',CLERK_SYNC_HOST:process.env.CLERK_SYNC_HOST||'http://127.0.0.1',APP_ORIGIN:process.env.WANDEL_APP_ORIGIN||'http://127.0.0.1:5174',API_ORIGIN:process.env.WANDEL_API_ORIGIN||'http://127.0.0.1:4320'};
const defines=Object.fromEntries(Object.entries(publicConfig).map(([key,value])=>['process.env.WANDEL_PUBLIC_'+key,JSON.stringify(value)]));
defines.WANDEL_FREE=JSON.stringify(free);
defines.WANDEL_ASSISTANT=JSON.stringify(assistant);
defines['process.env.NODE_ENV']='"production"';
await mkdir(out,{recursive:true});
await Promise.all([
  build({entryPoints:[free?'extension/background/free.ts':'extension/background/index.ts'],outfile:out+'/background.js',bundle:true,format:'esm',target:'chrome116',define:defines}),
  build({entryPoints:['extension/content/index.ts'],outfile:out+'/content.js',bundle:true,format:'iife',target:'chrome116',define:{WANDEL_FREE:JSON.stringify(free),WANDEL_ASSISTANT:JSON.stringify(assistant)}}),
  build({entryPoints:[free?'extension/sidepanel/free.tsx':'extension/sidepanel/index.tsx'],outfile:out+'/sidepanel.js',bundle:true,format:'esm',target:'chrome116',minify:true,define:defines})
]);
await build({entryPoints:[free?'extension/recording/free.tsx':'extension/recording/index.tsx'],outfile:out+'/recorder.js',bundle:true,format:'esm',target:'chrome116',minify:true,define:defines});
await cp('public/brand',out+'/brand',{recursive:true});
const {readFile}=await import('node:fs/promises');
const manifest=JSON.parse(await readFile('extension/manifest.json','utf8'));
if(!free&&!manifest.permissions.includes('cookies'))manifest.permissions.push('cookies');
const origins=new Set([publicConfig.API_ORIGIN]);
if(!free&&publicConfig.CLERK_KEY){const host=Buffer.from(publicConfig.CLERK_KEY.split('_').slice(2).join('_'),'base64').toString().replace(/\$$/,'');if(!/^[a-z0-9.-]+$/.test(host))throw new Error('Invalid Clerk publishable key');origins.add('https://'+host);}
if(free){manifest.name='Wandel — Local Workflow Prototyper';manifest.version='0.2.1';delete manifest.content_scripts;delete manifest.host_permissions;manifest.content_security_policy.extension_pages="script-src 'self'; object-src 'none'; connect-src 'none'";}else manifest.content_security_policy.extension_pages+=' '+[...origins].join(' ');
if(assistant)manifest.name='Wandel — Assistant Beta';
if(!free)manifest.externally_connectable={matches:[new URL(publicConfig.APP_ORIGIN).origin+'/*']};
if(!free&&!assistant&&process.env.WANDEL_EXTENSION_KEY)manifest.key=process.env.WANDEL_EXTENSION_KEY;
await writeFile(out+'/manifest.json',JSON.stringify(manifest,null,2));
await writeFile(out+'/sidepanel.html','<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wandel</title><link rel="stylesheet" href="sidepanel.css"></head><body><div id="root"></div><script type="module" src="sidepanel.js"></script></body></html>');
await writeFile(out+'/recorder.html','<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wandel walkthrough studio</title><link rel="stylesheet" href="recorder.css"></head><body><div id="root"></div><script type="module" src="recorder.js"></script></body></html>');
console.log(`Unpacked ${free?'local-only ':''}extension ready in ${out}/`);
