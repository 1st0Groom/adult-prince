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
