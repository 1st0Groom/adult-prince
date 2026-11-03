import { getTrainingContext } from '../simulation/training.js';

// The scene contract owns instructions and consequences. AI selects an expression,
// while separate ordinary dialogue can still be generated between game actions.
const beats = {
  arrival: { core: '안녕하세요. 저는 오늘 체험을 안내할 담당자예요.', warm: ['편하게 인사부터 나눌까요?', '처음 오셨죠? 반가워요.'], dry: ['오셨군요. 먼저 인사하고 시작하죠.', '제가 안내하겠습니다.'] },
  briefing: { core: '오늘은 전원이 차단된 가상 교육용 장비의 상태표를 함께 볼 거예요. 직접 전원을 조작하지 않고 제가 옆에서 안내할게요.', warm: ['천천히 해봐도 괜찮아요.', '처음엔 제가 같이 볼게요.'], dry: ['상태표부터 보죠.', '제 안내에 따라 시작하죠.'] },
  routine: { core: '지금 상태표를 보고 정상인지 주의 표시인지 골라주세요.', warm: ['제가 옆에 있으니 직접 한번 보세요.', '급할 것 없어요. 하나씩 보죠.'], dry: ['표시된 내용대로 판단하면 됩니다.', '첫 번째 항목입니다.'] },
  'routine-repeat': { core: '방금 확인은 맞았어요. 다음 상태표도 정상인지 주의 표시인지 확인해 주세요.', warm: ['이런 확인을 여러 번 반복하는 시간도 있어요.', '비슷한 확인이 이어지죠. 이것도 체험해보세요.'], dry: ['같은 방식으로 다음 항목을 보죠.', '반복 확인도 오늘 체험에 포함돼요.'] },
  retry: { core: '방금 고른 내용이 상태표와 달라요. 표시를 다시 보고 한 번 더 골라보세요.', warm: ['제가 옆에서 같이 볼게요.', '이번엔 조금 천천히 봐요.'], dry: ['아직 다음 항목으로 넘어가지는 않을게요.', '같은 항목을 다시 확인하죠.'] },
  'supervised-review': { core: '같은 체험에서 실수가 네 번 이상 이어졌어요. 다음 항목도 제가 함께 확인하는 방식으로 진행할게요.', warm: ['이걸로 이 일이 안 맞는다고 정하는 건 아니에요.', '놓친 표시부터 같이 짚어보죠.'], dry: ['오늘은 혼자 맡기지 않고 같이 보겠습니다.', '표시를 읽는 기준부터 다시 확인하죠.'] },
  'ask-for-help': { core: '주의 표시를 찾았어요. 직접 수리하지 말고 저에게 알려주세요.', warm: ['지금은 함께 확인하는 단계예요.', '어디에 표시가 있는지 같이 보죠.'], dry: ['이제 제게 확인을 요청하는 단계입니다.', '여기서 혼자 조작하지 않습니다.'] },
  'power-blocked': { core: '지금은 직접 전원을 켜면 안 돼요. 전원이 차단된 교육용 장비를 저와 함께 확인하는 체험이에요.', warm: ['어디서 막혔는지 저에게 말해 주세요.', '제가 옆에서 다시 안내할게요.'], dry: ['전원 조작은 허용되지 않습니다.', '현재 확인하던 항목으로 돌아가죠.'] },
  debrief: { core: '오늘은 반복 확인과 주의 표시를 찾아 함께 확인하는 과정까지 해봤어요. 이 일을 더 경험해보고 싶으세요?', warm: ['재미있었던 부분도 지루했던 부분도 편하게 말해 주세요.', '지루했던 순간이 있어도 솔직하게 말해 주세요.'], dry: ['바로 진로를 정할 필요는 없어요.', '오늘 해본 부분을 기준으로 이야기해 보죠.'] },
  preparation: { core: '더 해보고 싶으시면 다음 교육과 준비 과정을 알아볼 기회를 드릴게요. 지금 채용이 결정된 건 아니에요.', warm: ['오늘 체험을 바탕으로 천천히 알아봐요.', '더 알고 싶은 부분부터 이어가면 돼요.'], dry: ['오늘은 체험을 마치겠습니다.', '준비 과정은 다음 안내에서 다루겠습니다.'] },
  'other-experiences': { core: '아직 모르겠거나 다른 일을 해보고 싶어도 괜찮아요. 오늘 체험은 여기서 마치고 다른 기회도 살펴보세요.', warm: ['한 번 해봤다는 것만으로도 남는 게 있겠죠.', '오늘 바로 결정하지 않아도 돼요.'], dry: ['다음 진로는 직접 선택하시면 됩니다.', '오늘 체험으로 적성을 단정하지 않겠습니다.'] }
};

export function trainingOptions(state, style = 'warm') {
  if (!['warm', 'dry'].includes(style)) throw new Error('Unknown mentor style');
  const context = getTrainingContext(state);
  const beat = beats[context.beat];
  if (!beat) throw new Error('Unknown training beat');
  return beat[style].map(expression => `${beat.core} ${expression}`);
}

export async function generateTrainingReply(state, { style = 'warm', selectExpression }) {
  const options = trainingOptions(state, style);
  const context = getTrainingContext(state);
  const messages = [
    { role: 'system', content: `너는 고등학생의 가상 설비 체험을 안내하는 담당자다. 말투는 ${style === 'warm' ? '따뜻하고 편안함' : '짧고 담백함'}이다. 현재 단계에서 options 중 한 대사를 고른다. 새 지시나 사건을 만들지 않는다. 출력은 {"index":0} 형식 JSON 하나다.` },
    { role: 'user', content: JSON.stringify({ context, options }) }
  ];
  let index;
  let raw;
  try {
    raw = await selectExpression(messages);
    const value = JSON.parse(raw);
    if (Object.keys(value).length === 1) index = value.index;
  } catch {}
  const valid = Number.isInteger(index) && index >= 0 && index < options.length;
  return { text: options[valid ? index : 0], fallback: !valid, raw: raw ?? null,
    messages, context, mode: 'scene-contract' };
}
