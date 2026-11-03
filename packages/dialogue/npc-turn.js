import { generateSocialTurn } from './social-turn.js';
import { generateFactAwareTurn } from './fact-answers.js';

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
