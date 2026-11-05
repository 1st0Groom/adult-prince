import { applyFirstPlayAction, createFirstPlay, getFirstPlayContext } from '/packages/simulation/first-play.js';
import { trainingOptions } from '/packages/dialogue/training-response.js';
import { createGraphics } from './graphics.js';
import { makeWorlds, walkable } from './world.js';

const byId = id => document.getElementById(id);
const game = byId('game');
const canvas = byId('world');
const panel = byId('panel');
const options = byId('choices');
const detail = byId('panel-detail');
const chat = byId('chat');
const utterance = byId('utterance');
const interact = byId('interact');
const keys = new Set();
const saveKey = 'adult-prince.first-play.web.v1';
const places = { street: '해솔동 골목', workshop: '진로체험 교육장' };
const choice = (label, run) => ({ label, run });
const action = (type, fields) => ({ type, ...fields });
const task = (type, fields) => commit(action('training-action', { action: action(type, fields) }));

let state = createFirstPlay();
let actions = [];
let scene = 'street';
let started = false;
let graphics;
let worlds;
let camera;
let active;
let labels = [];
let chatRevision = 0;
let noticeTimer;
let history = [];
let audio;
let soundEnabled = false;

function chime(frequency = 520, duration = .09, gain = .035) {
  if (!soundEnabled || !audio || audio.state !== 'running') return;
  const tone = audio.createOscillator();
  const volume = audio.createGain();
  const now = audio.currentTime;
  tone.type = 'sine';
  tone.frequency.setValueAtTime(frequency, now);
  tone.frequency.exponentialRampToValueAtTime(frequency * .71, now + duration);
  volume.gain.setValueAtTime(gain, now);
  volume.gain.exponentialRampToValueAtTime(.001, now + duration);
  tone.connect(volume).connect(audio.destination);
  tone.start(now);
  tone.stop(now + duration);
}

function commit(...pending) {
  let next = state;
  for (const item of pending) next = applyFirstPlayAction(next, item);
  state = next;
  actions.push(...pending);
  renderHud();
}

const day = at => Math.floor(at / 1440) + 1;
const time = at => [Math.floor(at % 1440 / 60), at % 60].map(part => String(part).padStart(2, '0')).join(':');
const appointmentText = appointment => `${day(appointment.at)}일차 ${time(appointment.at)} · ${appointment.place}`;

function notify(text) {
  clearTimeout(noticeTimer);
  byId('notice').textContent = text;
  noticeTimer = setTimeout(() => { byId('notice').textContent = ''; }, 3600);
}

function objective() {
  const { appointment, training, invitation } = getFirstPlayContext(state);
  if (scene === 'workshop') {
    if (training.phase === 'finished') return { text: '첫 체험을 마쳤다', id: 'exit' };
    if (training.phase === 'routine') return { text: '상태표를 직접 확인하기', id: 'board' };
    if (training.phase === 'collaboration') return { text: '주의 표시를 담당자에게 알리기', id: 'mentor' };
    return { text: '교육 담당자와 이야기하기', id: 'mentor' };
  }
  if (training?.phase === 'finished') return { text: '첫 체험을 마쳤다. 골목을 둘러봐도 좋아요.' };
  if (training) return { text: '교육장으로 돌아가기', id: 'center' };
  if (appointment) return day(appointment.at) > day(state.life.minute)
    ? { text: '집으로 돌아가 하루를 마무리하기', id: 'home' }
    : { text: `${time(appointment.at)} · 교육장에 가기`, id: 'center' };
  if (invitation === 'declined' || invitation === 'deferred') return { text: '골목을 둘러보기' };
  return { text: '학교 앞에서 민서 만나기', id: 'friend' };
}

function renderHud() {
  byId('location').textContent = places[scene];
  byId('clock').textContent = `${day(state.life.minute)}일차 ${time(state.life.minute)}`;
  byId('objective-text').textContent = objective().text;
}

function setScene(next, spawn = worlds[next].spawn) {
  scene = next;
  game.dataset.scene = next;
  camera = { ...spawn, y: 1.62, pitch: -.025 };
  keys.clear();
  active = null;
  interact.hidden = true;
  const stage = byId('world-labels');
  stage.replaceChildren();
  labels = [...worlds[scene].targets, ...worlds[scene].signs].map(target => {
    const element = document.createElement('span');
    element.className = target.id ? 'world-label is-target' : 'world-label';
    if (target.id) element.dataset.worldTarget = target.id;
    element.hidden = true;
    stage.append(element);
    return { target, element };
  });
  renderHud();
}

