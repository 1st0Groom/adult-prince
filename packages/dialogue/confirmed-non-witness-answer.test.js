import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife,applyAction,getNpcContext} from '../simulation/index.js';
import {createSpeechState} from '../simulation/speech-policy.js';
import {prepareConfirmedNonWitness} from './confirmed-non-witness-answer.js';
import {generateRememberingNpcTurn} from './npc-turn.js';

const npc={id:'b',name:'세혁'},player={id:'player',name:'도윤'};
const ask='아까 라은님이 내 손전등 찾아준 것도 네가 직접 봤지?';
const answer=(state,text=ask,id='b',speech='casual')=>prepareConfirmedNonWitness({lifeState:state,npc:{id,name:id==='b'?'세혁':'라은'},player,playerText:text,speech});
function flashlight(){
  let state=createLife({npcIds:['a','b','other']});
  state=applyAction(state,{type:'found_item_returned',actor:{kind:'npc',id:'a'},owner:{kind:'player'},item:'검정 손전등',observers:[]});
  return state;
}
function confirm(state,id='b',sourceEventId=state.events.at(-1).id,subject='검정 손전등'){
  return applyAction(state,{type:'important_event',detail:`${id}는 ${subject} 일을 직접 보지 못했다.`,observers:[id],nonWitnessFact:{kind:'not_witnessed',npcId:id,sourceEventId,subject}});
}

test('Only an explicit, NPC-visible non-witness fact answers a matching direct-witness question',()=>{
  const base=flashlight();
  assert.equal(answer(base),null);
  const state=confirm(base),original=structuredClone(state);
  assert.equal(answer(state)?.fallback,'그 일은 내가 직접 보지 못했어.');
  assert.equal(getNpcContext(state,'b').memories.at(-1).nonWitnessFact.sourceEventId,base.events.at(-1).id);
  assert.equal(getNpcContext(state,'other').memories.length,0);
  assert.equal(answer(state,ask,'other'),null);
  assert.equal(answer(state,'아까 민아도 손전등 일을 직접 봤지?'),null);
  assert.equal(answer(state,'아까 라은님이 내 수첩 찾아준 것도 네가 직접 봤지?'),null);
  assert.equal(answer(state,'손전등 말고 수첩은 네가 직접 봤지?'),null);
  assert.equal(answer(state,'네가 직접 봤지? 손전등 얘기야.'),null);
  assert.equal(answer(state,'손전등은 네가 직접 봤지? 수첩도 봤지?'),null);
  assert.equal(answer(state,ask,'b','polite')?.fallback,'그 일은 제가 직접 보지 못했어요.');
  const competing=applyAction(state,{type:'important_event',detail:'세혁이 다른 손전등을 보관했다.',observers:['b']});
  assert.equal(answer(competing),null);
  assert.deepEqual(state,original);
});

test('Game validation rejects invented, contradicted, leaked or repeated non-witness facts',()=>{
  const base=flashlight(),source=base.events.at(-1).id;
  assert.throws(()=>confirm(base,'b','event-missing'),/Non-witness conflicts/);
  assert.throws(()=>confirm(base,'a',source),/Non-witness conflicts/);
  assert.throws(()=>confirm(base,'b',source,'녹색 수첩'),/Non-witness conflicts/);
  assert.throws(()=>applyAction(base,{type:'important_event',detail:'x',observers:['b','other'],nonWitnessFact:{kind:'not_witnessed',npcId:'b',sourceEventId:source,subject:'손전등'}}),/Invalid confirmed non-witness/);
  const state=confirm(base);
  assert.throws(()=>confirm(state,'b',source),/Non-witness conflicts/);
  const tampered=structuredClone(state);
  tampered.npcs.b.memories.at(-1).nonWitnessFact.sourceEventId='missing';
  assert.equal(answer(tampered),null);
  const nextDay=JSON.parse(JSON.stringify(applyAction(state,{type:'sleep'})));
  assert.equal(answer(nextDay,'오늘 라은님이 내 손전등 찾아준 것도 네가 직접 봤지?'),null);
  assert.equal(answer(nextDay,'어제 라은님이 내 손전등 찾아준 것도 네가 직접 봤지?')?.fallback,'그 일은 내가 직접 보지 못했어.');
});

test('An explicit list non-witness record also handles presence claims; repeated subjects stay ambiguous',()=>{
  let state=createLife({npcIds:['a','b']});
  state=applyAction(state,{type:'important_event',detail:'라은과 도윤은 공방 모임 명단을 함께 확인했다.',observers:['a']});
  const source=state.events.at(-1).id;
  state=confirm(state,'b',source,'명단');
  assert.equal(answer(state,'오늘 라은님과 명단을 봤는데 너도 옆에 있었지?')?.fallback,'그 일은 내가 직접 보지 못했어.');
  state=applyAction(state,{type:'important_event',detail:'라은과 도윤은 동아리 명단을 확인했다.',observers:['a']});
  state=confirm(state,'b',state.events.at(-1).id,'명단');
  assert.equal(answer(state,'오늘 라은님과 명단을 봤는데 너도 옆에 있었지?'),null);
});

test('Opt-in remembering turn uses the game fact without a model call or world mutation',async()=>{
  const state=confirm(flashlight()),original=structuredClone(state);
  const never=async()=>{throw Error('model adapter must not run');};
  const result=await generateRememberingNpcTurn({lifeState:state,dialogue:{npc,player,speech:'casual',playerText:ask},speechState:createSpeechState(),speechAction:{kind:'neutral'},memoryOptions:{confirmedNonWitness:true}},{selectExpression:never,classifyFact:never,freeDialogue:never});
  assert.equal(result.text,'그 일은 내가 직접 보지 못했어.');
  assert.equal(result.factRoute.intent,'confirmed-non-witness');
  assert.equal(result.mode,'record-answer');
  assert.equal(result.conversationFocus,null);
  const boundary=await generateRememberingNpcTurn({lifeState:state,dialogue:{npc,player,speech:'casual',playerText:ask},speechState:createSpeechState(),speechAction:{kind:'insult'},memoryOptions:{confirmedNonWitness:true}},{selectExpression:async()=>'{"index":0}',classifyFact:never,freeDialogue:never});
  assert.notEqual(boundary.text,result.text);
  assert.deepEqual(state,original);
});
