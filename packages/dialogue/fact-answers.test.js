import test from 'node:test';
import assert from 'node:assert/strict';
import { renderFactAnswer, parseFactRoute, routeFactHint, generateFactAwareTurn } from './fact-answers.js';
const input = () => ({ npc: { id: 'n', name: '유나' }, player: { id: 'p', name: '민수' }, speech: 'casual', playerText: '누가 빌렸지?', loans: [{ lenderId: 'p', borrowerId: 'n', holderId: 'n', item: '우산', knownBy: ['n'] }] });
test('Loan holder, owner and borrower are distinct; direction is engine-owned', () => {
  const value = input();
  assert.match(renderFactAnswer(value, 'loan-origin'), /내가 너한테 우산을 빌렸어/);
  assert.match(renderFactAnswer(value, 'loan-holder'), /지금 내가 가지고 있어/);
  value.loans[0].lenderId = 'n'; value.loans[0].borrowerId = 'p'; value.loans[0].holderId = 'p';
  assert.match(renderFactAnswer(value, 'loan-origin'), /빌려줬어/);
  assert.match(renderFactAnswer(value, 'loan-holder'), /지금 네가 가지고 있어/);
});
test('Invisible, sensitive or ambiguous records cannot become an answer', () => {
  for (const change of [{knownBy:['other']},{sensitive:true}]) {
    const value=input(); Object.assign(value.loans[0],change);
    assert.equal(renderFactAnswer(value,'loan-holder'),null);
  }
  const value=input();value.loans.push(structuredClone(value.loans[0]));
  assert.equal(renderFactAnswer(value,'loan-origin'),null);
});
test('Classifier text cannot override facts, or reschedule an appointment', async () => {
  assert.deepEqual(parseFactRoute('{"index":2,"text":"상대에게 있어"}'), {intent:'other',valid:false});
  const value=input();value.playerText='그거 어디 있더라?';const before=structuredClone(value);
  const reply=await generateFactAwareTurn(value,{classify:async()=>'{"index":2}',freeDialogue:async()=>{throw new Error('wrong route');}});
  assert.match(reply.text,/내가 가지고/);assert.deepEqual(value,before);
  const fallback=await generateFactAwareTurn(value,{classify:async()=>{throw new Error('offline');},freeDialogue:async()=> '다시 말해줄래?'});
  assert.equal(fallback.mode,'free-dialogue');assert.equal(fallback.route.valid,false);
});
test('Time belief never replaces an agreement and source identifiers stay out of dialogue', () => {
  const value=input();
  value.appointmentKnowledge={knownBy:['n'],state:{originalAgreement:{time:'17:00',place:'도서관 입구'},agreement:{time:'18:00',place:'도서관 입구'},belief:{time:'19:00',source:'player-calendar-claim'}}};
  const text=renderFactAnswer(value,'current-agreement');
  assert.match(text,/18:00.*도서관 입구/);assert.equal(text.includes('19:00'),false);
  const memory=renderFactAnswer(value,'original-vs-belief');
  assert.match(memory,/17:00.*달력.*19:00/);assert.equal(memory.includes('player-calendar-claim'),false);
  value.appointmentKnowledge.knownBy=['other'];assert.equal(renderFactAnswer(value,'current-agreement'),null);
});
test('Requests and current-clock questions cannot be silently treated as established appointments', () => {
  for(const text of ['장소만 바꾸자','내일 저녁 어때?','그거 돌려줘','빌려주세요','지금 몇 시야?']) assert.equal(routeFactHint(text).intent,'other');
  assert.equal(routeFactHint('누구랑 같이 있어?'),null);
  assert.equal(routeFactHint('그 우산은 누구한테 있어?').intent,'loan-holder');
});
test('Clear rule route bypasses the model; unfamiliar conversation still uses normal dialogue', async () => {
  const value=input();value.playerText='그 우산은 누구한테 있어?';
  const reply=await generateFactAwareTurn(value,{classify:async()=>{throw new Error('must not call');},freeDialogue:async()=>{throw new Error('must not call');}});
  assert.equal(reply.route.source,'rule');assert.match(reply.text,/내가 가지고/);
  value.playerText='농구 좋아해?';
  const normal=await generateFactAwareTurn(value,{classify:async()=>'{"index":0}',freeDialogue:async()=> '응, 좋아해.'});
  assert.equal(normal.mode,'free-dialogue');assert.equal(normal.text,'응, 좋아해.');
});
test('Rendered loan grammar respects 받침 and a stranger does not acquire shared history', () => {
  const value=input();value.loans[0].item='충전기';value.speech='polite';
  assert.match(renderFactAnswer(value,'loan-origin'),/충전기를/);
  assert.match(renderFactAnswer(value,'loan-holder'),/충전기는/);
  value.firstMeeting=true;value.playerText='지난주 우리 같이 만났잖아요, 기억나요?';assert.match(renderFactAnswer(value,'claimed-shared-past'),/처음 뵙는데/);
  value.firstMeeting=false;assert.equal(renderFactAnswer(value,'claimed-shared-past'),null);
});
test('A wrongly classified apology or work impression does not trigger a fabricated correction', async () => {
  for (const playerText of ['내가 착각했나 봐요. 처음 뵙겠습니다.', '반복해서 보는 건 지루했는데 이상한 부분 찾는 건 재밌었어요.']) {
    const value={...input(),firstMeeting:true,playerText};
    const result=await generateFactAwareTurn(value,{classify:async()=>'{"index":5}',freeDialogue:async()=> '그렇구나.'});
    assert.equal(result.mode,'free-dialogue');assert.equal(result.text,'그렇구나.');
  }
});
