// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {repeatPeers} from '../extension/content/repeats';
it('finds the same control in every repeated item, including identical ones',()=>{
 document.body.innerHTML=`<main><ol class="row">${Array.from({length:20},(_,i)=>`<li class="col"><article class="pod"><h3>Book ${i}</h3><div class="price"><p>£${i}</p><button class="btn">Add to basket</button></div></article></li>`).join('')}</ol><button class="btn">Checkout</button></main>`;
 const root=document.querySelector('main')!,buttons=[...root.querySelectorAll<HTMLElement>('li button')];
 const peers=repeatPeers(buttons[3],root);
 expect(peers).toHaveLength(20);expect(peers).toEqual(buttons);
 expect(peers).not.toContain(root.querySelector('main>button'));
});
it('follows records spread over table rows and leaves a lone element alone',()=>{
 document.body.innerHTML=`<main><table><tbody>${Array.from({length:5},(_,i)=>`<tr class="athing"><td class="title">${i}.</td><td class="title"><span class="titleline"><a href="#">Story ${i}</a></span></td></tr><tr><td class="subtext">${i} points</td></tr>`).join('')}</tbody></table><h1>Alone</h1></main>`;
 const root=document.querySelector('main')!;
 expect(repeatPeers(root.querySelector<HTMLElement>('.titleline a')!,root).map(a=>a.textContent)).toEqual(['Story 0','Story 1','Story 2','Story 3','Story 4']);
 const h1=root.querySelector<HTMLElement>('h1')!;expect(repeatPeers(h1,root)).toEqual([h1]);
});
it('a hover on every item styles each item itself, not the example',async()=>{
 const {Session}=await import('../extension/content/session');const {Repository,BrowserStorage}=await import('../extension/storage/store');
 document.body.innerHTML=`<main><ul>${[0,1,2,3].map(i=>`<li class="story"><a class="t" href="#">Story ${i}</a></li>`).join('')}</ul></main>`;
 localStorage.clear();const root=document.querySelector('main')!;const s=new Session(root,new Repository(new BrowserStorage()),new URL('https://example.test/'),{assistantEnabled:true});await s.init();await s.dispatch({type:'edit'});
 const c=(await s.dispatch({type:'assistantContext',instruction:'Highlight each story title in yellow when I hover it'})).assistant!.context!;
 const ref=c.elements.find(e=>e.name==='Story 0')!.ref;
 await s.dispatch({type:'assistantApply',token:c.token,plan:{status:'edit',message:'Hover highlight.',question:null,candidates:[],actions:[{everyMatch:true,kind:'behavior',event:'hover',targets:[ref],effects:[{action:'style',targets:[ref],value:'background-color:rgb(255, 244, 184)'}],element:null,text:null,labels:[],position:null,styleRef:null,style:null,destination:null,newViewTitle:null}]}}).catch(e=>{if(!/^Preview kept/.test((e as Error).message))throw e;});
 const links=[...root.querySelectorAll<HTMLElement>('a.t')];
 links[2].dispatchEvent(new Event('pointerenter'));
 expect(links[2].style.backgroundColor).toBe('rgb(255, 244, 184)');expect(links[0].style.backgroundColor).toBe('');
 links[2].dispatchEvent(new Event('pointerleave'));expect(links[2].style.backgroundColor).toBe('');
 s.destroy();
});
