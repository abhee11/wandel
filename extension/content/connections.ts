import type {ConnectionCondition,ConnectionEvent} from '../shared/model';
export type FormControl=HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement;
export function fieldFor(el:Element|null):FormControl|null{
  const field=el?.matches('input,textarea,select')?el:el?.querySelector('input,textarea,select');
  return field instanceof HTMLInputElement||field instanceof HTMLTextAreaElement||field instanceof HTMLSelectElement?field:null;
}
export function eventsFor(el:HTMLElement):ConnectionEvent[]{
  // A timed progress bar moves on by itself when it fills.
  if(el.matches('[data-dx-live="progress"]'))return ['finish'];
  if(el.matches('button,a,[role="button"],[role="link"]'))return ['click'];
  const field=fieldFor(el);if(field)return field.matches('select,input[type=checkbox],input[type=radio]')?['change']:['enter','change'];
  // Any other element, such as a card or section, can open a screen when clicked.
  return el.matches('html,body')?[]:['click'];
}
export function conditionPasses(condition:ConnectionCondition,field:FormControl|null){
  if(!field||field.matches('input[type=hidden],input[type=file]'))return false;
  switch(condition.test){
    case 'checked':return field instanceof HTMLInputElement&&['checkbox','radio'].includes(field.type)&&field.checked;
    case 'unchecked':return field instanceof HTMLInputElement&&['checkbox','radio'].includes(field.type)&&!field.checked;
    case 'filled':return !!field.value.trim();
    case 'valid':return field.checkValidity();
    case 'equals':return field.value===condition.value;
  }
}
