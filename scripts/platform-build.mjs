import {build} from 'esbuild';
await build({entryPoints:['platform/server/main.ts','platform/server/seed.ts','platform/server/accessAdmin.ts'],outdir:'dist-platform/server',bundle:true,platform:'node',format:'esm',target:'node20',packages:'external'});
// The player runs published prototypes in a sandboxed page; it sits outside the web build, which empties its folder.
await build({entryPoints:['extension/public/player.ts'],outfile:'dist-platform/player/player.js',bundle:true,format:'iife',target:'chrome116',minify:true,define:{'process.env.NODE_ENV':'"production"','process.env.WANDEL_PUBLIC_API_ORIGIN':'""',WANDEL_FREE:'false'}});
