import Database from 'better-sqlite3';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
export type DB=Database.Database;
export function database(path:string):DB {
 if(/^[a-z][a-z0-9+.-]*:\/\//i.test(path)||path.startsWith('file:'))throw new Error('WANDEL_DB must be a SQLite file path, not a database URL.');
 if(path&&path!==':memory:'){
  const directory=dirname(resolve(path));
  try{mkdirSync(directory,{recursive:true,mode:0o700});}catch(cause){throw new Error(`Cannot prepare database directory "${directory}". Check WANDEL_DB and the volume's write permissions.`,{cause});}
 }
 const db=new Database(path);db.pragma('foreign_keys = ON');db.pragma('journal_mode = WAL');db.pragma('synchronous = FULL');db.pragma('busy_timeout = 5000');
 db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
 for(const file of readdirSync('platform/migrations').filter(x=>x.endsWith('.sql')).sort()){
  if(db.prepare('SELECT 1 FROM schema_migrations WHERE name=?').get(file))continue;
  db.transaction(()=>{db.exec(readFileSync(`platform/migrations/${file}`,'utf8'));db.prepare('INSERT INTO schema_migrations VALUES (?,?)').run(file,new Date().toISOString());}).immediate();
 }
 return db;
}
export function one<T>(db:DB,sql:string,...args:unknown[]):T|undefined{return db.prepare(sql).get(...args) as T|undefined;}
export function all<T>(db:DB,sql:string,...args:unknown[]):T[]{return db.prepare(sql).all(...args) as T[];}
