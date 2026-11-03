// Intent is supplied by a validated game action, not inferred from arbitrary prose.
export function createSpeechState() { return { incidents: 0, apologyAccepted: false }; }
export function resolveSpeech(state, { kind, casualAgreed = false, formality = 'strict' }) {
 if (!['neutral','casual','rude','insult','apology'].includes(kind)) throw new Error('Unknown speech intent');
 if (!['strict','relaxed'].includes(formality)) throw new Error('Unknown formality');
 const next = structuredClone(state);
 let reaction = 'continue';
 if (kind === 'rude' || kind === 'insult') {
  next.incidents += 1; next.apologyAccepted = false;
  reaction = next.incidents > 1 ? 'repeat-boundary' : 'boundary';
 } else if (kind === 'apology' && next.incidents > 0) {
  next.apologyAccepted = true; reaction = 'accept-apology';
 } else if (kind === 'casual' && !casualAgreed && formality === 'strict') reaction = 'request-register';
 return { state: next, reaction };
}
