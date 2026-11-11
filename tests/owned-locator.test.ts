// @vitest-environment jsdom
import {describe,expect,it} from 'vitest';
import {atStructure,structuralIdentity} from '../extension/content/locator';
import {LocatorSchema} from '../extension/shared/model';
// A tester asked Wandel to restyle the icon of a "0 Comments" item Wandel had just added beside the page's own items.
// Its address used to be recorded as -1 (Wandel's own elements were skipped while counting), and the edit failed validation.
describe('addresses inside elements Wandel added',()=>{
 const page=()=>{document.body.innerHTML='<main id="record"><ul><li><span><svg></svg></span><h3>624 words</h3></li><li><span><svg></svg></span><h3>0 videos</h3></li></ul></main>';
  const added=document.createElement('li');added.dataset.dxOwned='e_comments';added.innerHTML='<span data-dx-owned="e_comments_icon"><svg></svg></span><h3>0 Comments</h3>';
  document.querySelector('ul')!.append(added);return added;};
 it('records a valid address for a part of an addition and finds it again',()=>{
  const added=page(),icon=added.querySelector('svg')!,structure=structuralIdentity(icon)!;
  expect(structure.path.every(n=>n>=0)).toBe(true);
  expect(structure.anchorId).toBe('dx-owned:e_comments_icon');
  const heading=added.querySelector('h3')!,headingAt=structuralIdentity(heading)!;
  expect(headingAt).toEqual({anchorId:'dx-owned:e_comments',path:[1]});
 });
 it('round-trips through the saved locator format',()=>{
  const added=page(),heading=added.querySelector('h3')!;
  const locator={tag:'h3',role:'heading',ancestorTags:['li','ul','main','body','html'],structure:structuralIdentity(heading)};
  expect(()=>LocatorSchema.shape.structure.parse(locator.structure)).not.toThrow();
  expect(atStructure(locator as never,document)).toBe(heading);
 });
 it('still addresses page elements while ignoring Wandel additions',()=>{
  page();const original=document.querySelectorAll('h3')[1];
  expect(structuralIdentity(original)).toEqual({anchorId:'record',path:[0,1,1]});
 });
});
