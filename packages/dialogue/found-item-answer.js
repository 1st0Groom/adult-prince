import { getNpcContext } from '../simulation/index.js';

// Opt-in experiment: answer only a narrow, explicitly named past-item query.
// Records are game-owned; this never extracts or commits events from speech.
export function prepareConfirmedReturn({ lifeState, npc, player, playerText, speech, conversationFocus = null }) {
  if (!npc?.id || !player?.id || npc.id === player.id || !['casual', 'polite'].includes(speech) || typeof playerText !== 'string' || !Number.isSafeInteger(lifeState?.minute) || lifeState.minute < 0 || (speech === 'polite' && (typeof player.name !== 'string' || !player.name.trim()))) return null;
  const text = playerText.replace(/\s+/g, '');
  const normalized = text.replace(/[?.!,]/g, '');
  // Follow-ups are accepted only against a focus returned from a prior game-record answer.
  const followups = new Map([
    ['그물건은원래누구거였어', 'owner'], ['그물건원래누구거였어', 'owner'],
    ['그물건은누구거였어', 'owner'], ['그건원래누구거였어', 'owner'],
    ['누가주웠더라', 'actor'], ['그걸누가주워줬어', 'actor'],
    ['그걸누가주웠어', 'actor'], ['누가그걸주웠어', 'actor'],
    ['그때내가왜그랬는지알아', 'player-motive'], ['그때내가왜그랬을까', 'player-motive']
  ]);
  const followup = followups.get(normalized) ?? null;
  if (followup) {
    if (conversationFocus?.kind !== 'found-item' || conversationFocus.npcId !== npc.id || conversationFocus.playerId !== player.id || typeof conversationFocus.eventId !== 'string') return null;
  } else if (!/(기억나|기억해|주워|주운|주웠|찾아줬|돌려준|돌려줬|돌려드린)/.test(text) || /기분|느낌|왜|어떻게|어디|언제|몇시|빌려|돌려줘|주워줘|찾아줘|다시|만약|내일|다음|지난주|작년/.test(text)) return null;
  const memories = getNpcContext(lifeState, npc.id).memories;
  const matching = memories.filter(memory => {
    const i = memory.interaction;
    if (i?.kind !== 'found_item_returned' || typeof i.item !== 'string' || !i.item.trim()) return false;
    const fullItem = i.item.replace(/\s+/g, '');
    const shortItem = i.item.trim().split(/\s+/).at(-1);
    if (followup ? memory.eventId !== conversationFocus.eventId :
      !text.includes(fullItem) && (shortItem.length < 2 || !text.includes(shortItem))) return false;
    const id = p => p?.kind === 'player' ? player.id : p?.kind === 'npc' && p.id === npc.id ? npc.id : null;
    const actor = id(i.actor), owner = id(i.owner);
    return actor && owner && actor !== owner && [actor, owner].every(x => [npc.id, player.id].includes(x));
  });
  // Check all visible memories, not just a truncated retrieval subset.
  if (matching.length !== 1) return null;
  const selectedItem = matching[0].interaction.item.replace(/\s+/g, '');
  const lastWord = matching[0].interaction.item.trim().split(/\s+/).at(-1);
  const itemText = !followup && !text.includes(selectedItem) ? lastWord : selectedItem;
  // A separate visible event mentioning the same reference makes it ambiguous.
  if (memories.some(memory => memory.eventId !== matching[0].eventId && typeof memory.detail === 'string' && memory.detail.replace(/\s+/g, '').includes(itemText))) return null;
  const allowed = new Set();
  for (const prefix of ['', '어제', '오늘']) {
    for (const suffix of [`${itemText}얘기기억나`, `${itemText}이야기기억나`, `${itemText}주운거기억나`, `${itemText}을주운거기억나`, `${itemText}를주운거기억나`, `누가누구${itemText}을주운거였지`, `누가누구${itemText}를주운거였지`, `누가${itemText}을주웠어`, `누가${itemText}를주웠어`, `누가${itemText}을주웠어요`, `누가${itemText}를주웠어요`, `네가내${itemText}을주워줬잖아`, `네가내${itemText}를주워줬잖아`]) allowed.add(prefix + suffix);
    for (const particle of ['을', '를']) {
      for (const ending of ['주워줬던거지', '주워줬지', '주워줬잖아', '찾아줬던거지', '찾아줬지']) {
        allowed.add(prefix + `내${itemText}${particle}네가${ending}`);
        allowed.add(prefix + `네가내${itemText}${particle}${ending}`);
        allowed.add(prefix + `내가네${itemText}${particle}${ending}`);
      }
    }
  }
  // Natural explicit past questions are admitted only after a unique, visible
  // player/NPC record has been selected. Keep third-party and vague references
  // on the free-dialogue path.
  const ownerQuestion = ['이', '제가', '내가'].some(prefix =>
    ['물건인가요', '물건맞나요', '물건이야'].some(ending =>
      normalized === prefix + itemText + '주워왔는데' + npc.name + '님' + ending ||
      normalized === prefix + itemText + '주워왔는데' + ending));
  const returnQuestion = ['', '어제', '오늘'].some(prefix =>
    ['', '그'].some(reference => ['죠', '지'].some(ending =>
      normalized === prefix + reference + itemText + '누가누구물건을돌려준거였' + ending)));
  const returnClaim = ['', '을', '를'].some(particle =>
    ['거야', '거지'].some(ending =>
      normalized === '내' + itemText + particle + '네가찾아서돌려준' + ending));
  // Admit explicit item and participant wording seen in natural player questions.
  // A full or unique short item reference identifies one NPC-visible game event above.
  const naturalRoleQuestion =
    normalized === `이${itemText}주웠어요${npc.name}님것맞나요` ||
    normalized === `이${itemText}네가주워서내게돌려준거지` ||
    ['', '어제', '오늘'].some(prefix => ['을', '를'].some(particle =>
      normalized === `${prefix}${itemText}${particle}찾아돌려준건누구였죠`)) ||
    ['은', '는'].some(topic =>
      normalized === `그${itemText}${topic}네가찾아서내게돌려준거맞지` ||
      normalized === `아까${itemText}${topic}원래누구것이었고누가돌려줬죠` ||
      normalized === `어제${itemText}${topic}누가찾아누구에게돌려줬나요`) ||
    ['을', '를'].some(particle =>
      normalized === `제가${itemText}${particle}찾아서${npc.name}님께돌려드린거였죠`);
  // Older templates require the full recorded item name. Short references
  // are admitted only by the explicit natural-role templates above.
  const fullItemTemplate = text.includes(selectedItem) &&
    (allowed.has(normalized) || ownerQuestion || returnQuestion || returnClaim);
  // A handover announcement can acknowledge an already recorded return.
  // Keep it distinct from requests, future promises alone and past questions.
  const handover = matching[0].interaction.actor.kind === 'player' &&
    ['을', '를'].some(particle =>
      normalized === `여기네${selectedItem}${particle}내가주워왔어돌려줄게` ||
      normalized === `여기${npc.name}님${selectedItem}${particle}제가주워왔어요돌려드릴게요` ||
      normalized === `${npc.name}아여기네${selectedItem}${particle}내가주워왔어돌려줄게` ||
      normalized === `${npc.name}야여기네${selectedItem}${particle}내가주워왔어돌려줄게`);
  if (!followup && !fullItemTemplate && !naturalRoleQuestion && !handover) return null;
  const memory = matching[0], eventDay = Math.floor(memory.minute / 1440), today = Math.floor(lifeState.minute / 1440);
  if (!Number.isSafeInteger(memory.minute) || memory.minute < 0 || memory.minute > lifeState.minute || (/어제/.test(text) && today - eventDay !== 1) || (/오늘/.test(text) && today !== eventDay)) return null;
  if (handover) {
    if (eventDay !== today || playerText.includes('?')) return null;
    const fallback = speech === 'polite'
      ? `제 ${memory.interaction.item} 찾아주셔서 고마워요.`
      : `내 ${memory.interaction.item} 찾아줬구나. 고마워.`;
    return { fallback, options: [fallback], eventId: memory.eventId };
  }
  // A vague reference to a past conversation is not proof that such a
  // conversation occurred, even if the game has a related item event.
  const ambiguousConversation = ['', '어제', '오늘'].some(prefix =>
    normalized === prefix + `${itemText}얘기기억나` ||
    normalized === prefix + `${itemText}이야기기억나`
  );
  if (!followup && ambiguousConversation) {
    const options = speech === 'polite'
      ? [`${itemText} 이야기요? 어떤 이야기인지 조금 더 알려주시겠어요?`,
         `${itemText}에 관해 어떤 이야기를 하시는 건가요?`]
      : [`${itemText} 얘기? 어떤 얘기인지 조금 더 말해 줄래?`,
         `${itemText}에 관해 어떤 얘기를 하는 거야?`];
    return { kind: 'clarification', fallback: options[0], options };
  }
  const i = memory.interaction, actorIsPlayer = i.actor.kind === 'player';
  if (followup === 'player-motive') {
    if (!actorIsPlayer) return null;
    const options = speech === 'polite'
      ? ['그때 어떤 마음이셨는지는 제가 확실히 알기 어려워요.', '그건 제게 말씀해 주시지 않으면 잘 모르겠어요.']
      : ['네 마음은 나도 확실히는 몰라.', '그건 네가 말해주지 않으면 잘 모르겠어.'];
    return { fallback: options[0], options, eventId: memory.eventId };
  }
  if (followup === 'owner') {
    const options = speech === 'polite'
      ? actorIsPlayer ? ['제 것이었어요.', '그 물건은 제 거예요.'] : [`${player.name} 님 것이었어요.`, `그 물건은 ${player.name} 님 거예요.`]
      : actorIsPlayer ? ['내 거였어.', '그건 내 물건이었어.'] : ['네 거였어.', '그건 네 물건이었어.'];
    return { fallback: options[0], options, eventId: memory.eventId };
  }
  const last = i.item.codePointAt(i.item.length - 1);
  const object = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 ? '을' : '를';
  const topic = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 ? '은' : '는';
  const whoQuestion = followup === 'actor' || normalized.includes('누가');
  const recallQuestion = normalized.includes('기억나');
  const claim = !whoQuestion && !recallQuestion;
  let fallback, options;
  const playerClaimsPlayerActed = normalized.includes('내가네' + itemText);
  const claimAgrees = playerClaimsPlayerActed ? actorIsPlayer : !actorIsPlayer;
  if (speech === 'polite') {
    if (actorIsPlayer) {
      fallback = `제 ${i.item}${topic} ${player.name} 님이 주워주셨어요.`;
      options = [fallback, `제 기억에는 ${player.name} 님이 제 ${i.item}${object} 주워주셨어요.`, `${player.name} 님이 제 ${i.item}${object} 주워주신 걸로 기억해요.`];
    } else {
      fallback = `제 기억에는 제가 ${player.name} 님의 ${i.item}${object} 주워드렸어요.`;
      options = [fallback, `제가 ${player.name} 님의 ${i.item}${object} 주워드렸어요.`, `${player.name} 님의 ${i.item}${object} 제가 주워드린 걸로 기억해요.`];
    }
  } else if (actorIsPlayer) {
    fallback = whoQuestion ? `네가 내 ${i.item}${object} 주워줬어.` : recallQuestion ? `응, 네가 내 ${i.item}${object} 주워줬어.` : `내 기억엔 네가 내 ${i.item}${object} 주워줬어.`;
    options = claim
      ? [fallback, `${claimAgrees ? '맞아' : '아니'}, 네가 내 ${i.item}${object} 주워줬어.`, `내 ${i.item}${topic} 네가 주워준 거야.`]
      : [fallback, `내 ${i.item}${topic} 네가 주워줬어.`, `내 기억엔 네가 내 ${i.item}${object} 주워줬어.`];
  } else {
    fallback = whoQuestion ? `내가 네 ${i.item}${object} 주워줬어.` : recallQuestion ? `응, 내가 네 ${i.item}${object} 주워줬어.` : `내 기억엔 내가 네 ${i.item}${object} 주워줬어.`;
    options = claim
      ? [fallback, `${claimAgrees ? '맞아' : '아니'}, 내가 네 ${i.item}${object} 주워줬어.`, `내가 네 ${i.item}${object} 주워준 거야.`]
      : [fallback, `네 ${i.item}${topic} 내가 주워줬어.`, `내 기억엔 내가 네 ${i.item}${object} 주워줬어.`];
  }
  // Present reactions such as thanks do not add a new past event.
  // The neutral fallback remains available for characters who would not say it.
  if (actorIsPlayer) {
    options.push(speech === 'polite'
      ? `${player.name} 님이 제 ${i.item}${object} 주워주셨어요. 고마워요.`
      : `네가 내 ${i.item}${object} 주워줬어. 고마워.`);
  } else {
    options.push(speech === 'polite'
      ? `제가 ${player.name} 님의 ${i.item}${object} 주워드렸어요. 별일 아니에요.`
      : `내가 네 ${i.item}${object} 주워줬어. 별일 아니야.`);
  }
  return { fallback, options: [...new Set(options)], eventId: memory.eventId };
}

export function answerConfirmedReturn(input) {
  return prepareConfirmedReturn(input)?.fallback ?? null;
}
