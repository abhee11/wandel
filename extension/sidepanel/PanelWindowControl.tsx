import {useState} from 'react';
export function PanelWindowControl(){
 const [error,setError]=useState('');
 if(typeof chrome==='undefined'||!chrome.runtime?.id)return null;
 const params=new URL(location.href).searchParams,tab=Number(params.get('tabId')),floating=params.get('floating')==='1';
 if(!Number.isInteger(tab)||!params.has('tabId'))return null;
 if(params.get('embedded')==='1')return null;
 const change=()=>{setError('');if(floating){
  // sidePanel.open is invoked directly in the click's user gesture.
  void chrome.sidePanel.setOptions({tabId:tab,path:'sidepanel.html?tabId='+tab,enabled:true}).catch(()=>{});
  void chrome.sidePanel.open({tabId:tab}).then(()=>window.close()).catch(()=>setError('Use the Wandel toolbar icon to reopen the window.'));
 }else void chrome.runtime.sendMessage({type:'WANDEL_FLOAT_PANEL',tabId:tab}).then(result=>{if(result?.error)setError(result.error);}).catch(()=>setError('Reopen Wandel from its toolbar icon.'));};
 return <div className="dx-window-bar"><span>{floating?'Floating workspace':''}</span><button className="dx-small" onClick={change}>{floating?'Dock panel':'Float panel ↗'}</button>{error&&<small role="status">{error}</small>}</div>;
}
