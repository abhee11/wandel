import {createRoot} from 'react-dom/client';
import {Recorder} from './Recorder';
import {HostedSharing} from './HostedSharing';
import './style.css';
createRoot(document.getElementById('root')!).render(<Recorder sharing={props=><HostedSharing {...props}/>}/>);