function show({ tag, title, text, choices = [], display, canTalk = false }) {
  chatRevision++;
  keys.clear();
  byId('panel-tag').textContent = tag;
  byId('panel-title').textContent = title;
  byId('panel-text').textContent = text;
  detail.replaceChildren();
  detail.hidden = !display;
  if (display) detail.append(display);
  options.replaceChildren();
  for (const [index, entry] of choices.entries()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice';
    const key = document.createElement('kbd');
    key.textContent = index + 1;
    key.setAttribute('aria-hidden', 'true');
    button.append(key, entry.label);
    button.addEventListener('click', () => attempt(entry.run));
    options.append(button);
  }
  chat.hidden = !canTalk;
  utterance.disabled = false;
  chat.querySelector('button').disabled = false;
  if (!panel.open) panel.showModal();
}

function attempt(run) {
  try {
    run();
    chime();
  } catch {
    notify('지금은 그 행동을 할 수 없어요.');
  }
}

function card(className, label, value, reading) {
  const element = document.createElement('div');
  element.className = className;
  if (reading) element.dataset.reading = reading;
  const caption = document.createElement('span');
  caption.className = 'caption';
  caption.textContent = label;
  const strong = document.createElement('strong');
  if (reading) {
    const indicator = document.createElement('span');
    indicator.className = 'indicator';
    indicator.setAttribute('aria-hidden', 'true');
    strong.append(indicator);
  }
  strong.append(value);
  element.append(caption, strong);
  return element;
}

const closePanel = () => panel.close();

function friend(text) {
  if (state.place !== 'school') commit(action('move', { place: 'school' }));
  const { invitation, appointment, slots, training } = getFirstPlayContext(state);
  const choices = [];
  if (!training && invitation !== 'offered' && !appointment) {
    text ??= invitation === 'deferred' || invitation === 'declined'
      ? '왔네. 아까 얘기는 천천히 생각해도 돼. 골목 한 바퀴 돌고 갈래?'
      : '야, 잠깐. 요즘 진로 얘기만 나오면 무슨 말을 해야 할지 모르겠더라. 그런데 저기 교육장에서 직접 해 보는 날이 있대.';
    choices.push(choice('어떤 일을 해 보는 건데?', () => {
      commit(action('ask-about-experience'));
      friend('기계에 붙은 상태표를 보고, 이상하면 담당자랑 같이 확인한대. 나도 말로만 듣는 건 감이 안 와서 궁금했어. 내일 오전이랑 오후에 자리가 있대.');
    }), choice('골목을 더 걸어볼래', closePanel));
  }
  if (invitation === 'offered' || appointment) {
    text ??= appointment
      ? `우리가 정한 건 ${time(appointment.at)}이야. 골목 맞은편 초록색 문 보이지? 거기가 교육장이야.`
      : '시간은 네가 골라. 조금 더 생각해 보고 결정해도 돼.';
    for (const slot of slots.filter(slot => slot.at !== appointment?.at)) {
      choices.push(choice(`${slot.time}에 가볼래`, () => {
        commit(action('confirm-slot', { slot: slot.id }));
        friend(`좋아, ${slot.time}에 교육장. 헷갈리면 휴대폰 달력에서 다시 봐. 가서 어떤 느낌이었는지 나중에 들려줘.`);
      }));
    }
    if (appointment) choices.push(choice('이번 약속은 취소할래', () => {
      commit(action('cancel'));
      friend('알겠어. 마음 바뀌면 그때 다시 얘기하자.');
    }));
    else choices.push(choice('조금 더 생각할래', () => { commit(action('defer')); friend('응. 직접 보고 싶어질 때 이야기해.'); }),
      choice('이번에는 안 갈래', () => { commit(action('decline')); friend('그럴 수 있지. 다른 일도 같이 찾아보자.'); }));
  }
  if (training) text ??= training.phase === 'finished'
    ? '다녀왔구나. 해보기 전이랑 느낌이 좀 달라?'
    : '교육장에 아직 확인할 게 있으면 갔다 와. 나 여기 있을게.';
  show({ tag: '학교 앞 · 친구', title: '민서', text, choices, canTalk: true });
}

function home() {
  if (state.place !== 'home') commit(action('move', { place: 'home' }));
  const morning = day(state.life.minute) * 1440 + 7 * 60;
  show({ tag: '골목 · 우리 집', title: '집 앞', text: '현관 창에 볕이 들고 있다. 들어가 쉬면 다음 날 아침이 된다.',
    choices: [choice('집에 들어가 하루 쉬기', () => {
      commit(action('wait', { minutes: morning - state.life.minute }));
      closePanel();
      notify('다음 날 아침. 골목에 다시 볕이 들었다.');
    }), choice('조금 더 걷기', closePanel)] });
}

