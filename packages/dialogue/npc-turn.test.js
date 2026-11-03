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
