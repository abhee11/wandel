import {useEffect,useState} from 'react';
import {describeShape} from './shape';
import {isStale,type AppMap} from './catalog';
import {deleteMap,readMap,readSettings,watchTab,writeSettings,type AppMapSettings} from './store';
const when=(iso:string)=>new Date(iso).toLocaleDateString(undefined,{day:'numeric',month:'short'});
/** The per-app switch, block list and the list of everything Wandel has learned about this app. */
export function AppMapSection({origin}:{origin:string}){
 const [settings,setSettings]=useState<AppMapSettings|null>(null),[map,setMap]=useState<AppMap|null>(null),[blockText,setBlockText]=useState(''),[error,setError]=useState('');
 const [viewing,setViewing]=useState(false);
 const available=typeof chrome!=='undefined'&&!!chrome.storage?.local&&!!chrome.storage.onChanged&&!!chrome.scripting;
 useEffect(()=>{
  if(!available)return;
  let live=true;const load=()=>{void Promise.all([readSettings(),readMap(origin)]).then(([s,m])=>{if(!live)return;setSettings(s);setMap(m);setBlockText(s.blockList.join('\n'));});};
  load();const changed=(changes:Record<string,unknown>,area:string)=>{if(area==='local'&&('appMapSettings' in changes||'appMap:'+origin in changes))load();};
  chrome.storage.onChanged.addListener(changed);return ()=>{live=false;chrome.storage.onChanged.removeListener(changed);};
 },[origin,available]);
 if(!available||!settings||!/^https?:/.test(origin))return null;
 const on=settings.origins.includes(origin),endpoints=Object.values(map?.endpoints||{}).sort((a,b)=>a.path.localeCompare(b.path)||a.method.localeCompare(b.method));
 const save=(next:AppMapSettings)=>writeSettings(next).then(setSettings).catch(e=>setError(e instanceof Error?e.message:String(e)));
 async function toggle(){
  setError('');
  const next={...settings!,origins:on?settings!.origins.filter(o=>o!==origin):[...settings!.origins,origin]};
  await save(next);
  // Start on the open tab now; later loads get the watcher before the app starts.
  const tabId=Number(new URL(location.href).searchParams.get('tabId'));
  if(!on&&Number.isInteger(tabId)&&tabId>0)await watchTab(tabId).catch(()=>setError('Reload the page to start learning.'));
 }
 return <details className="dx-app-map">
  <summary>Learn how this app works{on?` · ${endpoints.length} requests learned`:''}</summary>
  <p>Wandel notes the shape of {new URL(origin).host}’s own requests (field names and types, never values) so prototypes use real fields, statuses and rules. Logins, personal details and form entries are never recorded. It stays in this browser.</p>
  <label className="dx-app-map-switch"><input type="checkbox" checked={on} onChange={()=>void toggle()}/> Learn from this app</label>
  <label className="dx-app-map-block">Never record these paths, one per line (use * for any part)<textarea rows={3} value={blockText} placeholder={'/admin\n/api/hr/*'} onChange={e=>setBlockText(e.target.value)}/></label>
  <div className="dx-row"><button className="dx-small" disabled={blockText.trim()===settings.blockList.join('\n')} onClick={()=>void save({...settings,blockList:blockText.split('\n')})}>Save block list</button>
   <button className="dx-small" disabled={!endpoints.length} onClick={()=>setViewing(!viewing)}>{viewing?'Hide':'What Wandel knows'}</button>
   <button className="dx-small" disabled={!endpoints.length} onClick={()=>{if(confirm(`Delete everything Wandel learned about ${new URL(origin).host}? This can’t be undone.`))void deleteMap(origin);}}>Delete what it learned</button></div>
  {error&&<p className="dx-error" role="alert">{error}</p>}
  {viewing&&<ul className="dx-app-map-list">{endpoints.map(endpoint=><li key={endpoint.method+endpoint.path} className={isStale(endpoint)?'is-stale':''}>
   <strong>{endpoint.method} {endpoint.path}</strong>{endpoint.query.length>0&&<small> ?{endpoint.query.join('&')}</small>}
   <small> · seen {endpoint.seen}× · last {when(endpoint.lastSeen)} · {endpoint.statuses.join(', ')}{isStale(endpoint)?' · not seen lately':''}</small>
   {endpoint.request&&<><em>Sends</em><pre>{describeShape(endpoint.request)}</pre></>}
   {endpoint.response&&<><em>Returns</em><pre>{describeShape(endpoint.response)}</pre></>}
   {endpoint.rules.length>0&&<><em>Rules</em><pre>{endpoint.rules.join('\n')}</pre></>}
  </li>)}</ul>}
 </details>;
}
