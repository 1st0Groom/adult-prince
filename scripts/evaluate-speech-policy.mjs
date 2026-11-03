import {mkdir,writeFile} from 'node:fs/promises';
import {createSpeechState,resolveSpeech} from '../packages/simulation/speech-policy.js';
import {generateSpeechResponse} from '../packages/dialogue/speech-response.js';
const base='http://127.0.0.1:11434';
const settings={num_ctx:4096,num_predict:60,temperature:0.4,seed:42};
await mkdir('work/evaluations',{recursive:true});
for(const model of process.argv.slice(2)) {
 const report={model,settings,classification:'explicit typed fixtures; not automatic natural-language understanding',cases:[]};
 for(const style of ['firm','warm']) {
  let state=createSpeechState();
  for(const [kind,playerText,casualAgreed,formality] of [
   ['casual','너도 신입이야?',false,'relaxed'],
   ['casual','야 너 여기 직원이야?',false,'strict'],
   ['rude','야 빨리 이것 좀 해. 왜 이렇게 느려?',false,'strict'],
   ['insult','어린 게 말이 많네. 시키면 그냥 해.',false,'strict'],
   ['apology','제가 나이로 무시했네요. 미안해요.',false,'strict'],
   ['neutral','무슨 모임인지 알려주실래요?',false,'strict'],
   ['casual','야 오늘 같이 공원 가자.',true,'strict']
  ]) {
   const decision=resolveSpeech(state,{kind,casualAgreed,formality});state=JSON.parse(JSON.stringify(decision.state));
   const entry={style,kind,playerText,decision};
   const result=await generateSpeechResponse({reaction:decision.reaction,style,playerText},async messages=>{
    entry.messages=messages;
    const started=performance.now();
    const response=await fetch(base+'/api/chat',{method:'POST',signal:AbortSignal.timeout(120000),body:JSON.stringify({model,messages,format:'json',stream:false,think:false,options:settings,keep_alive:'5m'})});
    if(!response.ok)throw new Error('HTTP '+response.status);
    const body=await response.json();entry.wallMs=Math.round(performance.now()-started);entry.metrics={loadMs:body.load_duration/1e6,totalMs:body.total_duration/1e6,outputTokens:body.eval_count};entry.raw=body.message?.content;return entry.raw;
   });
   report.cases.push({...entry,...result});
  }
 }
 const path=`work/evaluations/${Date.now()}-speech-policy-${model.replace(/[^a-zA-Z0-9-]/g,'_')}.json`;
 await writeFile(path,JSON.stringify(report,null,2));console.log(path);
 await fetch(base+'/api/generate',{method:'POST',body:JSON.stringify({model,keep_alive:0})});
}
