import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildFactRouteMessages, parseFactRoute, routeFactHint, renderFactAnswer, FACT_ROUTER_VERSION } from '../packages/dialogue/fact-answers.js';
import { buildGroundedMessages, GROUNDED_PROMPT_VERSION } from '../packages/dialogue/grounded-messages.js';

const base = 'http://127.0.0.1:11434';
const models = process.argv.slice(2);
if (!models.length) throw new Error('Installed model tags required');
const settings = { num_ctx: 4096, num_predict: 180, temperature: 0.4, seed: 42 };
const source = await readFile(new URL('../data/evaluation/grounded-dialogue.json', import.meta.url), 'utf8');
const holdoutSource = await readFile(new URL('../data/evaluation/fact-routing-holdout.json', import.meta.url), 'utf8');
const freshSource = await readFile(new URL('../data/evaluation/fact-routing-fresh.json', import.meta.url), 'utf8');
const hash = value => createHash('sha256').update(value).digest('hex');
await mkdir('work/evaluations', { recursive: true });
for (const model of models) {
  const meta = await (await fetch(`${base}/api/show`, { method: 'POST', body: JSON.stringify({ model }) })).json();
  const tags = await (await fetch(`${base}/api/tags`)).json();
  const report = { model, digest: tags.models?.find(x => x.name === model)?.digest, template: meta.template,
    settings, routerVersion: FACT_ROUTER_VERSION, freePromptVersion: GROUNDED_PROMPT_VERSION,
    datasetHash: hash(source), holdoutHash: hash(holdoutSource), freshHash: hash(freshSource), runnerHash: hash(await readFile(new URL(import.meta.url))), sequences: [], holdout: [], fresh: [] };
  const path = `work/evaluations/${Date.now()}-fact-routing-${model.replace(/[^a-zA-Z0-9-]/g, '_')}.json`;
  async function call(messages, format) {
    const started = performance.now();
    const response = await fetch(`${base}/api/chat`, { method: 'POST', signal: AbortSignal.timeout(120000),
      body: JSON.stringify({ model, messages, ...(format ? { format } : {}), stream: false, think: false, options: settings, keep_alive: '5m' }) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    if (!body.message?.content?.trim()) throw new Error('Empty response');
    return { text: body.message.content, wallMs: Math.round(performance.now() - started) };
  }
  for (const item of JSON.parse(source)) {
    const input = structuredClone(item.input);
    if (item.id === 'actor-direction') input.loans = [{ item: '우산', lenderId: input.player.id, borrowerId: input.npc.id, holderId: input.npc.id, knownBy: [input.npc.id] }];
    input.firstMeeting = item.id === 'stranger-claimed-past';
    if (input.socialState) {
      input.appointmentKnowledge = { knownBy: [input.npc.id], state: structuredClone(input.socialState) };
      input.appointmentKnowledge.state.belief.source = 'player-calendar-claim';
    }
    const sequence = { id: item.id, turns: [] }; report.sequences.push(sequence);
    const recentPlayerTexts = [];
    for (const test of item.turns) {
      input.playerText = test.text; input.stage = test.stage ?? item.input.stage;
      const messages = buildFactRouteMessages({ playerText: test.text, recentPlayerTexts });
      const response = routeFactHint(test.text) ? null : await call(messages, 'json');
      const route = routeFactHint(test.text) ?? { ...parseFactRoute(response.text), source: 'model' };
      const recordAnswer = route.valid ? renderFactAnswer(input, route.intent) : null;
      const entry = { playerText: test.text, expectedIntent: test.expectedIntent, route, classificationCorrect: route.valid && route.intent === test.expectedIntent,
        routeMessages: response ? messages : null, routeRaw: response?.text ?? null, routeMs: response?.wallMs ?? 0, mode: recordAnswer ? 'record-answer' : 'free-dialogue', humanReview: null };
      if (recordAnswer) entry.text = recordAnswer;
      else {
        entry.freeMessages = buildGroundedMessages(input);
        const generated = await call(entry.freeMessages);
        entry.text = generated.text; entry.freeMs = generated.wallMs;
      }
      sequence.turns.push(entry);
      input.history.push({ role: 'user', text: test.text, knownBy: [input.npc.id] }, { role: 'assistant', text: entry.text, knownBy: [input.npc.id] });
      recentPlayerTexts.push(test.text);
      await writeFile(path, JSON.stringify(report, null, 2));
    }
    console.log(`${model}: ${item.id} routing ${sequence.turns.filter(t => t.classificationCorrect).length}/${sequence.turns.length}`);
  }
  for (const [group, sourceText] of [['holdout', holdoutSource], ['fresh', freshSource]]) {
    for (const item of JSON.parse(sourceText)) {
      const messages = buildFactRouteMessages(item);
      const response = routeFactHint(item.playerText) ? null : await call(messages, 'json');
      const route = routeFactHint(item.playerText) ?? { ...parseFactRoute(response.text), source: 'model' };
      report[group].push({ ...item, route, raw: response?.text ?? null, wallMs: response?.wallMs ?? 0, classificationCorrect: route.valid && route.intent === item.expectedIntent });
      await writeFile(path, JSON.stringify(report, null, 2));
    }
    console.log(`${model}: ${group} ${report[group].filter(t => t.classificationCorrect).length}/${report[group].length}`);
  }
  await fetch(`${base}/api/generate`, { method: 'POST', body: JSON.stringify({ model, keep_alive: 0 }) });
  console.log(path);
}
