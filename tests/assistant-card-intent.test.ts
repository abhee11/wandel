import {expect,it} from 'vitest';
import {cardCopyIntent} from '../extension/assistant/cardIntent';
it('extracts all explicit fields from the reported conversational follow-up',()=>{
 expect(cardCopyIntent('Yes - duplicate it with heading "Feedback & Support" and the sub text is for feedback please click on create and call the button inside as "Create"')).toEqual({title:'Feedback & Support',description:'for feedback please click on create',button:'Create',incomplete:false});
});
it('preserves punctuation and casing in quoted labels and descriptions',()=>{
 expect(cardCopyIntent('Copy this card with title "Help & FAQ" and description "Need help? Click Create." and button called "Get Help"')).toEqual({title:'Help & FAQ',description:'Need help? Click Create.',button:'Get Help',incomplete:false});
});
it('distinguishes copying without changes from fields it could not parse',()=>{
 expect(cardCopyIntent('Duplicate it')).toEqual({title:null,description:null,button:null,incomplete:false});expect(cardCopyIntent('Duplicate it with a different button')?.incomplete).toBe(true);
});
