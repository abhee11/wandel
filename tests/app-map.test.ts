// @vitest-environment jsdom
import {describe,expect,it,vi} from 'vitest';
import {describeShape,mergeShape,shapeOf} from '../extension/appmap/shape';
import {blocked,emptyMap,mergeMaps,record,scrubMessage,templatePath} from '../extension/appmap/catalog';
import {APP_MAP_MESSAGE,observe,ownRequest,startWatching} from '../extension/appmap/watch';
const invoice={id:'inv_83a1',customer:'Jane Doe',customer_email:'jane@acme.com',amount:4210,status:'overdue',paid:false,access_token:'abc123',lines:[{sku:'A1',qty:2}]};
describe('shapes',()=>{
 it('keeps types and drops every value except status words',()=>{
  const shape=shapeOf(invoice)!,text=JSON.stringify(shape);
  for(const value of ['Jane Doe','jane@acme.com','4210','inv_83a1','abc123'])expect(text).not.toContain(value);
  expect(shape.fields!.access_token).toBeUndefined();
  expect(shape.fields!.customer_email.personal).toBe(true);
  expect(shape.fields!.amount.types).toEqual(['number']);
  expect(shape.fields!.status.values).toEqual(['overdue']);
  expect(shape.fields!.lines.items!.fields!.qty.types).toEqual(['number']);
 });
 it('flags personal names but not product names',()=>{
  const shape=shapeOf({customerName:'Jane',first_name:'Jane',product_name:'Pro',filename:'a.pdf'})!;
  expect(shape.fields!.customerName.personal).toBe(true);
  expect(shape.fields!.first_name.personal).toBe(true);
  expect(shape.fields!.product_name.personal).toBeUndefined();
  expect(shape.fields!.filename.personal).toBeUndefined();
 });
 it('treats a value that looks like an email or phone as personal whatever its key',()=>{
  expect(shapeOf({note:'call +1 415 555 0100'})!.fields!.note.personal).toBe(true);
  expect(shapeOf({note:'Ships in two days'})!.fields!.note.personal).toBeUndefined();
  expect(shapeOf({contact:'+1 415 555 0100'})!.fields!.contact.personal).toBe(true);
  expect(shapeOf({x:'a@b.co'})!.fields!.x.personal).toBe(true);
  expect(shapeOf({due_date:'2026-01-01',created_at:'2026-01-01T10:00:00Z'})!.fields!.due_date.personal).toBeUndefined();
  expect(shapeOf({date_of_birth:'1990-01-01'})!.fields!.date_of_birth.personal).toBe(true);
 });
 it('stops keeping values once a set grows past eight',()=>{
  let shape=shapeOf({status:'a'})!;
  for(const word of ['b','c','d','e','f','g','h','i'])shape=mergeShape(shape,shapeOf({status:word})!);
  expect(shape.fields!.status.values).toBeUndefined();
  expect(shape.fields!.status.open).toBe(true);
 });
 it('marks fields missing from some items as optional',()=>{
  const shape=shapeOf([{a:1,b:2},{a:1}])!;
  expect(shape.items!.fields!.b.optional).toBe(true);
  expect(describeShape(shape.items!)).toContain('b?: number');
 });
});
describe('catalogue',()=>{
 it('turns ids into placeholders',()=>{
  expect(templatePath('/api/invoices/inv_83a1/lines/7')).toBe('/api/invoices/:id/lines/:id');
  expect(templatePath('/api/users/3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90')).toBe('/api/users/:id');
  expect(templatePath('/api/users/jane%40acme.com')).toBe('/api/users/:id');
  expect(templatePath('/api/v2/settings')).toBe('/api/v2/settings');
  expect(templatePath('/api/orders/ord_7')).toBe('/api/orders/:id');
 });
 it('scrubs values out of error messages',()=>{
  expect(scrubMessage('Email jane@acme.com is already taken')).toBe('Email <email> is already taken');
  expect(scrubMessage('Amount must be at least 10.00')).toBe('Amount must be at least <n>');
  expect(scrubMessage('Name "Jane" is reserved')).toBe('Name <value> is reserved');
 });
 it('merges observations and keeps rules from errors',()=>{
  let map=emptyMap('https://app.acme.com');
  map=record(map,{method:'get',path:'/api/invoices/inv_1',query:['status'],status:200,response:shapeOf(invoice)},'2026-11-01T00:00:00Z');
  map=record(map,{method:'GET',path:'/api/invoices/inv_2',query:['page'],status:200,response:shapeOf({...invoice,status:'paid'})},'2026-11-02T00:00:00Z');
  map=record(map,{method:'POST',path:'/api/invoices',query:[],status:422,request:shapeOf({amount:-1}),message:'Amount must be above 0'},'2026-11-02T00:00:00Z');
  const get=map.endpoints['GET /api/invoices/:id'];
  expect(get.seen).toBe(2);expect(get.query).toEqual(['page','status']);
  expect(get.response!.fields!.status.values).toEqual(['overdue','paid']);
  expect(map.endpoints['POST /api/invoices'].rules).toEqual(['422: Amount must be above <n>']);
  expect(map.endpoints['POST /api/invoices'].response).toBeUndefined();
 });
 it('ignores blocked paths',()=>{
  expect(blocked('/admin/users',['/admin'])).toBe(true);
  expect(blocked('/api/hr/salaries',['/api/hr/*'])).toBe(true);
  expect(blocked('/administrator',['/admin'])).toBe(false);
  expect(Object.keys(record(emptyMap('x'),{method:'GET',path:'/admin/users',query:[],status:200},undefined,['/admin']).endpoints)).toHaveLength(0);
 });
 it('merges two teammates\' maps',()=>{
  const a=record(emptyMap('o'),{method:'GET',path:'/a',query:['x'],status:200},'2026-11-01T00:00:00Z'),b=record(emptyMap('o'),{method:'GET',path:'/a',query:['y'],status:404},'2026-11-03T00:00:00Z');
  const merged=mergeMaps(a,b).endpoints['GET /a'];
  expect(merged).toMatchObject({seen:2,query:['x','y'],statuses:[200,404],firstSeen:'2026-11-01T00:00:00Z',lastSeen:'2026-11-03T00:00:00Z'});
 });
});
describe('watcher',()=>{
 it('counts sibling subdomains as the app and third parties as not',()=>{
  const page=new URL('https://app.acme.com/x');
  expect(ownRequest(new URL('https://api.acme.com/v1'),page)).toBe(true);
  expect(ownRequest(new URL('https://api.segment.io/v1'),page)).toBe(false);
 });
 it('reduces a response to its shape and keeps the error words',()=>{
  const ok=observe('get',new URL('https://app.acme.com/api/invoices?status=due'),200,undefined,JSON.stringify(invoice));
  expect(JSON.stringify(ok)).not.toContain('Jane');expect(ok.query).toEqual(['status']);
  const bad=observe('post',new URL('https://app.acme.com/api/invoices'),422,{amount:-1},JSON.stringify({error:{message:'Amount must be above 0'}}));
  expect(bad.message).toBe('Amount must be above 0');expect(bad.response).toBeNull();
 });
 it('passes requests through unchanged and posts only shapes',async()=>{
  vi.useFakeTimers();
  const response=new Response(JSON.stringify(invoice),{status:200,headers:{'content-type':'application/json'}});
  const real=vi.fn(async()=>response);(window as any).fetch=real;
  const posted:any[]=[];const post=vi.spyOn(window,'postMessage').mockImplementation((data:any)=>{posted.push(data);});
  startWatching(window as any);
  const got=await window.fetch(location.origin+'/api/invoices/inv_1');
  expect(got).toBe(response);expect(real).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(2100);
  expect(posted[0].type).toBe(APP_MAP_MESSAGE);
  expect(JSON.stringify(posted[0])).not.toContain('Jane');
  expect(posted[0].observations[0].response.fields.amount.types).toEqual(['number']);
  post.mockRestore();vi.useRealTimers();
 });
});
describe('what the page may send',()=>{
 it('keeps only well-formed observations',async()=>{
  const {validObservations}=await import('../extension/appmap/store');
  const good={method:'GET',path:'/a',query:['x'],status:200,response:{types:['object'],fields:{}}};
  expect(validObservations([good,{method:'GET'},{...good,status:'200'},{...good,response:{evil:true}},'junk'])).toHaveLength(1);
  expect(validObservations('nope')).toEqual([]);
  expect(validObservations(Array(80).fill(good))).toHaveLength(50);
 });
});
describe('using the map',()=>{
 const build=async()=>{
  const now='2026-11-10T00:00:00Z';let map=emptyMap('https://app.acme.com',now);
  map=record(map,{method:'GET',path:'/api/invoices',query:['status'],status:200,response:shapeOf([{id:'inv_1x',amount:10,status:'due'},{id:'inv_2x',amount:5,status:'paid'}])},now);
  map=record(map,{method:'POST',path:'/api/invoices',query:[],status:422,request:shapeOf({amount:0}),message:'Amount must be above 0'},now);
  map=record(map,{method:'GET',path:'/api/team/members',query:[],status:200,response:shapeOf([{role:'admin',email:'a@b.co'}])},now);
  return map;
 };
 it('picks endpoints that match the request and describes them without values',async()=>{
  const {relevantEndpoints}=await import('../extension/appmap/relevant');
  const text=relevantEndpoints(await build(),'Add a filter for overdue invoices','/billing',6000,new Date('2026-11-12'));
  expect(text.indexOf('GET /api/invoices?status')).toBe(0);
  expect(text).toContain('status: string, one of due | paid');
  expect(text).toContain('list of objects:\n      id: string');
  expect(text).toContain('rules: 422: Amount must be above <n>');
  expect(text).not.toContain('/api/team/members');
  expect(text).not.toMatch(/inv_1x|a@b\.co/);
 });
 it('gives the same words for the same map and request',async()=>{
  const {relevantEndpoints}=await import('../extension/appmap/relevant');const map=await build(),day=new Date('2026-11-12');
  expect(relevantEndpoints(map,'invoices','/',6000,day)).toBe(relevantEndpoints(map,'invoices','/',6000,day));
 });
 it('falls back to the most used reads, leaves out stale ones and respects the limit',async()=>{
  const {relevantEndpoints}=await import('../extension/appmap/relevant');const map=await build();
  expect(relevantEndpoints(map,'make it purple','/',6000,new Date('2026-11-12'))).toContain('GET ');
  expect(relevantEndpoints(map,'invoices','/',6000,new Date('2027-06-01'))).toBe('');
  expect(relevantEndpoints(map,'invoices','/',60,new Date('2026-11-12')).length).toBeLessThanOrEqual(60);
 });
 it('adds an existing API section to the build prompt only when something was learned',async()=>{
  const {existingApiSection}=await import('../extension/implementation/brief');
  const workflow:any={name:'Invoice filters',route:'/billing',states:[{id:'s',title:'Invoices',operations:[]}]};
  expect(existingApiSection(await build(),workflow)).toContain('## Existing API');
  expect(existingApiSection(null,workflow)).toBe('');
 });
});
