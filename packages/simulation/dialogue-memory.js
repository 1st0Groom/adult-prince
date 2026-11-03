import { getNpcContext } from './index.js';

// Convert the chosen NPC's saved event records, not the global event log.
export function npcDialogueMemories(state, npcId) {
  return getNpcContext(state, npcId).memories.map(memory => {
    if (!Number.isSafeInteger(memory.minute) || memory.minute < 0 || memory.minute > state.minute) throw new Error('Invalid memory time');
    const days = Math.floor(state.minute / 1440) - Math.floor(memory.minute / 1440);
    const when = days === 0 ? '오늘' : days === 1 ? '어제' : `${days}일 전`;
    const time = `${String(Math.floor((memory.minute % 1440) / 60)).padStart(2, '0')}:${String(memory.minute % 60).padStart(2, '0')}`;
    const kind = memory.channel === 'experienced' ? '내가 직접 한 일' : memory.channel === 'observed' ? '내가 본 일' : '내가 합의한 일';
    return { id: memory.eventId, text: `${when} ${time}에 ${kind}: ${memory.detail}`, knownBy: [npcId] };
  });
}

// A bounded, opt-in retrieval view; saved records remain untouched.
// This lexical first pass is intentionally not presented as semantic search.
export function selectNpcDialogueMemories(state, npcId, playerText, { limit = 8, recent = 2, history = [] } = {}) {
  if (typeof playerText !== 'string' || !Array.isArray(history) || !Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(recent) || recent < 0 || recent > limit) throw new Error('Invalid memory selection');
  const memories = npcDialogueMemories(state, npcId);
  const saved = getNpcContext(state, npcId).memories;
  const tokenize = text => [...new Set((text.toLowerCase().match(/[가-힣a-z0-9]+/g) ?? [])
    .map(word => word.replace(/(에서|에게|한테|으로|은|는|이|가|을|를|에|과|와|도|만|의)$/, ''))
    .filter(word => word.length >= 2))];
  const terms = tokenize(playerText);
  const isReference = /그거|그것|그걸|그곳|거기|그때/.test(playerText);
  const context = isReference ? history.slice(-2).filter(turn => turn && turn.sensitive !== true && Array.isArray(turn.knownBy) && turn.knownBy.includes(npcId) && ['user','assistant'].includes(turn.role) && typeof turn.text === 'string') : [];
  const contextTerms = tokenize(context.map(turn => turn.text).join(' '));
  const selected = new Set();
  for (let i = Math.max(0, memories.length - recent); i < memories.length; i++) selected.add(i);
  // Time labels such as "오늘" occur in every rendered record; they are not
  // evidence that an event matches the user's topic.
  const candidates = memories.map((memory, index) => ({ index, score: 2 * terms.filter(term => saved[index].detail.toLowerCase().includes(term)).length + contextTerms.filter(term => saved[index].detail.toLowerCase().includes(term)).length }));
  candidates.sort((a, b) => b.score - a.score || b.index - a.index);
  for (const candidate of candidates) {
    if (selected.size >= limit) break;
    selected.add(candidate.index);
  }
  return [...selected].sort((a, b) => a - b).map(index => memories[index]);
}
