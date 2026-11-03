import test from 'node:test';
import assert from 'node:assert/strict';
import { generateNpcTurn } from './npc-turn.js';
import { createSpeechState } from '../simulation/speech-policy.js';
const dialogue = { npc: { id: 'n' }, player: { id: 'p' }, speech: 'casual', playerText: '그 우산은 누구한테 있어?',
  loans: [{ lenderId: 'p', borrowerId: 'n', holderId: 'n', item: '우산', knownBy: ['n'] }] };
const never = async () => { throw new Error('wrong route'); };
test('An insult containing a factual question still respects the NPC boundary', async () => {
  const input = { dialogue, speechState: createSpeechState(), speechAction: { kind: 'insult' } };
  const original = structuredClone(input);
  const reply = await generateNpcTurn(input, { selectExpression: async () => '{"index":0}', classifyFact: never, freeDialogue: never });
  assert.equal(reply.mode, 'authored-boundary'); assert.equal(reply.factRoute, null);
  assert.equal(reply.state.incidents, 1); assert.deepEqual(input, original);
});
test('Neutral factual question uses persistent records and ordinary chat uses free dialogue', async () => {
  const input = { dialogue, speechState: createSpeechState(), speechAction: { kind: 'neutral' } };
  const reply = await generateNpcTurn(input, { selectExpression: never, classifyFact: never, freeDialogue: never });
  assert.equal(reply.mode, 'record-answer'); assert.match(reply.text, /내가 가지고/);
  const normal = await generateNpcTurn({ ...input, dialogue: { ...dialogue, playerText: '오늘 어때?' } }, {
    selectExpression: never, classifyFact: async () => '{"index":0}', freeDialogue: async () => '그냥 평범해.'
  });
  assert.equal(normal.mode, 'free-dialogue'); assert.equal(normal.text, '그냥 평범해.');
});
test('Ambiguous memory selection can reach the NPC turn without inventing an answer', async () => {
  const {createLife,applyAction}=await import('../simulation/index.js');
  const {selectNpcDialogueMemoryResult}=await import('../simulation/dialogue-memory.js');
  let state=createLife({npcIds:['n']});
  state=applyAction(state,{type:'npc_activity',npcId:'n',detail:'우산을 빌렸다',observers:[]});
  state=applyAction(state,{type:'npc_activity',npcId:'n',detail:'카메라를 빌렸다',observers:[]});
  const selection=selectNpcDialogueMemoryResult(state,'n','그거 기억나?',{history:[{role:'user',text:'우산과 카메라 이야기야',knownBy:['n']}]});
  const reply=await generateNpcTurn({dialogue:{...dialogue,playerText:'그거 기억나?',memoryResolution:selection.resolution},speechState:createSpeechState(),speechAction:{kind:'neutral'}},{selectExpression:never,classifyFact:never,freeDialogue:never});
  assert.equal(selection.resolution,'ambiguous');assert.equal(reply.mode,'clarify-reference');assert.equal(reply.text,'어떤 거 말하는 거야?');
});
