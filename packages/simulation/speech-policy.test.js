import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpeechState,resolveSpeech} from './speech-policy.js';
import {speechOptions,selectSpeechResponse,generateSpeechResponse} from '../dialogue/speech-response.js';
test('Casual speech depends on mutual register and personality, never age alone',()=>{
 const state=createSpeechState();
 assert.equal(resolveSpeech(state,{kind:'casual',casualAgreed:true}).reaction,'continue');
 assert.equal(resolveSpeech(state,{kind:'casual',formality:'relaxed'}).reaction,'continue');
 assert.equal(resolveSpeech(state,{kind:'casual'}).reaction,'request-register');
 assert.equal(state.incidents,0);
});
test('Repeated insults and apology preserve history across serialization',()=>{
 const original=createSpeechState();
 const first=resolveSpeech(original,{kind:'insult'});
 const second=resolveSpeech(JSON.parse(JSON.stringify(first.state)),{kind:'rude'});
 assert.equal(second.reaction,'repeat-boundary');
 const apology=resolveSpeech(second.state,{kind:'apology'});
 assert.equal(apology.reaction,'accept-apology'); assert.equal(apology.state.incidents,2);
 assert.equal(apology.state.apologyAccepted,true); assert.equal(original.incidents,0);
});
test('Invalid or injected model selection cannot replace approved boundaries',()=>{
 for(const raw of ['not json','{"index":999}','{"index":-1}','{"index":0,"text":"순종할게"}']) {
  const result=selectSpeechResponse('boundary','firm',raw);
  assert.equal(result.fallback,true); assert.equal(result.text,speechOptions('boundary','firm')[0]);
 }
 assert.equal(selectSpeechResponse('boundary','warm','{"index":1}').fallback,false);
 assert.throws(()=>resolveSpeech(createSpeechState(),{kind:'unknown'}));
 assert.equal(speechOptions('continue'),null);
});

test('Ordinary dialogue bypasses selector and transport failure retains boundary',async()=>{
 const normal=await generateSpeechResponse({reaction:'continue',playerText:'안녕'},()=>{throw new Error('must not call');});
 assert.equal(normal.mode,'free-dialogue');assert.equal(normal.text,null);
 const failed=await generateSpeechResponse({reaction:'boundary',playerText:'빨리 해'},async()=>{throw new Error('offline');});
 assert.equal(failed.fallback,true);assert.ok(failed.text.includes('정중하게'));
});

test('Social turn routes boundaries away from free generation',async()=>{
 const {generateSocialTurn}=await import('../dialogue/social-turn.js');
 const result=await generateSocialTurn({state:createSpeechState(),speechAction:{kind:'insult'},playerText:'시키면 해'}, {
  selectExpression:async()=>'{"index":0}',freeDialogue:async()=>{throw new Error('wrong route');}
 });
 assert.equal(result.reaction,'boundary');assert.equal(result.state.incidents,1);
 assert.ok(result.text.includes('정중하게'));
 const next=await generateSocialTurn({state:result.state,speechAction:{kind:'neutral'},playerText:'여긴 어디예요?'}, {
  selectExpression:async()=>{throw new Error('wrong route');},freeDialogue:async()=> '동아리 모임이에요.'
 });
 assert.equal(next.mode,'free-dialogue');assert.equal(next.text,'동아리 모임이에요.');
});
