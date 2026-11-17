// @vitest-environment jsdom
import {expect,it} from 'vitest';
import {coverElements} from '../extension/assistant/execute';
import {plainReason} from '../extension/assistant/recovery';
it('turns every line of a transcript into the transcript body, but never takes the title with it',()=>{
 document.body.innerHTML=`<div id="root"><section><div class="head"><h5>1. Title</h5></div><div class="body">${Array.from({length:12},(_,i)=>`<div class="row"><p>Line ${i}</p></div>`).join('')}</div></section></div>`;
 const root=document.getElementById('root')!,rows=[...document.querySelectorAll<HTMLElement>('.row')];
 expect(coverElements(rows,root)).toEqual([document.querySelector('.body')]);
 const lines=[...document.querySelectorAll<HTMLElement>('.row p')];
 expect(coverElements(lines,root)).toEqual([document.querySelector('.body')]);
 // Some lines only: they stay as they are.
 expect(coverElements(rows.slice(0,3),root)).toEqual(rows.slice(0,3));
 // A line inside a listed body is dropped; the root is never reached.
 expect(coverElements([document.querySelector<HTMLElement>('.body')!,lines[0]],root)).toEqual([document.querySelector('.body')]);
 expect(coverElements([document.querySelector<HTMLElement>('.head')!,document.querySelector<HTMLElement>('.body')!],root)).toEqual([document.querySelector('section')]);
});
it('says what was too big instead of blaming a lost element',()=>{
 const zod=JSON.stringify([{code:'too_big',maximum:10,type:'array',inclusive:true,exact:false,message:'Array must contain at most 10 element(s)',path:['effects']}],null,2);
 expect(plainReason('Preview not applied: '+zod)).toMatch(/more separate changes on one click than I can make \(at most 10\)/);
 expect(plainReason('[{"code":"invalid_type","path":["target"]}]')).toMatch(/lost track/);
});
import {verifyNewButton,isGlyphButton} from '../extension/assistant/controlVerification';
it('lets an arrow or close icon be a bare symbol, but not a worded button',()=>{
 const make=(text:string)=>{const b=document.createElement('button');b.textContent=text;b.style.background='transparent';b.style.border='0';document.body.append(b);b.getBoundingClientRect=()=>({width:16,height:16} as DOMRect);return b;};
 expect(isGlyphButton(make('▾'))).toBe(true);expect(isGlyphButton(make('✕'))).toBe(true);expect(isGlyphButton(make('A'))).toBe(false);
 expect(()=>verifyNewButton(make('▾'))).not.toThrow();
 const worded=make('Save');worded.getBoundingClientRect=()=>({width:60,height:32} as DOMRect);
 expect(()=>verifyNewButton(worded)).toThrow(/plain text/);
});
