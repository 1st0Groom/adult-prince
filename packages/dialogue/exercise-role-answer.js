import { getNpcContext } from '../simulation/index.js';

// A narrow opt-in route for roles that the game recorded as structured events.
// The caller must have committed the event through applyAction; dialogue cannot do so.
export function prepareConfirmedExerciseRoles({lifeState, npc, player, playerText, speech, conversationFocus = null}) {
  if (!npc?.id || !player?.id || npc.id === player.id || typeof player?.name !== 'string' || !player.name.trim() ||
      !Number.isSafeInteger(lifeState?.minute) || lifeState.minute < 0 ||
      !['casual', 'polite'].includes(speech) || typeof playerText !== 'string') return null;
  const text = playerText.replace(/\s+/g, '').replace(/[?.!,]/g, '');
  const initialQuestion = text.includes('설명한사람') && text.includes('살펴본사람') && text.includes('가상');
  const findingQuestion = text.includes('처음찾아서') && text.includes('알려준사람') && text.includes('들은사람') && text.includes('가상');
  if (!initialQuestion && !findingQuestion) return null;
  const memories = getNpcContext(lifeState, npc.id).memories;
  const kind = findingQuestion ? 'exercise_finding' : 'exercise_intro';
  const matches = memories.filter(m => m.roleFact?.kind === kind &&
    (text.includes(m.roleFact.subject.replace(/\s+/g, '')) ||
     (findingQuestion && text.includes('그가상과제') && conversationFocus?.kind === 'exercise-role' && conversationFocus.exerciseId === m.roleFact.exerciseId &&
      conversationFocus.npcId === npc.id && conversationFocus.playerId === player.id)));
  if (matches.length !== 1) return null;
  const memory = matches[0], fact = memory.roleFact;
  if (!Number.isSafeInteger(memory.minute) || memory.minute < 0 || memory.minute > lifeState.minute) return null;
  const daysAgo = Math.floor(lifeState.minute / 1440) - Math.floor(memory.minute / 1440);
  if ((text.includes('어제') && daysAgo !== 1) || (text.includes('오늘') && daysAgo !== 0)) return null;
  // An incomplete or conflicting same-exercise record must not be silently resolved.
  if (memories.some(m => m.eventId !== memory.eventId && m.roleFact?.kind === kind && m.roleFact.exerciseId === fact.exerciseId)) return null;
  const person = value => value?.kind === 'player' ? 'player' : value?.kind === 'npc' && value.id === npc.id ? 'npc' : null;
  const a = person(findingQuestion ? fact.reporter : fact.explainer);
  const b = person(findingQuestion ? fact.recipient : fact.observer);
  if (!a || !b || a === b) return null;
  let fallback;
  if (findingQuestion) {
    fallback = speech === 'polite'
      ? a === 'npc' ? `제가 먼저 찾아 ${player.name} 님께 알려드렸어요.` : `${player.name} 님이 먼저 찾아 제게 알려주셨어요.`
      : a === 'npc' ? '내가 먼저 찾아 네게 알려줬어.' : '네가 먼저 찾아 내게 알려줬어.';
  } else {
    fallback = speech === 'polite'
      ? a === 'npc' ? `제가 설명했고, ${player.name} 님이 살펴보셨어요.` : `${player.name} 님이 설명해 주셨고, 제가 살펴봤어요.`
      : a === 'npc' ? '내가 설명했고, 네가 살펴봤어.' : '네가 설명했고, 내가 살펴봤어.';
  }
  return {kind:'answer', fallback, exerciseId:fact.exerciseId, eventId:memory.eventId};
}
