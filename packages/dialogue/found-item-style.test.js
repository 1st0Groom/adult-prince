import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife,applyAction} from '../simulation/index.js';
import {createSpeechState} from '../simulation/speech-policy.js';
import {prepareConfirmedReturn} from './found-item-answer.js';
import {selectConfirmedReturnStyle} from './found-item-style.js';
import {generateRememberingNpcTurn} from './npc-turn.js';
const p={kind:'player'},n={kind:'npc',id:'n'};
const event=(actor,owner,item)=>applyAction(createLife({npcIds:['n','other']}),{type:'found_item_returned',actor,owner,item,observers:[]});
const args=(state,text,speech='casual')=>({lifeState:state,npc:{id:'n',name:'서윤'},player:{id:'p',name:'도현'},playerText:text,speech});
test('Every candidate preserves actor and owner for recollection, correction and reverse direction',()=>{
 const state=applyAction(event(p,n,'책'),{type:'sleep'});
 const recall=prepareConfirmedReturn(args(state,'어제 책을 주운 거 기억나?'));
 assert.deepEqual(recall.options,['응, 네가 내 책을 주워줬어.','내 책은 네가 주워줬어.','내 기억엔 네가 내 책을 주워줬어.','네가 내 책을 주워줬어. 고마워.']);
 const correction=prepareConfirmedReturn(args(state,'네가 내 책을 주워줬잖아.'));
 assert.deepEqual(correction.options,['내 기억엔 네가 내 책을 주워줬어.','아니, 네가 내 책을 주워줬어.','내 책은 네가 주워준 거야.','네가 내 책을 주워줬어. 고마워.']);
 const reverse=event(n,p,'모자');
 assert.deepEqual(prepareConfirmedReturn(args(reverse,'누가 모자를 주웠어?')).options,['내가 네 모자를 주워줬어.','네 모자는 내가 주워줬어.','내 기억엔 내가 네 모자를 주워줬어.','내가 네 모자를 주워줬어. 별일 아니야.']);
 const polite=prepareConfirmedReturn(args(state,'누가 책을 주웠어요?','polite'));
 assert.deepEqual(polite.options,['제 책은 도현 님이 주워주셨어요.','제 기억에는 도현 님이 제 책을 주워주셨어요.','도현 님이 제 책을 주워주신 걸로 기억해요.','도현 님이 제 책을 주워주셨어요. 고마워요.']);
});
test('Only a valid index selects approved text; errors, injected text and invalid indices use the fallback',async()=>{
 const options=['검토한 첫 대사','검토한 둘째 대사'],view={npc:{id:'n',name:'서윤'},player:{name:'도현'},playerText:'기억나?',history:[]};
 const choose=raw=>selectConfirmedReturnStyle({view,options,fallback:options[0]},async()=>raw);
 assert.deepEqual(await choose('{"index":1}'),{text:options[1],fallback:false,index:1});
 for(const raw of ['{"index":1,"text":"없는 사건"}','{"index":2}','{"index":"1"}','[]','{bad']) assert.deepEqual(await choose(raw),{text:options[0],fallback:true,index:null});
 assert.deepEqual(await selectConfirmedReturnStyle({view,options,fallback:options[0]},async()=>{throw Error('offline');}),{text:options[0],fallback:true,index:null});
});
test('Only the remembering path builds options, filters hidden history, and never mutates game state',async()=>{
 let state=applyAction(event(p,n,'책'),{type:'sleep'});const before=structuredClone(state);
 const dialogue={npc:{id:'n',name:'서윤'},player:{id:'p',name:'도현'},speech:'casual',personality:'친근하다',relationship:'친구',stage:'대답한다',scene:{place:'학교'},facts:[],memories:[],interactions:[],allowedChoices:[],playerText:'어제 책을 주운 거 기억나?',history:[{role:'user',text:'비공개 다른 대화',knownBy:['other']},{role:'user',text:'공개된 대화',knownBy:['n']}]};
 const never=async()=>{throw Error('wrong path');};let calls=0;
 const result=await generateRememberingNpcTurn({lifeState:state,dialogue,speechState:createSpeechState(),speechAction:{kind:'neutral'},memoryOptions:{confirmedReturn:true,confirmedReturnStyle:true}},{classifyFact:never,freeDialogue:never,selectExpression:async messages=>{calls++;const serialized=JSON.stringify(messages);assert.doesNotMatch(serialized,/비공개 다른 대화/);assert.match(serialized,/공개된 대화/);return '{"index":1}';}});
 assert.equal(calls,1);assert.equal(result.mode,'record-answer');assert.equal(result.text,'내 책은 네가 주워줬어.');assert.equal(result.recordStyle.fallback,false);assert.deepEqual(state,before);
 const unsupported={...dialogue,playerText:'책 찢은 거 기억나?'};
 const fallback=await generateRememberingNpcTurn({lifeState:state,dialogue:unsupported,speechState:createSpeechState(),speechAction:{kind:'neutral'},memoryOptions:{confirmedReturn:true,confirmedReturnStyle:true}},{classifyFact:async()=>'{"index":0}',freeDialogue:async()=>'그 얘기 더 해줄래?',selectExpression:never});
 assert.equal(fallback.mode,'free-dialogue');assert.equal(fallback.text,'그 얘기 더 해줄래?');assert.deepEqual(state,before);
});
test('Malformed saved data and missing polite name do not become generated facts',()=>{
 const state=event(p,n,'책');assert.equal(prepareConfirmedReturn({...args(state,'누가 책을 주웠어요?','polite'),player:{id:'p'}}),null);
 const damaged=structuredClone(state);damaged.npcs.n.memories[0].minute=-1;assert.equal(prepareConfirmedReturn(args(damaged,'누가 책을 주웠어?')),null);
});

