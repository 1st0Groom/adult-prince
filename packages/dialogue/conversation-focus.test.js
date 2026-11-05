import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife,applyAction} from '../simulation/index.js';
import {createSpeechState} from '../simulation/speech-policy.js';
import {prepareConfirmedReturn} from './found-item-answer.js';
import {generateRememberingNpcTurn} from './npc-turn.js';

const player={kind:'player'},npc={kind:'npc',id:'n'};
const makeLife=(actor,owner,item)=>applyAction(applyAction(createLife({npcIds:['n','other']}),{type:'found_item_returned',actor,owner,item,observers:[]}),{type:'sleep'});
const makeDialogue=text=>({npc:{id:'n',name:'하나'},player:{id:'p',name:'정우'},speech:'casual',personality:'다정하고 솔직하다',relationship:'친한 친구',stage:'대답한다',scene:{place:'학교'},facts:[],history:[],interactions:[],allowedChoices:[],playerText:text});
const adapters={selectExpression:async()=>'{\"index\":0}',classifyFact:async()=>'{\"index\":0}',freeDialogue:async()=>'자연스러운 일반 대화'};
async function turn(state,text,focus=null,extra={}) {
 return generateRememberingNpcTurn({lifeState:state,dialogue:makeDialogue(text),speechState:createSpeechState(),speechAction:{kind:'neutral'},memoryOptions:{confirmedReturn:true,confirmedReturnStyle:true,conversationFocus:focus},...extra},adapters);
}

test('Four linked turns keep a game-confirmed player actor and do not invent a motive',async()=>{
 const state=makeLife(player,npc,'목도리'),before=structuredClone(state);
 const first=await turn(state,'어제 내 목도리를 네가 주워줬던 거지?');
 assert.equal(first.mode,'record-answer');
 assert.equal(first.text,'내 기억엔 네가 내 목도리를 주워줬어.');
 assert.deepEqual(first.conversationFocus,{kind:'found-item',eventId:'event-1',npcId:'n',playerId:'p'});
 const second=await turn(state,'그 물건은 원래 누구 거였어?',first.conversationFocus);
 assert.equal(second.text,'내 거였어.');assert.deepEqual(second.conversationFocus,first.conversationFocus);
 const third=await turn(state,'누가 주웠더라?',second.conversationFocus);
 assert.equal(third.text,'네가 내 목도리를 주워줬어.');assert.deepEqual(third.conversationFocus,first.conversationFocus);
 const fourth=await turn(state,'그때 내가 왜 그랬는지 알아?',third.conversationFocus);
 assert.equal(fourth.text,'네 마음은 나도 확실히는 몰라.');assert.deepEqual(state,before);
});

test('The opposite actor direction keeps the owner and does not guess the player motive',async()=>{
 const state=makeLife(npc,player,'이어폰'),before=structuredClone(state);
 const first=await turn(state,'어제 내가 네 이어폰을 주워줬지?');
 assert.equal(first.text,'내 기억엔 내가 네 이어폰을 주워줬어.');
 const second=await turn(state,'그 물건은 원래 누구 거였어?',first.conversationFocus);
 assert.equal(second.text,'네 거였어.');
 const third=await turn(state,'누가 주웠더라?',second.conversationFocus);
 assert.equal(third.text,'내가 네 이어폰을 주워줬어.');
 const fourth=await turn(state,'그때 내가 왜 그랬는지 알아?',third.conversationFocus);
 assert.equal(fourth.mode,'free-dialogue');assert.equal(fourth.conversationFocus,null);assert.deepEqual(state,before);
});

test('Agreeing and disagreeing phrases track who the player claims acted',()=>{
 for(const [actor,owner] of [[player,npc],[npc,player]]){
  const state=makeLife(actor,owner,'책');
  for(const [text,claimPlayer] of [['내가 네 책을 주워줬지?',true],['네가 내 책을 주워줬지?',false]]){
   const plan=prepareConfirmedReturn({lifeState:state,npc:{id:'n'},player:{id:'p',name:'정우'},speech:'casual',playerText:text});
   assert.ok(plan,text);
   const agreed=claimPlayer===(actor.kind==='player');
   assert.ok(plan.options.some(x=>x.startsWith(agreed?'맞아,':'아니,')));
   assert.ok(!plan.options.some(x=>x.startsWith(agreed?'아니,':'맞아,')));
  }
 }
});

test('Missing, unrelated, private or ambiguous focus cannot select a game event',async()=>{
 const state=makeLife(player,npc,'책');
 const first=await turn(state,'어제 책을 주운 거 기억나?');
 const missing=await turn(state,'누가 주웠더라?');
 assert.equal(missing.mode,'free-dialogue');assert.equal(missing.conversationFocus,null);
 for(const focus of [
  {...first.conversationFocus,npcId:'other'},
  {...first.conversationFocus,playerId:'other'},
  {...first.conversationFocus,eventId:'missing'}
 ]){
  const result=await turn(state,'누가 주웠더라?',focus);
  assert.equal(result.mode,'free-dialogue');assert.equal(result.conversationFocus,null);
 }
 let hidden=applyAction(state,{type:'found_item_returned',actor:player,owner:{kind:'npc',id:'other'},item:'가방',observers:[]});
 const privateFocus={...first.conversationFocus,eventId:hidden.events.at(-1).id};
 assert.equal((await turn(hidden,'누가 주웠더라?',privateFocus)).mode,'free-dialogue');
 let ambiguous=applyAction(state,{type:'important_event',detail:'다른 책 이야기를 들었다.',observers:['n']});
 assert.equal((await turn(ambiguous,'누가 주웠더라?',first.conversationFocus)).mode,'free-dialogue');
});

test('Unrelated turns and social boundaries clear focus without changing game state',async()=>{
 const state=makeLife(player,npc,'책'),before=structuredClone(state);
 const first=await turn(state,'어제 책을 주운 거 기억나?');
 const unrelated=await turn(state,'오늘 밥 먹었어?',first.conversationFocus);
 assert.equal(unrelated.mode,'free-dialogue');assert.equal(unrelated.conversationFocus,null);
 const afterTopicChange=await turn(state,'누가 주웠더라?',unrelated.conversationFocus);
 assert.equal(afterTopicChange.mode,'free-dialogue');
 const boundary=await turn(state,'누가 주웠더라?',first.conversationFocus,{speechAction:{kind:'insult'}});
 assert.equal(boundary.mode,'authored-boundary');assert.equal(boundary.conversationFocus,null);
 assert.deepEqual(state,before);
});


test('A vague past-conversation reference is clarified and does not start a fact focus',async()=>{
 const state=makeLife(player,npc,'책'),before=structuredClone(state);
 const result=await turn(state,'어제 책 얘기 기억나?');
 assert.equal(result.mode,'record-clarification');
 assert.equal(result.text,'책 얘기? 어떤 얘기인지 조금 더 말해 줄래?');
 assert.equal(result.conversationFocus,null);
 assert.equal((await turn(state,'누가 주웠더라?',result.conversationFocus)).mode,'free-dialogue');
 assert.deepEqual(state,before);
});
