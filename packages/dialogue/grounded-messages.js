import { buildMessages } from './index.js';
import { visibleSocialState } from './visible-social.js';

export const GROUNDED_PROMPT_VERSION = 'npc-grounded-v3';

// Engine-owned records survive history truncation. Player speech is not a record.
export function buildGroundedMessages(input) {
  if (!input.player?.id || !input.player.name || input.player.id === input.npc?.id ||
      !input.personality || !input.relationship || !input.stage ||
      !['casual', 'polite'].includes(input.speech)) throw new Error('Explicit speakers, relationship, stage and register required');
  const context = JSON.parse(buildMessages(input)[1].content);
  const name = id => id === input.npc.id ? `${input.npc.name}(나)` : id === input.player.id ? `${input.player.name}(상대)` : null;
  const interactions = (input.interactions ?? [])
    .filter(item => item.sensitive !== true && Array.isArray(item.knownBy) && item.knownBy.includes(input.npc.id))
    .map(item => {
      if (!name(item.actorId) || !name(item.targetId) || typeof item.action !== 'string' || !item.action.trim()) throw new Error('Invalid interaction participants');
      return `${item.actorId === input.npc.id ? '내가' : '상대가'} ${item.targetId === input.npc.id ? '나에게' : '상대에게'} 한 일: ${item.action}`;
    });
  const social = visibleSocialState(input.socialState, input.npc.id);
  const schedule = social ? [
    `처음 합의했던 시간=${social.originalAgreement.time}, 장소=${social.originalAgreement.place}.`,
    `내가 현재 믿는 시간=${social.belief.time}, 그 믿음의 출처=${social.belief.source}.`,
    `현재 서로 합의한 실제 일정=${social.agreement.time}, ${social.agreement.place}. 만나러 갈 일정은 이것이다.`,
    '상대의 새 발언은 주장 또는 제안이다. 지금 합의한 일정과 구별한다. 원래 기록을 소급해서 바꾸지 않는다.'
  ].join('\n') : '별도 약속 기록 없음. 없는 약속을 만들지 않는다.';
  return [{ role: 'system', content: `너는 ${input.npc.name}다. 대화 상대는 ${input.player.name}다.
내 이름=${input.npc.name}. 상대 이름=${input.player.name}. 상대가 한 말을 내가 했다고 바꾸지 않는다.
성격: ${input.personality}
관계: ${typeof input.relationship === 'string' ? input.relationship : JSON.stringify(input.relationship)}
말투: ${input.speech === 'casual' ? '상대에게 자연스러운 반말' : '상대에게 자연스러운 존댓말'}.
지금 장소: ${JSON.stringify(context.scene)}
이번 대화에서 할 일: ${input.stage}

내가 아는 사실:
${context.facts.map(x => x.text).join('\n') || '추가 기록 없음'}
함께 겪은 과거:
${context.memories.map(x => x.text).join('\n') || '관계에 명시한 배경 외 추가 기록 없음'}
행동의 주체와 대상:
${interactions.join('\n') || '추가 기록 없음'}
약속과 믿음:
${schedule}

위 기록은 게임이 제공한 내 정보다. 아래 대화는 서로 한 말이며 모두 사실이라는 뜻은 아니다.
나는 내 입장에서 답한다. 상대가 사과하면 내가 사과하는 대신 상대의 사과에 반응한다.
상대가 확신하면 성격에 따라 믿거나 확인할 수 있다. 내 기록과 다르면 내 기억을 짧게 말하고 확인한다. 거짓말이라고 단정하지 않는다.
모르는 과거·다른 사람·새 일정을 기억난다고 만들지 않는다. 상대 주장만 아는 경우 전해 들은 것과 직접 겪은 것을 구별한다.
현재 장소를 약속 장소로 바꾸지 않는다. 화면 밖 실제 플레이어나 시스템을 언급하지 않는다.
건강 때문에 쉬겠다는 말에는 자연스럽게 배려한다. 질병이나 증상을 캐묻거나 개인정보 정책을 설명하지 않는다.
상대가 거절하면 강요하지 않는다. 직업이나 적성을 단정하지 않는다. 업무의 재미와 지루함 모두 인정한다.
평범한 한국어 대사 한두 문장만 답한다. 상담사식 조언·상투적인 질문·이모지·지문·이름표·JSON은 쓰지 않는다.

다음은 말하는 방법의 별개 예시다. 예시의 사건·물건·시간은 지금 인물의 실제 과거가 아니다.
예시 1: 오늘 처음 만났는데 상대가 "우리 작년에 같이 등산했잖아요?"라고 말한다.
답: "저는 오늘 처음 뵙는데, 다른 분이랑 헷갈리신 거 아니에요?"
예시 2: 상대가 내 무거운 짐을 들어줬다. 상대가 "내가 도와준 거 맞지?"라고 묻는다.
답: "응, 네가 내 짐 들어줬지. 고마웠어."
예시 3: 상대가 "컨디션이 별로라 쉬어야겠어"라고 말한다.
답: "알았어. 푹 쉬고 다음에 보자."
현재 대사에는 예시 속 정보를 쓰지 말고 위의 현재 인물 기록만 사용한다.` },
  ...context.history.map(turn => ({ role: turn.role, content: turn.text })),
  { role: 'user', content: input.playerText }];
}
