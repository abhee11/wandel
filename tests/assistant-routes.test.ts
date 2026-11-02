import {expect,it} from 'vitest';
import {connectionRoute,connectionControls,matchingScreens} from '../extension/assistant/routeConnection';
import {conversationInstruction} from '../extension/assistant/conversation';
import type {PageContext} from '../extension/assistant/schema';
import type {VisitedScreen} from '../extension/shared/model';
it('extracts only explicit route connection requests',()=>{
 expect(connectionRoute('Make it connect to /profile page')).toBe('/profile');expect(connectionRoute('Connect to /')).toBe('/');expect(connectionRoute('Change the title /profile')).toBeNull();
});
it('selects the single action within a selected card without reaching unrelated buttons',()=>{
 const c={selected:'card',elements:[{ref:'card',interactive:false,parent:null},{ref:'wrapper',interactive:false,parent:'card'},{ref:'create',tag:'button',interactive:true,parent:'wrapper'},{ref:'outside',tag:'button',interactive:true,parent:null}]} as unknown as PageContext;
 expect(connectionControls(c).map(e=>e.ref)).toEqual(['create']);c.elements.push({ref:'second',tag:'button',interactive:true,parent:'card'} as any);expect(connectionControls(c)).toHaveLength(2);
});
it('does not silently confuse /profile with another host or a different profile route',()=>{
 const screens=[{url:'https://example.com/profile'},{url:'https://other.example/profile'},{url:'https://example.com/profile/AmithV'}] as VisitedScreen[];expect(matchingScreens(screens,'/profile','https://example.com')).toEqual([screens[0]]);
});
it('bounds conversation context without truncating the current instruction',()=>{
 const text='Add a Feedback card';const combined=conversationInstruction(text,Array.from({length:20},()=>({role:'user' as const,text:'Previous text '.repeat(200)})));expect(combined.length).toBeLessThanOrEqual(1600);expect(combined.endsWith(text)).toBe(true);expect(conversationInstruction('x'.repeat(1600),[{role:'user',text:'hello'}])).toHaveLength(1600);
});
