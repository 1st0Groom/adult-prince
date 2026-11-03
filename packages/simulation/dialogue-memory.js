import { getNpcContext } from './index.js';

// Convert the chosen NPC's saved event records, not the global event log.
export function npcDialogueMemories(state, npcId) {
  return getNpcContext(state, npcId).memories.map(memory => ({
    id: memory.eventId,
    text: `${memory.channel === 'experienced' ? '내가 직접 한 일' : memory.channel === 'observed' ? '내가 본 일' : '내가 합의한 일'}: ${memory.detail}`,
    knownBy: [npcId]
  }));
}
