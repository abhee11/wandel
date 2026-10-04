import {build} from 'esbuild';
await build({entryPoints:['platform/server/main.ts','platform/server/seed.ts'],outdir:'dist-platform/server',bundle:true,platform:'node',format:'esm',target:'node20',packages:'external'});
