// @vitest-environment jsdom
import {expect,it} from 'vitest';
import {publicSnapshot} from '../extension/content/publicSnapshot';
import type {Workflow} from '../extension/shared/model';
const now=new Date().toISOString();
const workflow={schemaVersion:1,id:'w1',name:'Test',origin:'https://app.example.test',route:'/',createdAt:now,updatedAt:now,entry:'s1',maxStates:10,states:[{id:'s1',title:'Existing application',parent:null,view:'base',operations:[]}],edges:[]} as unknown as Workflow;
function page(viewport:string|null){
 document.head.innerHTML=(viewport===null?'':`<meta name="viewport" content="${viewport}">`)+'<title>App</title><script>window.secret=1</script>';
 document.body.innerHTML='<main><h1>Jessica Smith</h1><p>Contact jessica@example.com</p><a href="/private">Open</a><input value="typed secret"></main>';
}
it('keeps the page’s phone layout setting and strips scripts, links, typed values and real words',()=>{
 page('width=device-width,initial-scale=1');
 const {html}=publicSnapshot(document,workflow,new Map(),true,'https://app.example.test/');
 expect(html).toMatch(/<meta name="viewport" content="width=device-width,initial-scale=1">/);
 expect(html).not.toContain('window.secret');
 expect(html).not.toContain('href="/private"');
 expect(html).not.toContain('typed secret');
 expect(html).not.toContain('Jessica');
 expect(html).not.toContain('jessica@example.com');
});
it('leaves out a viewport setting that isn’t plain values, and adds none when the page has none',()=>{
 page('x');document.querySelector('meta[name="viewport"]')!.setAttribute('content','width=device-width"><script>alert(1)</script>');
 expect(publicSnapshot(document,workflow,new Map(),false,'https://app.example.test/').html).not.toContain('name="viewport"');
 page(null);
 expect(publicSnapshot(document,workflow,new Map(),false,'https://app.example.test/').html).not.toContain('name="viewport"');
});
