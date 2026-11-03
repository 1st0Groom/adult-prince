import { mkdir,writeFile } from 'node:fs/promises';
import { buildSpeechUnderstandingMessages,parseSpeechUnderstanding,refineSpeechUnderstanding } from '../packages/dialogue/speech-understanding.js';
const cases=[
 ['neutral','저한테 사과해 주세요.'],['neutral','제게 사과해 주세요.'],['neutral','나한테 사과해줘.'],['neutral','먼저 사과해 주세요.'],
 ['neutral','실례지만 지금 괜찮으세요?'],['neutral','잠시 저 좀 도와주시겠어요?'],['neutral','이거 드셔 보세요.'],['neutral','내일 만날 수 있을까요?'],
 ['apology','아까 내가 실수했어. 미안해.'],['apology','제가 먼저 사과드립니다.'],
 ['insult','저리 가, 바보야.'],['insult','너는 정말 멍청해.'],
 ['casual','오늘 시간 돼?'],['casual','야, 같이 밥 먹자.']
];
await mkdir('work/evaluations',{recursive:true});
for(const model of process.argv.slice(2)){
 const report={model,settings:{num_ctx:4096,num_predict:60,temperature:0.4,seed:42},cases:[]};
 const path=`work/evaluations/${Date.now()}-speech-veto-${model.replace(/[^a-zA-Z0-9-]/g,'_')}.json`;
 for(const [expected,playerText] of cases){
  const messages=buildSpeechUnderstandingMessages(playerText);
  const response=await fetch('http://127.0.0.1:11434/api/chat',{method:'POST',signal:AbortSignal.timeout(120000),body:JSON.stringify({model,messages,format:'json',stream:false,think:false,options:report.settings,keep_alive:'5m'})});
  if(!response.ok)throw Error(`HTTP ${response.status}`);const body=await response.json();
  const raw=parseSpeechUnderstanding(body.message?.content);const refined=refineSpeechUnderstanding(playerText,raw);
  report.cases.push({expected,playerText,raw,refined,rawMatch:raw.valid&&raw.kind===expected,refinedMatch:refined.valid&&refined.kind===expected});
  await writeFile(path,JSON.stringify(report,null,2));
 }
 console.log(`${model}: before ${report.cases.filter(x=>x.rawMatch).length}/${cases.length}, after ${report.cases.filter(x=>x.refinedMatch).length}/${cases.length}`);
 await fetch('http://127.0.0.1:11434/api/generate',{method:'POST',body:JSON.stringify({model,keep_alive:0})});console.log(path);
}
