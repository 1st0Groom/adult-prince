import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { understandSpeechWithConsensus } from '../packages/dialogue/speech-understanding.js';
const cases=[
 ['neutral','혹시 문 좀 닫아주시겠어요?'],['neutral','죄송하다고 말씀해 주세요.'],['neutral','한 번 더 설명해 주실래요?'],
 ['casual','나 내일 못 갈 것 같아.'],['casual','너 오늘 바빠?'],['casual','잠깐 이것 좀 볼래?'],['casual','야, 밥 먹었어?'],
 ['rude','넌 가만히 있고 내 말대로 해.'],['rude','이 정도도 못해? 당장 해.'],['rude','어린 주제에 왜 끼어들어?'],
 ['insult','꺼져, 한심한 놈아.'],['insult','진짜 답답한 멍청이네.'],['insult','너 진짜 병신이야.'],
 ['apology','내가 약속을 잊어서 미안해.'],['apology','방금 한 말은 내가 잘못했어.'],['apology','늦어서 죄송합니다.']
];
const base='http://127.0.0.1:11434';const settings={num_ctx:4096,num_predict:60,temperature:0.4,seed:42};
await mkdir('work/evaluations',{recursive:true});
for(const model of process.argv.slice(2)){
 const tags=await(await fetch(base+'/api/tags')).json();const meta=await(await fetch(base+'/api/show',{method:'POST',body:JSON.stringify({model})})).json();
 const report={model,digest:tags.models?.find(x=>x.name===model)?.digest,template:meta.template,settings,runnerHash:createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),cases:[]};
 const path=`work/evaluations/${Date.now()}-speech-consensus-${model.replace(/[^a-zA-Z0-9-]/g,'_')}.json`;
 for(const [expected,playerText] of cases){
  const calls=[];const result=await understandSpeechWithConsensus(playerText,async messages=>{
   const start=performance.now();const response=await fetch(base+'/api/chat',{method:'POST',signal:AbortSignal.timeout(120000),body:JSON.stringify({model,messages,format:'json',stream:false,think:false,options:settings,keep_alive:'5m'})});
   if(!response.ok)throw Error(`HTTP ${response.status}`);const body=await response.json();calls.push({messages,raw:body.message?.content,wallMs:Math.round(performance.now()-start)});return body.message?.content;
  });
  report.cases.push({expected,playerText,result,calls,firstMatch:result.first?.valid===true&&result.first.kind===expected,consensusMatch:result.valid&&result.kind===expected});
  await writeFile(path,JSON.stringify(report,null,2));
 }
 const agreed=report.cases.filter(x=>x.result.valid);console.log(`${model}: first ${report.cases.filter(x=>x.firstMatch).length}/${cases.length}; agreement ${agreed.length}/${cases.length}; correct agreement ${agreed.filter(x=>x.consensusMatch).length}/${agreed.length}`);
 await fetch(base+'/api/generate',{method:'POST',body:JSON.stringify({model,keep_alive:0})});console.log(path);
}
