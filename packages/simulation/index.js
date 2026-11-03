const integer = (value, name) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid ${name}`);
};
export function createLife({ npcIds = [] } = {}) {
  if (!Array.isArray(npcIds) || npcIds.some(id => typeof id !== 'string' || !id) || new Set(npcIds).size !== npcIds.length) throw new Error('Invalid NPC IDs');
  return { version: 1, minute: 7 * 60, events: [], appointments: [], npcs: Object.fromEntries(npcIds.map(id => [id, { visits: 0, memories: [] }])) };
}
export function applyAction(state, action) {
  if (!action || typeof action !== 'object') throw new Error('Invalid action');
  const next = structuredClone(state);
  const npc = id => {
    if (!Object.hasOwn(next.npcs, id)) throw new Error('Unknown NPC');
    return next.npcs[id];
  };
  const remember = (id, event, channel) => npc(id).memories.push({ eventId: event.id, minute: event.minute, type: event.type, channel, detail: event.detail });
  let event;
  if (action.type === 'activity') {
    integer(action.minutes, 'duration');
    if (!action.minutes || typeof action.activityId !== 'string' || !action.activityId) throw new Error('Invalid activity');
    next.minute += action.minutes;
  } else if (action.type === 'sleep') {
    next.minute = (Math.floor(next.minute / 1440) + 1) * 1440 + 7 * 60;
  } else if (action.type === 'visit') {
    npc(action.npcId).visits += 1;
  } else if (action.type === 'appointment') {
    npc(action.npcId);
    integer(action.at, 'appointment time');
    if (action.at <= next.minute || !action.id || !action.place || next.appointments.some(item => item.id === action.id)) throw new Error('Invalid appointment');
    next.appointments.push({ id: action.id, npcId: action.npcId, at: action.at, place: action.place, status: 'pending' });
  } else if (action.type === 'npc_activity') {
    npc(action.npcId);
    if (typeof action.detail !== 'string' || !action.detail.trim() || !Array.isArray(action.observers)) throw new Error('Invalid NPC activity');
    for (const id of action.observers) npc(id);
  } else if (action.type === 'important_event') {
    if (typeof action.detail !== 'string' || !action.detail.trim() || !Array.isArray(action.observers)) throw new Error('Invalid event');
    for (const id of action.observers) npc(id);
  } else throw new Error('Unsupported action');
  integer(next.minute, 'world time');
  event = { id: `event-${next.events.length + 1}`, minute: next.minute, type: action.type, detail: action.detail ?? action.activityId ?? action.place ?? '' };
  next.events.push(event);
  if (action.type === 'important_event') for (const id of new Set(action.observers)) remember(id, event, 'observed');
  if (action.type === 'npc_activity') {
    remember(action.npcId, event, 'experienced');
    for (const id of new Set(action.observers)) if (id !== action.npcId) remember(id, event, 'observed');
  }
  if (action.type === 'appointment') remember(action.npcId, event, 'agreed');
  return next;
}
export function getNpcContext(state, npcId) {
  if (!Object.hasOwn(state.npcs, npcId)) throw new Error('Unknown NPC');
  return structuredClone({ npcId, ...state.npcs[npcId] });
}
