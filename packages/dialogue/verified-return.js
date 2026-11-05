import { getNpcContext } from '../simulation/index.js';
import { objectParticle } from '../simulation/korean-particles.js';
import { createNpcView } from './npc-view.js';

const compact = text => text.normalize('NFC').replace(/[\s?!.,]/g, '');
const pastReturn = /돌려(?:준|줬|주었|드린|받)|건네(?:준|줬|주었)|건넸|건넨|반환(?:한|했)|돌아(?:왔|갔)/;
const roleQuestion = /누가|누구|어느분손|(?:돌려준|건넨|건네준|받은|반환한)(?:사람|분)|주인(?:과|하고|이누구)/;
const ownershipClaim = /(?:제|내).+(?:거(?:맞)?(?:죠|지|야)|거였나요|건가요)/;
const differentTask = /내일|모레|다음에|지난주|작년|만약|돌려주세요|주워주세요|찾아주세요|돌려줘$|주워줘$|찾아줘$/;
const sourceQuestion = /(?:라고|다고|다는).*(?:말|들었|했어|했나요|했죠|전했|알려줬)|누구(?:한테|에게)(?:서)?들|어디서(?:들|알)|어떻게알|직접(?:봤|보셨)/;
const asksForSpeaker = /누가.*(?:다고|라고)(?:말했|했|전했|알려줬)|(?:다고|라고).*(?:말한사람|말한분|누가(?:말했|그랬))|다는.*누구입|주장한(?:사람|분)/;
const quoteRecord = /^(?:\[(?<id>[^\]]+)\]\s*)?발화 기록\((?:(?:내용은 )?확인되지 않은|미확인) 주장\)\. (?<speaker>[^"\n]+?)[이가] [^"\n]+?에게 "(?<words>[^"\n]+)"라고 말(?:했다\.|했고,)/;
const genericReturn = /^(?:(?:그거|그걸|그물건(?:을|은)?)?누가|누가(?:그거|그걸|그물건(?:을|은)?))돌려(?:줬|준)(?:어|어요|나요|죠|거야|거지|사람이야)$|^(?:그걸|그물건을)?(?:돌려)?받은(?:사람|분)(?:은|이)?누구/;
const listenerPossessive = /^(?:누가)?(?:제|내)물건(?:을|은|이)?(?:누가)?(?:찾아서|주워서)?돌려/;
const focusedOwnership = /^(?:그물건(?:은)?|그건)원래누구(?:거|것)이?였(?:어|어요|죠|나요)$/;
const sourceTopic = /^(?:그\s+)?(.+?)\s+(?:일(?:은|을)?|건(?:은|을)?|얘기(?:는|를)?|얘긴|반환(?:은|을)?)[, ]+(.+)$/s;
const asksForSource = /어떤경로로|어디서(?:알|들|확인)|어떻게아(?:셨|셨어|시게|는|는지)|(?:직접|현장에서)(?:봤|보셨|보신)|(?:남|누구)(?:에게|한테)(?:서)?들은/;
const unrelatedTurn = /돌려(?:줬|주었)든|상관없|가져가면|놓도록|가져다주세|반환해(?:줘|주세요)|돌려줘요$/;
const asksToMove = /(?:놓|옮기|가져가|가져다놓)도록해(?:줘|주세요)$|(?:가져다|옮겨|갖다|돌려|반환해)(?:줘|줘요|주세요)$/;
const relativeDate = /어제|하루전|오늘|당일/;
const ordinal = /먼저|처음|첫번째|나중|두번째|마지막/;
const contextualRole = /^(?:돌려)?받은(?:사람|분|쪽)|(?:원래)?주인(?:이|은)?누구|^(?:그|제|내)(?:거|걸|물건|반환)/;

function subject(name) {
  const point = name.codePointAt(name.length - 1);
  return name + (point >= 0xac00 && point <= 0xd7a3 && (point - 0xac00) % 28 ? '이' : '가');
}

