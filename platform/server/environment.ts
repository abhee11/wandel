import {developmentOrigins} from './developmentOrigins';
import {loadEnvFile} from 'node:process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {configuration} from './config';
import {secret} from './security';
export function environment(){try{loadEnvFile('.env');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}if(process.env.NODE_ENV!=='production')mkdirSync('.data',{recursive:true,mode:0o700});let pepper=process.env.SESSION_PEPPER;
 if(!pepper&&process.env.NODE_ENV!=='production'){try{pepper=readFileSync('.data/session-secret','utf8');}catch{pepper=secret();writeFileSync('.data/session-secret',pepper,{mode:0o600,flag:'wx'});}}
 let env=process.env;
 if(env.NODE_ENV!=='production'){let origins:unknown=[];try{origins=JSON.parse(readFileSync('.data/development-extension-origins.json','utf8'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}env=developmentOrigins(env,origins);}
 return configuration(env,pepper||'');}
