import {randomUUID} from 'node:crypto';
import {writeFileSync,readFileSync} from 'node:fs';
import {environment} from './environment';
import {database} from './db';
import {hashPassword,secret} from './security';
import {createWorkflow} from '../../extension/prototype/engine';
import {period} from './entitlements';
const config=environment();if(config.production)throw new Error('Fixtures are disabled in production.');let previousPassword:string|undefined;try{previousPassword=readFileSync('.data/fixture-accounts.txt','utf8').match(/^New fixtures use password: (.+)$/m)?.[1];}catch{/* first seed */}
const db=database(config.dbPath),password=process.env.WANDEL_FIXTURE_PASSWORD||(!process.argv.includes('--reset')&&previousPassword)||secret().slice(0,20),hash=await hashPassword(password),now=new Date(),timestamp=now.toISOString(),p=period(now);
const fixtures=['free','pro','ai-limit','workflow-limit','canceled-pro'];
for(const name of fixtures){const email=`${name}@wandel.test`;if(process.argv.includes('--reset'))db.prepare('DELETE FROM users WHERE email=?').run(email);
 if(db.prepare('SELECT 1 FROM users WHERE email=?').get(email))continue;
 const id=randomUUID(),pro=name==='pro'||name==='canceled-pro';db.prepare('INSERT INTO users (id,email,name,password_hash,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(id,email,name,hash,timestamp,timestamp);
 db.prepare('INSERT INTO subscriptions VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,pro?'mock':'none',pro?`mock_${id}`:null,pro?`mock_sub_${id}`:null,pro?'PRO':'FREE',pro?'active':'free',pro?timestamp:null,pro?new Date(now.getTime()+14*86400000).toISOString():null,name==='canceled-pro'?1:0,timestamp);
 if(name==='ai-limit')for(let i=0;i<config.plans.FREE.aiActionsPerMonth;i++)db.prepare('INSERT INTO ai_actions VALUES (?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),id,`fixture-${i}`,'fixture',p.start,p.end,'succeeded','{}',timestamp,timestamp);
 if(name==='workflow-limit')for(let i=0;i<(config.plans.FREE.savedWorkflows||3);i++){const pid=randomUUID(),w=createWorkflow(new URL('https://example.com'),`Saved flow ${i+1}`);db.prepare('INSERT INTO prototypes (id,user_id,name,description,target_domain,current_version,revision,created_at,updated_at) VALUES (?,?,?,?,?,0,1,?,?)').run(pid,id,w.name,'Fixture','https://example.com',timestamp,timestamp);db.prepare('INSERT INTO prototype_definitions VALUES (?,?)').run(pid,JSON.stringify(w));}
}
writeFileSync('.data/fixture-accounts.txt',`New fixtures use password: ${password}\n${fixtures.map(x=>`${x}@wandel.test`).join('\n')}\nExisting fixture accounts are not overwritten.\n`,{mode:0o600});console.log('Fixture accounts prepared. Credentials are in .data/fixture-accounts.txt (local only).');db.close();
