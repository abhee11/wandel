/** The models the assistant can plan with. The server offers a model only when its provider's key is set. */
export type ModelProvider='openai'|'anthropic'|'xai';
export interface ModelChoice{id:string;label:string;provider:ModelProvider}
export const modelChoices:ModelChoice[]=[
 {id:'gpt-6-astra',label:'GPT-6 Astra',provider:'openai'},
 {id:'gpt-6.1-sol',label:'GPT-6.1 Sol',provider:'openai'},
 {id:'claude-opus-5-5',label:'Claude Opus 5.5',provider:'anthropic'},
 {id:'claude-sonnet-5-5',label:'Claude Sonnet 5.5',provider:'anthropic'},
 {id:'grok-4.7',label:'Grok 4.7',provider:'xai'},
 {id:'grok-4.6',label:'Grok 4.6',provider:'xai'},
];
export const providerNames:Record<ModelProvider,string>={openai:'OpenAI',anthropic:'Claude',xai:'Grok'};
