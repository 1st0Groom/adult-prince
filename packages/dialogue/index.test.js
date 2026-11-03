import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMessages, validateReply, generateReply } from './index.js';
const input = { npc: { id: 'friend', name: '지우' }, scene: '학교', playerText: '안녕', facts: [{ id: 'public', text: '같은 반', knownBy: ['friend'] }, { id: 'secret', text: '비밀', knownBy: ['other'] }, { id: 'health', text: '민감정보', knownBy: ['friend'], sensitive: true }], memories: [], history: [{ role: 'user', text: '비공개 대화', knownBy: ['other'] }], allowedChoices: [{ id: 'leave', label: '대화 끝내기' }] };
const reply = { npcId: 'friend', text: '왔어? 같이 가자.', evidenceIds: ['public'], choiceIds: ['leave'], endConversation: false };
test('context excludes inaccessible and sensitive records', () => {
  const context = JSON.parse(buildMessages(input)[1].content);
  assert.deepEqual(context.facts.map(item => item.id), ['public']);
  assert.deepEqual(context.history, []);
});
test('reply rejects fabricated evidence, choices and state changes', () => {
  assert.deepEqual(validateReply(JSON.stringify(reply), input), reply);
  assert.throws(() => validateReply({ ...reply, evidenceIds: ['secret'] }, input));
  assert.throws(() => validateReply({ ...reply, evidenceIds: ['imaginary'] }, input));
  assert.throws(() => validateReply({ ...reply, choiceIds: ['grant_job'] }, input));
  assert.throws(() => validateReply({ ...reply, stateChanges: { money: 100 } }, input));
});
test('transport uses local model and validates output without mutating input', async () => {
  const original = structuredClone(input);
  const result = await generateReply(input, { baseUrl: 'http://127.0.0.1:1234/v1', model: 'test-model', fetchImpl: async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:1234/v1/chat/completions');
    assert.equal(JSON.parse(options.body).model, 'test-model');
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(reply) } }] }) };
  } });
  assert.deepEqual(result, reply);
  assert.deepEqual(input, original);
  await assert.rejects(generateReply(input, { baseUrl: 'https://external.example/v1', model: 'x' }));
});

test('recall mode depends on visible non-sensitive memories only', () => {
  const hidden = { ...input, memories: [{ id: 'unseen', text: '행사에서 만났다', knownBy: ['other'] }] };
  assert.equal(JSON.parse(buildMessages(hidden)[1].content).recall.mode, 'no_recollection');
  const visible = { ...input, memories: [{ id: 'seen', text: '책을 주워줬다', knownBy: ['friend'] }] };
  assert.equal(JSON.parse(buildMessages(visible)[1].content).recall.mode, 'evidence_only');
});
