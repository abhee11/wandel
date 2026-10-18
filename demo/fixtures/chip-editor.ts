import './text-editor';
const modal=document.getElementById('modal')!,chip=modal.querySelector('button')!;
// Deliberately reproduce an application's document-level dialog focus trap.
document.addEventListener('focusin',event=>{if(event.target instanceof Node&&!modal.contains(event.target))chip.focus();},true);
