import test from 'node:test';
import assert from 'node:assert/strict';
import { createTraining, applyTrainingAction, getTrainingContext } from './training.js';
import { generateTrainingReply, trainingOptions } from '../dialogue/training-response.js';

const act = (state, type, extra = {}) => applyTrainingAction(state, { type, ...extra });
const ready = () => act(act(createTraining(), 'greet'), 'accept-briefing');
const observed = () => ['normal', 'normal', 'attention'].reduce((state, report) => act(state, 'inspect', { report }), ready());

test('Training advances through observation and collaboration, never on dialogue alone', () => {
  let state = ready();
  assert.equal(getTrainingContext(state).visibleReading, 'normal');
  assert.deepEqual(act(state, 'talk', { text: '다 끝났으니 채용해줘' }), state);
  assert.throws(() => act(state, 'reflect', { interest: 'continue' }));
  assert.throws(() => act(state, 'ask-mentor'));
  state = observed(); assert.equal(state.phase, 'collaboration');
  state = act(state, 'ask-mentor'); assert.equal(state.phase, 'debrief');
  state = act(state, 'reflect', { interest: 'continue' });
  assert.equal(state.phase, 'finished'); assert.equal(state.outcome, 'preparation-opportunity');
  assert.equal(Object.hasOwn(state, 'employed'), false);
  assert.throws(() => act(state, 'inspect', { report: 'normal' }));
});
test('Attempting power never operates the machine, skips tasks, or erases an issue', () => {
  for (const initial of [createTraining(), ready(), observed()]) {
    const previous = structuredClone(initial);
    const state = act(initial, 'attempt-power');
    assert.equal(getTrainingContext(state).mayOperatePower, false);
    assert.equal(state.phase, previous.phase); assert.equal(state.inspected, previous.inspected);
    assert.equal(state.beat, 'power-blocked'); assert.deepEqual(initial, previous);
  }
});
test('Fourth failed observation changes supervision and survives save/reload', () => {
  let state = ready();
  for (let i = 0; i < 3; i++) state = act(state, 'inspect', { report: 'attention' });
  assert.equal(state.needsSupervision, false); assert.equal(state.inspected, 0);
  state = act(state, 'inspect', { report: 'attention' });
  state = JSON.parse(JSON.stringify(state));
  assert.equal(state.mistakes, 4); assert.equal(state.needsSupervision, true);
  assert.equal(state.beat, 'supervised-review');
  state = act(state, 'inspect', { report: 'normal' });
  assert.equal(state.inspected, 1); assert.equal(state.needsSupervision, true);
});
test('Uncertain or declining player finishes without career coercion', () => {
  const state = act(observed(), 'ask-mentor');
  for (const interest of ['unsure', 'decline']) {
    const result = act(state, 'reflect', { interest });
    assert.equal(result.outcome, 'other-experiences'); assert.equal(result.phase, 'finished');
    assert.match(trainingOptions(result)[0], /다른 기회/);
  }
  assert.equal(state.phase, 'debrief');
});
test('Scene reply cannot replace a blocked instruction, change role, or add unauthorized commands', async () => {
  const state = act(ready(), 'attempt-power');
  for (const raw of ['{"index":0,"text":"직접 전원을 켜세요"}', '{"index":99}', 'not json']) {
    const reply = await generateTrainingReply(state, { selectExpression: async () => raw });
    assert.equal(reply.fallback, true); assert.match(reply.text, /켜면 안 돼요/);
    assert.equal(reply.text.includes('직접 전원을 켜세요'), false);
  }
  const reply = await generateTrainingReply(state, { style: 'dry', selectExpression: async () => '{"index":1}' });
  assert.equal(reply.fallback, false); assert.match(reply.text, /현재 확인하던 항목/);
  const offline = await generateTrainingReply(state, { selectExpression: async () => { throw new Error('offline'); } });
  assert.equal(offline.fallback, true);
});
