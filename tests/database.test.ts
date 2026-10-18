import {it,expect} from 'vitest';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {database} from '../platform/server/db';
import {serverAddress} from '../platform/server/config';
it('starts with a missing nested database directory, migrates it and preserves data across reopening',()=>{
 const root=mkdtempSync(join(tmpdir(),'wandel-db-')),path=join(root,'volume','nested','wandel.sqlite');
 try{let db=database(path);try{expect((db.prepare('SELECT count(*) as n FROM schema_migrations').get() as {n:number}).n).toBeGreaterThan(0);db.exec('CREATE TABLE startup_check (value TEXT NOT NULL)');db.prepare('INSERT INTO startup_check VALUES (?)').run('retained');}finally{db.close();}
 db=database(path);try{expect(db.prepare('SELECT value FROM startup_check').get()).toEqual({value:'retained'});expect(db.pragma('foreign_keys',{simple:true})).toBe(1);expect(db.pragma('journal_mode',{simple:true})).toBe('wal');}finally{db.close();}
 }finally{rmSync(root,{recursive:true,force:true});}
});
it('continues to support in-memory databases',()=>{const db=database(':memory:');try{expect((db.prepare('SELECT count(*) as n FROM schema_migrations').get() as {n:number}).n).toBeGreaterThan(0);}finally{db.close();}});
it('reports an unusable database directory without overwriting the existing file',()=>{
 const root=mkdtempSync(join(tmpdir(),'wandel-db-')),file=join(root,'not-a-directory');try{writeFileSync(file,'existing');expect(()=>database(join(file,'wandel.sqlite'))).toThrow('Check WANDEL_DB');}finally{rmSync(root,{recursive:true,force:true});}
});
it('uses the hosting port and production interface while preserving explicit and development settings',()=>{
 expect(serverAddress({})).toEqual({host:'127.0.0.1',port:4320});expect(serverAddress({NODE_ENV:'production',PORT:'8080'})).toEqual({host:'0.0.0.0',port:8080});expect(serverAddress({NODE_ENV:'production',WANDEL_HOST:'127.0.0.1',WANDEL_PORT:'4321',PORT:'8080'})).toEqual({host:'127.0.0.1',port:4321});expect(()=>serverAddress({PORT:'not-a-port'})).toThrow();expect(()=>serverAddress({PORT:'70000'})).toThrow();
});

it('rejects database URLs rather than silently creating a local directory from a connection string',()=>{expect(()=>database('postgresql://example.invalid/wandel')).toThrow('SQLite file path');expect(()=>database('file:/data/wandel.sqlite')).toThrow('SQLite file path');});
