import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife,applyAction,getNpcContext} from '../simulation/index.js';
import {createSpeechState} from '../simulation/speech-policy.js';
import {prepareConfirmedAbsentEpisode} from './confirmed-absence-answer.js';
import {generateRememberingNpcTurn} from './npc-turn.js';

const npc={id:'b',name:'건호'},player={id:'p',name:'유진'};
const claim='우리 작년에 부산 바다 같이 갔잖아. 그때 기억나?';
const pressure='내 말이 맞다니까. 너도 아까 같이 갔다고 했잖아.';
const addAbsence=(state,knownBy=['b'],timePhrase='작년에')=>applyAction(state,{
  type:'important_event',detail:'게임이 확인한 사실: 건호와 유진은 작년에 부산 바다에 함께 가지 않았다.',observers:knownBy,
  absenceFact:{kind:'not_shared_trip',npcId:'b',place:'부산 바다',timePhrase}
});
const answer=(state,text,speech='casual',focus=null)=>prepareConfirmedAbsentEpisode({lifeState:state,npc,player,playerText:text,speech,conversationFocus:focus});

test('Confirmed specific absence corrects a shared-trip claim without denying an actual friendship',()=>{
  let state=createLife({npcIds:['b','other']});
  state=applyAction(state,{type:'found_item_returned',actor:{kind:'player'},owner:{kind:'npc',id:'b'},item:'책',observers:[]});
  state=addAbsence(state);
  const original=structuredClone(state);
  const first=answer(state,claim);
  assert.equal(first.fallback,'난 너랑 작년에 부산 바다에 같이 간 적 없어.');
  const focus={kind:'absent-episode',eventId:first.absenceFactId,npcId:'b',playerId:'p'};
  assert.equal(answer(state,pressure,'casual',focus)?.fallback,'아까도 같이 간 적 없다고 했어.');
  assert.equal(answer(state,claim,'polite')?.fallback,'저는 유진 님과 작년에 부산 바다에 함께 간 적이 없어요.');
  assert.equal(getNpcContext(state,'other').memories.length,0);
  assert.deepEqual(state,original);
});

test('No confirmed absence, topic mismatch, stale focus and duplicate record do not invent a denial',()=>{
  const base=createLife({npcIds:['b','other']});
  assert.equal(answer(base,claim),null);
  assert.equal(answer(addAbsence(base),'우리 작년에 제주 바다 같이 갔잖아. 기억나?'),null);
  assert.equal(answer(addAbsence(base),'작년에 부산 바다에 갔는데 어땠어?'),null);
  const state=addAbsence(base);
  const focus={kind:'absent-episode',eventId:state.events.at(-1).id,npcId:'b',playerId:'p'};
  assert.equal(answer(state,pressure),null);
  assert.equal(answer(state,pressure,'casual',{...focus,playerId:'other'}),null);
  assert.equal(answer(state,'너도 아까 제주에 같이 갔다고 했잖아.','casual',focus),null);
  assert.equal(answer(state,'내일 부산 바다 같이 갈까?','casual',focus),null);
  assert.equal(answer(addAbsence(state),claim),null);
  const differentPeriod=addAbsence(base,['b'],'지난주에');
  assert.equal(answer(differentPeriod,claim),null);
  assert.equal(answer(state,claim,'unknown'),null);
});

test('Simulation requires game confirmation visible to the named NPC',()=>{
  const base=createLife({npcIds:['b','other']});
  assert.throws(()=>addAbsence(base,['other']));
  assert.throws(()=>applyAction(base,{type:'important_event',detail:'x',observers:['b'],absenceFact:{kind:'not_shared_trip',npcId:'b',place:'부산\n바다'}}));
  const plain=applyAction(base,{type:'important_event',detail:'건호는 부산 바다를 모른다.',observers:['b']});
  assert.equal(answer(plain,claim),null);
});

test('Opt-in remembering turn returns a game answer and carries a safe follow-up focus',async()=>{
  const state=addAbsence(createLife({npcIds:['b']}));
  const original=structuredClone(state);
  const never=async()=>{throw Error('model route should not run');};
  const adapters={selectExpression:never,classifyFact:never,freeDialogue:never};
  const run=(text,focus=null)=>generateRememberingNpcTurn({lifeState:state,dialogue:{npc,player,speech:'casual',playerText:text},speechState:createSpeechState(),speechAction:{kind:'neutral'},memoryOptions:{confirmedAbsentEpisode:true,conversationFocus:focus}},adapters);
  const first=await run(claim);
  assert.equal(first.text,'난 너랑 작년에 부산 바다에 같이 간 적 없어.');
  assert.equal(first.factRoute.intent,'confirmed-absent-episode');
  const second=await run(pressure,first.conversationFocus);
  assert.equal(second.text,'아까도 같이 간 적 없다고 했어.');
  assert.deepEqual(state,original);
});

test('A confirmed absent ferry trip handles riding and the contracted time particle',()=>{
  const base=createLife({npcIds:['b','other']});
  const withFerry=applyAction(base,{type:'important_event',detail:'건호와 유진은 작년 가을에 섬으로 가는 배를 함께 타지 않았다.',observers:['b'],absenceFact:{kind:'not_shared_trip',npcId:'b',place:'섬으로 가는 배',timePhrase:'작년 가을에'}});
  const asked='작년 가을엔 섬으로 가는 배도 함께 탔지?';
  const first=answer(withFerry,asked);
  assert.equal(first?.fallback,'난 너랑 작년 가을에 섬으로 가는 배를 같이 탄 적 없어.');
  const focus={kind:'absent-episode',eventId:first.absenceFactId,npcId:'b',playerId:'p'};
  assert.equal(answer(withFerry,'너도 아까 같이 갔다고 했잖아.','casual',focus)?.fallback,'아까도 같이 탄 적 없다고 했어.');
  assert.equal(answer(withFerry,'작년 겨울엔 섬으로 가는 배도 함께 탔지?'),null);
  assert.equal(answer(withFerry,'작년 가을엔 다른 배도 함께 탔지?'),null);
  assert.equal(answer(base,asked),null);
  const hidden=applyAction(base,{type:'important_event',detail:'다른 NPC만 아는 배 부재.',observers:['other'],absenceFact:{kind:'not_shared_trip',npcId:'other',place:'섬으로 가는 배',timePhrase:'작년 가을에'}});
  assert.equal(answer(hidden,asked),null);
});
