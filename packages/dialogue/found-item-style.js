// The game constructs all candidates from a verified record. The model may
// select an index only; it cannot supply or modify the text.
export async function selectConfirmedReturnStyle({ view, options, fallback }, selectExpression) {
  if (!view?.npc?.id || !Array.isArray(options) || !options.length || !options.includes(fallback)) throw new Error('Invalid approved expressions');
  const recent = new Set((view.history ?? []).filter(turn => turn.role === 'assistant' && typeof turn.text === 'string').map(turn => turn.text));
  const unused = options.filter(option => !recent.has(option));
  const offered = unused.length ? unused : options;
  const safeFallback = offered.includes(fallback) ? fallback : offered[0];
  const messages=[
    {role:'system',content:'게임 NPC로서 상황과 대화 흐름에 가장 잘 맞는 대사 번호 하나를 고르세요. 반드시 {"index":0} 형태의 JSON만 답하세요. 대사를 새로 쓰지 마세요. options 번호는 0부터 시작합니다.'},
    {role:'user',content:JSON.stringify({context:`너는 ${view.npc.name}이고 상대는 ${view.player?.name}이다. 성격: ${view.personality}. 관계: ${typeof view.relationship==='string'?view.relationship:JSON.stringify(view.relationship)}.`,history:(view.history??[]).map(({role,text})=>({role,text})),player:view.playerText,options:offered})}
  ];
  let index;
  try {
    const result=JSON.parse(await selectExpression(messages));
    if(result && typeof result==='object' && !Array.isArray(result) && Object.keys(result).length===1 && Number.isInteger(result.index) && result.index>=0 && result.index<offered.length) index=result.index;
  } catch {}
  return index===undefined?{text:safeFallback,fallback:true,index:null}:{text:offered[index],fallback:false,index};
}
