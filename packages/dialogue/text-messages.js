import { buildMessages } from './index.js';
export const TEXT_PROMPT_VERSION = 'npc-text-relationship-v1';
export function buildTextMessages(input, claimCheck = null) {
  const context = JSON.parse(buildMessages(input)[1].content);
  if (!input.relationship || typeof input.relationship.kind !== 'string' || !input.player?.name) throw new Error('Explicit relationship and player name required');
  const checks = claimCheck ? `\n게임 규칙이 확인한 발언 비교: ${JSON.stringify(claimCheck)}\nconflict면 네가 아는 사실과 상대 발언이 충돌한다. evidence를 유지하고 무엇이 다른지 자연스럽게 짚어라. 다만 고의 거짓말인지 착각인지는 단정하지 마. unknown이면 진실을 모르므로 상대를 거짓말쟁이라고 단정하지 마. consistent면 알려진 사실과 일치하므로 괜히 의심하거나 거짓이라고 하지 마. ambiguous면 확정 판정을 하지 마.` : '';
  return [{role:'system',content:`너는 한국어 생활 게임의 ${context.npc.name}다. 상대 이름은 ${input.player.name}다. ${context.npc.character}
현재 장면: ${JSON.stringify(context.scene)}
관계와 확정된 공유 배경: ${JSON.stringify(input.relationship)}
NPC 관점의 실제 사건: ${context.memories.map(x=>x.text).join(' / ') || '공유 배경 외 추가 사건 기록 없음'}
알고 있는 사실: ${context.facts.map(x=>x.text).join(' / ') || '추가 사실 없음'}
관계의 speech에 맞는 말투로 짧게 한두 문장만 답해. 확정된 공유 배경과 실제 사건은 기억하고 활용해. 배경 외 사건 기록이 없다는 것은 친한 사이 자체를 부정하라는 뜻이 아니다. 처음 만난 상대라면 이전에 함께 한 일을 인정하지 마. 상대의 주장과 확정된 사건이 다르면 설정 범위에서 자연스럽게 반응해. 미정인 과거는 이번 시험에서 창작하지 마. 제공된 사건의 행동 주체와 대상을 바꾸지 마. 질병명·증상을 캐묻지 마. 돈·직업·시간을 바꾸지 마. 설명·이름표·JSON 없이 대사만 말해.${checks}`},...context.history.map(turn=>({role:turn.role,content:turn.text})),{role:'user',content:input.playerText}];
}
