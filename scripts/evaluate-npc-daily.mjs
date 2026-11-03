import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createLife, applyAction } from '../packages/simulation/index.js';
import { npcDialogueMemories } from '../packages/simulation/dialogue-memory.js';
import { buildGroundedMessages } from '../packages/dialogue/grounded-messages.js';
const models=process.argv.slice(2);if(!models.length)throw Error('Model tags required');
const hash=x=>createHash('sha256').update(x).digest('hex');
const scenes=[['library','유나는 방과 후 도서관에서 책을 골랐다.','오늘 방과 후 뭐 했어?'],['practice','유나는 학교 체육관에서 농구 연습을 했다.','오늘 뭐 하고 지냈어?'],['rest','유나는 집에서 쉬었다.','오늘 하루 어땠어?']];
await mkdir('work/evaluations',{recursive:true});
for(const model of models){
 const tags=await(await fetch('http://127.0.0.1:11434/api/tags')).json();
 const meta=await(await fetch('http://127.0.0.1:11434/api/show',{method:'POST',body:JSON.stringify({model})})).json();
 const report={model,digest:tags.models?.find(x=>x.name===model)?.digest,template:meta.template,settings:{num_ctx:4096,num_predict:120,temperature:0.4,seed:42},runnerHash:hash(await readFile(new URL(import.meta.url))),results:[]};
 const path=`work/evaluations/${Date.now()}-npc-daily-${model.replace(/[^a-zA-Z0-9-]/g,'_')}.json`;
 for(const [id,detail,playerText] of scenes)for(const known of [false,true]){
  let state=createLife({npcIds:['yuna']});
  if(known)state=applyAction(state,{type:'npc_activity',npcId:'yuna',detail,observers:[]});
  const input={npc:{id:'yuna',name:'유나'},player:{id:'minsu',name:'민수'},personality:'친근하고 장난기 있는 고등학생',relationship:'친한 친구',speech:'casual',stage:'친구의 말에 짧고 자연스럽게 대답한다.',scene:{place:'학교 앞'},facts:[],memories:npcDialogueMemories(state,'yuna'),interactions:[],history:[],allowedChoices:[],playerText};
  const messages=buildGroundedMessages(input);const start=performance.now();
  const response=await fetch('http://127.0.0.1:11434/api/chat',{method:'POST',signal:AbortSignal.timeout(120000),body:JSON.stringify({model,messages,stream:false,think:false,options:report.settings,keep_alive:'5m'})});
  if(!response.ok)throw Error(`HTTP ${response.status}`);const body=await response.json();
  if(!body.message?.content?.trim())throw Error('Empty response');
  report.results.push({id,known,detail,messages,text:body.message.content,wallMs:Math.round(performance.now()-start),humanReview:null});
  await writeFile(path,JSON.stringify(report,null,2));console.log(`${model} ${id} known=${known}: generated`);
 }
 await fetch('http://127.0.0.1:11434/api/generate',{method:'POST',body:JSON.stringify({model,keep_alive:0})});console.log(path);
}
