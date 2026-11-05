import { getFirstPlayContext } from '../simulation/first-play.js';
import { createSpeechState } from '../simulation/speech-policy.js';
import { buildGroundedMessages } from './grounded-messages.js';
import { generateNpcTurnFromText } from './npc-turn.js';
import { generateTrainingReply } from './training-response.js';

export async function generateFirstPlayReply(state, { playerText = '', selectExpression, freeDialogue } = {}) {
  const context = getFirstPlayContext(state);
  if (context.training && context.place === 'training-center') {
    return generateTrainingReply(state.training, { selectExpression });
  }
  if (context.appointment && (!playerText.trim() || /예약|일정|약속|달력/.test(playerText))) {
    const { originalAgreement, agreement, belief } = state.social;
    const day = Math.floor(context.appointment.at / 1440) + 1;
    const confirmed = `확정 일정은 ${day}일차 ${agreement.time}, ${agreement.place}예요.`;
    const original = /처음|원래/.test(playerText) ? `처음 정한 시간은 ${originalAgreement.time}이었어요. ` : '';
    const claim = belief.source === 'player-calendar-claim'
      ? `달력에서 ${belief.time}을 봤다는 말씀은 들었어요. ` : '';
    return { text: original + claim + confirmed, mode: 'appointment-record' };
  }
  if (context.invitation === 'offered') {
    return { text: '교육장에서 가상 설비 상태표를 같이 보는 체험이 있어요. 가능한 시간을 골라도 되고, 나중에 결정해도 돼요.', mode: 'invitation' };
  }
  if (freeDialogue && playerText.trim()) {
    return generateNpcTurnFromText({ lifeState: state.life, speechState: createSpeechState(), dialogue: {
      npc: { id: 'friend', name: '민서' }, player: { id: 'player', name: '나' },
      speech: 'polite', playerText, personality: '편안하고 솔직하다.', relationship: '학교 친구',
      stage: '체험에 관심을 보이면 안내하고 선택을 존중한다.',
    } }, {
      classifySpeech: async () => '{"index":0}',
      classifyFact: async () => '{"index":0}',
      freeDialogue: view => freeDialogue(buildGroundedMessages(view)),
    });
  }
  return { text: '체험이 궁금해지면 이야기해요.', mode: 'ordinary' };
}
