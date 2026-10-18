import {environment} from './environment';
import {database} from './db';
import {createAccessCode,grantOwner} from './access';
const [command,...args]=process.argv.slice(2),config=environment(),db=database(config.dbPath);
try{
 if(command==='grant'&&args.length===1)console.log(JSON.stringify(grantOwner(db,args[0]),null,2));
 else if(command==='create-code'&&args.length===3)console.log(JSON.stringify(createAccessCode(db,args[0],Number(args[1]),Number(args[2])),null,2));
 else if(command==='revoke-code'&&args.length===1){db.transaction(()=>{const now=new Date().toISOString();const result=db.prepare('UPDATE access_codes SET revoked_at=? WHERE id=?').run(now,args[0]);if(!result.changes)throw new Error('Code not found.');db.prepare('UPDATE access_grants SET revoked_at=? WHERE code_id=?').run(now,args[0]);}).immediate();console.log('Code and its grants revoked.');}
 else if(command==='revoke-user'&&args.length===1){db.prepare('UPDATE access_grants SET revoked_at=? WHERE user_id IN (SELECT id FROM users WHERE lower(email)=?)').run(new Date().toISOString(),args[0].toLowerCase());console.log('Beta/admin grants revoked; paid subscriptions are unchanged.');}
 else throw new Error('Usage: accessAdmin grant EMAIL | create-code LABEL MAX_USES GRANT_DAYS | revoke-code ID | revoke-user EMAIL');
}catch(error){console.error((error as Error).message);process.exitCode=1;}finally{db.close();}
