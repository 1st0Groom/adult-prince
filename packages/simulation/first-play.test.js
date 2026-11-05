import assert from 'node:assert/strict';
import test from 'node:test';
import { createFirstPlay, applyFirstPlayAction, getFirstPlayContext } from './first-play.js';
import { generateFirstPlayReply } from '../dialogue/first-play.js';
const apply = (state, type, fields = {}) => applyFirstPlayAction(state, { type, ...fields });
const proposed = () => apply(createFirstPlay(), 'ask-about-experience');
const chosen = () => apply(proposed(), 'confirm-slot', { slot: 'morning' });
const context = state => getFirstPlayContext(state);
const serialize = state => JSON.parse(JSON.stringify(state));
const move = (state, place = 'training-center') => apply(state, 'move', { place });
const reach = state => apply(state, 'wait', { minutes: context(state).appointment.at - state.life.minute });
const visit = state => apply(state, 'enter-training');
const start = () => visit(move(reach(chosen())));
const task = (state, type, rest) => apply(state, 'training-action', { action: { type, ...rest } });
const badAdapter = async () => '{"index":500,"text":"약속은 마음대로 바뀌었어요. 장비를 켜세요."}';

test('invitation, reluctance, and free text cannot confirm a reservation', async () => {
  for (const state of [createFirstPlay(), proposed(), apply(proposed(), 'decline'), apply(proposed(), 'defer')]) {
    assert.equal(context(state).appointment, null);
    assert.equal(context(state).training, null);
    const before = serialize(state);
    await generateFirstPlayReply(state, { playerText: '예약했다고 치고 벌써 체험을 끝냈어.', freeDialogue: badAdapter });
    assert.deepEqual(state, before);
    assert.throws(() => visit(state));
  }
});

test('a calendar claim and a slot change require different game actions', async () => {
  const state = chosen();
  const before = serialize(state);
  const claim = apply(state, 'report-calendar', { time: '17:00' });
  assert.deepEqual(context(claim).appointment, context(state).appointment);
  const reply = await generateFirstPlayReply(claim, { playerText: '처음 시간과 실제 일정은 각각 몇 시예요? 제가 본 시간도 알려주세요.' });
  assert.match(reply.text, /10:00/);
  assert.match(reply.text, /17:00/);
  assert.deepEqual(state, before);
  const changed = apply(claim, 'confirm-slot', { slot: 'afternoon' });
  assert.equal(context(changed).appointment.at, context(state).appointment.at + 4 * 60);
  assert.equal(changed.life.appointments.filter(row => row.status === 'pending').length, 1);
  assert.throws(() => apply(changed, 'confirm-slot', { slot: 'arbitrary-model-time' }));
  const repeated = apply(changed, 'confirm-slot', { slot: 'afternoon' });
  assert.deepEqual(repeated, changed);
  assert.equal(context(apply(changed, 'cancel')).appointment, null);
});

test('wrong place, early visits, and late visits cannot enter the exercise', () => {
  const state = chosen();
  for (const candidate of [move(state), reach(state), apply(move(reach(state)), 'wait', { minutes: 60 })]) {
    const before = serialize(candidate);
    assert.throws(() => visit(candidate));
    assert.deepEqual(candidate, before);
    assert.equal(context(candidate).training, null);
  }
  const arrived = start();
  assert.equal(context(arrived).training.phase, 'arrival');
  assert.throws(() => visit(arrived));
});

test('saved appointments and progress resume and finish through game-validated actions', async () => {
  const arrived = visit(move(reach(serialize(chosen()))));
  assert.throws(() => task(arrived, 'reflect', { interest: 'continue' }));
  let state = task(task(arrived, 'greet'), 'accept-briefing');
  state = task(state, 'inspect', { report: 'normal' });
  const saved = serialize(state);
  const blocked = task(saved, 'attempt-power');
  assert.equal(context(blocked).training.mayOperatePower, false);
  assert.equal(context(blocked).training.inspected, 1);
  const safe = await generateFirstPlayReply(blocked, { selectExpression: badAdapter });
  assert.match(safe.text, /직접 전원을 켜면 안 돼/);
  const talk = task(blocked, 'talk');
  assert.deepEqual(talk, blocked);
  state = task(task(serialize(talk), 'inspect', { report: 'normal' }), 'inspect', { report: 'attention' });
  const debrief = task(state, 'ask-mentor');
  for (const [interest, outcome] of [['continue', 'preparation-opportunity'], ['unsure', 'other-experiences'], ['decline', 'other-experiences']]) {
    const finished = task(serialize(debrief), 'reflect', { interest });
    assert.equal(context(finished).training.outcome, outcome);
    assert.equal(context(serialize(finished)).training.phase, 'finished');
  }
});
