import {getNpcContext} from '../simulation/index.js';

// Opt-in: the game explicitly confirmed this NPC did not witness a named event.
// A missing memory or a player's claim alone cannot create this fact.
export function prepareConfirmedNonWitness({lifeState,npc,player,playerText,speech}) {
  if (!npc?.id || !player?.id || npc.id===player.id ||
      !['casual','polite'].includes(speech) || typeof playerText!=='string' ||
      !Number.isSafeInteger(lifeState?.minute) || lifeState.minute<0 || !Array.isArray(lifeState.events)) return null;
  const text=playerText.replace(/\s+/g,'').replace(/[?.!,]/g,'');
  const witness=text.match(/네가직접봤|너도직접봤|너도그자리에있었|너도옆에있었/);
  if (!witness || (playerText.match(/\?/g)?.length??0)>1) return null;
  const memories=getNpcContext(lifeState,npc.id).memories;
  const matches=memories.filter(memory=>{
    const fact=memory.nonWitnessFact;
    if (fact?.kind!=='not_witnessed' || fact.npcId!==npc.id ||
        typeof fact.sourceEventId!=='string' || typeof fact.subject!=='string' ||
        !fact.subject.trim() || !Number.isSafeInteger(memory.minute) ||
        memory.minute<0 || memory.minute>lifeState.minute) return false;
    const full=fact.subject.replace(/\s+/g,''),short=fact.subject.trim().split(/\s+/).at(-1);
    const reference=text.includes(full)?full:short.length>=2&&text.includes(short)?short:null;
    if (!reference) return false;
    const referenceEnd=text.lastIndexOf(reference)+reference.length;
    if (referenceEnd>witness.index || /(말고|아니|됐고|그보다)/.test(text.slice(referenceEnd,witness.index))) return false;
    const source=lifeState.events?.find(e=>e.id===fact.sourceEventId);
    if (!source || !['found_item_returned','important_event'].includes(source.type) ||
        !Number.isSafeInteger(source.minute) || source.minute<0 || source.minute>memory.minute ||
        typeof source.detail!=='string' || !source.detail.replace(/\s+/g,'').includes(full) ||
        memories.some(m=>m.eventId===source.id)) return false;
    const day=Math.floor(source.minute/1440),today=Math.floor(lifeState.minute/1440);
    return (!text.includes('오늘') || day===today) &&
      (!text.includes('어제') || today-day===1) &&
      (!text.includes('아까') || day===today);
  });
  if (matches.length!==1) return null;
  const subject=matches[0].nonWitnessFact.subject.trim().split(/\s+/).at(-1);
  // Any other visible event mentioning the same short reference makes it unclear.
  if (memories.some(m=>m.eventId!==matches[0].eventId &&
      typeof m.detail==='string' && m.detail.replace(/\s+/g,'').includes(subject))) return null;
  const fallback=speech==='polite'?'그 일은 제가 직접 보지 못했어요.':'그 일은 내가 직접 보지 못했어.';
  return {kind:'answer',fallback,nonWitnessFactId:matches[0].eventId};
}
