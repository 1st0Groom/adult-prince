import { generateSocialTurn } from './social-turn.js';
import { generateFactAwareTurn } from './fact-answers.js';
import { selectNpcDialogueMemoryResult } from '../simulation/dialogue-memory.js';

// Respect social boundaries before answering factual questions. All state changes
// still come from validated game actions; generated language cannot commit them.
export async function generateNpcTurn({ dialogue, speechState, speechAction, style = 'firm' }, adapters) {
  let factReply;
  const reply = await generateSocialTurn({
    state: speechState, speechAction, style, playerText: dialogue.playerText
  }, {
    selectExpression: adapters.selectExpression,
    freeDialogue: async () => {
      factReply = await generateFactAwareTurn(dialogue, {
        classify: adapters.classifyFact,
        freeDialogue: adapters.freeDialogue
      });
      return factReply.text;
    }
  });
  return { ...reply, mode: factReply?.mode ?? reply.mode, factRoute: factReply?.route ?? null };
}

// Experimental entry point: retrieval comes from the same NPC whose turn is generated.
export async function generateRememberingNpcTurn({ lifeState, dialogue, speechState, speechAction, style = 'firm', memoryOptions = {} }, adapters) {
  if (!dialogue?.npc?.id) throw new Error('NPC ID required');
  const selected = selectNpcDialogueMemoryResult(lifeState, dialogue.npc.id, dialogue.playerText, {
    ...memoryOptions, history: dialogue.history ?? []
  });
  const reply = await generateNpcTurn({
    dialogue: { ...dialogue, memories: selected.memories, memoryResolution: selected.resolution },
    speechState, speechAction, style
  }, adapters);
  return { ...reply, memorySelection: { resolution: selected.resolution, ids: selected.memories.map(memory => memory.id) } };
}
