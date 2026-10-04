import {randomUUID} from 'node:crypto';
import type {DB} from './db';
export interface Analytics {track(name:string,userId:string|null,properties?:Record<string,string|number|boolean>):void;}
export class LocalAnalytics implements Analytics {
 constructor(private db:DB,private clock:()=>Date){}
 track(name:string,userId:string|null,properties:Record<string,string|number|boolean>={}){this.db.prepare('INSERT INTO analytics_events VALUES (?,?,?,?,?)').run(randomUUID(),userId,name,JSON.stringify(properties),this.clock().toISOString());}
}
