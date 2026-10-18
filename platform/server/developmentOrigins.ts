import {z} from 'zod';
const Origins=z.array(z.string().regex(/^chrome-extension:\/\/[a-p]{32}$/)).max(20);
/** Explicit local registrations never affect production's environment allowlist. */
export function developmentOrigins(env:NodeJS.ProcessEnv,registered:unknown):NodeJS.ProcessEnv {
 if(env.NODE_ENV==='production')return env;
 const origins=Origins.parse(registered);
 return {...env,WANDEL_EXTENSION_ORIGINS:[...new Set([...(env.WANDEL_EXTENSION_ORIGINS||'').split(',').filter(Boolean),...origins])].join(',')};
}
