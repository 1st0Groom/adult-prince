import { randomUUID } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { applyFirstPlayAction, createFirstPlay, getFirstPlayContext } from '../packages/simulation/first-play.js';
import { generateFirstPlayReply } from '../packages/dialogue/first-play.js';

const savePath = resolve(process.argv[2] ?? 'first-play-save.json');
const places = { home: '집', school: '학교', 'training-center': '교육장' };
const action = (type, fields) => ({ type, ...fields });
const commands = new Map([
  ['체험', () => action('ask-about-experience')],
  ['보류', () => action('defer')],
  ['거절', () => action('decline')],
  ['오전', () => action('confirm-slot', { slot: 'morning' })],
  ['오후', () => action('confirm-slot', { slot: 'afternoon' })],
  ['달력', time => action('report-calendar', { time })],
  ['취소', () => action('cancel')],
  ['이동', place => action('move', { place: Object.keys(places).find(key => places[key] === place) })],
  ['대기', minutes => action('wait', { minutes: Number(minutes) })],
  ['시간맞추기', (_, state) => action('wait', { minutes: (getFirstPlayContext(state).appointment?.at ?? 0) - state.life.minute })],
  ['입장', () => action('enter-training')],
  ['인사', () => task('greet')],
  ['안내확인', () => task('accept-briefing')],
  ['정상', () => task('inspect', { report: 'normal' })],
  ['주의', () => task('inspect', { report: 'attention' })],
  ['담당자', () => task('ask-mentor')],
  ['전원', () => task('attempt-power')],
  ['더하기', () => task('reflect', { interest: 'continue' })],
  ['고민', () => task('reflect', { interest: 'unsure' })],
  ['다른체험', () => task('reflect', { interest: 'decline' })],
]);

function task(type, fields) {
  return action('training-action', { action: action(type, fields) });
}

function display(state) {
  const { place, slots, appointment, training } = getFirstPlayContext(state);
  const minute = state.life.minute % 1440;
  const time = [Math.floor(minute / 60), minute % 60].map(n => String(n).padStart(2, '0')).join(':');
  console.log(`[${Math.floor(state.life.minute / 1440) + 1}일차 ${time} · ${places[place]}]`);
  if (slots.length && !appointment) console.log('예약 가능한 시간', slots.map(slot => slot.time).join(', '));
  if (training?.visibleReading) console.log('상태표', training.visibleReading === 'normal' ? '정상' : '주의');
  if (training?.outcome) console.log('체험 결과', training.outcome === 'preparation-opportunity' ? '다음 준비 기회' : '다른 체험 탐색');
}

function help() {
  console.log('체험 · 오전 · 오후 · 보류 · 거절 · 달력 17:00 · 취소');
  console.log('이동 집/학교/교육장 · 대기 분 · 시간맞추기 · 입장');
  console.log('인사 · 안내확인 · 정상 · 주의 · 담당자 · 더하기 · 고민 · 다른체험');
  console.log('대화 내용 · 상태 · 저장 · 불러오기 · 종료');
}

let state = createFirstPlay();
console.log('어른왕자 | 첫 체험');
help();
display(state);
const input = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
for await (const line of input) {
  const [word, ...rest] = line.trim().split(/\s+/);
  if (!word) continue;
  const value = rest.join(' ');
  try {
    if (word === '종료') break;
    if (word === '도움말') help();
    else if (word === '상태') display(state);
    else if (word === '저장') {
      const temp = `${savePath}.${randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify(state, null, 2), { flag: 'wx' });
      await rename(temp, savePath);
      console.log('저장 완료');
    } else if (word === '불러오기') {
      const saved = JSON.parse(await readFile(savePath, 'utf8'));
      if (saved.version !== 1 || saved.life?.version !== 1 || !Object.hasOwn(places, saved.place)) throw new Error('Invalid save');
      getFirstPlayContext(saved);
      state = saved;
      display(state);
    } else if (word === '대화' || commands.has(word)) {
      if (word !== '대화') state = applyFirstPlayAction(state, commands.get(word)(value, state));
      console.log((await generateFirstPlayReply(state, { playerText: word === '대화' ? value : '' })).text);
      display(state);
    } else console.log('명령은 도움말에서 확인할 수 있어요.');
  } catch (error) {
    console.log('진행할 수 없어요.', error.message);
  }
}
input.close();
