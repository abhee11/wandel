import {isTextEntry} from '../shared/keyboard';
import {useEffect} from 'react';
import type {Command,Snapshot} from '../shared/model';

/** The Chrome side panel has a separate document: page listeners cannot hear its keys. */
export function useModeShortcuts(snapshot:Snapshot|null,blocked:boolean,send:(command:Command)=>unknown){
  useEffect(()=>{
    const handler=(event:KeyboardEvent)=>{
      if(!snapshot||blocked||event.defaultPrevented||event.repeat||event.isComposing||event.metaKey||event.ctrlKey||event.altKey||snapshot.mode==='closed')return;
      const origin=event.composedPath()[0];
      if(isTextEntry(origin))return;
      const key=event.key.toLowerCase();
      if(!['e','i','v'].includes(key)||(key==='v'&&snapshot.replay))return;
      event.preventDefault();
      void send({type:key==='e'?'edit':key==='i'?'interact':snapshot.mode==='interact'?'edit':'interact'});
    };
    window.addEventListener('keydown',handler);
    return()=>window.removeEventListener('keydown',handler);
  },[snapshot,blocked,send]);
}
