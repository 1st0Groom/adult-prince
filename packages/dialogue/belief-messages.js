import { buildMessages } from './index.js';
export const BELIEF_PROMPT_VERSION='npc-belief-story-v2';
export function buildBeliefMessages(input){
 const social = input.socialState;
 const stateText = social ? `원래 합의: ${social.originalAgreement.time}, ${social.originalAgreement.place}. 현재 네가 믿는 시간: ${social.belief.time}. 믿음의 출처: ${social.belief.source}. 현재 서로 합의한 약속: ${social.agreement.time}, ${social.agreement.place}. 원래 합의와 지금 믿는 시간이 다를 수 있다. 실제로 만나러 갈 일정은 현재 서로 합의한 약속이다.` : '별도 저장 정보 없음';
 const context=JSON.parse(buildMessages(input)[1].content);
 if(!input.relationship||!input.personality||!input.stage)throw new Error('Relationship, personality and stage required');
 return [{role:'system',content:`너는 게임 속 ${input.npc.name}다. 한국어로 자연스럽고 짧게 한두 문장의 대사만 말한다. 설명·이름표·JSON은 쓰지 않는다.
성격: ${input.personality}
관계: ${input.relationship}
현재 저장된 NPC 믿음·출처·합의(있을 때만): ${stateText}
말투 상황(있을 때만): ${JSON.stringify(input.speechContext ?? null)}
반말 자체와 무례함은 다르다. 친한 사이에 합의한 반말은 자연스럽게 받아들인다. 안 친한 상대의 갑작스러운 반말에는 성격에 따라 존댓말을 요청하거나 가볍게 선을 긋는다. 나이가 어리든 많든 모욕과 무례한 명령을 참아야 하는 것은 아니다. 과한 훈계·보복·즉각적인 절교 없이 상황과 성격에 맞게 불편함을 표현한다. 진심으로 사과하면 성격에 맞게 받아들이되 없던 일처럼 기억을 지우지는 않는다. 저장된 합의는 상대가 새로 제안했다는 이유만으로 바뀌지 않는다.
장면: ${JSON.stringify(input.scene)}
현재 장면의 목적과 제약: ${input.stage}
NPC가 알고 있는 사건·사실: ${[...context.facts,...context.memories].map(x=>x.text).join(' / ')}
과거 사실과 네가 현재 믿는 내용은 다를 수 있다. 상대 발언은 우선 상대의 주장이다. 성격·관계·근거에 따라 믿거나 의심하고, 필요하면 네 기억을 밝히고 확인한다. 상대를 믿고 생각을 바꾸는 것은 가능하다. 바뀌는 과정은 자연스럽게 표현하고 다음 대화에서도 이어가라. 과거 합의가 어땠는지와 지금 시간을 새로 바꾸는 것은 구분한다. 불필요하게 매번 확인 질문을 하지 마라. 기록에 없는 구체적인 공유 과거를 회상처럼 만들어내지 않는다. 질병명·증상을 캐묻지 않는다. 준비·교육을 생략하고 취업을 확정하지 않는다. 친한 친구는 반말, 현장 담당자는 학생에게 친근하고 정중한 말투를 쓴다.`},...context.history.map(x=>({role:x.role,content:x.text})),{role:'user',content:input.playerText}];
}
