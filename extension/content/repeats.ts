/** The same element in every repeated item of a list, table or grid: each book's "Add to basket", each story's title.
 * The closest ancestor (or the element itself) that has at least two siblings of its own tag and class is the item;
 * the element is found in each sibling item at the same address. Items Wandel added are left out. */
export function repeatPeers(target:HTMLElement,root:HTMLElement,limit=200):HTMLElement[]{
 const own=(el:Element)=>[...el.children].filter((child):child is HTMLElement=>child instanceof HTMLElement&&!child.hasAttribute('data-dx-owned'));
 const path:number[]=[];
 for(let item:HTMLElement=target,depth=0;depth<8&&item!==root&&item.parentElement;depth++){
  const parent:HTMLElement=item.parentElement,children=own(parent);
  const kin=children.filter(child=>child.tagName===item.tagName&&child.className===item.className);
  if(kin.length>=3){
   const peers:HTMLElement[]=[];
   for(const other of kin){let node:HTMLElement|undefined=other;for(const index of path)node=node&&own(node)[index];
    if(node&&node.tagName===target.tagName&&node.className===target.className)peers.push(node);if(peers.length>=limit)break;}
   if(peers.includes(target)&&peers.length>=2)return peers;
  }
  if(parent===root)break;
  path.unshift(children.indexOf(item));item=parent;
 }
 return [target];
}
