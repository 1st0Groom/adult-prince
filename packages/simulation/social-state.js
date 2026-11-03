// Typed game actions supply these updates; dialogue prose is never parsed as authority.
export function createSocialState() {
 return { originalAgreement: { time: '16:00', place: '공원 입구' }, agreement: { time: '16:00', place: '공원 입구' }, belief: { time: '16:00', source: 'original-agreement', confidence: 'high' }, history: [] };
}
export function updateSocialState(state, action) {
 const next = structuredClone(state);
 if (action.type === 'believe-player') {
  if (!action.source || !/^([01]\d|2[0-3]):[0-5]\d$/.test(action.time)) throw new Error('Invalid belief');
  next.belief = { time: action.time, source: action.source, confidence: 'tentative' };
 } else if (action.type === 'agree') {
  if (action.playerAccepted !== true || action.npcAccepted !== true || !/^([01]\d|2[0-3]):[0-5]\d$/.test(action.time) || !action.place) throw new Error('Mutual agreement required');
  next.agreement = { time: action.time, place: action.place };
  next.belief = { time: action.time, source: 'new-mutual-agreement', confidence: 'high' };
 } else throw new Error('Unsupported social action');
 next.history.push(structuredClone(action));
 return next;
}
