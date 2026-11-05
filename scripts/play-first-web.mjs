import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { applyFirstPlayAction, createFirstPlay, getFirstPlayContext } from '../packages/simulation/first-play.js';
import { createSpeechState } from '../packages/simulation/speech-policy.js';
import { generateNpcTurnFromText } from '../packages/dialogue/npc-turn.js';
import { buildGroundedMessages } from '../packages/dialogue/grounded-messages.js';

const port = Number(process.env.ADULT_PRINCE_WEB_PORT ?? 4173);
const model = process.env.ADULT_PRINCE_MODEL?.trim();
const root = new URL('../', import.meta.url);
const mime = { html: 'text/html', css: 'text/css', js: 'text/javascript' };
const assets = new Map([
  ...['index.html', 'style.css', 'game.js', 'graphics.js', 'world.js'].map(name =>
    [name === 'index.html' ? '/' : '/' + name, 'apps/web/first-play/' + name]),
  ...['first-play.js', 'index.js', 'social-state.js', 'training.js', 'korean-particles.js'].map(name =>
    ['/packages/simulation/' + name, 'packages/simulation/' + name]),
  ['/packages/dialogue/training-response.js', 'packages/dialogue/training-response.js'],
]);

function send(response, status, type, content) {
  response.writeHead(status, {
    'Content-Type': type + '; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'",
  });
  response.end(content);
}

async function readInput(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error('Dialogue input too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function complete(messages) {
  const response = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false, think: false, options: { num_predict: 100, temperature: .55 } }),
    signal: AbortSignal.timeout(26000),
  });
  if (!response.ok) throw new Error('Local model unavailable');
  const result = (await response.json()).message?.content?.trim();
  if (!result || result.length > 350) throw new Error('Invalid local dialogue');
  return result;
}

function friendlyReply(message, context) {
  if (/진로|모르겠|하고 싶은/.test(message)) return '나도 요즘 비슷해. 한번 보고 나서 생각해도 늦지 않잖아.';
  if (/싫|안\s*갈|부담|걱정/.test(message)) return '그럴 수 있지. 생각 바뀌면 말해 줘. 너 편한 쪽으로 하자.';
  if (/무슨 일|어떤 일|설비|상태표/.test(message)) return '가상 장비에 붙은 상태표를 먼저 본대. 애매한 건 담당자랑 같이 확인하는 거래.';
  if (context.training?.phase === 'finished') return '다녀왔네. 직접 해보니까 제일 기억에 남는 게 뭐였어?';
  if (context.appointment) return '그래. 저기 초록색 문이 교육장이야. 시간은 휴대폰 달력에서 볼 수 있어.';
  return '응, 듣고 있어. 골목 한 바퀴 걸으면서 이야기할래?';
}

async function talk({ actions, history, message }) {
  if (!Array.isArray(actions) || actions.length > 650 || typeof message !== 'string' || !message.trim() || message.length > 280 ||
      !Array.isArray(history) || history.length > 8 || history.some(turn =>
        !['user', 'assistant'].includes(turn?.role) || typeof turn.text !== 'string' || turn.text.length > 350)) {
    throw new Error('Invalid dialogue input');
  }
  const state = actions.reduce(applyFirstPlayAction, createFirstPlay());
  if (state.place !== 'school') throw new Error('Friend is at the school');
  const context = getFirstPlayContext(state);
  const appointment = context.appointment && state.social.agreement;
  if (/예약|약속|달력|체험\s*(?:시간|일정)/.test(message)) {
    return { text: appointment ? `우리가 정한 건 ${appointment.time}, ${appointment.place}야. 달력에도 적혀 있어.`
      : '지금 잡아 둔 약속은 없어. 가고 싶은 시간이 있으면 네가 골라.', source: 'record' };
  }
  const facts = [{ id: 'experience-offer', knownBy: ['friend'],
    text: '가상의 교육장에서 설비 상태표를 보고 담당자와 함께 확인하는 체험이 있다. 민서는 학교 앞에 있다.' }];
  if (appointment) facts.push({ id: context.appointment.id, knownBy: ['friend'],
    text: `플레이어가 확정한 시간은 ${appointment.time}, 장소는 ${appointment.place}다.` });
  let usedModel = false;
  const reply = await generateNpcTurnFromText({
    lifeState: state.life, speechState: createSpeechState(), casualAgreed: true,
    dialogue: {
      npc: { id: 'friend', name: '민서' }, player: { id: 'player', name: '친구' },
      speech: 'casual', playerText: message, personality: '말을 조금 아끼지만 다정하고 가끔 장난치는 학생.',
      relationship: '학교 앞에서 함께 걷는 친한 친구', stage: '진로와 체험에 관해 친구와 짧게 대화한다.',
      scene: { place: '해솔기술고등학교 앞' }, facts,
      history: history.map(({ role, text }) => ({ role, text, knownBy: ['friend'] })),
    },
  }, {
    classifySpeech: async () => '{"index":0}',
    classifyFact: async () => '{"index":0}',
    freeDialogue: async view => {
      if (model) {
        try {
          const text = await complete(buildGroundedMessages(view));
          usedModel = true;
          return text;
        } catch {}
      }
      return friendlyReply(message, context);
    },
  });
  return { text: reply.text, source: usedModel ? 'model' : 'authored' };
}

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  if (request.method === 'GET' && assets.has(pathname)) {
    try {
      const name = assets.get(pathname);
      send(response, 200, mime[name.split('.').at(-1)], await readFile(new URL(name, root)));
    } catch {
      send(response, 404, 'text/plain', '페이지를 찾을 수 없어요.');
    }
  } else if (request.method === 'POST' && pathname === '/api/talk' &&
    /^application\/json\b/i.test(request.headers['content-type'] ?? '') &&
    (!request.headers.origin || request.headers.origin === `http://${request.headers.host}`)) {
    try {
      send(response, 200, 'application/json', JSON.stringify(await talk(await readInput(request))));
    } catch {
      send(response, 400, 'application/json', '{"error":"대화를 이어갈 수 없어요."}');
    }
  } else {
    send(response, 404, 'text/plain', '페이지를 찾을 수 없어요.');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`어른왕자 · http://127.0.0.1:${server.address().port}`);
  if (model) console.log(`민서 자유 대화 · ${model}`);
});
