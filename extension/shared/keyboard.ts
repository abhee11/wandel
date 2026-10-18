/** Inputs that consume ordinary character keys; dialogs and checkboxes do not. */
export function isTextEntry(target:EventTarget|undefined){
 if(!(target instanceof Element))return false;
 if(target.closest('textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'))return true;
 const input=target.closest('input');return !!input&&!['button','submit','reset','checkbox','radio','range','color','file','hidden','image'].includes((input.getAttribute('type')||'text').toLowerCase());
}
