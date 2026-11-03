import test from 'node:test';
import assert from 'node:assert/strict';
import { createLife, applyAction, getNpcContext } from './index.js';
test('time advances only through time-consuming actions and sleep', () => {
  const initial = createLife({ npcIds: ['friend'] });
  const visited = applyAction(initial, { type: 'visit', npcId: 'friend' });
  assert.equal(visited.minute, initial.minute);
  const worked = applyAction(visited, { type: 'activity', activityId: 'lesson', minutes: 45 });
  assert.equal(worked.minute, 465);
  assert.equal(applyAction(worked, { type: 'sleep' }).minute, 1860);
  assert.equal(initial.npcs.friend.visits, 0);
});
test('NPC context contains observed memories only', () => {
  const initial = createLife({ npcIds: ['friend', 'stranger'] });
  const changed = applyAction(initial, { type: 'important_event', detail: '도움을 줬다', observers: ['friend'] });
  assert.equal(getNpcContext(changed, 'friend').memories.length, 1);
  assert.equal(getNpcContext(changed, 'stranger').memories.length, 0);
  const context = getNpcContext(changed, 'friend');
  context.memories.length = 0;
  assert.equal(changed.npcs.friend.memories.length, 1);
});
test('invalid actions cannot mutate the original state', () => {
  const state = createLife({ npcIds: ['friend'] });
  assert.throws(() => applyAction(state, { type: 'activity', activityId: 'lesson', minutes: -1 }));
  assert.throws(() => applyAction(state, { type: 'visit', npcId: '__proto__' }));
  assert.equal(state.events.length, 0);
});
test('appointments retain agreed place, time and participant and reject duplicate IDs', () => {
  const state = createLife({ npcIds: ['friend'] });
  const action = { type: 'appointment', id: 'training', npcId: 'friend', at: 1000, place: '교육장' };
  const changed = applyAction(state, action);
  assert.equal(changed.appointments[0].place, '교육장');
  assert.equal(changed.npcs.friend.memories[0].channel, 'agreed');
  assert.throws(() => applyAction(changed, action));
  assert.deepEqual(JSON.parse(JSON.stringify(changed)), changed);
});
