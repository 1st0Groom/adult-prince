// Select 을/를 for a Hangul item name. Non-Hangul endings use the existing 를 fallback.
export function objectParticle(word) {
  if (typeof word !== 'string' || !word.trim()) throw new Error('Item name required');
  const last = Array.from(word.trim()).at(-1).codePointAt(0);
  return last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 ? '을' : '를';
}


export function describeReturnedItem(item) {
  return `물건 ${item}${objectParticle(item)} 주워 주인에게 돌려줌`;
}
