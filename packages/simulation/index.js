import { describeReturnedItem } from './korean-particles.js';

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
  const remember = (id, event, channel) => npc(id).memories.push({ eventId: event.id, minute: event.minute, type: event.type, channel, detail: event.detail, ...(event.interaction ? { interaction: structuredClone(event.interaction) } : {}), ...(event.roleFact ? { roleFact: structuredClone(event.roleFact) } : {}), ...(event.absenceFact ? { absenceFact: structuredClone(event.absenceFact) } : {}), ...(event.nonWitnessFact ? { nonWitnessFact: structuredClone(event.nonWitnessFact) } : {}) });
  let interaction;
  let roleFact;
  let absenceFact;
  let nonWitnessFact;
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
  } else if (action.type === 'found_item_returned') {
    // This records a game-confirmed event; player text alone must not create it.
    const participant = value => {
      if (!value || typeof value !== 'object') throw new Error('Invalid participant');
      if (value.kind === 'player' && Object.keys(value).length === 1) return { kind: 'player' };
      if (value.kind === 'npc' && Object.keys(value).length === 2 && typeof value.id === 'string') { npc(value.id); return { kind: 'npc', id: value.id }; }
      throw new Error('Invalid participant');
    };
    const actor = participant(action.actor), owner = participant(action.owner);
    if (actor.kind === owner.kind && (actor.kind === 'player' || actor.id === owner.id)) throw new Error('Actor and owner must differ');
    if (typeof action.item !== 'string' || !action.item.trim() || action.item.length > 80 || /[\r\n]/.test(action.item) || !Array.isArray(action.observers)) throw new Error('Invalid returned item');
    for (const id of action.observers) npc(id);
    interaction = { kind: 'found_item_returned', actor, owner, item: action.item.trim() };
  } else if (action.type === 'important_event') {
    if (typeof action.detail !== 'string' || !action.detail.trim() || !Array.isArray(action.observers)) throw new Error('Invalid event');
    for (const id of action.observers) npc(id);
    if (action.absenceFact !== undefined) {
      const fact=action.absenceFact;
      if (fact?.kind!=='not_shared_trip' || typeof fact.npcId!=='string' || !action.observers.includes(fact.npcId) ||
          typeof fact.place!=='string' || !fact.place.trim() || fact.place.length>100 || /[\r\n]/.test(fact.place) ||
          (fact.timePhrase!==undefined && (typeof fact.timePhrase!=='string' || fact.timePhrase.length>60 || /[\r\n]/.test(fact.timePhrase)))) throw new Error('Invalid confirmed absence');
      npc(fact.npcId);
      absenceFact={kind:'not_shared_trip',npcId:fact.npcId,place:fact.place.trim(),timePhrase:fact.timePhrase?.trim()??''};
    }
    if (action.nonWitnessFact !== undefined) {
      const fact=action.nonWitnessFact;
      if (fact?.kind!=='not_witnessed' || typeof fact.npcId!=='string' ||
          action.observers.length!==1 || action.observers[0]!==fact.npcId ||
          typeof fact.sourceEventId!=='string' || typeof fact.subject!=='string' ||
          !fact.subject.trim() || fact.subject.length>80 || /[\r\n]/.test(fact.subject)) throw new Error('Invalid confirmed non-witness');
      npc(fact.npcId);
      const source=next.events.find(e=>e.id===fact.sourceEventId);
      const subject=fact.subject.trim();
      if (!source || source.nonWitnessFact || !['found_item_returned','important_event'].includes(source.type) ||
          !source.detail.replace(/\s+/g,'').includes(subject.replace(/\s+/g,'')) ||
          npc(fact.npcId).memories.some(m=>m.eventId===source.id) ||
          next.events.some(e=>e.nonWitnessFact?.npcId===fact.npcId && e.nonWitnessFact.sourceEventId===source.id))
        throw new Error('Non-witness conflicts with game event');
      nonWitnessFact={kind:'not_witnessed',npcId:fact.npcId,sourceEventId:source.id,subject};
    }
    if (action.roleFact !== undefined) {
      const fact = action.roleFact;
      const intro = fact?.kind === 'exercise_intro';
      const finding = fact?.kind === 'exercise_finding';
      if ((!intro && !finding) || typeof fact.exerciseId !== 'string' || !fact.exerciseId.trim() || fact.exerciseId.length > 100 || /[\r\n]/.test(fact.exerciseId) ||
          typeof fact.subject !== 'string' || !fact.subject.trim() || fact.subject.length > 100 || /[\r\n]/.test(fact.subject)) throw new Error('Invalid exercise role fact');
      const participant = value => {
        if (value?.kind === 'player' && Object.keys(value).length === 1) return {kind:'player'};
        if (value?.kind === 'npc' && typeof value.id === 'string' && Object.keys(value).length === 2) { npc(value.id); return {kind:'npc',id:value.id}; }
        throw new Error('Invalid exercise participant');
      };
      const first = participant(intro ? fact.explainer : fact.reporter);
      const second = participant(intro ? fact.observer : fact.recipient);
      if (first.kind === second.kind && (first.kind === 'player' || first.id === second.id)) throw new Error('Exercise participants must differ');
      roleFact = {kind:fact.kind,exerciseId:fact.exerciseId.trim(),subject:fact.subject.trim(),
        ...(intro ? {explainer:first,observer:second} : {reporter:first,recipient:second})};
    }
  } else throw new Error('Unsupported action');
  integer(next.minute, 'world time');
  event = { id: `event-${next.events.length + 1}`, minute: next.minute, type: action.type, detail: interaction ? describeReturnedItem(interaction.item) : action.detail ?? action.activityId ?? action.place ?? '', ...(interaction ? { interaction } : {}), ...(roleFact ? { roleFact } : {}), ...(absenceFact ? { absenceFact } : {}), ...(nonWitnessFact ? { nonWitnessFact } : {}) };
  next.events.push(event);
  if (action.type === 'found_item_returned') {
    const participants = [interaction.actor, interaction.owner].filter(p => p.kind === 'npc').map(p => p.id);
    for (const id of new Set([...participants, ...action.observers])) remember(id, event, participants.includes(id) ? 'participated' : 'observed');
  }
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
