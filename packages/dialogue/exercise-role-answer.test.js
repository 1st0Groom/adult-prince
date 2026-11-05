import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife, applyAction, getNpcContext} from '../simulation/index.js';
import {prepareConfirmedExerciseRoles} from './exercise-role-answer.js';
import {generateRememberingNpcTurn} from './npc-turn.js';
import {createSpeechState} from '../simulation/speech-policy.js';

const player = {kind:'player'}, npc = {kind:'npc',id:'n'};
const npcIdentity = {id:'n',name:'하리'}, playerIdentity = {id:'p',name:'강우'};
const subject = '가상 촬영 계획표';
const role = (state,kind,first,second,id='photo') => applyAction(state,{
  type:'important_event',detail:kind === 'exercise_intro' ? '강우는 계획표를 살펴봤다. 하리는 설명했다.' : '강우는 빈칸을 찾아 하리에게 알렸다.',
  observers:['n'],roleFact:{kind,exerciseId:id,subject,
    ...(kind === 'exercise_intro' ? {explainer:first,observer:second} : {reporter:first,recipient:second})}
});
const intro = '직업 소개 말고, 아까 가상 촬영 계획표 살펴본 과제 말이에요. 그 과제 내용을 설명한 사람과 살펴본 사람은 각각 누구였나요?';
const finding = '잠깐 걷고 왔어요. 아까 그 가상 과제에서 빠진 부분을 처음 찾아서 상대에게 알려준 사람과 그때 그 말을 들은 사람은 각각 누구였나요?';
const answer = (state,playerText,speech='polite',conversationFocus=null) => prepareConfirmedExerciseRoles({lifeState:state,npc:npcIdentity,player:playerIdentity,playerText,speech,conversationFocus});

test('Structured, visible exercise roles answer both directions and a focused finding follow-up',()=>{
  let state=role(createLife({npcIds:['n','other']}),'exercise_intro',npc,player);
  state=role(state,'exercise_finding',player,npc);
  const before=structuredClone(state);
  const first=answer(state,intro);
  assert.equal(first.fallback,'제가 설명했고, 강우 님이 살펴보셨어요.');
  const focus={kind:'exercise-role',exerciseId:first.exerciseId,npcId:'n',playerId:'p'};
  assert.equal(answer(state,finding,'polite',focus)?.fallback,'강우 님이 먼저 찾아 제게 알려주셨어요.');
  assert.equal(answer(state,finding,'polite'),null);
  assert.equal(answer(state,finding,'polite',{...focus,playerId:'other'}),null);
  assert.equal(answer(state,intro.replace('촬영','의상'),'polite',focus),null);
  assert.equal(answer(state,intro,'casual')?.fallback,'내가 설명했고, 네가 살펴봤어.');
  const reverse=role(createLife({npcIds:['n']}),'exercise_intro',player,npc);
  assert.equal(answer(reverse,intro)?.fallback,'강우 님이 설명해 주셨고, 제가 살펴봤어요.');
  assert.deepEqual(state,before);
  assert.equal(getNpcContext(state,'other').memories.length,0);
});

test('Unconfirmed, ambiguous, other-subject and third-party roles stay on free dialogue',()=>{
  const base=createLife({npcIds:['n','other']});
  assert.equal(answer(base,intro),null);
  const textOnly=applyAction(base,{type:'important_event',detail:'강우는 계획표를 살펴봤다. 하리는 설명했다.',observers:['n']});
  assert.equal(answer(textOnly,intro),null);
  const once=role(base,'exercise_intro',npc,player);
  assert.equal(answer(once,'직업 소개를 해주세요.'),null);
  assert.equal(answer(once,intro.replace('촬영','의상')),null);
  assert.equal(answer(once,'어제 '+intro),null);
  const duplicated=role(once,'exercise_intro',player,npc);
  assert.equal(answer(duplicated,intro),null);
  const hidden=applyAction(base,{type:'important_event',detail:'비공개',observers:['other'],roleFact:{kind:'exercise_intro',exerciseId:'photo',subject,explainer:npc,observer:player}});
  assert.equal(answer(hidden,intro),null);
  const outsider=role(base,'exercise_intro',{kind:'npc',id:'other'},player);
  assert.equal(answer(outsider,intro),null);
  assert.equal(answer(once,intro,'unknown'),null);
});

test('Simulation validates roles and copies the fact into only visible memories',()=>{
  const base=createLife({npcIds:['n','other']});
  assert.throws(()=>role(base,'exercise_intro',npc,npc));
  assert.throws(()=>role(base,'exercise_intro',{kind:'npc',id:'missing'},player));
  assert.throws(()=>applyAction(base,{type:'important_event',detail:'x',observers:['n'],roleFact:{kind:'exercise_intro',exerciseId:'x',subject:'bad\nsubject',explainer:npc,observer:player}}));
  const state=role(base,'exercise_intro',npc,player);
  assert.equal(state.events.at(-1).roleFact.explainer.id,'n');
  assert.equal(getNpcContext(state,'n').memories.at(-1).roleFact.observer.kind,'player');
  assert.equal(getNpcContext(state,'other').memories.length,0);
});

test('Opt-in remembering turn uses the game answer, carries focus, and leaves world unchanged',async()=>{
  let state=role(createLife({npcIds:['n']}),'exercise_intro',npc,player);
  state=role(state,'exercise_finding',player,npc);
  const original=structuredClone(state);
  const never=async()=>{throw Error('model route should not be used');};
  const adapters={selectExpression:never,classifyFact:never,freeDialogue:never};
  const run=(text,focus=null)=>generateRememberingNpcTurn({
    lifeState:state, dialogue:{npc:npcIdentity,player:playerIdentity,speech:'polite',playerText:text},
    speechState:createSpeechState(),speechAction:{kind:'neutral'},
    memoryOptions:{confirmedExerciseRoles:true,conversationFocus:focus}
  },adapters);
  const first=await run(intro);
  assert.equal(first.text,'제가 설명했고, 강우 님이 살펴보셨어요.');
  assert.equal(first.mode,'record-answer');
  assert.equal(first.factRoute.intent,'confirmed-exercise-role');
  const second=await run(finding,first.conversationFocus);
  assert.equal(second.text,'강우 님이 먼저 찾아 제게 알려주셨어요.');
  assert.deepEqual(state,original);
});
