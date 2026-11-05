import { generateSocialTurn } from './social-turn.js';
import { generateFactAwareTurn } from './fact-answers.js';
import { selectNpcDialogueMemoryResult } from '../simulation/dialogue-memory.js';
import { understandSpeech } from './speech-understanding.js';
import { prepareConfirmedReturn } from './found-item-answer.js';
import { prepareVerifiedReturn } from './verified-return.js';
import { prepareConfirmedExerciseRoles } from './exercise-role-answer.js';
import { prepareConfirmedAbsentEpisode } from './confirmed-absence-answer.js';
import { prepareConfirmedNonWitness } from './confirmed-non-witness-answer.js';
import { selectConfirmedReturnStyle } from './found-item-style.js';
import { createNpcView } from './npc-view.js';
import { objectParticle } from '../simulation/korean-particles.js';

const returnTopic = /돌려\s*(?:준|줬|주었|받)|반환|주워\s*돌려/;

function nextTopic(text) {
  const pivot = text.match(/(?:상관\s*없고|(?:얘기(?:는)?\s*)?됐고|얘기(?:는)?\s*그만하고)[,，]\s*(\S.*)$/s);
  return pivot && returnTopic.test(text.slice(0, pivot.index)) ? pivot[1] : null;
}

// Respect social boundaries before answering factual questions. All state changes
// still come from validated game actions; generated language cannot commit them.
async function generateNpcTurnInternal({ dialogue, speechState, speechAction, style = 'firm' }, adapters, confirmedReturn = null, verifiedReturn = null) {
  const confirmedReturnAnswer = confirmedReturn?.fallback ?? null;
  const confirmedReturnOptions = confirmedReturn?.selectStyle ? confirmedReturn.options : null;
  let factReply;
  let conversationFocus = null;
  const reply = await generateSocialTurn({
    state: speechState, speechAction, style, playerText: dialogue.playerText
  }, {
    selectExpression: adapters.selectExpression,
    freeDialogue: async () => {
      if (verifiedReturn) {
        const { kind, fallback, eventId, finder, owner, recipient } = verifiedReturn;
        const mode = { roles: 'confirmed-return-roles', clarification: 'record-clarification',
          request: 'action-boundary', unknown: 'record-unknown', 'source-unknown': 'record-unknown' }[kind] ?? 'record-answer';
        factReply = { text: fallback, mode, route: { intent: `verified-return-${kind}`, valid: true,
          source: 'game', ...(eventId ? { evidenceId: eventId } : {}) } };
        if (kind === 'roles') {
          factReply.roleRecord = { eventId, finder, owner, recipient };
        }
        if (kind === 'roles' || verifiedReturn.anchorId) {
          conversationFocus = { kind: kind === 'clarification' ? 'return-candidates' : 'found-item',
            eventId: verifiedReturn.anchorId ?? eventId,
            npcId: dialogue.npc.id, playerId: dialogue.player.id };
        }
        return fallback;
      }
      if (confirmedReturnAnswer) {
        const recordStyle = confirmedReturnOptions ? await selectConfirmedReturnStyle({ view:createNpcView(dialogue), options:confirmedReturnOptions, fallback:confirmedReturnAnswer }, adapters.selectExpression) : null;
        const needsClarification = confirmedReturn.kind === 'clarification';
        factReply = { text: recordStyle?.text ?? confirmedReturnAnswer, mode: needsClarification ? 'record-clarification' : 'record-answer', route: { intent: needsClarification ? 'ambiguous-found-item-reference' : confirmedReturn.exerciseId ? 'confirmed-exercise-role' : confirmedReturn.absenceFactId ? 'confirmed-absent-episode' : confirmedReturn.nonWitnessFactId ? 'confirmed-non-witness' : 'confirmed-found-item', valid: true, source: 'game' }, recordStyle };
        if (!needsClarification) conversationFocus = confirmedReturn.exerciseId ? { kind: 'exercise-role', exerciseId: confirmedReturn.exerciseId, npcId: dialogue.npc.id, playerId: dialogue.player.id } : confirmedReturn.absenceFactId ? { kind: 'absent-episode', eventId: confirmedReturn.absenceFactId, npcId: dialogue.npc.id, playerId: dialogue.player.id } : confirmedReturn.nonWitnessFactId ? null : { kind: 'found-item', eventId: confirmedReturn.eventId, npcId: dialogue.npc.id, playerId: dialogue.player.id };
        return factReply.text;
      }
      factReply = await generateFactAwareTurn(dialogue, {
        classify: adapters.classifyFact,
        freeDialogue: adapters.freeDialogue
      });
      return factReply.text;
    }
  });
  return { ...reply, mode: factReply?.mode ?? reply.mode, factRoute: factReply?.route ?? null, conversationFocus, ...(factReply?.recordStyle ? {recordStyle:factReply.recordStyle} : {}), ...(factReply?.roleRecord ? { roleRecord: factReply.roleRecord } : {}) };
}

// Public free-form dialogue entry point cannot inject a pre-approved answer.
export async function generateNpcTurn(input, adapters) {
  return generateNpcTurnInternal(input, adapters);
}

