// A fictional training-board exercise, not a real machine maintenance procedure.
const readings = ['normal', 'normal', 'attention'];
export function createTraining() {
  return { version: 1, phase: 'arrival', inspected: 0, mistakes: 0, needsSupervision: false,
    outcome: null, beat: 'arrival', events: [] };
}

export function applyTrainingAction(state, action) {
  if (!action || typeof action.type !== 'string') throw new Error('Invalid training action');
  const next = structuredClone(state);
  if (next.phase === 'finished') throw new Error('Training already finished');
  if (action.type === 'talk') {
    // Conversation alone never completes a task or persists arbitrary personal text.
    return next;
  }
  if (action.type === 'attempt-power') {
    next.beat = 'power-blocked';
  } else if (next.phase === 'arrival' && action.type === 'greet') {
    next.phase = 'briefing'; next.beat = 'briefing';
  } else if (next.phase === 'briefing' && action.type === 'accept-briefing') {
    next.phase = 'routine'; next.beat = 'routine';
  } else if (next.phase === 'routine' && action.type === 'inspect') {
    if (!['normal', 'attention'].includes(action.report)) throw new Error('Invalid observation');
    if (action.report !== readings[next.inspected]) {
      next.mistakes += 1;
      next.needsSupervision = next.mistakes > 3;
      next.beat = next.needsSupervision ? 'supervised-review' : 'retry';
    } else {
      next.inspected += 1;
      next.phase = next.inspected === readings.length ? 'collaboration' : 'routine';
      next.beat = next.phase === 'collaboration' ? 'ask-for-help' : 'routine-repeat';
    }
  } else if (next.phase === 'collaboration' && action.type === 'ask-mentor') {
    next.phase = 'debrief'; next.beat = 'debrief';
  } else if (next.phase === 'debrief' && action.type === 'reflect') {
    if (!['continue', 'unsure', 'decline'].includes(action.interest)) throw new Error('Invalid reflection');
    next.phase = 'finished';
    next.outcome = action.interest === 'continue' ? 'preparation-opportunity' : 'other-experiences';
    next.beat = action.interest === 'continue' ? 'preparation' : 'other-experiences';
  } else throw new Error(`Action not available in ${next.phase}`);
  next.events.push({ type: action.type, ...(action.report ? { report: action.report } : {}),
    ...(action.interest ? { interest: action.interest } : {}), phase: next.phase, beat: next.beat });
  return next;
}

export function getTrainingContext(state) {
  const choices = {
    arrival: ['greet'], briefing: ['accept-briefing'], routine: ['inspect'],
    collaboration: ['ask-mentor'], debrief: ['reflect'], finished: []
  };
  return { phase: state.phase, beat: state.beat, inspected: state.inspected,
    visibleReading: state.phase === 'routine' ? readings[state.inspected] : null,
    mistakes: state.mistakes, needsSupervision: state.needsSupervision,
    choices: [...choices[state.phase]], mayOperatePower: false, outcome: state.outcome };
}
