// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {HostedSharing} from '../extension/recording/HostedSharing';
import {Recorder} from '../extension/recording/Recorder';
import {uploadRecording,revokeRecording} from '../extension/recording/client';
vi.mock('../extension/recording/client',()=>({uploadRecording:vi.fn(),sharedRecordings:vi.fn(),revokeRecording:vi.fn()}));
vi.mock('../extension/sidepanel/accountClient',()=>({signIn:vi.fn()}));
let root:Root,element:HTMLDivElement;const blob=new Blob(['webm'],{type:'video/webm'});
beforeEach(()=>{vi.clearAllMocks();(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;element=document.createElement('div');document.body.append(element);root=createRoot(element);});
afterEach(async()=>{await act(async()=>root.unmount());element.remove();vi.unstubAllGlobals();});
const button=(label:string)=>[...element.querySelectorAll('button')].find(b=>b.textContent===label)!;
async function mount(){await act(async()=>root.render(<HostedSharing blob={blob} name="My journey" recording={false} onBusy={()=>{}}/>));}
it('requires explicit review before upload and exposes the resulting viewer link and revocation',async()=>{
 const video={id:'video',name:'My journey',url:'https://api.example/api/playback/token',bytes:4,createdAt:'2026-10-18',expiresAt:'2026-10-25'};vi.mocked(uploadRecording).mockResolvedValue(video);vi.mocked(revokeRecording).mockResolvedValue({ok:true});vi.stubGlobal('confirm',()=>true);
 await mount();expect(button('Upload & create link').disabled).toBe(true);expect(uploadRecording).not.toHaveBeenCalled();
 await act(async()=>element.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());await act(async()=>button('Upload & create link').click());
 expect(uploadRecording).toHaveBeenCalledWith(blob,'My journey');expect(element.querySelector('a')?.href).toBe(video.url);expect(element.querySelector<HTMLInputElement>('[aria-label="Share link for My journey"]')?.value).toBe(video.url);
 await act(async()=>button('Revoke link').click());expect(revokeRecording).toHaveBeenCalledWith('video');expect(element.querySelector('a')).toBeNull();expect(element.textContent).toContain('Link revoked');
});
it('retains a retryable local video when the upload fails',async()=>{
 vi.mocked(uploadRecording).mockRejectedValue(new Error('Network unavailable. Local video retained.'));await mount();await act(async()=>element.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());await act(async()=>button('Upload & create link').click());
 expect(element.querySelector('[role=alert]')?.textContent).toContain('Local video retained');expect(button('Upload & create link').disabled).toBe(false);expect(element.querySelector('input[type=checkbox]')).not.toBeNull();
});
it('has a local-only recorder view with no hosted controls when no sharing component is provided',async()=>{
 await act(async()=>root.render(<Recorder/>));expect(button('Record walkthrough')).toBeTruthy();expect(element.textContent).not.toContain('Upload & create link');expect(element.textContent).not.toContain('Sign in');expect(uploadRecording).not.toHaveBeenCalled();
});