// Experimental entry point: retrieval comes from the same NPC whose turn is generated.
export async function generateRememberingNpcTurn({ lifeState, dialogue, speechState, speechAction, style = 'firm', memoryOptions = {} }, adapters) {
  if (!dialogue?.npc?.id) throw new Error('NPC ID required');
  const pivot = nextTopic(dialogue.playerText);
  if (pivot) {
    dialogue = { ...dialogue, playerText: pivot, history: [],
      facts: dialogue.facts?.filter(fact => !returnTopic.test(fact?.text ?? '')),
      interactions: dialogue.interactions?.filter(item => !returnTopic.test(item?.action ?? '')) };
    memoryOptions = { ...memoryOptions, conversationFocus: null };
  }
  // A caller assertion must not contradict a game-confirmed joint event.
  // Lack of such events does not establish that the two never interacted.
  if (dialogue.confirmedNoSharedPast === true && Array.isArray(lifeState?.events)) {
    const conflicts = lifeState.events.some(event => {
      const interaction = event?.interaction;
      if (interaction?.kind !== 'found_item_returned') return false;
      const parties = [interaction.actor, interaction.owner];
      return parties.some(p => p?.kind === 'player') && parties.some(p => p?.kind === 'npc' && p.id === dialogue.npc.id);
    });
    if (conflicts) throw new Error('Confirmed absence conflicts with a recorded joint event');
  }
  const selected = selectNpcDialogueMemoryResult(lifeState, dialogue.npc.id, dialogue.playerText, {
    ...memoryOptions, history: dialogue.history ?? []
  });
  // Only promote selected, NPC-visible game records involving this conversation's two participants.
  const participantId = p => p?.kind === 'player' ? dialogue.player?.id : p?.kind === 'npc' && p.id === dialogue.npc.id ? dialogue.npc.id : null;
  const renderedMemories = [];
  const rememberedInteractions = selected.memories.flatMap(memory => {
    const item = memory.interaction;
    if (pivot && (item?.kind === 'found_item_returned' || returnTopic.test(memory.text))) return [];
    if (item?.kind !== 'found_item_returned' || !dialogue.player?.id) { renderedMemories.push(memory); return []; }
    const actorId = participantId(item.actor), targetId = participantId(item.owner);
    if (!actorId || !targetId || actorId === targetId || ![actorId, targetId].every(id => [dialogue.npc.id, dialogue.player.id].includes(id))) { renderedMemories.push(memory); return []; }
    const actorName = actorId === dialogue.npc.id ? `${dialogue.npc.name}(나)` : `${dialogue.player.name}(상대)`;
    const ownerName = targetId === dialogue.npc.id ? `${dialogue.npc.name}(나)` : `${dialogue.player.name}(상대)`;
    renderedMemories.push({ ...memory, text: `${memory.text} [행동 주체: ${actorName}; 물건 주인: ${ownerName}]` });
    const ownerPerspective = targetId === dialogue.npc.id ? '내' : '상대의';
    return [{ actorId, targetId, action: `${ownerPerspective} 물건 ‘${item.item}’${objectParticle(item.item)} 주워 주인에게 돌려줌`, knownBy: [dialogue.npc.id] }];
  });
  const confirmed = memoryOptions.confirmedReturn === true ? prepareConfirmedReturn({ lifeState, npc: dialogue.npc, player: dialogue.player, playerText: dialogue.playerText, speech: dialogue.speech, conversationFocus: memoryOptions.conversationFocus }) : null;
  const confirmedExercise = memoryOptions.confirmedExerciseRoles === true ? prepareConfirmedExerciseRoles({ lifeState, npc: dialogue.npc, player: dialogue.player, playerText: dialogue.playerText, speech: dialogue.speech, conversationFocus: memoryOptions.conversationFocus }) : null;
  const confirmedAbsence = memoryOptions.confirmedAbsentEpisode === true ? prepareConfirmedAbsentEpisode({ lifeState, npc: dialogue.npc, player: dialogue.player, playerText: dialogue.playerText, speech: dialogue.speech, conversationFocus: memoryOptions.conversationFocus }) : null;
  const confirmedNonWitness = memoryOptions.confirmedNonWitness === true ? prepareConfirmedNonWitness({ lifeState, npc: dialogue.npc, player: dialogue.player, playerText: dialogue.playerText, speech: dialogue.speech }) : null;
  const verified = confirmedExercise || confirmedAbsence ? null :
    prepareVerifiedReturn({ lifeState, dialogue, conversationFocus: memoryOptions.conversationFocus });
  const reply = await generateNpcTurnInternal({
    dialogue: { ...dialogue, interactions: [...(dialogue.interactions ?? []), ...rememberedInteractions], memories: renderedMemories, memoryResolution: selected.resolution },
    speechState, speechAction, style
  }, adapters, confirmedExercise ?? confirmedAbsence ?? confirmedNonWitness ?? (confirmed ? { ...confirmed, selectStyle: memoryOptions.confirmedReturnStyle === true } : null), verified);
  return { ...reply, memorySelection: { resolution: selected.resolution, ids: selected.memories.map(memory => memory.id) } };
}

// Experimental text entry point. The classifier suggests a type; game rules
// still determine the reaction. Invalid output never records an incident.
export async function generateNpcTurnFromText({ lifeState, dialogue, speechState, casualAgreed = false, formality = 'strict', style = 'firm', memoryOptions = {} }, adapters) {
  const understanding = await understandSpeech(dialogue.playerText, adapters.classifySpeech);
  const reply = await generateRememberingNpcTurn({ lifeState, dialogue, speechState,
    speechAction: { kind: understanding.kind, casualAgreed, formality }, style, memoryOptions }, adapters);
  // Classifier results are not verified game actions. Expose the tentative
  // state for inspection, but do not commit incidents or apologies silently.
  return { ...reply, proposedSpeechState: reply.state, state: structuredClone(speechState), speechImpactCommitted: false, speechUnderstanding: understanding };
}
