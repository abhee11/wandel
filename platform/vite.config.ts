import {defineConfig,loadEnv} from 'vite';
import {resolve} from 'node:path';
export default defineConfig(({mode})=>({define:{'process.env.WANDEL_PUBLIC_CLERK_KEY':JSON.stringify(loadEnv(mode,process.cwd(),'').VITE_CLERK_PUBLISHABLE_KEY||loadEnv(mode,process.cwd(),'').CLERK_PUBLISHABLE_KEY||'')},root:resolve('platform/web'),publicDir:resolve('public'),server:{host:'127.0.0.1',port:5174,strictPort:true,proxy:{'/api':'http://127.0.0.1:4320'}},build:{outDir:resolve('dist-platform/web'),emptyOutDir:true}}));
