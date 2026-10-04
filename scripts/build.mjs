import {loadEnvFile} from 'node:process';
try{loadEnvFile('.env');}catch(e){if(e.code!=='ENOENT')throw e;}
import { build } from 'esbuild';
import { mkdir, copyFile, writeFile, cp } from 'node:fs/promises';
const publicConfig={CLERK_KEY:process.env.VITE_CLERK_PUBLISHABLE_KEY||process.env.CLERK_PUBLISHABLE_KEY||'',CLERK_SYNC_HOST:process.env.CLERK_SYNC_HOST||'http://127.0.0.1',APP_ORIGIN:process.env.WANDEL_APP_ORIGIN||'http://127.0.0.1:5174',API_ORIGIN:process.env.WANDEL_API_ORIGIN||'http://127.0.0.1:4320'};
const defines=Object.fromEntries(Object.entries(publicConfig).map(([key,value])=>['process.env.WANDEL_PUBLIC_'+key,JSON.stringify(value)]));
defines['process.env.NODE_ENV']='"production"';
await mkdir('dist',{recursive:true});
await Promise.all([
  build({entryPoints:['extension/background/index.ts'],outfile:'dist/background.js',bundle:true,format:'esm',target:'chrome116',define:defines}),
  build({entryPoints:['extension/content/index.ts'],outfile:'dist/content.js',bundle:true,format:'iife',target:'chrome116'}),
  build({entryPoints:['extension/sidepanel/index.tsx'],outfile:'dist/sidepanel.js',bundle:true,format:'esm',target:'chrome116',minify:true,define:defines})
]);
await cp('public/brand','dist/brand',{recursive:true});
const {readFile}=await import('node:fs/promises');
const manifest=JSON.parse(await readFile('extension/manifest.json','utf8'));
if(!manifest.permissions.includes('cookies'))manifest.permissions.push('cookies');
const origins=new Set([publicConfig.API_ORIGIN]);
if(publicConfig.CLERK_KEY){const host=Buffer.from(publicConfig.CLERK_KEY.split('_').slice(2).join('_'),'base64').toString().replace(/\$$/,'');if(!/^[a-z0-9.-]+$/.test(host))throw new Error('Invalid Clerk publishable key');origins.add('https://'+host);}
manifest.content_security_policy.extension_pages+=' '+[...origins].join(' ');
if(process.env.WANDEL_EXTENSION_KEY)manifest.key=process.env.WANDEL_EXTENSION_KEY;
await writeFile('dist/manifest.json',JSON.stringify(manifest,null,2));
await writeFile('dist/sidepanel.html','<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wandel</title><link rel="stylesheet" href="sidepanel.css"></head><body><div id="root"></div><script type="module" src="sidepanel.js"></script></body></html>');
console.log('Unpacked extension ready in dist/');
