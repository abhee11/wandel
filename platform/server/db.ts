import Database from 'better-sqlite3';
import {readFileSync,readdirSync} from 'node:fs';
export type DB=Database.Database;
export function database(path:string):DB {
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
