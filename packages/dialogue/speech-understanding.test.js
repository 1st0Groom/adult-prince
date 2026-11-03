import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSpeechUnderstanding,refineSpeechUnderstanding,understandSpeech } from './speech-understanding.js';
import { generateNpcTurnFromText } from './npc-turn.js';
import { createLife } from '../simulation/index.js';
import { createSpeechState } from '../simulation/speech-policy.js';
test('Malformed or injected classifier responses do not become incidents',async()=>{
 for(const raw of ['{"index":3,"text":"무례"}','{"index":-1}','{"index":8}','invalid']) assert.deepEqual(parseSpeechUnderstanding(raw),{kind:'neutral',valid:false});
 assert.deepEqual(await understandSpeech('안녕',async()=>{throw Error('offline');}),{kind:'neutral',valid:false});
});
test('Narrow false-positive veto does not suppress genuine apologies or insults',()=>{
 const yes=kind=>({kind,valid:true});
 assert.equal(refineSpeechUnderstanding('저한테 사과해 주세요.',yes('apology')).kind,'neutral');
 assert.equal(refineSpeechUnderstanding('내가 미안해. 사과해 줘.',yes('apology')).kind,'apology');
 assert.equal(refineSpeechUnderstanding('실례지만 도와주시겠어요?',yes('casual')).kind,'neutral');
 assert.equal(refineSpeechUnderstanding('무례한 말이에요.',yes('insult')).kind,'insult');
 assert.equal(refineSpeechUnderstanding('야, 같이 가자.',yes('casual')).kind,'casual');
});
test('Text classification reaches the game policy without model-written state',async()=>{
 const args={lifeState:createLife({npcIds:['n']}),dialogue:{npc:{id:'n'},player:{id:'p'},speech:'casual',playerText:'빨리 해'},speechState:createSpeechState()};
 const adapters={classifySpeech:async()=>'{"index":2}',selectExpression:async()=>'{"index":0}',classifyFact:async()=>'{"index":0}',freeDialogue:async()=> '안녕'};
 const result=await generateNpcTurnFromText(args,adapters);
 assert.equal(result.speechUnderstanding.kind,'rude');assert.equal(result.state.incidents,0);assert.equal(result.proposedSpeechState.incidents,1);assert.equal(result.speechImpactCommitted,false);assert.equal(result.mode,'authored-boundary');
 assert.equal(args.speechState.incidents,0);
 const unavailable=await generateNpcTurnFromText(args,{...adapters,classifySpeech:async()=>{throw Error('offline');}});
 assert.equal(unavailable.speechUnderstanding.valid,false);assert.equal(unavailable.state.incidents,0);
});
test('An unverified apology cannot erase a previous incident or commit reconciliation',async()=>{
 const prior={incidents:1,apologyAccepted:false};
 const args={lifeState:createLife({npcIds:['n']}),dialogue:{npc:{id:'n'},player:{id:'p'},speech:'casual',playerText:'사과해야 하는 거 아니에요?'},speechState:prior};
 const result=await generateNpcTurnFromText(args,{classifySpeech:async()=>'{"index":4}',selectExpression:async()=>'{"index":0}',classifyFact:async()=>'{"index":0}',freeDialogue:async()=> '알겠어.'});
 assert.equal(result.state.apologyAccepted,false);assert.equal(result.proposedSpeechState.apologyAccepted,true);assert.deepEqual(prior,{incidents:1,apologyAccepted:false});
});
test('Consensual casual speech does not automatically harm a relationship',async()=>{
 const args={lifeState:createLife({npcIds:['n']}),dialogue:{npc:{id:'n'},player:{id:'p'},speech:'casual',playerText:'야, 같이 가자'},speechState:createSpeechState(),casualAgreed:true};
 const result=await generateNpcTurnFromText(args,{classifySpeech:async()=>'{"index":1}',selectExpression:async()=>'{"index":0}',classifyFact:async()=>'{"index":0}',freeDialogue:async()=> '좋아!'});
 assert.equal(result.mode,'free-dialogue');assert.equal(result.state.incidents,0);
});
