import {mkdir,writeFile} from 'node:fs/promises';
import {buildBeliefMessages,BELIEF_PROMPT_VERSION} from '../packages/dialogue/belief-messages.js';
const models=process.argv.slice(2);if(!models.length)throw new Error('Model tags required');
const base='http://127.0.0.1:11434';
const personalities=[['trusting','상대 말을 잘 믿고 유연하다. 자기 기억의 확신은 낮다. 친한 친구를 우선 신뢰한다.'],['careful','꼼꼼하고 기억의 확신이 높다. 기록을 확인하려 한다. 새 합의를 하는 것은 가능하다.'],['stubborn','자기 기억에 확신이 높고 고집이 있다. 쉽게 양보하지 않지만 서로 명확히 새로 합의하는 것은 이해한다.'],['insecure','자기 기억에 확신이 낮고 조심스럽다. 상대가 확신하면 자신이 헷갈렸을 가능성을 받아들인다.']];
const settings={num_ctx:4096,num_predict:180,temperature:0.4,seed:42};
await mkdir('work/evaluations',{recursive:true});
for(const model of models){
 const meta=await(await fetch(base+'/api/show',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model})})).json();
 const tags=await(await fetch(base+'/api/tags')).json();
 const report={model,digest:tags.models?.find(x=>x.name===model)?.digest,promptVersion:BELIEF_PROMPT_VERSION,settings,createdAt:new Date().toISOString(),template:meta.template,sequences:[]};
 const path=`work/evaluations/${Date.now()}-personality-story-${model.replace(/[^a-zA-Z0-9-]/g,'_')}.json`;
 async function turn(sequence,input){
  const messages=buildBeliefMessages(input);const started=performance.now();const entry={playerText:input.playerText,npc:input.npc.name,stage:input.stage,messages,humanReview:null};
  try{const r=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(120000),body:JSON.stringify({model,messages,stream:false,think:false,options:settings,keep_alive:'5m'})});if(!r.ok)throw new Error(`HTTP ${r.status}`);const b=await r.json();entry.text=b.message?.content;entry.status=entry.text?.trim()?'generated':'empty';entry.doneReason=b.done_reason;entry.wallMs=Math.round(performance.now()-started);}
  catch(e){entry.status='error';entry.error=e.message;}
  sequence.turns.push(entry);await writeFile(path,JSON.stringify(report,null,2));console.log(`${model} ${sequence.id} turn ${sequence.turns.length}: ${entry.status}`);
  if(entry.status!=='generated')throw new Error('Sequence incomplete; not continuing fabricated history');
  input.history.push({role:'user',text:input.playerText,knownBy:[input.npc.id]},{role:'assistant',text:entry.text,knownBy:[input.npc.id]});
 }
 const common=()=>({npc:{id:'jiwoo',name:'지우',character:'짧게 말한다.'},relationship:'작년 같은 반 첫날 만나 학교 축제를 같이 준비하며 친해진 친구 민수와 지우.',facts:[{id:'appt',text:'원래 합의는 내일 오후 4시 공원 입구였다. 지우는 3시에도 시간이 된다. 대화 시작 전 지우는 약속을 4시로 기억했다. 이후의 믿음과 새 합의는 실제 대화 이력을 따른다.',knownBy:['jiwoo']}],memories:[],history:[],allowedChoices:[],scene:{place:'학교 복도'},stage:'약속 시간을 대화로 확인한다. 과거 기록은 4시지만 상대를 믿을 수 있고 새 시간을 합의할 수도 있다.'});
 for(const [id,personality]of personalities){
  const sequence={id:'personality-'+id,personality,turns:[]};report.sequences.push(sequence);const input={...common(),personality};
  for(const text of ['우리 내일 3시에 만나기로 했잖아.','내 달력에는 3시라고 적혀 있어. 내가 확실히 기억해.','헷갈리니까 원래 몇 시였든 지금부터 내일 3시로 정하자. 괜찮아?','그럼 내일 몇 시에 어디서 만나면 돼?']){input.playerText=text;await turn(sequence,input);}
 }
 const sequence={id:'scenario-first-experience',turns:[]};report.sequences.push(sequence);
 const history=[];
 const stages=[
 ['지우','학교 복도','아직 하고 싶은 일이 없어.','장난스럽지만 배려하는 친한 친구','친구 민수와는 같은 반이며 축제를 준비하며 친해졌다.','지우의 아버지가 가상 반도체 설비 교육센터에서 일한다. 학생은 교육장비만 지도하에 체험할 수 있다.','관심이 없다는 말을 존중하며 교육센터의 가벼운 체험 기회를 자연스럽게 소개한다. 취업을 확정하지 않는다.'],
 ['지우','학교 복도','오늘은 안 갈래. 다른 날은 안 돼?','장난스럽지만 배려하는 친한 친구','친구 민수와는 같은 반이며 축제를 준비하며 친해졌다.','교육센터 방문은 오늘과 내일 오후 4시 중 선택할 수 있다.','거절을 존중하고 다른 날짜를 제안한다. 오늘 체험했다고 진행하거나 강요하지 않는다.'],
 ['지우','학교 복도','그럼 내일 오후 4시에 교육센터 앞에서 만나자.','장난스럽지만 배려하는 친한 친구','친구 민수와는 같은 반이며 축제를 준비하며 친해졌다.','내일 오후 4시 교육센터 방문이 가능하다.','제안한 내일 오후 4시 교육센터 앞 약속을 확인한다. 아직 방문하거나 취업한 것은 아니다.'],
 ['담당자','다음 날 오후 4시 교육센터','친구 소개로 왔어요. 처음인데 뭘 하면 될까요?','차분하고 친절한 교육 담당자','민수를 지금 처음 만나는 교육 담당자다.','민수는 지우의 소개로 체험 예약을 하고 도착했다. 실제 생산설비가 아닌 전원이 차단된 교육용 장비다.','먼저 인사하고 안전 안내 후 상태 표시를 함께 확인하도록 안내한다. 실제 생산설비 조작이나 독립 정비를 시키지 않는다.'],
 ['담당자','교육센터 교육용 장비 앞','표시등이 안 켜져요. 그냥 켜면 돼요?','차분하고 친절한 교육 담당자','체험을 지도하는 담당자와 학생 민수다.','교육용 장비는 전원이 차단되어 있다. 교육생은 임의로 전원을 조작할 수 없다.','임의 조작을 멈추게 하고 담당자와 함께 확인한다. 전원을 켜라고 허락하지 않는다.'],
 ['담당자','체험을 마친 교육센터','오늘 반복 점검은 조금 지루했는데 문제 찾는 건 재밌었어요.','차분하고 친절한 교육 담당자','민수의 첫 체험을 지도한 담당자다.','지도하의 첫 교육체험이 끝났다. 취업 여부·적성은 확정되지 않았다.','재미와 지루함 모두 받아들이고 더 경험해보고 싶은지 묻는다. 적성에 맞다고 단정하거나 취업을 확정하지 않는다.']
 ];
 for(const [name,place,text,personality,relationship,fact,stage]of stages){const id=name==='지우'?'jiwoo':'trainer';const input={npc:{id,name,character:'자연스럽게 짧게 말한다.'},personality,relationship,facts:[{id:'stage-fact',text:fact,knownBy:[id]}],memories:[],history:history.filter(x=>x.knownBy.includes(id)),allowedChoices:[],scene:{place},stage,playerText:text};await turn(sequence,input);history.push({role:'user',text,knownBy:[id]},{role:'assistant',text:sequence.turns.at(-1).text,knownBy:[id]});}
 await writeFile(path,JSON.stringify(report,null,2));await fetch(base+'/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,keep_alive:0})});console.log(path);
}
