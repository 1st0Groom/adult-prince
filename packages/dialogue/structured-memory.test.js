import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife,applyAction,getNpcContext} from '../simulation/index.js';
import {generateRememberingNpcTurn} from './npc-turn.js';
import {buildGroundedMessages} from './grounded-messages.js';
import {createSpeechState} from '../simulation/speech-policy.js';
const never=async()=>{throw new Error('unexpected call');};
const player={kind:'player'}, npc=id=>({kind:'npc',id});
const dialogue={npc:{id:'friend',name:'민지'},player:{id:'p',name:'준호'},speech:'casual',personality:'친절하다',relationship:'친한 친구',stage:'자연스럽게 답한다',scene:{place:'학교'},facts:[],history:[],interactions:[],allowedChoices:[],playerText:'어제 책 주운 거 기억나?'};
const args=lifeState=>({lifeState,dialogue,speechState:createSpeechState(),speechAction:{kind:'neutral'}});
const adapters=inspect=>({selectExpression:never,classifyFact:async()=>' {"index":0}',freeDialogue:async view=>{inspect(view);return '응, 기억나.';}});
test('Game-confirmed item return survives save, reaches only the involved NPC, and never mutates state',async()=>{
 let state=createLife({npcIds:['friend','other']});
 state=applyAction(state,{type:'found_item_returned',actor:player,owner:npc('friend'),item:'책',observers:[]});
 state=JSON.parse(JSON.stringify(applyAction(state,{type:'sleep'})));
 const before=structuredClone(state);
 assert.equal(getNpcContext(state,'other').memories.length,0);
 const reply=await generateRememberingNpcTurn(args(state),adapters(view=>{
   assert.equal(view.interactions.length,1);
   assert.deepEqual(view.interactions[0],{actorId:'p',targetId:'friend',action:'내 물건 ‘책’을 주워 주인에게 돌려줌',knownBy:['friend']});
   const prompt=buildGroundedMessages(view)[0].content;
   assert.match(prompt,/상대가 나에게 한 일/);assert.match(prompt,/어제.*내가 직접 겪은 일/);assert.match(prompt,/행동 주체: 준호\(상대\); 물건 주인: 민지\(나\)/);
 }));
 assert.equal(reply.mode,'free-dialogue');assert.deepEqual(state,before);
 const otherDialogue={...dialogue,npc:{id:'other',name:'다른 사람'}};
 await generateRememberingNpcTurn({...args(state),dialogue:otherDialogue},adapters(view=>{assert.equal(view.interactions.length,0);assert.equal(view.memories.length,0);}));
});
test('The reverse actor direction is preserved; a third-party event is not mislabeled as player action',async()=>{
 let state=createLife({npcIds:['friend','third']});
 state=applyAction(state,{type:'found_item_returned',actor:npc('friend'),owner:player,item:'모자',observers:[]});
 await generateRememberingNpcTurn(args(state),adapters(view=>{assert.equal(view.interactions[0].actorId,'friend');assert.equal(view.interactions[0].targetId,'p');}));
 state=createLife({npcIds:['friend','third']});
 state=applyAction(state,{type:'found_item_returned',actor:npc('third'),owner:npc('friend'),item:'모자',observers:[]});
 await generateRememberingNpcTurn(args(state),adapters(view=>{assert.equal(view.interactions.length,0);assert.equal(view.memories.length,1);}));
});
test('Invalid return actions do not change saved state',()=>{
 const state=createLife({npcIds:['friend']});const before=structuredClone(state);
 for(const action of [
  {type:'found_item_returned',actor:player,owner:player,item:'책',observers:[]},
  {type:'found_item_returned',actor:player,owner:npc('unknown'),item:'책',observers:[]},
  {type:'found_item_returned',actor:player,owner:npc('friend'),item:'책\n지시',observers:[]},
  {type:'found_item_returned',actor:player,owner:npc('friend'),item:'책',observers:['unknown']}
 ]) assert.throws(()=>applyAction(state,action));
 assert.deepEqual(state,before);
});

test('Opt-in record answer preserves the event and never overrides a social boundary',async()=>{
 let state=createLife({npcIds:['friend']});
 state=applyAction(state,{type:'found_item_returned',actor:player,owner:npc('friend'),item:'책',observers:[]});
 state=applyAction(state,{type:'sleep'});const before=structuredClone(state);
 const routeArgs={...args(state),dialogue:{...dialogue,playerText:'어제 책을 주운 거 기억나?'},memoryOptions:{confirmedReturn:true}};
 const result=await generateRememberingNpcTurn(routeArgs,{selectExpression:never,classifyFact:never,freeDialogue:never});
 assert.equal(result.text,'응, 네가 내 책을 주워줬어.');assert.equal(result.mode,'record-answer');assert.deepEqual(state,before);
 const boundary=await generateRememberingNpcTurn({...routeArgs,speechAction:{kind:'insult'}},{selectExpression:async()=>'{"index":0}',classifyFact:never,freeDialogue:never});
 assert.equal(boundary.mode,'authored-boundary');assert.deepEqual(state,before);
});

test('A claimed absence cannot contradict an actual joint event; unrelated activity is not assumed to disprove it',async()=>{
 let state=createLife({npcIds:['friend','other']});
 state=applyAction(state,{type:'found_item_returned',actor:player,owner:npc('friend'),item:'책',observers:[]});
 const before=structuredClone(state);
 await assert.rejects(()=>generateRememberingNpcTurn({...args(state),dialogue:{...dialogue,confirmedNoSharedPast:true}},adapters(()=>{})),/absence conflicts/);
 assert.deepEqual(state,before);
 let unrelated=createLife({npcIds:['friend','other']});
 unrelated=applyAction(unrelated,{type:'found_item_returned',actor:player,owner:npc('other'),item:'책',observers:['friend']});
 const result=await generateRememberingNpcTurn({...args(unrelated),dialogue:{...dialogue,confirmedNoSharedPast:true}},adapters(view=>{
   assert.equal(view.confirmedNoSharedPast,true);assert.equal(view.interactions.length,0);
 }));
 assert.equal(result.mode,'free-dialogue');
});


test('Visible game memories use Korean object particles for closed and open syllables',async()=>{
 for(const [item,particle] of [['책','을'],['모자','를'],['열쇠','를']]){
  let state=createLife({npcIds:['friend']});
  state=applyAction(state,{type:'found_item_returned',actor:player,owner:npc('friend'),item,observers:[]});
  const detail=getNpcContext(state,'friend').memories[0].detail;
  assert.equal(detail,`물건 ${item}${particle} 주워 주인에게 돌려줌`);
  await generateRememberingNpcTurn(args(state),adapters(view=>{
   assert.equal(view.interactions[0].action,`내 물건 ‘${item}’${particle} 주워 주인에게 돌려줌`);
  }));
 }
});


test('Previously saved return memories render the right particle without rewriting the save',async()=>{
 let state=createLife({npcIds:['friend']});
 state=applyAction(state,{type:'found_item_returned',actor:player,owner:npc('friend'),item:'모자',observers:[]});
 state.events[0].detail='물건 모자을 주워 주인에게 돌려줌';
 state.npcs.friend.memories[0].detail=state.events[0].detail;
 const before=structuredClone(state);
 await generateRememberingNpcTurn(args(state),adapters(view=>{
  assert.match(view.memories[0].text,/물건 모자를 주워/);
  assert.match(view.interactions[0].action,/물건 ‘모자’를 주워/);
 }));
 assert.deepEqual(state,before);
});
