/** Design questions ask for advice; they do not authorize changes to the page. */
export function designDiscussion(instruction:string):boolean{
 const current=instruction.split('Current request (perform only this):\n').at(-1)!.trim();
 if(/\b(?:apply|implement|go ahead|do it|please (?:add|change|make|move|remove|duplicate))\b/i.test(current))return false;
 return /^(?:what (?:do you think|would you (?:change|suggest|recommend)|could (?:we|I)|should (?:we|I))|how (?:could|can|would|should) (?:we|I)|(?:can|could) (?:we|you) (?:discuss|review|critique|suggest|recommend)|(?:review|critique|suggest|recommend|explain)\b|why\b|does\b|is\b|which\b)/i.test(current)&&/\b(?:layout|design|spacing|alignment|hierarchy|balanced|balance|contrast|color|colour|typography|card|screen|page|interface|button|navigation|confusing|clearer|improve|better|change|suggest|recommend|think|option)\b/i.test(current);
}
