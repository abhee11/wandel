// @vitest-environment jsdom
import {expect,it} from 'vitest';
import {compactBlock,inlineContext} from '../extension/assistant/execute';
const chevron='<svg width="16" height="16" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>';
it('treats a lone icon, badge or small markup as compact, and a section as not',()=>{
 expect(compactBlock({nodes:[{type:'custom',html:chevron}]})).toBe(true);
 expect(compactBlock({nodes:[{type:'icon'}]})).toBe(true);
 expect(compactBlock({nodes:[{type:'badge'},{type:'button'}]})).toBe(true);
 expect(compactBlock({nodes:[{type:'row',parent:-1},{type:'button',parent:0}]})).toBe(true);
 expect(compactBlock({nodes:[{type:'row',parent:-1},{type:'row',parent:0},{type:'button',parent:1}]})).toBe(false);
 expect(compactBlock({nodes:[{type:'heading'},{type:'text'}]})).toBe(false);
 expect(compactBlock({nodes:[{type:'custom',html:'<section><h3>Title</h3><p>Body</p></section>'}]})).toBe(false);
 expect(compactBlock({nodes:[{type:'icon'},{type:'icon'},{type:'icon'},{type:'icon'}]})).toBe(false);
});
it('sees a title or a horizontal row as a line, and a stacked column as not',()=>{
 document.body.innerHTML='<div id="col" style="display:flex;flex-direction:column"><div id="header" style="display:flex;justify-content:space-between"><div id="titlerow" style="display:flex;align-items:center"><h5 id="title">1. Class Recalls Story</h5></div><p>7:55am</p></div><div id="body">Text</div></div>';
 const el=(id:string)=>document.getElementById(id) as HTMLElement;
 expect(inlineContext(el('title'),'inside')).toBe(true);
 expect(inlineContext(el('title'),'after')).toBe(true);
 expect(inlineContext(el('titlerow'),'inside')).toBe(true);
 expect(inlineContext(el('header'),'after')).toBe(false);
 expect(inlineContext(el('body'),'inside')).toBe(false);
});
