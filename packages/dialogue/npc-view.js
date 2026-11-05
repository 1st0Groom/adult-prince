// The dialogue adapter receives only records visible to this NPC. Scene,
// relationship and stage are still trusted, caller-supplied NPC context.
export function createNpcView(input) {
  const id = input.npc?.id;
  if (!id) throw new Error('NPC ID required');
  const audience = Array.isArray(input.scene?.audience) ? input.scene.audience : [];
  const visible = item => item && item.sensitive !== true && Array.isArray(item.knownBy) && item.knownBy.includes(id) &&
    (item.discloseTo === undefined || (Array.isArray(item.discloseTo) && input.player?.id &&
      [input.player.id, ...audience].every(personId => personId === id || item.discloseTo.includes(personId))));
  const pick = (value, keys) => Object.fromEntries(keys.filter(k => value?.[k] !== undefined).map(k => [k, structuredClone(value[k])]));
  const records = (value, keys) => Array.isArray(value) ? value.filter(visible).map(x => pick(x, [...keys, 'knownBy'])) : [];
  const view = pick(input, ['personality', 'relationship', 'speech', 'stage', 'scene', 'playerText', 'firstMeeting', 'confirmedNoSharedPast']);
  view.npc = pick(input.npc, ['id', 'name', 'character']);
  view.player = pick(input.player, ['id', 'name']);
  view.facts = records(input.facts, ['id', 'text']);
  view.memories = records(input.memories, ['id', 'text']);
  view.history = records(input.history, ['role', 'text']).slice(-8);
  view.interactions = records(input.interactions, ['actorId', 'targetId', 'action']);
  view.loans = records(input.loans, ['item', 'lenderId', 'borrowerId', 'holderId']);
  view.allowedChoices = Array.isArray(input.allowedChoices) ? input.allowedChoices.map(x => pick(x, ['id', 'label'])) : [];
  // This observation is current for the scene and supplied by the game.
  if (visible(input.weatherKnowledge)) {
    view.weatherKnowledge = pick(input.weatherKnowledge, ['id', 'temperature']);
  }
  for (const key of ['socialState', 'appointmentKnowledge']) {
    const record = input[key];
    if (visible(record) && record.state) {
      const state = {};
      for (const [field, keys] of [['originalAgreement', ['time', 'place']], ['agreement', ['time', 'place']], ['belief', ['time', 'source', 'confidence']]]) {
        if (record.state[field]) state[field] = pick(record.state[field], keys);
      }
      view[key] = { knownBy: [...record.knownBy], state };
    }
  }
  return view;
}
