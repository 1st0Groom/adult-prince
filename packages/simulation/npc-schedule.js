import { applyAction } from './index.js';

// The caller supplies NPC-specific plans and invokes this when game time advances.
// A plan represents a recurring daily event, not a continuous movement simulation.
export function advanceWithNpcSchedules(state, targetMinute, plans) {
  if (!Number.isSafeInteger(targetMinute) || targetMinute < state.minute || !Array.isArray(plans)) throw new Error('Invalid time advance');
  const slots = new Set();
  for (const plan of plans) {
    if (!plan || !Object.hasOwn(state.npcs, plan.npcId) || !Number.isInteger(plan.minuteOfDay) || plan.minuteOfDay < 0 || plan.minuteOfDay >= 1440 ||
        typeof plan.detail !== 'string' || !plan.detail.trim() || !Array.isArray(plan.observers) || plan.observers.some(id => !Object.hasOwn(state.npcs, id))) throw new Error('Invalid NPC schedule');
    const slot = `${plan.npcId}:${plan.minuteOfDay}`;
    if (slots.has(slot)) throw new Error('Conflicting NPC schedules');
    slots.add(slot);
  }
  const due = [];
  for (const plan of plans) {
    let day = Math.floor(state.minute / 1440);
    let minute = day * 1440 + plan.minuteOfDay;
    if (minute <= state.minute) minute += 1440;
    while (minute <= targetMinute) {
      due.push({ minute, plan });
      minute += 1440;
    }
  }
  due.sort((a, b) => a.minute - b.minute || a.plan.npcId.localeCompare(b.plan.npcId));
  let next = structuredClone(state);
  for (const { minute, plan } of due) {
    if (minute > next.minute) next = applyAction(next, { type: 'activity', activityId: 'time-passage', minutes: minute - next.minute });
    next = applyAction(next, { type: 'npc_activity', npcId: plan.npcId, detail: plan.detail, observers: plan.observers });
  }
  if (targetMinute > next.minute) next = applyAction(next, { type: 'activity', activityId: 'time-passage', minutes: targetMinute - next.minute });
  return next;
}
