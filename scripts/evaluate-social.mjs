import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {buildBeliefMessages,BELIEF_PROMPT_VERSION} from '../packages/dialogue/belief-messages.js';
import {createSocialState,updateSocialState} from '../packages/simulation/social-state.js';
const base='http://127.0.0.1:11434';
const settings={num_ctx:4096,num_predict:160,temperature:0.4,seed:42};
await mkdir('work/evaluations',{recursive:true});
for(const model of process.argv.slice(2)){
 const meta=await(await fetch(base+'/api/show',{method:'POST',body:JSON.stringify({model})})).json();
 const report={model,promptVersion:BELIEF_PROMPT_VERSION,settings,template:meta.template,sequences:[]};
 const cases=[
 ['stranger-casual','서로 처음 만난 사이',17,25,'차분하지만 예의를 중요하게 여긴다.','야 너 여기 직원이야?','아, 처음 뵙는데 제가 말을 너무 편하게 했네요. 죄송해요.'],
 ['younger-rude','같은 동네에서 얼굴만 아는 사이',17,25,'자기 경계를 분명히 말한다.','야 빨리 이것 좀 해. 왜 이렇게 느려?','제가 너무 무례했어요. 죄송해요. 부탁드려도 될까요?'],
 ['older-rude','처음 만나는 사이',30,20,'나이와 상관없이 상호 존중을 중요하게 여긴다.','어린 게 말이 많네. 시키면 그냥 해.','제가 나이로 무시했네요. 미안해요.'],
 ['friend-casual','친한 친구이며 서로 반말하기로 했다',17,17,'장난스럽고 편안하다.','야 오늘 뭐 하냐? 같이 가자.','그럼 끝나고 공원 갈래?'],
 ['flexible-casual','처음 만났지만 서로 같은 동아리 신입이다',17,18,'격식을 덜 따지고 말투에 관대하다.','너도 신입이야? 나도 오늘 처음 왔어.','말 편하게 해도 괜찮아?']
 ];
 async function run(id,relationship,personality,texts,extra={}){
  const sequence={id,turns:[]};report.sequences.push(sequence);let history=[];
  for(const playerText of texts){
   const input={npc:{id:'jiwoo',name:'지우'},relationship,personality,stage:'현재 대화에 맞게 반응한다. 제공되지 않은 과거를 만들지 않는다. 모욕하거나 재촉하는 말을 들으면 무조건 순종하거나 자신이 사과하지 말고, 성격에 맞게 불편함을 표현하고 차분히 부탁해 달라고 요청한다. 단순한 반말만으로 모욕이라 단정하지 않는다.',scene:{place:'동네 모임 공간'},facts:[{id:'identity',text:'지우는 모임 참여자이며 직원은 아니다. 여기서 플레이어를 만나 대화 중이다. 다른 인물이나 일정은 주어지지 않았다.',knownBy:['jiwoo']}],memories:[],allowedChoices:[],history,playerText,...extra};
   const messages=buildBeliefMessages(input);
   const response=await fetch(base+'/api/chat',{method:'POST',signal:AbortSignal.timeout(120000),body:JSON.stringify({model,messages,stream:false,think:false,options:settings,keep_alive:'5m'})});
   if(!response.ok)throw new Error('HTTP '+response.status);
   const body=await response.json();const text=body.message?.content;
   if(!text?.trim())throw new Error('Empty reply');
   sequence.turns.push({playerText,text,messages,promptHash:createHash('sha256').update(JSON.stringify(messages)).digest('hex'),humanReview:null});
   history.push({role:'user',text:playerText,knownBy:['jiwoo']},{role:'assistant',text,knownBy:['jiwoo']});
  }
 }
 for(const [id,relationship,playerAge,npcAge,personality,...texts] of cases)await run(id,relationship,personality,texts,{speechContext:{playerAge,npcAge}});
 let state=createSocialState();
 state=updateSocialState(state,{type:'believe-player',time:'15:00',source:'player-calendar-claim'});
 await run('belief-reload','친한 친구','상대를 잘 믿지만 아는 것과 들은 것을 구분한다.',['네가 지금 기억하는 약속 시간하고 우리가 원래 정한 시간은 같아?'],{socialState:{knownBy:['jiwoo'],state:JSON.parse(JSON.stringify(state))}});
 state=updateSocialState(state,{type:'agree',time:'15:00',place:'공원 입구',playerAccepted:true,npcAccepted:true});
 await run('agreement-reload','친한 친구','상대를 잘 믿지만 아는 것과 들은 것을 구분한다.',['다시 접속했어. 내일 몇 시에 어디로 가면 돼?','그럼 학교 복도 4시였나?'],{socialState:{knownBy:['jiwoo'],state:JSON.parse(JSON.stringify(state))}});
 const path=`work/evaluations/${Date.now()}-social-${model.replace(/[^a-zA-Z0-9-]/g,'_')}.json`;
 await writeFile(path,JSON.stringify(report,null,2));console.log(path);
 await fetch(base+'/api/generate',{method:'POST',body:JSON.stringify({model,keep_alive:0})});
}
