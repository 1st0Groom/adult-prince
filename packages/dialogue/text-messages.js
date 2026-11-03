import { buildMessages } from './index.js';
import { NPC_GUIDELINES } from './guidelines.js';
export const TEXT_PROMPT_VERSION = 'npc-text-relationship-v4';
export function buildTextMessages(input, claimCheck = null) {
  const context = JSON.parse(buildMessages(input)[1].content);
  if (!input.relationship || typeof input.relationship.kind !== 'string' || !input.player?.name) throw new Error('Explicit relationship and player name required');
  const policy = { conflict: 'evidence에 적힌 네 기억을 1인칭으로 짧게 밝히고 필요하면 확인해. 상대를 거짓말쟁이라고 단정하지 마. 성격과 근거에 따라 상대를 믿을 수 있지만 원래 사건 기록은 바꾸지 마.', consistent: '상대 발언이 네 기록과 일치한다. 상황에 맞게 동의하거나 감사해. 괜히 의심하거나 확인 질문을 반복하지 마.', unknown: '이 주장은 네가 아는 기록으로 확인할 수 없다. 거짓이라고 단정하지 말고 상대가 말한 것으로 받아들여 대화해. 네 경험이나 함께한 과거를 새로 만들지 마.', ambiguous: '기록 자체가 불명확하다. 확정 판정 없이 필요한 내용을 물어봐.' };
  const checks = claimCheck ? `\n게임 규칙이 확인한 발언 비교: ${JSON.stringify(claimCheck)}\n${policy[claimCheck.status] ?? '확정 판정 없이 대화해.'}` : '';
  return [{role:'system',content:`${NPC_GUIDELINES}

너는 한국어 생활 게임의 ${context.npc.name}다. 상대 이름은 ${input.player.name}다. ${context.npc.character}
현재 장면: ${JSON.stringify(context.scene)}
관계와 확정된 공유 배경: ${JSON.stringify(input.relationship)}
NPC 관점의 실제 사건: ${context.memories.map(x=>x.text).join(' / ') || '공유 배경 외 추가 사건 기록 없음'}
알고 있는 사실: ${context.facts.map(x=>x.text).join(' / ') || '추가 사실 없음'}
관계의 speech에 맞는 말투로 짧게 한두 문장만 답해. 확정된 공유 배경과 실제 사건은 기억하고 활용해. 배경 외 사건 기록이 없다는 것은 친한 사이 자체를 부정하라는 뜻이 아니다. 처음 만난 상대의 주장을 믿을 수 있지만 기록에 없는 과거를 직접 기억한다고 말하지 마. 상대의 주장과 확정된 사건이 다르면 설정 범위에서 자연스럽게 반응해. 기록에 없는 과거를 확인된 사건으로 창작하지 마. 제공된 사건의 행동 주체와 대상을 바꾸지 마. 질병명·증상을 캐묻지 마. 돈·직업·시간을 바꾸지 마. 설명·이름표·JSON 없이 대사만 말해.${checks}`},...context.history.map(turn=>({role:turn.role,content:turn.text})),{role:'user',content:input.playerText}];
}