function enterCenter() {
  if (state.training) commit(action('move', { place: 'training-center' }));
  else commit(action('move', { place: 'training-center' }), action('enter-training'));
  closePanel();
  setScene('workshop');
  notify('교육 담당자가 안쪽에서 기다리고 있다.');
}

function center() {
  const { appointment, training } = getFirstPlayContext(state);
  if (training) return enterCenter();
  const remaining = appointment ? appointment.at - state.life.minute : null;
  if (remaining !== null && remaining <= 0) return enterCenter();
  const sameDay = appointment && day(appointment.at) === day(state.life.minute);
  show({ tag: '골목 · 초록색 문', title: '진로체험 교육장',
    text: appointment ? `${day(appointment.at)}일차 ${time(appointment.at)} 예약이다. 문 옆 안내판에 체험 시간이 적혀 있다.`
      : '예약한 시간에 교육 담당자가 입장을 안내한다. 민서가 체험 이야기를 들려줄 것 같다.',
    choices: [
      ...(sameDay ? [choice('예약 시간까지 앞에서 기다리기', () => {
        commit(action('wait', { minutes: remaining }));
        center();
      })] : []),
      choice('골목으로 돌아가기', closePanel),
    ] });
}

function bench() {
  show({ tag: '골목 · 쉼터', title: '골목 벤치', text: '벤치에 앉으니 바람에 나뭇잎이 부딪치는 소리가 난다.',
    choices: [choice('10분 쉬기', () => { commit(action('wait', { minutes: 10 })); closePanel(); }),
      choice('다시 걷기', closePanel)] });
}

function mentor() {
  const { training } = getFirstPlayContext(state);
  const text = trainingOptions(state.training)[0];
  const after = (label, type, fields) => choice(label, () => { task(type, fields); mentor(); });
  const byPhase = {
    arrival: [after('안녕하세요', 'greet')],
    briefing: [after('안내를 들었어요', 'accept-briefing')],
    routine: [choice('상태표를 보러 가기', closePanel)],
    collaboration: [after('주의 표시가 떴어요', 'ask-mentor')],
    debrief: [after('다음 과정도 알아볼래요', 'reflect', { interest: 'continue' }),
      after('조금 더 생각할래요', 'reflect', { interest: 'unsure' }),
      after('다른 체험도 해볼래요', 'reflect', { interest: 'decline' })],
    finished: [choice('교육장을 둘러보기', closePanel)],
  };
  show({ tag: training.phase === 'finished' ? '첫 체험을 마쳤다' : '교육장 · 안내',
    title: '교육 담당자', text, choices: byPhase[training.phase] });
}

function board(text) {
  const { training } = getFirstPlayContext(state);
  const reading = training.visibleReading;
  const choices = reading ? ['normal', 'attention'].map(value =>
    choice(value === 'normal' ? '정상으로 기록' : '주의로 기록', () => {
      task('inspect', { report: value });
      board(trainingOptions(state.training)[0]);
    })) : [choice('상태표에서 물러나기', closePanel)];
  const meter = reading && card('meter', `확인 항목 ${training.inspected + 1} / 3`, reading === 'normal' ? '정상' : '주의', reading);
  show({ tag: '교육장 · 확인대', title: '상태표',
    text: text ?? (reading ? '불이 들어온 항목을 보고, 표시된 상태를 직접 기록한다.' : '담당자의 안내에 따라 순서대로 상태표를 확인한다.'),
    choices, display: meter });
}

function power() {
  show({ tag: '교육장 · 잠금', title: '전원 패널', text: '스위치 아래에 가상 장비의 전원을 켜지 말라는 표지가 붙어 있다.',
    choices: [
      ...(!getFirstPlayContext(state).training.outcome ? [choice('스위치를 살펴보기', () => {
        task('attempt-power');
        show({ tag: '교육장 · 안내', title: '교육 담당자', text: trainingOptions(state.training)[0],
          choices: [choice('원래 하던 곳으로 돌아가기', closePanel)] });
      })] : []),
      choice('패널에서 물러나기', closePanel),
    ] });
}

function exitWorkshop() {
  commit(action('move', { place: 'school' }));
  setScene('street', worlds.street.arrival);
}

