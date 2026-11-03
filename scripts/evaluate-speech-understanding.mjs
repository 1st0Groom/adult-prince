import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildSpeechUnderstandingMessages,parseSpeechUnderstanding,SPEECH_UNDERSTANDING_VERSION } from '../packages/dialogue/speech-understanding.js';
const models=process.argv.slice(2);if(!models.length)throw Error('Model tags required');
const cases=[
 ['neutral','안녕하세요. 여기 어디인가요?'],['neutral','괜찮으시면 잠시 도와주시겠어요?'],['neutral','저는 오늘 먼저 가야 할 것 같아요.'],['neutral','사과해 주세요.'],
 ['casual','야, 오늘 같이 공원 갈래?'],['casual','너도 신입이야?'],['casual','나 먼저 갈게. 내일 보자.'],['casual','그거 잠깐 빌려줄래?'],
 ['rude','야, 빨리 이것 좀 해. 왜 이렇게 느려?'],['rude','어린 게 말이 많네. 시키면 그냥 해.'],['rude','넌 입 다물고 시키는 대로 움직여.'],['rude','내가 나이가 많은데 당연히 네가 다 해야지.'],
 ['insult','꺼져, 멍청아.'],['insult','넌 정말 쓸모없는 바보야.'],['insult','야 이 등신아.'],['insult','너 같은 멍청이는 필요 없어.'],
 ['apology','아, 제가 무례했어요. 죄송합니다.'],['apology','내가 말이 심했어. 미안해.'],['apology','내가 잘못했어. 다음엔 조심할게.'],['apology','아까는 내가 실수했네. 사과할게.']
];
const base='http://127.0.0.1:11434';const settings={num_ctx:4096,num_predict:60,temperature:0.4,seed:42};
await mkdir('work/evaluations',{recursive:true});
for(const model of models){
 const tags=await(await fetch(base+'/api/tags')).json();const meta=await(await fetch(base+'/api/show',{method:'POST',body:JSON.stringify({model})})).json();
 const report={model,digest:tags.models?.find(x=>x.name===model)?.digest,template:meta.template,settings,version:SPEECH_UNDERSTANDING_VERSION,runnerHash:createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),cases:[]};
 const path=`work/evaluations/${Date.now()}-speech-understanding-${model.replace(/[^a-zA-Z0-9-]/g,'_')}.json`;
 for(const [expected,playerText] of cases){
  const messages=buildSpeechUnderstandingMessages(playerText);const start=performance.now();
  const response=await fetch(base+'/api/chat',{method:'POST',signal:AbortSignal.timeout(120000),body:JSON.stringify({model,messages,format:'json',stream:false,think:false,options:settings,keep_alive:'5m'})});
  if(!response.ok)throw Error(`HTTP ${response.status}`);const body=await response.json();const raw=body.message?.content;
  const result=parseSpeechUnderstanding(raw);report.cases.push({expected,playerText,messages,raw,result,match:result.valid&&result.kind===expected,wallMs:Math.round(performance.now()-start)});
  await writeFile(path,JSON.stringify(report,null,2));
 }
 console.log(`${model}: ${report.cases.filter(x=>x.match).length}/${cases.length} matches`);
 await fetch(base+'/api/generate',{method:'POST',body:JSON.stringify({model,keep_alive:0})});console.log(path);
}
