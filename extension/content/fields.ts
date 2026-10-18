import type {Operation} from '../shared/model';
import {applyAppearance} from './nativeDesign';
type Spec=Extract<Operation,{kind:'insert'}>['node'];
/** Standalone prototype fields never submit the host form. Entered values are transient. */
export function configureField(host:HTMLElement,node:Spec){
 const old=host.querySelector('input,textarea,select');old?.remove();
 const type=node.inputType||'text';let input:HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement;
 if(type==='textarea')input=document.createElement('textarea');
 else if(type==='select'){input=document.createElement('select');for(const text of node.options||['Option 1','Option 2']){const option=document.createElement('option');option.textContent=text;option.value=text;input.append(option);}}
 else{input=document.createElement('input');input.type=type;}
 input.dataset.dxField='true';input.setAttribute('aria-label',node.text);input.autocomplete='off';input.required=!!node.required;
 if(input instanceof HTMLInputElement&&type==='radio')input.name='wandel-radio-'+(node.radioGroup||'default');
 if(input instanceof HTMLInputElement||input instanceof HTMLTextAreaElement){input.placeholder=node.text;input.maxLength=300;}
 input.style.cssText='box-sizing:border-box;width:100%;min-width:0;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;background:white;color:inherit;font:inherit;';
 if(node.inputAppearance)applyAppearance(input,node.inputAppearance);
 if(type==='checkbox'||type==='radio'){input.style.cssText='width:18px;height:18px;min-width:18px;flex:none;accent-color:currentColor;';host.style.flexDirection='row';host.style.alignItems='center';host.prepend(input);}
 else{host.style.flexDirection='column';host.append(input);}
 input.addEventListener('keydown',e=>{if((e as KeyboardEvent).key==='Enter'&&type!=='textarea')e.preventDefault();});
 input.addEventListener('input',e=>{input.removeAttribute('aria-invalid');e.stopPropagation();});
 input.addEventListener('click',e=>e.stopPropagation());
 input.addEventListener('change',e=>e.stopPropagation());
 return input;
}
