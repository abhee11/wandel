import {describe,expect,it} from 'vitest';
import {conversationRecovery} from '../extension/assistant/recovery';
// Failure details recorded from a real tester session (Nov 2026).
const zod='Preview not applied: [\n  {\n    "code": "too_small",\n    "minimum": 0,\n    "type": "number",\n    "message": "Number must be greater than or equal to 0",\n    "path": ["target","structure","path",15]\n  }\n]';
describe('plain failure messages',()=>{
 it('never shows validation JSON',()=>{const {text}=conversationRecovery(zod);expect(text).not.toMatch(/too_small|"code"|\[/);expect(text).toMatch(/lost track of one of the elements/);});
 it('explains a rejected container destination',()=>{expect(conversationRecovery('Preview rolled back: Preview could not be applied: Choose a container as the destination.').text).toMatch(/can’t hold other elements/);});
 it('explains a target with several labels',()=>{expect(conversationRecovery('Preview not applied: This target contains several independent labels. Inspect its child labels before choosing which text to change.').text).toMatch(/several pieces of text/);});
 it('says a timeout ran out of time',()=>{expect(conversationRecovery('[ASSISTANT_TIMEOUT]').text).toMatch(/ran out of time/);});
});
