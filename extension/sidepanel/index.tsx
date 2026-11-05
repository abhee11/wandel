import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ChromeBridge } from './bridge';
import { watchDevReload } from './devReload';
import './style.css';
const value=new URL(location.href).searchParams.get('tabId');
const ownerTabId=value!==null&&/^\d+$/.test(value)?Number(value):undefined;
watchDevReload(ownerTabId);
createRoot(document.getElementById('root')!).render(<App bridge={new ChromeBridge(ownerTabId)}/>);
