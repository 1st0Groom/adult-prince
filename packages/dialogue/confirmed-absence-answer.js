import {getNpcContext} from '../simulation/index.js';
import {objectParticle} from '../simulation/korean-particles.js';

// Opt-in answer for a game-confirmed missing joint episode, not missing memories.
export function prepareConfirmedAbsentEpisode({lifeState,npc,player,playerText,speech,conversationFocus=null}) {
  if (!npc?.id || !player?.id || npc.id===player.id || typeof player.name!=='string' || !player.name.trim() ||
      !['casual','polite'].includes(speech) || typeof playerText!=='string' ||
      !Number.isSafeInteger(lifeState?.minute) || lifeState.minute<0) return null;
  const text=playerText.replace(/\s+/g,'').replace(/[?.!,]/g,'');
  const shared=/(우리|같이|함께|너랑|저랑)/.test(text);
  const past=/(작년|지난|전에|기억나|갔잖아|다녀왔)/.test(text);
  const travel=/(갔|다녀왔|여행|탔)/.test(text);
  const focused=conversationFocus?.kind==='absent-episode' && conversationFocus.npcId===npc.id &&
    conversationFocus.playerId===player.id && typeof conversationFocus.eventId==='string' &&
    ['내말이맞다니까너도아까같이갔다고했잖아','너도아까같이갔다고했잖아'].includes(text);
  if (!focused && !(shared && past && travel)) return null;
  const memories=getNpcContext(lifeState,npc.id).memories;
  const matches=memories.filter(memory=>{
    const fact=memory.absenceFact;
    if (fact?.kind!=='not_shared_trip' || fact.npcId!==npc.id ||
        !Number.isSafeInteger(memory.minute) || memory.minute<0 || memory.minute>lifeState.minute) return false;
    if (focused) return memory.eventId===conversationFocus.eventId;
    const period=fact.timePhrase.replace(/\s+/g,'');
    // Korean topic marking can turn '작년 가을에' into '작년 가을엔'.
    const periodMatches=!period || text.includes(period) ||
      (period.endsWith('에') && text.includes(period.slice(0,-1)+'엔'));
    return text.includes(fact.place.replace(/\s+/g,'')) && periodMatches;
  });
  if (matches.length!==1) return null;
  const memory=matches[0], fact=memory.absenceFact;
  // A second visible confirmation for the same place makes the reference unclear.
  if (memories.some(m=>m.eventId!==memory.eventId && m.absenceFact?.kind==='not_shared_trip' &&
      m.absenceFact.npcId===npc.id && m.absenceFact.place===fact.place)) return null;
  const riding=/(배|기차|버스|비행기)$/.test(fact.place);
  const politeEpisode=riding ? `${fact.place}${objectParticle(fact.place)} 함께 탄 적이 없어요.` : `${fact.place}에 함께 간 적이 없어요.`;
  const casualEpisode=riding ? `${fact.place}${objectParticle(fact.place)} 같이 탄 적 없어.` : `${fact.place}에 같이 간 적 없어.`;
  const fallback=focused
    ? speech==='polite'
      ? riding ? '아까도 함께 탄 적이 없다고 말씀드렸어요.' : '아까도 함께 간 적이 없다고 말씀드렸어요.'
      : riding ? '아까도 같이 탄 적 없다고 했어.' : '아까도 같이 간 적 없다고 했어.'
    : speech==='polite'
      ? `저는 ${player.name} 님과 ${fact.timePhrase ? fact.timePhrase+' ' : ''}${politeEpisode}`
      : `난 너랑 ${fact.timePhrase ? fact.timePhrase+' ' : ''}${casualEpisode}`;
  return {kind:'answer',fallback,absenceFactId:memory.eventId};
}
