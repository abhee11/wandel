/** A page's full-card click target is an empty, positioned layer over a card. When editing, the content under the
 * pointer is what the designer means, not that layer. */
export function beneathCover(hit:HTMLElement,x:number,y:number):HTMLElement{
 if(hit.textContent?.trim()||hit.querySelector('img,svg,input,select,textarea')||!['absolute','fixed'].includes(getComputedStyle(hit).position))return hit;
 return document.elementsFromPoint(x,y).find((e):e is HTMLElement=>e instanceof HTMLElement&&e!==hit&&!hit.contains(e)&&!e.closest('[data-dx-ignore]')&&!!e.textContent?.trim())||hit;
}
