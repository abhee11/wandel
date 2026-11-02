import {afterEach,expect,it,vi} from 'vitest';
import {liveSpeech} from '../extension/assistant/liveSpeech';
afterEach(()=>vi.unstubAllGlobals());
it('updates interim words during recording and detaches recognizer callbacks on stop',()=>{
 const abort=vi.fn(),start=vi.fn();let recognition:any;vi.stubGlobal('navigator',{language:'en-US'});vi.stubGlobal('SpeechRecognition',class{constructor(){recognition=this;}start=start;abort=abort;});
 const update=vi.fn(),unavailable=vi.fn(),stop=liveSpeech(update,unavailable);expect(start).toHaveBeenCalledOnce();expect(recognition.interimResults).toBe(true);
 recognition.onresult({results:[[{transcript:'Add another'}]]});recognition.onresult({results:[[{transcript:'Add another card'}],[{transcript:'called Feedback'}]]});expect(update).toHaveBeenLastCalledWith('Add another card called Feedback');stop();expect(abort).toHaveBeenCalledOnce();expect(recognition.onresult).toBeNull();expect(unavailable).not.toHaveBeenCalled();
});
it('reports unavailable live preview while allowing WAV transcription to remain the fallback',()=>{
 vi.stubGlobal('SpeechRecognition',undefined);vi.stubGlobal('webkitSpeechRecognition',undefined);const unavailable=vi.fn();expect(()=>liveSpeech(vi.fn(),unavailable)()).not.toThrow();expect(unavailable).toHaveBeenCalledOnce();
});
