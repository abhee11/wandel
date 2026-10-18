import {it,expect} from 'vitest';
import {developmentOrigins} from '../platform/server/developmentOrigins';
const a='chrome-extension://'+'a'.repeat(32),b='chrome-extension://'+'b'.repeat(32);
it('merges only explicit local extension registrations without replacing environment values',()=>{expect(developmentOrigins({WANDEL_EXTENSION_ORIGINS:a},[a,b]).WANDEL_EXTENSION_ORIGINS).toBe(a+','+b);expect(()=>developmentOrigins({},['*'])).toThrow();});
it('ignores local registrations completely in production',()=>{const env={NODE_ENV:'production',WANDEL_EXTENSION_ORIGINS:a};expect(developmentOrigins(env,[b])).toBe(env);});
