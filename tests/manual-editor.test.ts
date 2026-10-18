// @vitest-environment jsdom
import {it,expect,beforeEach,afterEach,vi} from 'vitest';
import {Session} from '../extension/content/session';
import {Repository,BrowserStorage} from '../extension/storage/store';
import {RecordSchema,type FieldType} from '../extension/shared/model';
let session:Session;
const root=()=>document.querySelector('main')!;
const shadow=()=>document.querySelector('[data-dx-editor]')!.shadowRoot!;
beforeEach(async()=>{localStorage.clear();document.body.innerHTML='<main><section id="area"><button id="source" style="background:rgb(120,40,200);border-radius:24px;font-family:Georgia">Source</button><button id="target" style="background:rgb(10,20,30);border-radius:2px">Target</button></section></main>';session=new Session(root(),new Repository(new BrowserStorage()),new URL('https://example.com'));await session.init();await session.dispatch({type:'edit'});});
afterEach(()=>session.destroy());
it('Escape restores host interaction and offers a visible way back to selection',async()=>{
 const clicked=vi.fn();document.getElementById('source')!.onclick=clicked;document.getElementById('source')!.click();expect(clicked).not.toHaveBeenCalled();
 await session.dispatch({type:'escape'});expect(session.snapshot().mode).toBe('interact');
 expect(shadow().textContent).toContain('Interact · page clicks work');
 document.getElementById('source')!.click();expect(clicked).toHaveBeenCalledOnce();
 const resume=shadow().querySelector<HTMLButtonElement>('[aria-label="Resume selecting (V)"]')!;resume.click();await session.dispatch({type:'snapshot'});expect(session.snapshot().mode).toBe('edit');
 document.getElementById('source')!.click();expect(clicked).toHaveBeenCalledOnce();
});
it('Escape closes the add menu first without trapping the user in it',async()=>{
 document.getElementById('source')!.click();
 const add=shadow().querySelector<HTMLElement>('[aria-label="Add an element"]')!.parentElement as HTMLDetailsElement;add.open=true;
 window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));expect(add.open).toBe(false);expect(session.snapshot().mode).toBe('edit');
 window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await session.dispatch({type:'snapshot'});expect(session.snapshot().mode).toBe('interact');
});
it.each(['email','password','number','url','tel','date','time','checkbox','radio','textarea','select'] as FieldType[])('inserts a working %s field and restores the host on undo',async type=>{
 document.getElementById('area')!.click();
 await session.dispatch({type:'insertElement',kind:'field',inputType:type,text:'Sample field',position:'inside'});
 const label=session.findSelected()!,input=label.querySelector<HTMLInputElement>('input,textarea,select')!;
 expect(input).not.toBeNull();if(type==='textarea'||type==='select')expect(input.tagName.toLowerCase()).toBe(type);else expect(input.type).toBe(type);
 await session.dispatch({type:'interact'});
 let submits=0;root().addEventListener('submit',e=>{submits++;e.preventDefault();});
 if(type==='checkbox'){input.click();expect(input.checked).toBe(true);}
 if(type==='email'){input.value='sample@example.com';input.dispatchEvent(new Event('input',{bubbles:true}));expect(input.checkValidity()).toBe(true);}
 expect(submits).toBe(0);await session.dispatch({type:'edit'});await session.dispatch({type:'undo'});expect(root().querySelector('[data-dx-field]')).toBeNull();expect(document.getElementById('source')).not.toBeNull();
});
it('supports radio groups, field properties, duplication and serialization without entered values',async()=>{
 document.getElementById('area')!.click();await session.dispatch({type:'insertElement',kind:'field',inputType:'radio',text:'One',position:'inside'});
 await session.dispatch({type:'duplicateElement'});await session.dispatch({type:'text',text:'Two'});await session.dispatch({type:'fieldSettings',inputType:'radio',radioGroup:'choice'});
 const second=session.findSelected()!;const first=[...root().querySelectorAll<HTMLElement>('label')].find(l=>l!==second)!;first.click();await session.dispatch({type:'fieldSettings',inputType:'radio',radioGroup:'choice'});
 await session.dispatch({type:'interact'});const radios=root().querySelectorAll<HTMLInputElement>('input[type=radio]');radios[0].click();radios[1].click();expect(radios[0].checked).toBe(false);expect(radios[1].checked).toBe(true);
 const record=RecordSchema.parse(JSON.parse(JSON.stringify({draft:session.workflow,enabled:true,currentVersion:0,versions:[]})));expect(record.draft.states[0].operations.filter(o=>o.kind==='insert')).toHaveLength(2);
 expect(JSON.stringify(record)).not.toContain('"checked"');
});
it('Ctrl/Cmd-click copies style, preserves text and behavior, and supports undo and replay',async()=>{
 let clicks=0;document.getElementById('target')!.onclick=()=>clicks++;
 document.getElementById('source')!.dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true}));
 document.getElementById('target')!.dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true}));
 await session.dispatch({type:'snapshot'});const target=document.getElementById('target')!;
 expect(target.style.borderRadius).toBe('24px');expect(target.textContent).toBe('Target');expect(clicks).toBe(0);
 await session.dispatch({type:'interact'});target.click();expect(clicks).toBe(1);
 await session.dispatch({type:'undo'});expect(target.style.borderRadius).toBe('2px');
 await session.dispatch({type:'redo'});expect(target.style.borderRadius).toBe('24px');
 await session.dispatch({type:'reset'});expect(target.style.borderRadius).toBe('2px');
});
it('retains prototype typing when switching between Edit and Interact',async()=>{
 document.getElementById('area')!.click();await session.dispatch({type:'insertElement',kind:'field',inputType:'email',position:'inside'});
 await session.dispatch({type:'interact'});const input=root().querySelector<HTMLInputElement>('[data-dx-field]')!;input.value='temporary@example.com';
 await session.dispatch({type:'edit'});expect(root().querySelector<HTMLInputElement>('[data-dx-field]')!.value).toBe('temporary@example.com');
 expect(JSON.stringify(session.workflow)).not.toContain('temporary@example.com');
});
it('keeps stationary pointer presses available for double-click editing of a copied pill',async()=>{
 const source=document.getElementById('source')!;source.innerHTML='<span>Talk Time</span>';source.click();await session.dispatch({type:'duplicateElement'});
 const copy=session.findSelected()!;
 const down=new MouseEvent('pointerdown',{bubbles:true,cancelable:true,button:0,clientX:20,clientY:20});copy.dispatchEvent(down);expect(down.defaultPrevented).toBe(false);
 const up=new MouseEvent('pointerup',{bubbles:true,cancelable:true,button:0,clientX:20,clientY:20});copy.dispatchEvent(up);expect(up.defaultPrevented).toBe(false);
 copy.querySelector('span')!.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));
 const editor=shadow().querySelector<HTMLTextAreaElement>('[aria-label="Edit text"]')!;expect(editor).not.toBeNull();expect(editor.value).toBe('Talk Time');expect(editor.selectionStart).toBe(0);expect(editor.selectionEnd).toBe(9);
 editor.value='Response time';editor.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,composed:true}));await session.dispatch({type:'snapshot'});
 expect(session.renderer.owned.get(copy.dataset.dxOwned!)!.textContent).toBe('Response time');expect(source.textContent).toBe('Talk Time');
});
it('drags the dropdown control without moving its label or surrounding section',async()=>{
 document.getElementById('area')!.click();await session.dispatch({type:'insertElement',kind:'field',inputType:'select',text:'Choose',position:'inside'});
 const label=session.findSelected()!,control=label.querySelector('select')!;
 control.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,cancelable:true,button:0,clientX:10,clientY:10}));expect(session.findSelected()).toBe(control);
 window.dispatchEvent(new MouseEvent('pointermove',{bubbles:true,cancelable:true,clientX:70,clientY:40}));
 window.dispatchEvent(new MouseEvent('pointerup',{bubbles:true,cancelable:true,clientX:70,clientY:40}));
 await session.dispatch({type:'snapshot'});
 const moved=session.renderer.owned.get(control.dataset.dxOwned!)!;expect(moved.style.translate).toBe('60px 30px');expect(label.style.translate).toBe('');expect(document.getElementById('area')!.style.translate).toBe('');
 await session.dispatch({type:'undo'});expect(session.renderer.owned.get(control.dataset.dxOwned!)!.style.translate).toBe('');
 await session.dispatch({type:'interact'});const active=root().querySelector('select')!;active.value='Option 2';active.dispatchEvent(new Event('change',{bubbles:true}));expect(active.value).toBe('Option 2');
});
it('double-clicking a copied pill in Interact resumes editing and selects its label',async()=>{
 document.getElementById('source')!.click();await session.dispatch({type:'duplicateElement'});const copy=session.findSelected()!;
 await session.dispatch({type:'interact'});copy.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));await session.dispatch({type:'snapshot'});
 const editor=shadow().querySelector<HTMLTextAreaElement>('[aria-label="Edit text"]')!;
 expect(session.snapshot().mode).toBe('edit');expect(editor).not.toBeNull();expect(editor.selectionStart).toBe(0);expect(editor.selectionEnd).toBe(editor.value.length);
});
it('completes the text journey: align, move, duplicate, rename, copy style, save and restore',async()=>{
 const text=document.createElement('p');text.id='copy-text';text.textContent='Original label';text.style.cssText='width:240px;height:100px;color:rgb(20,30,40)';document.getElementById('area')!.append(text);text.click();
 expect(shadow().querySelector('[aria-label="Text alignment"]')).not.toBeNull();
 await session.dispatch({type:'alignText',horizontal:'center'});await session.dispatch({type:'alignText',vertical:'middle'});
 expect(text.style.textAlign).toBe('center');expect(text.style.justifyContent).toBe('center');
 text.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,cancelable:true,button:0,clientX:10,clientY:10}));
 window.dispatchEvent(new MouseEvent('pointermove',{bubbles:true,cancelable:true,clientX:50,clientY:30}));window.dispatchEvent(new MouseEvent('pointerup',{bubbles:true,cancelable:true,clientX:50,clientY:30}));await session.dispatch({type:'snapshot'});
 expect(text.style.translate).toBe('40px 20px');await new Promise(resolve=>setTimeout(resolve,0));
 await session.dispatch({type:'duplicateElement'});const copiedId=session.findSelected()!.dataset.dxOwned!;
 session.findSelected()!.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));const editor=shadow().querySelector<HTMLTextAreaElement>('[aria-label="Edit text"]')!;
 expect(editor.selectionEnd).toBe('Original label'.length);editor.value='New label';editor.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,composed:true}));await session.dispatch({type:'snapshot'});
 expect(session.renderer.owned.get(copiedId)!.textContent).toBe('New label');expect(text.textContent).toBe('Original label');
 document.getElementById('source')!.dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true}));session.renderer.owned.get(copiedId)!.dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true}));await session.dispatch({type:'snapshot'});
 expect(session.renderer.owned.get(copiedId)!.style.fontFamily).toBe('Georgia');expect(session.renderer.owned.get(copiedId)!.textContent).toBe('New label');
 await session.dispatch({type:'undo'});expect(session.renderer.owned.get(copiedId)!.style.fontFamily).not.toBe('Georgia');await session.dispatch({type:'redo'});
 await session.dispatch({type:'saveTemporary'});const record=RecordSchema.parse(JSON.parse(JSON.stringify(session.record)));
 await session.dispatch({type:'reset'});expect(text.style.translate).toBe('');expect(text.style.display).toBe('');
 await session.dispatch({type:'loadRecord',record});expect(text.style.textAlign).toBe('center');expect(text.style.justifyContent).toBe('center');expect(text.style.translate).toBe('40px 20px');expect(session.renderer.owned.get(copiedId)!.textContent).toBe('New label');
});
it('aligns text inputs horizontally and explicitly disables vertical alignment',async()=>{
 const input=document.createElement('input');input.type='email';input.id='email-field';input.placeholder='Email';document.getElementById('area')!.append(input);input.click();
 expect(shadow().querySelector<HTMLButtonElement>('[aria-label="Align text middle"]')!.disabled).toBe(true);
 await session.dispatch({type:'alignText',horizontal:'center'});expect(input.style.textAlign).toBe('center');expect(input.style.display).toBe('');
 await expect(session.dispatch({type:'alignText',vertical:'middle'})).rejects.toThrow('Vertical alignment');
});
it('keeps alignment axes independent and restores host layout on undo',async()=>{
 const text=document.createElement('p');text.textContent='Text';text.style.cssText='display:flex;flex-direction:row;justify-content:flex-end;align-items:flex-start';root().append(text);text.click();
 await session.dispatch({type:'alignText',horizontal:'center'});expect(text.style.justifyContent).toBe('center');expect(text.style.alignItems).toBe('flex-start');
 await session.dispatch({type:'alignText',vertical:'middle'});expect(text.style.justifyContent).toBe('center');expect(text.style.alignItems).toBe('center');
 await session.dispatch({type:'undo'});expect(text.style.alignItems).toBe('flex-start');await session.dispatch({type:'undo'});expect(text.style.justifyContent).toBe('flex-end');
});
it('keeps generated text selected after alignment and style transfer and allows cancelling a transfer',async()=>{
 document.getElementById('area')!.click();await session.dispatch({type:'insertElement',kind:'text',text:'Keep selected',position:'inside'});const id=session.findSelected()!.dataset.dxOwned!;
 await session.dispatch({type:'alignText',horizontal:'center'});expect(session.findSelected()).toBe(session.renderer.owned.get(id));
 document.getElementById('source')!.dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true}));expect(shadow().querySelector('[aria-label="Cancel style transfer"]')).not.toBeNull();
 await session.dispatch({type:'cancelStyle'});expect(session.snapshot().styleSource).toBeNull();
 document.getElementById('source')!.dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true}));session.renderer.owned.get(id)!.dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true}));await session.dispatch({type:'snapshot'});
 expect(session.findSelected()).toBe(session.renderer.owned.get(id));expect(shadow().querySelector('[aria-label="Edit text in place"]')).not.toBeNull();
});
it('double-click edits a specific label inside a multi-label button without flattening its other text',async()=>{
 const button=document.getElementById('source')!;button.innerHTML='<span id="primary-label">Talk time</span><small>Selected metric</small>';
 const label=document.getElementById('primary-label')!;label.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));
 const editor=shadow().querySelector<HTMLTextAreaElement>('[aria-label="Edit text"]')!;expect(editor.value).toBe('Talk time');editor.value='Response time';editor.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,composed:true}));await session.dispatch({type:'snapshot'});
 expect(label.textContent).toBe('Response time');expect(button.querySelector('small')!.textContent).toBe('Selected metric');
});
it('allows double-clicking generated input labels without pointerdown swallowing the gesture',async()=>{
 document.getElementById('area')!.click();await session.dispatch({type:'insertElement',kind:'field',text:'Work email',inputType:'email',position:'inside'});
 const label=session.findSelected()!,input=label.querySelector('input')!;
 const down=new MouseEvent('pointerdown',{bubbles:true,cancelable:true,button:0,clientX:10,clientY:10});input.dispatchEvent(down);expect(down.defaultPrevented).toBe(false);
 input.dispatchEvent(new MouseEvent('pointerup',{bubbles:true,cancelable:true,clientX:10,clientY:10}));input.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));
 expect(shadow().querySelector<HTMLTextAreaElement>('[aria-label="Edit text"]')!.value).toBe('Work email');
});
it('leaves native rich text editors and non-text areas alone on double-click',()=>{
 const native=document.createElement('div');native.contentEditable='true';native.setAttribute('contenteditable','true');native.textContent='Native editor';root().append(native);
 const event=new MouseEvent('dblclick',{bubbles:true,cancelable:true});native.dispatchEvent(event);expect(event.defaultPrevented).toBe(false);expect(shadow().querySelector('[aria-label="Edit text"]')).toBeNull();
 const empty=document.createElement('div');root().append(empty);empty.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));expect(shadow().querySelector('[role="alert"]')!.textContent).toBe('');
});
it.each(['Backspace','Delete'])('%s removes the selected element in Edit and can be undone',async key=>{
 const source=document.getElementById('source')!;source.click();const event=new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true});window.dispatchEvent(event);await session.dispatch({type:'snapshot'});
 expect(event.defaultPrevented).toBe(true);expect(source.style.display).toBe('none');
 await session.dispatch({type:'undo'});expect(source.style.display).not.toBe('none');
});
it('keeps Delete/Backspace available for typing and leaves Interact and Replay alone',async()=>{
 const source=document.getElementById('source')!;source.click();source.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));
 const editor=shadow().querySelector<HTMLTextAreaElement>('[aria-label="Edit text"]')!;
 const inlineKey=new KeyboardEvent('keydown',{key:'Backspace',bubbles:true,composed:true,cancelable:true});editor.dispatchEvent(inlineKey);await session.dispatch({type:'snapshot'});expect(inlineKey.defaultPrevented).toBe(false);expect(source.style.display).not.toBe('none');
 editor.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,composed:true}));
 const input=document.createElement('input');root().append(input);const inputKey=new KeyboardEvent('keydown',{key:'Delete',bubbles:true,cancelable:true});input.dispatchEvent(inputKey);expect(inputKey.defaultPrevented).toBe(false);
 for(const mode of ['interact','replay'] as const){await session.dispatch({type:mode});const event=new KeyboardEvent('keydown',{key:'Backspace',bubbles:true,cancelable:true});window.dispatchEvent(event);expect(event.defaultPrevented).toBe(false);expect(source.style.display).not.toBe('none');}
});
it('E enters Edit and I enters Interact, while V remains a toggle',async()=>{
 const key=async(value:string)=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true}));await session.dispatch({type:'snapshot'});};
 await key('i');expect(session.mode()).toBe('interact');expect(shadow().textContent).toContain('Edit (E)');
 await key('e');expect(session.mode()).toBe('edit');expect(shadow().textContent).toContain('Interact (I)');
 await key('v');expect(session.mode()).toBe('interact');await key('E');expect(session.mode()).toBe('edit');
 await session.dispatch({type:'replay'});await key('e');expect(session.mode()).toBe('edit');
});
it('does not switch modes when typing E or I, using command shortcuts, or after closing',async()=>{
 const input=document.createElement('input');root().append(input);
 for(const key of ['e','i']){const event=new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true});input.dispatchEvent(event);expect(event.defaultPrevented).toBe(false);expect(session.mode()).toBe('edit');}
 const command=new KeyboardEvent('keydown',{key:'i',metaKey:true,bubbles:true,cancelable:true});window.dispatchEvent(command);expect(command.defaultPrevented).toBe(false);expect(session.mode()).toBe('edit');
 await session.dispatch({type:'closeEditor'});window.dispatchEvent(new KeyboardEvent('keydown',{key:'e',bubbles:true}));await session.dispatch({type:'snapshot'});expect(session.mode()).toBe('closed');
});
it.each(['button','a','role-button'])('edits, aligns, moves, duplicates and deletes a %s consistently',async kind=>{
 const control=document.createElement(kind==='role-button'?'div':kind);control.id='action-control';if(kind==='role-button'){control.setAttribute('role','button');control.tabIndex=0;}if(kind==='a')control.setAttribute('href','https://example.com/details');
 control.innerHTML='<span>View details</span>';control.style.cssText='display:inline-flex;width:200px;height:60px;gap:8px';root().append(control);
 const click=vi.fn();control.onclick=click;
 control.querySelector('span')!.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));const editor=shadow().querySelector<HTMLTextAreaElement>('[aria-label="Edit text"]')!;
 expect(editor.value).toBe('View details');editor.value='Open details';editor.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,composed:true}));await session.dispatch({type:'snapshot'});expect(control.textContent).toBe('Open details');expect(click).not.toHaveBeenCalled();
 control.click();await session.dispatch({type:'alignText',horizontal:'center',vertical:'middle'});expect(control.style.justifyContent).toBe('center');expect(control.style.alignItems).toBe('center');
 await session.dispatch({type:'style',style:{x:30,y:15}});expect(control.style.translate).toBe('30px 15px');
 await session.dispatch({type:'duplicateElement'});const id=session.findSelected()!.dataset.dxOwned!,copy=session.findSelected()!;expect(copy.textContent).toBe('Open details');
 if(kind==='a'){expect(copy.tagName).toBe('A');expect(copy.getAttribute('href')).toBe('https://example.com/details');}if(kind==='role-button')expect(copy.getAttribute('role')).toBe('button');
 await session.dispatch({type:'text',text:'Copied action'});expect(session.renderer.owned.get(id)!.textContent).toBe('Copied action');expect(control.textContent).toBe('Open details');
 await session.dispatch({type:'remove'});expect(session.renderer.owned.get(id)!.style.display).toBe('none');await session.dispatch({type:'undo'});expect(session.renderer.owned.get(id)!.style.display).not.toBe('none');
 control.click();await session.dispatch({type:'child',text:'Details screen'});const destination=session.stateId;await session.dispatch({type:'replay'});control.click();expect(session.stateId).toBe(destination);expect(click).not.toHaveBeenCalled();
});
it('exposes copy style directly and applies it with a normal destination click',async()=>{
 document.getElementById('source')!.click();const button=shadow().querySelector<HTMLButtonElement>('[aria-label="Copy style"]')!;expect(button.closest('details')).toBeNull();button.click();await session.dispatch({type:'snapshot'});
 expect(shadow().textContent).toContain('Click a destination');document.getElementById('target')!.click();await session.dispatch({type:'snapshot'});
 expect(document.getElementById('target')!.style.borderRadius).toBe('24px');expect(document.getElementById('target')!.textContent).toBe('Target');expect(session.snapshot().styleSource).toBeNull();expect(session.findSelected()).toBe(document.getElementById('target'));
});
it('accepts full and short hex colors, rejects incomplete values and preserves the color on undo',async()=>{
 document.getElementById('source')!.click();const hex=shadow().querySelector<HTMLInputElement>('[aria-label="Text color hex"]')!;hex.focus();
 hex.value='#123456';hex.dispatchEvent(new Event('input',{bubbles:true}));await session.dispatch({type:'snapshot'});expect(document.getElementById('source')!.style.color).toBe('rgb(18, 52, 86)');
 hex.value='#f0a';hex.dispatchEvent(new Event('input',{bubbles:true}));await session.dispatch({type:'snapshot'});expect(document.getElementById('source')!.style.color).toBe('rgb(255, 0, 170)');
 hex.value='#xy';hex.dispatchEvent(new Event('input',{bubbles:true}));await session.dispatch({type:'snapshot'});expect(hex.getAttribute('aria-invalid')).toBe('true');expect(document.getElementById('source')!.style.color).toBe('rgb(255, 0, 170)');
 hex.blur();await session.dispatch({type:'undo'});expect(document.getElementById('source')!.style.color).toBe('');
});
it('aligns a link with an icon without stacking its icon and label',async()=>{
 const link=document.createElement('a');link.id='icon-link';link.href='https://example.com';link.innerHTML='<svg aria-hidden="true"></svg><span>Details</span>';root().append(link);link.click();
 await session.dispatch({type:'alignText',horizontal:'right',vertical:'middle'});expect(link.style.flexDirection).toBe('row');expect(link.style.justifyContent).toBe('flex-end');expect(link.style.alignItems).toBe('center');expect(link.querySelector('svg')).not.toBeNull();
});
it('preserves the host link drag behavior outside Edit and blocks native drag while editing',async()=>{
 const link=document.createElement('a');link.href='https://example.com';link.textContent='Link';root().append(link);
 const edit=new Event('dragstart',{bubbles:true,cancelable:true});link.dispatchEvent(edit);expect(edit.defaultPrevented).toBe(true);
 await session.dispatch({type:'interact'});const interact=new Event('dragstart',{bubbles:true,cancelable:true});link.dispatchEvent(interact);expect(interact.defaultPrevented).toBe(false);
});
it('does not preserve executable link destinations in duplicated controls',async()=>{
 const link=document.createElement('a');link.id='unsafe-link';link.href='javascript:alert(1)';link.textContent='Unsafe';root().append(link);link.click();await session.dispatch({type:'duplicateElement'});
 expect(session.findSelected()!.tagName).toBe('A');expect(session.findSelected()!.hasAttribute('href')).toBe(false);
});
it('keeps button editing actions grouped and changes padding, corners and weight without Apply',async()=>{
 document.getElementById('source')!.click();const primary=shadow().querySelector('[aria-label="Button and link editing"]')!;
 expect(primary.querySelector('[aria-label="Copy style"]')).not.toBeNull();expect(primary.querySelector('[aria-label="Drag to move selected element"]')).not.toBeNull();
 const radius=shadow().querySelector<HTMLInputElement>('[aria-label="Corner radius"]')!;radius.value='18';radius.dispatchEvent(new Event('change',{bubbles:true}));await session.dispatch({type:'snapshot'});expect(document.getElementById('source')!.style.borderRadius).toBe('18px');
 const padding=shadow().querySelector<HTMLInputElement>('[aria-label="Padding"]')!;padding.value='20';padding.dispatchEvent(new Event('change',{bubbles:true}));await session.dispatch({type:'snapshot'});expect(document.getElementById('source')!.style.padding).toBe('20px');
 const weight=shadow().querySelector<HTMLSelectElement>('[aria-label="Font weight"]')!;weight.value='700';weight.dispatchEvent(new Event('change',{bubbles:true}));await session.dispatch({type:'snapshot'});expect(document.getElementById('source')!.style.fontWeight).toBe('700');
});
const talkTimeMarkup='<button class="Chip-sc-1rr5b1b-6 kFXXVp" type="button" aria-pressed="true">Talk Time<span class="ChipIcon-sc-1rr5b1b-7 hClLma"><svg width="16" height="16" viewBox="0 0 24 24" focusable="false" color="inherit" aria-hidden="true" role="presentation" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M20.7071 5.29289C21.0976 5.68342 21.0976 6.31658 20.7071 6.70711L9.70711 17.7071C9.31658 18.0976 8.68342 18.0976 8.29289 17.7071L3.29289 12.7071C2.90237 12.3166 2.90237 11.6834 3.29289 11.2929C3.68342 10.9024 4.31658 10.9024 4.70711 11.2929L9 15.5858L19.2929 5.29289C19.6834 4.90237 20.3166 4.90237 20.7071 5.29289Z" fill="currentColor"></path></svg></span></button>';
it.each(['edit','interact'] as const)('edits the supplied Talk Time chip in %s without replacing its icon',async mode=>{
 const holder=document.createElement('section');holder.innerHTML=talkTimeMarkup;root().append(holder);const chip=holder.querySelector('button')!,svg=chip.querySelector('svg')!;await session.dispatch({type:mode});
 chip.querySelector('path')!.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));await session.dispatch({type:'snapshot'});
 const editor=shadow().querySelector<HTMLTextAreaElement>('[aria-label="Edit text"]')!;expect(editor).not.toBeNull();expect(editor.value).toBe('Talk Time');
 editor.value='Response time';editor.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,composed:true}));await session.dispatch({type:'snapshot'});
 expect(chip.firstChild!.textContent).toBe('Response time');expect(chip.querySelector('svg')).toBe(svg);expect(chip.getAttribute('aria-pressed')).toBe('true');await session.dispatch({type:'undo'});expect(chip.firstChild!.textContent).toBe('Talk Time');
});
it.each(['label','div','span','p'])('double-clicks host %s text from Interact directly into editing',async tag=>{
 const label=document.createElement(tag);label.textContent='Editable '+tag;root().append(label);await session.dispatch({type:'interact'});label.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));await session.dispatch({type:'snapshot'});
 expect(shadow().querySelector<HTMLTextAreaElement>('[aria-label="Edit text"]')?.value).toBe('Editable '+tag);
});
it('keeps inline editing focused inside an application with a modal focus trap',async()=>{
 const modal=document.createElement('div');modal.setAttribute('role','dialog');modal.innerHTML=talkTimeMarkup;root().append(modal);const chip=modal.querySelector('button')!;chip.focus();
 const trap=(event:FocusEvent)=>{if(event.target instanceof Node&&!modal.contains(event.target))chip.focus();};document.addEventListener('focusin',trap,true);
 try{chip.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));expect(shadow().activeElement).toBe(shadow().querySelector('[aria-label="Edit text"]'));}finally{document.removeEventListener('focusin',trap,true);}
});
it('edits a clicked text run in a formatted paragraph without flattening its children',async()=>{
 const paragraph=document.createElement('p');paragraph.innerHTML='First text <strong>bold text</strong> trailing text';root().append(paragraph);const bold=paragraph.querySelector('strong')!,range=document.createRange();range.setStart(paragraph.firstChild!,1);range.collapse(true);
 const descriptor=Object.getOwnPropertyDescriptor(document,'caretRangeFromPoint');Object.defineProperty(document,'caretRangeFromPoint',{configurable:true,value:()=>range});
 try{
  paragraph.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true,clientX:10,clientY:10}));const input=shadow().querySelector<HTMLTextAreaElement>('[aria-label="Edit text"]')!;expect(input.value).toBe('First text');input.value='Updated text';input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,composed:true}));await session.dispatch({type:'snapshot'});
  expect(paragraph.firstChild!.textContent).toBe('Updated text');expect(paragraph.querySelector('strong')).toBe(bold);expect(bold.textContent).toBe('bold text');expect(paragraph.lastChild!.textContent).toBe(' trailing text');
  const op=session.workflow.states[0].operations.at(-1)!;expect(op.kind==='text'&&op.target.textPath).toEqual([0]);await session.dispatch({type:'saveTemporary'});const record=RecordSchema.parse(JSON.parse(JSON.stringify(session.record)));
  await session.dispatch({type:'undo'});expect(paragraph.firstChild!.textContent).toBe('First text ');await session.dispatch({type:'loadRecord',record});expect(paragraph.firstChild!.textContent).toBe('Updated text');expect(paragraph.querySelector('strong')).toBe(bold);
 }finally{if(descriptor)Object.defineProperty(document,'caretRangeFromPoint',descriptor);else delete (document as any).caretRangeFromPoint;}
});
it('does not take over native input text selection when double-clicking in Interact',async()=>{
 const input=document.createElement('input');input.value='Existing data';root().append(input);await session.dispatch({type:'interact'});const event=new MouseEvent('dblclick',{bubbles:true,cancelable:true});input.dispatchEvent(event);expect(event.defaultPrevented).toBe(false);expect(session.mode()).toBe('interact');expect(shadow().querySelector('[aria-label="Edit text"]')).toBeNull();
});
it('keeps plain-text editing controls away from adjacent text and omits overlapping insertion handles',()=>{
 const p=document.createElement('p');p.textContent='One paragraph';root().append(p);p.click();expect(shadow().querySelector('[aria-label="Text editing"]')).not.toBeNull();expect(shadow().querySelector('[aria-label="Add below selection"]')).toBeNull();expect(shadow().querySelector('[aria-label="Add an element"]')).not.toBeNull();
 const bar=shadow().querySelector<HTMLElement>('[aria-label="Element actions"]')!;expect(parseFloat(bar.style.top)).toBeGreaterThan(100);
});
it('switches modes and duplicates a focused button inside a host application dialog',async()=>{
 const modal=document.createElement('section');modal.setAttribute('role','dialog');modal.innerHTML='<button id="modal-option">Talk Time</button>';root().append(modal);const control=modal.querySelector<HTMLButtonElement>('button')!;const host=vi.fn();control.onclick=host;
 await session.dispatch({type:'interact'});control.focus();const edit=new KeyboardEvent('keydown',{key:'e',bubbles:true,cancelable:true});control.dispatchEvent(edit);await session.dispatch({type:'snapshot'});expect(edit.defaultPrevented).toBe(true);expect(session.mode()).toBe('edit');
 control.click();const duplicate=new KeyboardEvent('keydown',{key:'d',metaKey:true,bubbles:true,cancelable:true});control.dispatchEvent(duplicate);await session.dispatch({type:'snapshot'});expect(duplicate.defaultPrevented).toBe(true);expect(session.workflow.states[0].operations.some(op=>op.kind==='insert'&&op.node.copy?.some(n=>n.text==='Talk Time'))).toBe(true);expect(host).not.toHaveBeenCalled();
 const inline=shadow().querySelector<HTMLTextAreaElement>('[aria-label="Edit text"]')!;expect(inline.value).toBe('Talk Time');inline.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,composed:true}));
 control.dispatchEvent(new KeyboardEvent('keydown',{key:'i',bubbles:true,cancelable:true}));await session.dispatch({type:'snapshot'});expect(session.mode()).toBe('interact');
});
it('uses mode keys on a focused checkbox and duplicates a selected email field in Edit',async()=>{
 const modal=document.createElement('section');modal.setAttribute('role','dialog');modal.innerHTML='<label><input type="checkbox">Show profile</label><label>Email<input type="email"></label>';root().append(modal);
 const checkbox=modal.querySelector<HTMLInputElement>('input[type=checkbox]')!,email=modal.querySelector<HTMLInputElement>('input[type=email]')!;
 await session.dispatch({type:'interact'});checkbox.focus();checkbox.dispatchEvent(new KeyboardEvent('keydown',{key:'e',bubbles:true,cancelable:true}));await session.dispatch({type:'snapshot'});expect(session.mode()).toBe('edit');
 email.click();email.focus();const event=new KeyboardEvent('keydown',{key:'d',ctrlKey:true,bubbles:true,cancelable:true});email.dispatchEvent(event);await session.dispatch({type:'snapshot'});expect(event.defaultPrevented).toBe(true);expect(session.workflow.states[0].operations.some(op=>op.kind==='insert')).toBe(true);
});
it('keeps ordinary typing and browser shortcuts in an Interact text field inside a dialog',async()=>{
 const modal=document.createElement('section');modal.setAttribute('role','dialog');modal.innerHTML='<input type="email">';root().append(modal);const input=modal.querySelector('input')!;await session.dispatch({type:'interact'});input.focus();
 for(const key of ['e','i','v']){const event=new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true});input.dispatchEvent(event);await session.dispatch({type:'snapshot'});expect(event.defaultPrevented).toBe(false);expect(session.mode()).toBe('interact');}
 const duplicate=new KeyboardEvent('keydown',{key:'d',metaKey:true,bubbles:true,cancelable:true});input.dispatchEvent(duplicate);expect(duplicate.defaultPrevented).toBe(false);
});