function phone() {
  const { appointment } = getFirstPlayContext(state);
  show({ tag: '휴대폰 · 달력', title: '오늘의 기록', text: appointment ? '달력에 확정된 체험 일정이 남아 있다.' : '달력에 다가오는 예약이 없다.',
    display: appointment && card('calendar', '확정 약속', appointmentText(appointment)),
    choices: [choice('지금 위치에서 저장', () => {
      localStorage.setItem(saveKey, JSON.stringify({ actions, scene, x: camera.x, z: camera.z, yaw: camera.yaw }));
      closePanel();
      notify('이 브라우저에 저장했어요.');
    }), choice('휴대폰 닫기', closePanel)] });
}

function savedGame() {
  try {
    const save = JSON.parse(localStorage.getItem(saveKey));
    if (!save || !Array.isArray(save.actions) || !worlds[save.scene]) return null;
    const rebuilt = save.actions.reduce(applyFirstPlayAction, createFirstPlay());
    const expectedScene = rebuilt.place === 'training-center' ? 'workshop' : 'street';
    if (save.scene !== expectedScene) return null;
    if (![save.x, save.z, save.yaw].every(Number.isFinite) || !walkable(worlds[save.scene], save.x, save.z)) return null;
    return { save, rebuilt };
  } catch {
    return null;
  }
}

function start(resume) {
  if (!graphics) return;
  if (resume) {
    const checkpoint = savedGame();
    if (!checkpoint) return notify('이어서 플레이할 수 있는 저장을 찾지 못했어요.');
    state = checkpoint.rebuilt;
    const { actions: journal, scene: room, x, z, yaw } = checkpoint.save;
    actions = journal;
    setScene(room, { x, z, yaw });
  } else {
    state = createFirstPlay();
    actions = [];
    setScene('street');
  }
  started = true;
  byId('welcome').hidden = true;
  for (const id of ['hud', 'objective', 'reticle', 'controls']) byId(id).hidden = false;
}

const interactions = { friend, home, center, bench, mentor, board, power, exit: exitWorkshop };

chat.addEventListener('submit', async event => {
  event.preventDefault();
  const message = utterance.value.trim();
  if (!message || utterance.disabled) return;
  const revision = chatRevision;
  const previous = byId('panel-text').textContent;
  utterance.value = '';
  utterance.disabled = true;
  const send = chat.querySelector('button');
  send.disabled = true;
  byId('panel-text').textContent = '민서가 잠시 생각한다.';
  try {
    const response = await fetch('/api/talk', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actions, history, message }),
      signal: AbortSignal.timeout(32000),
    });
    if (!response.ok) throw new Error('Dialogue unavailable');
    const { text } = await response.json();
    if (typeof text !== 'string' || !text.trim()) throw new Error('Empty reply');
    if (panel.open && revision === chatRevision) {
      byId('panel-text').textContent = text;
      history = [...history, { role: 'user', text: message }, { role: 'assistant', text }].slice(-8);
    }
  } catch {
    if (panel.open && revision === chatRevision) byId('panel-text').textContent = previous;
  } finally {
    if (panel.open && revision === chatRevision) {
      utterance.disabled = false;
      send.disabled = false;
      utterance.focus();
    }
  }
});

panel.addEventListener('close', () => { chatRevision++; });
byId('start').addEventListener('click', () => start(false));
byId('resume').addEventListener('click', () => start(true));
byId('open-phone').addEventListener('click', () => attempt(phone));
byId('sound').addEventListener('click', async () => {
  if (!window.AudioContext) return;
  try {
    audio ??= new AudioContext();
    await audio.resume();
    soundEnabled = !soundEnabled;
    byId('sound').setAttribute('aria-pressed', soundEnabled);
    byId('sound').setAttribute('aria-label', soundEnabled ? '소리 끄기' : '소리 켜기');
    chime();
  } catch {
    notify('이 브라우저에서 소리를 켤 수 없어요.');
  }
});
interact.addEventListener('click', () => { if (active) attempt(interactions[active.id]); });

const moveKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
window.addEventListener('keydown', event => {
  if (!started || event.isComposing || /^(INPUT|TEXTAREA)$/.test(event.target.tagName)) return;
  if (panel.open) {
    if (/^Digit[1-9]$/.test(event.code) && !event.repeat) options.children[Number(event.code.at(-1)) - 1]?.click();
    return;
  }
  if (moveKeys.has(event.code)) {
    event.preventDefault();
    keys.add(event.code);
  } else if (!event.repeat && event.code === 'KeyE' && active) {
    attempt(interactions[active.id]);
  } else if (!event.repeat && event.code === 'KeyP') {
    attempt(phone);
  }
});
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => keys.clear());
let dragging = false;
canvas.addEventListener('pointerdown', event => {
  if (!started || panel.open || event.button !== 0) return;
  dragging = true;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  if (!dragging || panel.open) return;
  camera.yaw += event.movementX * .0045;
  camera.pitch = Math.max(-.62, Math.min(.55, camera.pitch - event.movementY * .004));
});
canvas.addEventListener('lostpointercapture', () => { dragging = false; });

let last = 0;
let walked = 0;

function walk(dt, world) {
  if (!started || panel.open) return;
  const pressed = key => Number(keys.has(key));
  camera.yaw += (pressed('ArrowRight') - pressed('ArrowLeft')) * dt * 1.85;
  camera.pitch = Math.max(-.62, Math.min(.55, camera.pitch + (pressed('ArrowUp') - pressed('ArrowDown')) * dt));
  const forward = pressed('KeyW') - pressed('KeyS');
  const lateral = pressed('KeyD') - pressed('KeyA');
  const speed = 3.65 * dt / Math.max(1, Math.hypot(forward, lateral));
  const dx = (Math.sin(camera.yaw) * forward + Math.cos(camera.yaw) * lateral) * speed;
  const dz = (-Math.cos(camera.yaw) * forward + Math.sin(camera.yaw) * lateral) * speed;
  const { x, z } = camera;
  if (walkable(world, x + dx, z)) camera.x += dx;
  if (walkable(world, camera.x, z + dz)) camera.z += dz;
  const step = Math.hypot(camera.x - x, camera.z - z);
  walked += step;
  if (walked >= 1.10) {
    chime(scene === 'street' ? 87 : 112, .064, .016);
    walked %= 1.10;
  }
  camera.y = 1.62 + (step > 0 ? Math.sin(walked * Math.PI * 2 / 1.10) * .024 : 0);
}

function nearby(world) {
  const candidates = world.targets.flatMap(target => {
    const x = target.x - camera.x, z = target.z - camera.z;
    const distance = Math.hypot(x, z);
    const facing = (x * Math.sin(camera.yaw) - z * Math.cos(camera.yaw)) / Math.max(.01, distance);
    return distance <= target.reach && (facing > .22 || distance < 1.05) ? [{ ...target, distance }] : [];
  });
  return candidates.sort((a, b) => a.distance - b.distance)[0];
}

function drawFrame(now) {
  const dt = Math.min(.04, (now - (last || now)) / 1000);
  last = now;
  const world = worlds[scene];
  walk(dt, world);
  const reading = state.training && scene === 'workshop' ? getFirstPlayContext(state).training.visibleReading : null;
  graphics.draw(camera, [world.layer, world.layers?.[reading || 'idle']], world.colors);
  active = started && !panel.open ? nearby(world) : null;
  interact.hidden = !active;
  if (active && interact.dataset.target !== active.id) {
    interact.dataset.target = active.id;
    interact.querySelector('span').textContent = active.action;
  }
  const goal = objective().id;
  for (const { target, element } of labels) {
    const distance = Math.hypot(target.x - camera.x, target.z - camera.z);
    const relevant = started && !panel.open && (target.range ? distance < target.range
      : target.id === goal ? distance < 24 : distance < 6.5);
    const point = relevant && graphics.project(camera, target.x, target.labelY, target.z);
    element.hidden = !point || point.x < 30 || point.x > canvas.clientWidth - 30 || point.y < 98 || point.y > canvas.clientHeight - 45;
    if (!element.hidden) {
      const label = target.id === goal && distance > target.reach ? `${target.name} · ${Math.ceil(distance)}m` : target.name;
      if (element.textContent !== label) element.textContent = label;
      element.style.transform = `translate(${Math.round(point.x)}px, ${Math.round(point.y)}px)`;
      element.classList.toggle('active', target.id === active?.id);
    }
  }
  requestAnimationFrame(drawFrame);
}

try {
  graphics = createGraphics(canvas);
  worlds = makeWorlds(graphics);
  setScene('street');
  byId('resume').hidden = !savedGame();
  requestAnimationFrame(drawFrame);
} catch {
  byId('start').disabled = true;
  byId('boot-error').hidden = false;
  byId('boot-error').textContent = '이 브라우저에서 3D 화면을 열 수 없어요. 그래픽 가속을 켠 Chrome 또는 Edge에서 다시 열어 주세요.';
}
