// Social knowledge belongs to specific observers; callers must supply a tagged record.
export function visibleSocialState(record, npcId) {
  if (!record || record.sensitive === true || !Array.isArray(record.knownBy) || !record.knownBy.includes(npcId)) return null;
  return record.state ?? null;
}
