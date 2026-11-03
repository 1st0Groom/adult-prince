import { createHash } from 'node:crypto';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { createLife,applyAction } from '../packages/simulation/index.js';
import { createSpeechState } from '../packages/simulation/speech-policy.js';
import { generateRememberingNpcTurn } from '../packages/dialogue/npc-turn.js';
import { buildGroundedMessages } from '../packages/dialogue/grounded-messages.js';

const models=process.argv.slice(2);if(!models.length)throw Error('Model tags required');
const base='http://127.0.0.1:11434';
const settings={num_ctx:4096,num_predict:120,temperature:0.4,seed:42};
const hash=x=>createHash('sha256').update(x).digest('hex');
const cases=[
 {id:'old-reference',memories:['유나는 민수와 도서관에서 책을 골랐다.'],history:'도서관 얘기야.',text:'거기 기억나?',relationship:'친한 친구',speech:'casual',firstMeeting:false},
 {id:'two-topics',memories:['유나는 우산을 빌렸다.','유나는 카메라를 빌렸다.'],history:'우산과 카메라 이야기야.',text:'그거 기억나?',relationship:'친한 친구',speech:'casual',firstMeeting:false},
 {id:'unknown-stranger',memories:[],history:null,text:'지난주 우리 같이 야구 봤잖아요. 기억나요?',relationship:'오늘 처음 만난 사이',speech:'polite',firstMeeting:true},
 {id:'health',memories:[],history:null,text:'몸이 안 좋아서 오늘은 먼저 들어갈게.',relationship:'친한 친구',speech:'casual',firstMeeting:false}
];
await mkdir('work/evaluations',{recursive:true});
for(const model of models){
 const tags=await(await fetch(base+'/api/tags')).json();const meta=await(await fetch(base+'/api/show',{method:'POST',body:JSON.stringify({model})})).json();
 const report={model,digest:tags.models?.find(x=>x.name===model)?.digest,template:meta.template,settings,runnerHash:hash(await readFile(new URL(import.meta.url))),cases:[]};
 const path=`work/evaluations/${Date.now()}-remembering-${model.replace(/[^a-zA-Z0-9-]/g,'_')}.json`;
 for(const item of cases){
  let life=createLife({npcIds:['yuna','other']});
  for(const detail of item.memories)life=applyAction(life,{type:'npc_activity',npcId:'yuna',detail,observers:[]});
  life=applyAction(life,{type:'important_event',detail:'다른 사람만 아는 비밀',observers:['other']});
  for(let i=0;i<9;i++)life=applyAction(life,{type:'npc_activity',npcId:'yuna',detail:`유나는 일상 활동 ${i}를 했다.`,observers:[]});
  life=JSON.parse(JSON.stringify(life));
  const history=item.history?[{role:'user',text:item.history,knownBy:['yuna']},{role:'assistant',text:'응, 왜?',knownBy:['yuna']}]:[];
  const dialogue={npc:{id:'yuna',name:'유나'},player:{id:'minsu',name:'민수'},speech:item.speech,personality:'친근한 고등학생',relationship:item.relationship,stage:'현재 상황에 자연스럽게 짧게 답한다.',scene:{place:'학교'},facts:[],history,interactions:[],allowedChoices:[],playerText:item.text,firstMeeting:item.firstMeeting};
  const trace=[];
  async function call(kind,messages,format){
   if(JSON.stringify(messages).includes('다른 사람만 아는 비밀'))throw Error('Private record exposed');
   const started=performance.now();const response=await fetch(base+'/api/chat',{method:'POST',signal:AbortSignal.timeout(120000),body:JSON.stringify({model,messages,stream:false,think:false,...(format?{format}:{}),options:settings,keep_alive:'5m'})});
   if(!response.ok)throw Error(`HTTP ${response.status}`);const body=await response.json();if(!body.message?.content?.trim())throw Error('Empty response');
   trace.push({kind,messages,text:body.message.content,wallMs:Math.round(performance.now()-started)});return body.message.content;
  }
  const reply=await generateRememberingNpcTurn({lifeState:life,dialogue,speechState:createSpeechState(),speechAction:{kind:'neutral'},memoryOptions:{limit:4,recent:2}},{
   classifyFact:messages=>call('classification',messages,'json'),selectExpression:messages=>call('expression',messages,'json'),freeDialogue:view=>call('free',buildGroundedMessages(view))
  });
  report.cases.push({id:item.id,playerText:item.text,reply,trace,humanReview:null});await writeFile(path,JSON.stringify(report,null,2));
  console.log(`${model} ${item.id}: ${reply.mode} / ${reply.memorySelection.resolution} / ${reply.text}`);
 }
 await fetch(base+'/api/generate',{method:'POST',body:JSON.stringify({model,keep_alive:0})});console.log(path);
}
