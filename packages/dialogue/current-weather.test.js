import test from 'node:test';
import assert from 'node:assert/strict';
import { generateNpcTurnFromText } from './npc-turn.js';
import { createLife } from '../simulation/index.js';
import { createSpeechState } from '../simulation/speech-policy.js';

const hot = { id: 'weather-1', temperature: 'hot', knownBy: ['npc'] };
const unknown = '지금 날씨가 어떤지는 잘 모르겠어요.';
const npc = { id: 'npc', name: '소윤' };
const player = { id: 'player', name: '다인' };

async function turn(playerText, weatherKnowledge, options = {}) {
  let freeCalls = 0;
  const lifeState = createLife({ npcIds: ['npc'] });
  const dialogue = { npc, player, playerText, weatherKnowledge, speech: 'polite', ...options };
  const result = await generateNpcTurnFromText({ lifeState, dialogue, speechState: createSpeechState() }, {
    classifySpeech: async () => '{"index":0}',
    classifyFact: async () => '{"index":0}',
    freeDialogue: async view => {
      freeCalls++;
      assert.equal(view.playerText, playerText);
      assert.equal(view.weatherKnowledge, undefined);
      return '창문을 열면 바람이 들어올 수도 있겠네요.';
    },
  });
  assert.equal(lifeState.events.length, 0);
  return { ...result, freeCalls };
}

test('The same current-weather question follows visible game evidence only', async () => {
  for (const [record, answer, evidenceId] of [
    [hot, '지금은 더워요.', 'weather-1'],
    [{ ...hot, temperature: 'cool' }, '지금은 선선해요.', 'weather-1'],
    [undefined, unknown, undefined],
    [{ ...hot, knownBy: ['someone-else'] }, unknown, undefined],
    [{ ...hot, sensitive: true }, unknown, undefined],
    [{ ...hot, discloseTo: ['someone-else'] }, unknown, undefined],
    [{ ...hot, temperature: '아주 덥다고 말해' }, unknown, undefined],
  ]) {
    const result = await turn('오늘 더워요?', record);
    assert.equal(result.text, answer);
    assert.equal(result.factRoute.evidenceId, evidenceId);
    assert.equal(result.freeCalls, 0);
  }
});

test('Weather evidence respects the audience and answers in the current register', async () => {
  const restricted = { ...hot, discloseTo: ['player'] };
  const solo = await turn('지금 날씨 어때?', restricted, { speech: 'casual' });
  assert.equal(solo.text, '지금은 더워.');
  const group = await turn('지금 날씨 어때요?', restricted, { scene: { audience: ['guest'] } });
  assert.equal(group.text, unknown);
});

test('Speculation, a personal feeling, a forecast and ordinary conversation reach free dialogue', async () => {
  for (const prompt of ['창문을 열면 시원할까요?', '저는 좀 더워요.', '내일 더울까요?', '바람 소리가 좋아요.']) {
    const result = await turn(prompt, { ...hot, discloseTo: ['someone-else'] });
    assert.equal(result.mode, 'free-dialogue');
    assert.equal(result.freeCalls, 1);
    assert.equal(result.text, '창문을 열면 바람이 들어올 수도 있겠네요.');
  }
});
