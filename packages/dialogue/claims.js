export function compareClaim(npcId, claim, records) {
  if (!npcId || !claim || typeof claim.key !== 'string' || !['string','number','boolean'].includes(typeof claim.value) || !Array.isArray(records)) throw new Error('Invalid claim');
  const visible=records.filter(x=>x.key===claim.key && x.sensitive!==true && Array.isArray(x.knownBy) && x.knownBy.includes(npcId));
  if (!visible.length) return {status:'unknown'};
  if (new Set(visible.map(x=>JSON.stringify(x.value))).size!==1) return {status:'ambiguous'};
  const record=visible[0];
  if (Object.is(record.value,claim.value)) return {status:'consistent'};
  return {status:'conflict',evidence:record.text,evidenceId:record.id};
}
