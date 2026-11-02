/** Extract explicit card-copy fields; quoted labels retain punctuation and casing. */
export function cardCopyIntent(text:string){
 if(!/\b(?:duplicate|copy)\b/i.test(text)&&!(/\b(?:another|similar)\b/i.test(text)&&/\bcard\b/i.test(text)))return null;
 const headingQuoted=text.match(/\b(?:heading|title)\s*(?:(?:is|as|to|of)\s*|[:=]\s*)?["“]([^"”]+)["”]/i);
 const headingPlain=text.match(/\b(?:heading|title)\s*(?:(?:is|as|to|of)\s+|[:=]\s*)?(.+?)(?=\s+(?:and\s+)?(?:the\s+)?(?:sub\s*text|description|body\s*text|button)\b|[.!?\n]|$)/i);
 const namedTitle=text.match(/\b(?:called|named|titled)\s+(?:["“]([^"”]+)["”]|([a-z][a-z &'-]{0,80}?)(?=\s*,?\s*(?:matching|with|and|for)\b|[.!?\n]|$))/i);
 const legacyTitle=text.match(/\b(?:into|as|called|named|titled)\s+(?:an?\s+)?([a-z][a-z -]{0,48}?)\s+card\b/i);
 const description=text.match(/\b(?:sub\s*text|description|body\s*text)\s*(?:(?:is|as|to)\s+|[:=]\s*)?(?:["“]([^"”]+)["”]|(.+?)(?=\s+(?:and\s+)?(?:call|name|label|set|make|change)\s+(?:the\s+)?button\b|\s+(?:and\s+)?(?:the\s+)?button\b|$))/i);
 const buttonQuoted=text.match(/\b(?:button|cta)(?:\s+inside)?\s*(?:(?:as|to|is|use|say|says|called|named|label(?:ed)?(?: as)?)\s+)?["“]([^"”]+)["”]/i);
 const buttonPlain=text.match(/\b(?:button|cta)(?:\s+inside)?\s+(?:as|to|is|use|say|says|called|named|label(?:ed)?(?: as)?)\s+([a-z][a-z &'-]{0,99}?)(?=["”?.!,\n]|$)/i);
 const title=headingQuoted?.[1]||headingPlain?.[1]?.trim()||namedTitle?.[1]||namedTitle?.[2]?.trim()||legacyTitle?.[1]?.trim().replace(/^./,s=>s.toUpperCase())||null;
 const body=description?.[1]||description?.[2]?.trim()||null;
 const button=buttonQuoted?.[1]||buttonPlain?.[1]?.trim().replace(/^./,s=>s.toUpperCase())||null;
 // Let AI interpret genuinely unparsed fields instead of silently discarding them.
 const incomplete=/\b(?:heading|title)\b/i.test(text)&&!title||/\b(?:sub\s*text|description|body\s*text)\b/i.test(text)&&!body||/\bbutton\b/i.test(text)&&!button;
 return {title,description:body,button,incomplete};
}