test('Invalid selector output falls back within the game path and never overrides a social boundary',async()=>{
 let state=applyAction(event(p,n,'책'),{type:'sleep'});const before=structuredClone(state);
 const dialogue={npc:{id:'n',name:'서윤'},player:{id:'p',name:'도현'},speech:'casual',personality:'친근하다',relationship:'친구',stage:'대답한다',scene:{place:'학교'},facts:[],history:[],interactions:[],allowedChoices:[],playerText:'어제 책을 주운 거 기억나?'};
 const base={lifeState:state,dialogue,speechState:createSpeechState(),memoryOptions:{confirmedReturn:true,confirmedReturnStyle:true}};
 const never=async()=>{throw Error('wrong path');};
 const invalid=await generateRememberingNpcTurn({...base,speechAction:{kind:'neutral'}},{classifyFact:never,freeDialogue:never,selectExpression:async()=>'{"index":1,"text":"없는 기억"}'});
 assert.equal(invalid.text,'응, 네가 내 책을 주워줬어.');assert.equal(invalid.recordStyle.fallback,true);assert.deepEqual(state,before);
 let selections=0;
 const boundary=await generateRememberingNpcTurn({...base,speechAction:{kind:'insult'}},{classifyFact:never,freeDialogue:never,selectExpression:async messages=>{selections++;assert.match(messages[0].content,/대사를 선택한다/);return '{"index":0}';}});
 assert.equal(boundary.mode,'authored-boundary');assert.equal(selections,1);assert.equal(boundary.recordStyle,undefined);assert.deepEqual(state,before);
});

test('An NPC with the same raw ID as the player is never treated as the player',async()=>{
 let state=createLife({npcIds:['n','p']});
 state=applyAction(state,{type:'found_item_returned',actor:{kind:'npc',id:'p'},owner:{kind:'npc',id:'n'},item:'책',observers:[]});
 state=applyAction(state,{type:'sleep'});const before=structuredClone(state);
 const dialogue={npc:{id:'n',name:'서윤'},player:{id:'p',name:'도현'},speech:'casual',personality:'친근하다',relationship:'친구',stage:'대답한다',scene:{place:'학교'},facts:[],history:[],interactions:[],allowedChoices:[],playerText:'어제 책을 주운 거 기억나?'};
 assert.equal(prepareConfirmedReturn({lifeState:state,npc:dialogue.npc,player:dialogue.player,playerText:dialogue.playerText,speech:dialogue.speech}),null);
 const result=await generateRememberingNpcTurn({lifeState:state,dialogue,speechState:createSpeechState(),speechAction:{kind:'neutral'},memoryOptions:{confirmedReturn:true,confirmedReturnStyle:true}},{classifyFact:async()=>'{"index":0}',freeDialogue:async view=>{assert.equal(view.interactions.length,0);return '어떤 책 말이야?';},selectExpression:async()=>{throw Error('must not select a fabricated player event');}});
 assert.equal(result.mode,'free-dialogue');assert.equal(result.text,'어떤 책 말이야?');assert.deepEqual(state,before);
});

test('Previously spoken candidates are not repeated while an equally grounded alternative exists',async()=>{
 const options=['서로 확인한 첫 대사','같은 사실의 둘째 대사','같은 사실의 셋째 대사'];
 const view={npc:{id:'n',name:'서윤'},player:{name:'도현'},playerText:'다시 말해봐',history:[{role:'assistant',text:options[0]},{role:'assistant',text:options[1]}]};
 const result=await selectConfirmedReturnStyle({view,options,fallback:options[0]},async messages=>{
   const input=JSON.parse(messages[1].content);assert.deepEqual(input.options,[options[2]]);return '{"index":0}';
 });
 assert.equal(result.text,options[2]);assert.equal(result.fallback,false);
 const offline=await selectConfirmedReturnStyle({view,options,fallback:options[0]},async()=>{throw Error('offline');});
 assert.equal(offline.text,options[2]);assert.equal(offline.fallback,true);
 view.history.push({role:'assistant',text:options[2]});
 const exhausted=await selectConfirmedReturnStyle({view,options,fallback:options[0]},async()=>'{"index":99}');
 assert.equal(exhausted.text,options[0]);assert.equal(exhausted.fallback,true);
});

test('The public free-dialogue entry point cannot inject a game-record answer',async()=>{
 const {generateNpcTurn}=await import('./npc-turn.js');
 const dialogue={npc:{id:'n',name:'서윤'},player:{id:'p',name:'도현'},speech:'casual',playerText:'안녕',facts:[],memories:[],history:[],interactions:[]};
 const result=await generateNpcTurn({dialogue,speechState:createSpeechState(),speechAction:{kind:'neutral'},confirmedReturnAnswer:'없는 사건을 확정',confirmedReturnOptions:['없는 사건을 확정']},{classifyFact:async()=>'{"index":0}',freeDialogue:async()=>'안녕.',selectExpression:async()=>'{"index":0}'});
 assert.equal(result.mode,'free-dialogue');assert.equal(result.text,'안녕.');
});
