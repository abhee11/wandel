import { z } from 'zod';
export const PlanConfig=z.object({savedWorkflows:z.number().int().positive().nullable(),aiActionsPerMonth:z.number().int().nonnegative(),maxDepth:z.number().int().positive().nullable(),savedVersions:z.number().int().positive().nullable(),versionHistory:z.boolean(),privateSharing:z.boolean()});
export type Limits=z.infer<typeof PlanConfig>;
export const defaultPlans={FREE:{savedWorkflows:3,aiActionsPerMonth:20,maxDepth:5,savedVersions:3,versionHistory:false,privateSharing:false},PRO:{savedWorkflows:null,aiActionsPerMonth:500,maxDepth:null,savedVersions:null,versionHistory:true,privateSharing:false}} satisfies Record<string,Limits>;
export interface Config {production:boolean;mockBilling:boolean;origin:string;extensionOrigins:string[];pepper:string;plans:{FREE:Limits;PRO:Limits};priceCents:number;currency:string;dbPath:string;aiMode:'mock'|'openai';authMode:'clerk'|'legacy';}
export function configuration(env:NodeJS.ProcessEnv,pepper:string):Config {
 const production=env.NODE_ENV==='production';
 const plans=z.object({FREE:PlanConfig,PRO:PlanConfig}).parse(env.WANDEL_PLAN_LIMITS?JSON.parse(env.WANDEL_PLAN_LIMITS):defaultPlans);
 const origin=new URL(env.WANDEL_APP_ORIGIN||'http://127.0.0.1:5174').origin;
 if(production&&(!env.SESSION_PEPPER||!origin.startsWith('https://')))throw new Error('Production requires SESSION_PEPPER and an HTTPS WANDEL_APP_ORIGIN.');
 if(production&&env.WANDEL_MOCK_BILLING==='true')throw new Error('Mock billing cannot run in production.');
 z.string().min(32).parse(pepper);
 return {authMode:env.WANDEL_AUTH_MODE==='legacy'?'legacy':'clerk',production,mockBilling:!production&&env.WANDEL_MOCK_BILLING!=='false',origin,extensionOrigins:(env.WANDEL_EXTENSION_ORIGINS||'').split(',').filter(Boolean),pepper,plans,priceCents:z.coerce.number().int().positive().parse(env.WANDEL_PRO_PRICE_CENTS||1500),currency:'USD',dbPath:env.WANDEL_DB||'.data/wandel.sqlite',aiMode:env.WANDEL_AI_MODE==='mock'&&!production?'mock':'openai'};
}

/** Keep local development private; container production listens on its service interface. */
export function serverAddress(env:NodeJS.ProcessEnv){
 return {host:env.WANDEL_HOST||(env.NODE_ENV==='production'?'0.0.0.0':'127.0.0.1'),port:z.coerce.number().int().min(1).max(65535).parse(env.WANDEL_PORT||env.PORT||4320)};
}
