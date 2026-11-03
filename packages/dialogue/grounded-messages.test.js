import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGroundedMessages } from './grounded-messages.js';
const input = () => ({
  npc: { id: 'jiwoo', name: '지우' }, player: { id: 'minsu', name: '민수' },
  personality: '장난스럽지만 배려한다', relationship: '친한 친구', speech: 'casual',
  stage: '빌린 물건 이야기', scene: { place: '복도' }, playerText: '누가 빌려줬지?',
  facts: [], memories: [], history: [], allowedChoices: [],
  interactions: [{ actorId: 'minsu', targetId: 'jiwoo', action: '드라이버를 빌려줌', knownBy: ['jiwoo'] }]
});
test('Speakers and interaction direction remain explicit after old turns disappear', () => {
  const value = input();
  value.history = Array.from({ length: 16 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: `옛 대화 ${i}`, knownBy: ['jiwoo'] }));
  const messages = buildGroundedMessages(value);
  assert.match(messages[0].content, /상대가 나에게 한 일: 드라이버를 빌려줌/);
  assert.equal(messages.some(x => x.content === '옛 대화 0'), false);
  assert.equal(messages.some(x => x.content === '옛 대화 15'), true);
});
test('Private records and other NPC observations never reach this speaker', () => {
  const value = input();
  value.interactions.push({ actorId: 'unknown', action: '비밀 관찰', knownBy: ['other'] });
  value.interactions.push({ actorId: 'minsu', targetId: 'jiwoo', action: '민감 기록', knownBy: ['jiwoo'], sensitive: true });
  value.facts.push({ id: 'private', text: '숨긴 사실', knownBy: ['other'] });
  const text = JSON.stringify(buildGroundedMessages(value));
  for (const secret of ['비밀 관찰', '민감 기록', '숨긴 사실']) assert.equal(text.includes(secret), false);
});
test('Missing identity or unbound interaction participants are rejected', () => {
  assert.throws(() => buildGroundedMessages({ ...input(), player: undefined }));
  const value = input(); value.interactions[0].targetId = 'other';
  assert.throws(() => buildGroundedMessages(value));
});
