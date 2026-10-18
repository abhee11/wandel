import type {Command,CopyNode} from '../shared/model';
import {editableText} from './text';

export function canAlignText(el:HTMLElement){
  return el.matches('button,a,[role=button],[role=link]')&&!!el.textContent?.trim()||el.matches('input:not([type=checkbox]):not([type=radio]):not([type=hidden]),textarea')||!!editableText(el);
}
export function canAlignVertically(el:HTMLElement){
  return canAlignText(el)&&!el.matches('input,textarea,select')&&!el.querySelector('input,textarea,select,button,a,[contenteditable]')&&(!el.querySelector('img,svg')||el.matches('button,a,[role=button],[role=link]'));
}
/** Align within the selected box; never reposition its surrounding layout. */
export function textAlignment(el:HTMLElement,c:Extract<Command,{type:'alignText'}>):CopyNode['style']{
  if(!canAlignText(el))throw new Error('Select a text element or text input to align.');
  if(c.vertical&&!canAlignVertically(el))throw new Error('Vertical alignment is unavailable for this element. Select a simple text box.');
  if(!c.horizontal&&!c.vertical)throw new Error('Choose an alignment.');
  const computed=getComputedStyle(el),style:CopyNode['style']={};
  const flex=computed.display==='flex'||computed.display==='inline-flex';
  const column=computed.flexDirection.startsWith('column');
  const horizontal={left:'flex-start',center:'center',right:'flex-end'} as const;
  const vertical={top:'flex-start',middle:'center',bottom:'flex-end'} as const;
  const control=el.matches('button,a,[role=button],[role=link]');
  if(control&&!flex){
    style.display=computed.display==='block'?'flex':'inline-flex';style['flex-direction']='row';
    style['justify-content']=horizontal[c.horizontal||(['left','center','right'].includes(computed.textAlign)?computed.textAlign as 'left'|'center'|'right':'center')];
    style['align-items']=vertical[c.vertical||'middle'];
    if(c.horizontal)style['text-align']=c.horizontal;
    return style;
  }
  if(c.horizontal){
    style['text-align']=c.horizontal;
    if(flex)style[column?'align-items':'justify-content']=horizontal[c.horizontal];
  }
  if(c.vertical){
    if(flex)style[column?'justify-content':'align-items']=vertical[c.vertical];
    else Object.assign(style,{display:'flex','flex-direction':'column','align-items':'stretch','justify-content':vertical[c.vertical]});
  }
  return style;
}