function refersTo(question, item) {
  if (typeof item !== 'string' || !/[\p{L}\p{N}]/u.test(item)) return false;
  const words = item.normalize('NFC').trim().split(/\s+/).map(RegExp.escape).join('\\s*');
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:그|이|제|내)?${words}(?=$|[^\\p{L}\\p{N}]|(?:이|가|을|를|은|는|도|의|만|에|말|얘기)(?=$|[^\\p{L}\\p{N}]))`, 'u').test(question.normalize('NFC'));
}

function visibleQuotes(dialogue) {
  return createNpcView(dialogue).facts.flatMap(fact => {
    const quote = fact.text?.match(quoteRecord)?.groups;
    return quote && fact.id && (!quote.id || quote.id === fact.id) ? [{ ...quote, id: fact.id }] : [];
  });
}

function prepareSourceAnswer({ lifeState, dialogue }) {
  const [, topic, question] = dialogue.playerText.trim().match(sourceTopic) ?? [];
  if (!topic || !asksForSource.test(compact(question))) return null;
  const { npc, player, speech } = dialogue;
  const polite = speech === 'polite';
  const memories = getNpcContext(lifeState, npc.id).memories;
  const observed = memories.filter(memory =>
    ['observed', 'participated', 'experienced'].includes(memory.channel) &&
    !memory.nonWitnessFact &&
    (memory.interaction?.kind === 'found_item_returned'
      ? compact(memory.interaction.item) === compact(topic)
      : memory.type === 'important_event' && !/발화 기록|소문|들었다|라고 말|다는 말/.test(memory.detail) &&
        refersTo(memory.detail, topic)));
  const clarification = { kind: 'clarification', fallback: polite ? '어느 때의 일을 말씀하시나요?' : '어느 때의 일 말이야?' };
  if (observed.length > 1) return clarification;
  if (observed.length === 1) {
    return { kind: 'source-observed', eventId: observed[0].eventId,
      fallback: polite ? '제가 그 장면을 직접 봤어요.' : '내가 그 장면을 직접 봤어.' };
  }
  const heard = visibleQuotes(dialogue).filter(quote => quote.speaker !== npc.name && refersTo(quote.words, topic));
  if (new Set(heard.map(quote => quote.speaker)).size > 1) return clarification;
  if (heard.length) {
    const { speaker, id } = heard[0];
    return { kind: 'source-heard', eventId: id, fallback: polite ? `${speaker} 님한테 들었어요.`
      : speaker === player.name ? '네가 알려줬어.' : `${speaker}한테 들었어.` };
  }
  const unseen = memories.find(memory => memory.nonWitnessFact?.npcId === npc.id &&
    compact(memory.nonWitnessFact.subject) === compact(topic));
  if (unseen) {
    return { kind: 'source-unseen', eventId: unseen.eventId,
      fallback: polite ? '그 장면은 제가 직접 보지 못했어요.' : '그 장면은 내가 못 봤어.' };
  }
  return { kind: 'source-unknown', fallback: polite ? '그 일은 제가 확인한 정보가 없어서 모르겠어요.'
    : '그 일은 내가 아는 내용이 없어서 모르겠어.' };
}

function resolveSpeaker(dialogue, question, polite, anchor, visibleReturns) {
  // Historical utterance facts have an ID and a distinct quoted payload.
  // Attribute only the statement. Its payload is not evidence of a return.
  const item = question.match(/누가\s+(.+?)[을를]\s+(?:주워서\s+|찾아서\s+)?(?:돌려|건네)/)?.[1];
  const generic = /^누가돌려줬다고(?:말했|했)/.test(compact(question));
  const topic = item ?? anchor?.interaction.item;
  const quotes = visibleQuotes(dialogue).filter(quote => pastReturn.test(compact(quote.words)) &&
    (topic ? refersTo(quote.words, topic) : generic));
  const sameItemRepeated = topic && visibleReturns.filter(memory => compact(memory.interaction.item) === compact(topic)).length > 1;
  if (quotes.length > 1 || (quotes.length && sameItemRepeated)) return {
    kind: 'clarification', anchorId: anchor?.eventId,
    fallback: polite ? '어느 때 들으신 말을 뜻하시나요?' : '어느 때 들은 말이야?',
  };
  if (!quotes.length) return { kind: 'unknown', fallback: polite ? '그 말을 누가 했는지는 확인할 수 없어요.' : '그 말을 누가 했는지는 확인이 안 돼.' };
  const [{ speaker, id }] = quotes;
  const who = speaker === dialogue.npc.name ? (polite ? '제가' : '내가')
    : speaker === dialogue.player.name && !polite ? '네가' : polite ? `${speaker} 님이` : subject(speaker);
  return { kind: 'speaker', eventId: id, anchorId: anchor?.eventId,
    fallback: `${who} 그렇게 ${polite ? '말했어요.' : '말했어.'}` };
}

function clarifyReturn(matches, polite, today) {
  const item = matches[0]?.interaction.item;
  if (matches.length < 2 || !matches.every(memory => memory.interaction.item === item)) {
    return { kind: 'clarification', fallback: polite ? '어느 물건을 언제 돌려받은 일을 말씀하시는 건가요?'
      : '어느 물건을 언제 돌려받은 일 말이야?' };
  }
  const days = new Set(matches.map(memory => Math.floor(memory.minute / 1440)));
  const contrast = days.size === 2 && days.has(today) && days.has(today - 1)
    ? '어제 일과 오늘 일' : '먼저 있었던 일과 나중에 있었던 일';
  const fallback = matches.length > 2
    ? (polite ? '여러 번 돌려받았는데, 몇 번째 일을 말씀하시나요?' : '여러 번 돌려받았는데, 몇 번째 일 말이야?')
    : (polite ? `${contrast} 중 어느 쪽을 말씀하시나요?` : `${contrast} 중 어느 쪽이야?`);
  return { kind: 'clarification', anchorId: matches[0].eventId, fallback };
}

export function prepareVerifiedReturn({ lifeState, dialogue, conversationFocus }) {
  const { npc, player, scene, playerText, speech } = dialogue;
  if (!npc?.id || !player?.id || npc.id === player.id || !['casual', 'polite'].includes(speech)) return null;
  const question = playerText.trim().split(/(?<=[.!?。！？])\s+/).at(-1);
  const text = compact(question);
  const polite = speech === 'polite';
  if (asksToMove.test(text)) {
    const namedReturn = getNpcContext(lifeState, npc.id).memories.some(memory => {
      const item = memory.interaction?.kind === 'found_item_returned' && memory.interaction.item;
      const lastWord = item && item.split(/\s+/).at(-1);
      return item && (refersTo(question, item) || (lastWord.length >= 2 && refersTo(question, lastWord)));
    });
    if (namedReturn) return { kind: 'request', fallback: polite
      ? '게임에서 물건을 직접 옮겨 주세요.' : '게임에서 물건을 직접 옮겨 줘.' };
  }
  if (differentTask.test(text) || unrelatedTurn.test(text)) return null;
  const source = prepareSourceAnswer({ lifeState, dialogue });
  if (source) return source;
  const pending = conversationFocus?.kind === 'return-candidates';
  const focusedId = (pending || conversationFocus?.kind === 'found-item') &&
    conversationFocus.npcId === npc.id && conversationFocus.playerId === player.id ? conversationFocus.eventId : null;
  const today = Math.floor(lifeState.minute / 1440);
  const visibleReturns = getNpcContext(lifeState, npc.id).memories.filter(memory =>
    memory.interaction?.kind === 'found_item_returned' && ['participated', 'observed'].includes(memory.channel) &&
    /[\p{L}\p{N}]/u.test(memory.interaction.item ?? '') &&
    Number.isSafeInteger(memory.minute) && memory.minute >= 0 && memory.minute <= lifeState.minute);
  const anchor = visibleReturns.find(memory => memory.eventId === focusedId);
  if (asksForSpeaker.test(text) && (pastReturn.test(text) || /반환/.test(text))) {
    return pending && anchor ? clarifyReturn(visibleReturns.filter(memory => memory.interaction.item === anchor.interaction.item), polite, today)
      : resolveSpeaker(dialogue, question, polite, anchor, visibleReturns);
  }
  const ownerFollowup = focusedOwnership.test(text);
  const listenerItem = listenerPossessive.test(text);
  const shortSelection = (relativeDate.test(text) || ordinal.test(text)) &&
    /건이요|것은요|일을묻|반환|돌려준쪽|처음것|받은쪽|그때/.test(text);
  const contextQuery = !!anchor && (shortSelection || (contextualRole.test(text) &&
    (roleQuestion.test(text) || (pastReturn.test(text) && ownershipClaim.test(text)))));
  if (sourceQuestion.test(text) || (!ownerFollowup && !contextQuery &&
      (!pastReturn.test(text) || (!roleQuestion.test(text) && !ownershipClaim.test(text))))) return null;
  const generic = genericReturn.test(text) || ownerFollowup || listenerItem || contextQuery;
  const fullText = compact(playerText);
  const day = /어제|하루전/.test(fullText) ? today - 1 : /오늘|당일/.test(fullText) ? today : null;
  const dated = visibleReturns.filter(memory => day === null || Math.floor(memory.minute / 1440) === day);
  let named = visibleReturns.filter(memory => refersTo(question, memory.interaction.item));
  if (!named.length) named = visibleReturns.filter(memory => refersTo(playerText, memory.interaction.item));
  let matches = dated.filter(memory => named.includes(memory));
  if (!named.length && anchor && generic) {
    matches = !pending && day === null && !ordinal.test(text) ? dated.filter(memory => memory.eventId === focusedId)
      : dated.filter(memory => memory.interaction.item === anchor.interaction.item);
  }
  if (matches.length > 1 && ordinal.test(text) && !(matches.length > 2 && text.includes('나중'))) {
    matches = [text.includes('두번째') ? matches[1] : /나중|마지막/.test(text) ? matches.at(-1) : matches[0]];
  }
  if (listenerItem && !matches.length) {
    matches = dated.filter(memory => memory.interaction.owner.kind === 'player');
  }
  if (matches.length > 1 || (generic && !listenerItem && !matches.length && !anchor && !named.length && dated.length)) {
    return clarifyReturn(matches, polite, today);
  }
  const unknown = { kind: 'unknown', fallback: polite ? '그 반환은 제가 아는 기록으로 확인하기 어려워요.' : '그 반환은 내가 아는 기록으로 확인하기 어려워.' };
  if (!matches.length) return unknown;

  const { eventId, interaction } = matches[0];
  const idOf = person => person.kind === 'player' ? player.id : person.id;
  const finder = idOf(interaction.actor), owner = idOf(interaction.owner);
  const names = new Map((scene?.present ?? []).map(person => [person.id, person.name]));
  names.set(npc.id, npc.name);
  names.set(player.id, player.name);
  const canName = id => id === npc.id || (!polite && id === player.id) ||
    (typeof names.get(id) === 'string' && names.get(id).trim());
  const actor = !canName(finder) ? null : finder === npc.id ? (polite ? '제가' : '내가')
    : !polite && finder === player.id ? '네가' : polite ? `${names.get(finder)} 님이` : subject(names.get(finder));
  const whose = !canName(owner) ? null : owner === npc.id ? (polite ? '제' : '내')
    : !polite && owner === player.id ? '네' : polite ? `${names.get(owner)} 님의` : `${names.get(owner)}의`;
  const recipient = owner === npc.id ? (polite ? '제게' : '나한테')
    : !polite && owner === player.id ? '너한테' : polite ? `${names.get(owner)} 님께` : `${names.get(owner)}한테`;
  const returned = polite ? (finder === npc.id ? '돌려드렸어요.' : '돌려줬어요.') : '돌려줬어.';
  const { item } = interaction;
  if (!actor || !whose) {
    if (whose) return { kind: 'unknown', eventId, fallback: polite
      ? `${whose} 물건이었고 ${recipient} 돌아왔어요. 찾아준 분의 이름은 확인하기 어려워요.`
      : `${whose} 물건이었고 ${recipient} 돌아왔어. 찾아준 사람의 이름은 확인하기 어려워.` };
    if (actor && !ownerFollowup) return { kind: 'unknown', eventId, fallback: polite
      ? `${actor} ${item}${objectParticle(item)} 찾아서 ${returned} 주인의 이름은 확인하기 어려워요.`
      : `${actor} ${item}${objectParticle(item)} 찾아서 ${returned} 주인의 이름은 확인하기 어려워.` };
    return unknown;
  }
  const fallback = ownerFollowup ? `${whose} ${polite ? '것이었어요.' : '거였어.'}`
    : `${actor} ${whose} ${item}${objectParticle(item)} 찾아서 ${recipient} ${returned}`;
  return { kind: 'roles', eventId, finder, owner, recipient: owner, fallback };
}
