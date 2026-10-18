import { OperationSchema, uid, type Operation, type Locator } from '../shared/model';
import { nativeChoices } from '../content/nativeChoices';
import { describe } from '../content/locator';
import { editableText } from '../content/text';
import { localOperation, operationFromPlan } from './planner';
import { BatchSchema, type Batch } from './planSchema';

/** A deliberately bounded offline preset, not a substitute for a language model. */
export function formPreset(prompt:string):Batch|null {
  if(!/\b(add|more)\b/i.test(prompt)||!/\b(fields?|first name|last name|address)\b/i.test(prompt))return null;
  const fields:string[]=[];
  if(/\b(first name|name)\b/i.test(prompt.replace(/last name/ig,'')))fields.push('First name');
  if(/\blast name\b/i.test(prompt))fields.push('Last name');
  if(/\baddress\b/i.test(prompt))fields.push('Address');
  if(/\bemail\b/i.test(prompt))fields.push('Email');
  if(/\bphone\b/i.test(prompt))fields.push('Phone');
  if(!fields.length||(!/\b(fields?|layout)\b/i.test(prompt)&&fields.length<2))return null;
  const steps:Batch['steps']=[];
  if(/\blayout\b/i.test(prompt))steps.push({kind:'style',target:'form',position:'inside',element:'panel',text:'',style:{display:'flex',flexDirection:'column',gap:12,padding:24}});
  for(const text of fields)steps.push({kind:'insert',target:'submit',position:'before',element:'field',text,style:null});
  // Only change a label when the user actually supplies its replacement.
  const rename=prompt.match(/(?:rename|change)\s+(?:the\s+)?(?:sign[ -]?in\s+)?button\s+(?:text\s+)?to\s+["“]([^"”]+)["”]/i);
  if(rename)steps.push({kind:'text',target:'submit',position:'after',element:'button',text:rename[1],style:null});
  else if(/change\s+(?:the\s+)?sign[ -]?in\s+button/i.test(prompt))steps.push({kind:'style',target:'submit',position:'after',element:'button',text:'',style:{backgroundColor:'#6258db',color:'#ffffff',padding:12}});
  return BatchSchema.parse({steps});
}

export function promptOperations(prompt:string,plan:unknown,selected:HTMLElement,locator:Locator,root:HTMLElement,owned:Map<string,HTMLElement>):Operation[] {
  if(plan===undefined&&(!prompt.trim()||prompt.length>2000))throw new Error('Enter a change under 2,000 characters.');
  const batch=plan===undefined?formPreset(prompt):typeof plan==='object'&&plan!==null&&'steps' in plan?BatchSchema.parse(plan):null;
  if(!batch)return [plan===undefined?localOperation(prompt,locator):operationFromPlan(plan,locator)];
  // A matching native choice section supplies its own precise anchor. Resolve it
  // before generic form targets: dialogs often have choices but no HTML form.
  if(batch.steps.every(step=>step.kind==='insert')){
    const candidates:Operation[]=batch.steps.map(step=>({id:uid(),kind:'insert',target:locator,position:step.position,node:{id:uid(),kind:step.element,text:step.text,...(step.control?{control:step.control}:{}),...(step.required?{required:true}:{}),...(step.inputType?{inputType:step.inputType}:{})}}));
    const matched=nativeChoices(prompt,candidates,selected);
    if(matched!==candidates)return matched;
  }
  let form=selected.closest<HTMLElement>('form,[role="form"]');
  if(!form){let parent:HTMLElement|null=selected;while(parent&&root.contains(parent)&&!parent.matches('body,html')){if(parent.querySelector('input')&&parent.querySelector('button')){form=parent;break;}parent=parent.parentElement;}}
  const controls=form?Array.from(form.querySelectorAll<HTMLElement>('button,[role="button"],input[type="submit"]')).filter(el=>!el.closest('[data-dx-ignore],[data-dx-owned]')):[];
  const preferred=controls.filter(el=>el.matches('[type="submit"]')||/^sign\s*in$|^log\s*in$/i.test(el.textContent?.trim()||''));
  const submit=selected.matches('button,[role="button"]')&&form?.contains(selected)?selected:preferred.length===1?preferred[0]:controls.length===1?controls[0]:null;
  const ops=batch.steps.map(step=>{
    let el=step.target==='selected'?selected:step.target==='form'?form:submit;
    if(!el||!root.contains(el))throw new Error('Select the sign-in button inside the form so I can identify where to add the fields.');
    if(el.matches('input,textarea,select'))throw new Error('Select a button or form container, rather than an input control.');
    if(step.kind==='text'&&!editableText(el)){const labels=Array.from(el.querySelectorAll<HTMLElement>('span,p,strong,b,em')).filter(node=>editableText(node));if(labels.length===1)el=labels[0];}
    const ownedId=[...owned].find(([,node])=>node===el)?.[0];
    const target=step.target==='selected'&&el===selected?locator:describe(el,ownedId).locator;
    if(step.kind==='text'&&!editableText(el))throw new Error('Select the specific button text to rename it.');
    if(step.kind==='insert'&&step.position==='inside'&&el.matches('button,a,input,textarea,select,img,br,hr'))throw new Error('Select a container to add elements inside it.');
    if(step.kind==='insert'&&el.closest('table')&&!el.closest('td,th'))throw new Error('Select a table cell or a container outside the table.');
    return OperationSchema.parse(step.kind==='insert'?{id:uid(),kind:'insert',target,position:step.position,node:{id:uid(),kind:step.element,text:step.text,...(step.control?{control:step.control}:{}),...(step.required?{required:true}:{}),...(step.inputType?{inputType:step.inputType}:{})}}:step.kind==='text'?{id:uid(),kind:'text',target,text:step.text}:step.kind==='style'?{id:uid(),kind:'style',target,style:step.style}:{id:uid(),kind:'remove',target});
  });
  // Text changes can alter host locators. Apply insertions/styles first.
  return ops.sort((a,b)=>Number(a.kind==='text'||a.kind==='remove')-Number(b.kind==='text'||b.kind==='remove'));
}
