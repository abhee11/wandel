/** Recognize a copy request before any AI generation can reinterpret it as a new box. */
export function isDuplicateRequest(prompt:string){return /^(?:(?:please|can you|could you|would you)\s+)*(?:duplicate|copy|clone|make\s+(?:a|another)\s+copy)\b/i.test(prompt.trim());}
/** Only complete requests are executed locally; extra instructions are never discarded. */
export function duplicateIntent(prompt:string):{heading?:string}|null{
 const p=prompt.trim().replace(/[.!?]+$/,'').replace(/\s+please$/i,'');
 const verb='(?:(?:please|can you|could you|would you)\\s+)*(?:copy|duplicate|clone|make\\s+(?:a|another)\\s+copy(?:\\s+of)?)';
 const target='(?:(?:this|that|it|selected|the selected)(?:\\s+(?:whole\\s+)?(?:card|section|element|item|panel|button|text|link))?)?';
 const base=p.match(new RegExp('^'+verb+'(?:\\s+'+target+')?$','i'));if(base)return {};
 const rename='(?:(?:give\\s+it\\s+(?:a\\s+)?|with\\s+(?:a\\s+)?|add\\s+(?:a\\s+)?|(?:change|set|rename)\\s+(?:its|the)\\s+)(?:heading|title)\\s*(?:of|to|as|is|called|:)?|(?:name(?:\\s+it)?|rename(?:\\s+it)?|call\\s+it)\\s*(?:is|to|as|called|:)?|(?:set|change)\\s+(?:its|the)\\s+name\\s*(?:to|as|:)?)';
 const match=p.match(new RegExp('^'+verb+'\\s+'+target+'\\s*(?:,|and)?\\s*'+rename+'\\s+(.+)$','i'));if(!match)return null;
 const raw=match[1].trim(),quoted=raw.match(/^["“]([^"”]+)["”]$/)||raw.match(/^'([^']+)'$/);
 if(!quoted&&/\b(?:and|then|also|with|connect|delete|remove|navigate|button|description|below|above|beside)\b/i.test(raw))return null;
 const heading=quoted?.[1]||raw;if(!heading||heading.length>300)return null;return {heading};
}
