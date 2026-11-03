import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createTraining, applyTrainingAction, getTrainingContext } from '../packages/simulation/training.js';
import { generateTrainingReply } from '../packages/dialogue/training-response.js';
const base = 'http://127.0.0.1:11434';
const models = process.argv.slice(2);
if (!models.length) throw new Error('Installed model tags required');
const hash = value => createHash('sha256').update(value).digest('hex');
const settings = { num_ctx: 4096, num_predict: 60, temperature: 0.4, seed: 42 };
const commonActions = [
  { type: 'greet' }, { type: 'accept-briefing' },
  { type: 'inspect', report: 'normal' }, { type: 'inspect', report: 'normal' },
  { type: 'inspect', report: 'attention' }, { type: 'ask-mentor' }
];
const paths = [
  { id: 'continue-warm', style: 'warm', actions: [...commonActions, { type: 'reflect', interest: 'continue' }], outcome: 'preparation-opportunity' },
  { id: 'mistakes-unsure-dry', style: 'dry', actions: [
    ...commonActions.slice(0, 2), ...Array.from({ length: 4 }, () => ({ type: 'inspect', report: 'attention' })),
    { type: 'attempt-power' }, ...commonActions.slice(2), { type: 'reflect', interest: 'unsure' }
  ], outcome: 'other-experiences' }
];
await mkdir('work/evaluations', { recursive: true });
for (const model of models) {
  const meta = await (await fetch(`${base}/api/show`, { method: 'POST', body: JSON.stringify({ model }) })).json();
  const tags = await (await fetch(`${base}/api/tags`)).json();
  const report = { model, digest: tags.models?.find(x => x.name === model)?.digest, template: meta.template, settings,
    simulationHash: hash(await readFile(new URL('../packages/simulation/training.js', import.meta.url))),
    responseHash: hash(await readFile(new URL('../packages/dialogue/training-response.js', import.meta.url))), paths: [] };
  const path = `work/evaluations/${Date.now()}-training-${model.replace(/[^a-zA-Z0-9-]/g, '_')}.json`;
  for (const scenario of paths) {
    let state = createTraining();
    const sequence = { id: scenario.id, style: scenario.style, turns: [] }; report.paths.push(sequence);
    for (const action of [null, ...scenario.actions]) {
      if (action) state = applyTrainingAction(state, action);
      const serialized = JSON.stringify(state);
      state = JSON.parse(serialized);
      let wallMs;
      const reply = await generateTrainingReply(state, { style: scenario.style, selectExpression: async messages => {
        const started = performance.now();
        const response = await fetch(`${base}/api/chat`, { method: 'POST', signal: AbortSignal.timeout(120000),
          body: JSON.stringify({ model, messages, format: 'json', stream: false, think: false, options: settings, keep_alive: '5m' }) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = await response.json(); wallMs = Math.round(performance.now() - started);
        return body.message?.content;
      } });
      const context = getTrainingContext(state);
      if (context.mayOperatePower || JSON.stringify(state) !== serialized) throw new Error('State invariant failed');
      sequence.turns.push({ action, state: structuredClone(state), ...reply, wallMs: wallMs ?? null, humanReview: null });
      await writeFile(path, JSON.stringify(report, null, 2));
    }
    sequence.completed = state.phase === 'finished' && state.outcome === scenario.outcome;
    sequence.supervisionPreserved = scenario.style !== 'dry' || state.needsSupervision;
    if (!sequence.completed || !sequence.supervisionPreserved) throw new Error('Training path failed');
    await writeFile(path, JSON.stringify(report, null, 2));
    console.log(`${model}: ${scenario.id} ${sequence.turns.length} replies, fallback ${sequence.turns.filter(t => t.fallback).length}, completed ${sequence.completed}`);
  }
  await fetch(`${base}/api/generate`, { method: 'POST', body: JSON.stringify({ model, keep_alive: 0 }) });
  console.log(path);
}
