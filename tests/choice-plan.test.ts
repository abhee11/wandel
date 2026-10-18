import {it,expect} from 'vitest';
import {choicePlan} from '../extension/ai/choicePlan';
it('parses the reported explicit category with numbered options',()=>{
 const plan=choicePlan('Add another section called Feedback length which has three options: 1. Concise - toggle (like others); 2. Normal; 3. Elaborated');
 expect(plan?.steps.map(s=>s.text)).toEqual(['Feedback length','Concise — On','Normal — Off','Elaborated — Off']);
});
it('honors the requested default in the previously suggested prompt',()=>{
 const plan=choicePlan('Add a “Feedback length” category below Metrics and above Cancel/Save. Match the existing category headings, spacing and purple pill controls. Include Concise, Normal and Elaborated. Allow only one choice at a time, with Normal selected initially.');
 expect(plan?.steps.map(s=>s.text)).toEqual(['Feedback length','Concise — Off','Normal — On','Elaborated — Off']);
});
it('does not locally guess unrelated or independent interactions',()=>{
 for(const prompt of ['Add billing with a backend','Add a category called Payment with options: transfer and pay and independent controls','Add a category with unspecified options'])expect(choicePlan(prompt)).toBeNull();
});
