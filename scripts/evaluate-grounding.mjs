import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildBeliefMessages, BELIEF_PROMPT_VERSION } from '../packages/dialogue/belief-messages.js';
import { buildGroundedMessages, GROUNDED_PROMPT_VERSION } from '../packages/dialogue/grounded-messages.js';

const models = process.argv.slice(2);
if (!models.length) throw new Error('Installed model tags required');
const base = 'http://127.0.0.1:11434';
const settings = { num_ctx: 4096, num_predict: 180, temperature: 0.4, seed: 42 };
const hash = value => createHash('sha256').update(value).digest('hex');
const source = await readFile(new URL('../data/evaluation/grounded-dialogue.json', import.meta.url), 'utf8');
const cases = JSON.parse(source);
await mkdir('work/evaluations', { recursive: true });
for (const model of models) {
  const metadata = await (await fetch(`${base}/api/show`, { method: 'POST', body: JSON.stringify({ model }) })).json();
  const tags = await (await fetch(`${base}/api/tags`)).json();
  const report = { model, digest: tags.models?.find(x => x.name === model)?.digest, template: metadata.template,
    settings, datasetHash: hash(source), runnerHash: hash(await readFile(new URL(import.meta.url))), sequences: [] };
  const path = `work/evaluations/${Date.now()}-grounding-${model.replace(/[^a-zA-Z0-9-]/g, '_')}.json`;
  for (const [variant, builder, promptVersion] of [['baseline', buildBeliefMessages, BELIEF_PROMPT_VERSION], ['grounded', buildGroundedMessages, GROUNDED_PROMPT_VERSION]]) {
    for (const item of cases) {
      const sequence = { id: item.id, variant, promptVersion, turns: [] };
      report.sequences.push(sequence);
      const input = structuredClone(item.input);
      // Both prompts receive the same visible semantic evidence. Baseline has no typed interaction field.
      for (const interaction of input.interactions ?? []) {
        if (interaction.sensitive === true || !Array.isArray(interaction.knownBy) || !interaction.knownBy.includes(input.npc.id)) continue;
        const names = { [input.npc.id]: input.npc.name, [input.player.id]: input.player.name };
        input.memories.push({ id: `interaction-${input.memories.length}`, text: `${names[interaction.actorId]}가 ${names[interaction.targetId]}에게 ${interaction.action}`, knownBy: [input.npc.id] });
      }
      for (const test of item.turns) {
        input.playerText = test.text;
        input.stage = test.stage ?? item.input.stage;
        const messages = builder(input);
        const started = performance.now();
        const entry = { playerText: test.text, criterion: test.criterion, messages, promptHash: hash(JSON.stringify(messages)), humanReview: null };
        try {
          const response = await fetch(`${base}/api/chat`, { method: 'POST', signal: AbortSignal.timeout(120000),
            body: JSON.stringify({ model, messages, stream: false, think: false, options: settings, keep_alive: '5m' }) });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const body = await response.json();
          entry.text = body.message?.content;
          entry.wallMs = Math.round(performance.now() - started);
          entry.metrics = { totalMs: body.total_duration / 1e6, loadMs: body.load_duration / 1e6,
            promptTokens: body.prompt_eval_count, outputTokens: body.eval_count, doneReason: body.done_reason };
          if (!entry.text?.trim()) throw new Error('Empty response');
          entry.status = 'generated';
        } catch (error) { entry.status = 'error'; entry.error = error.message; }
        sequence.turns.push(entry);
        await writeFile(path, JSON.stringify(report, null, 2));
        if (entry.status === 'error') throw new Error(`Sequence stopped: ${entry.error}`);
        input.history.push({ role: 'user', text: test.text, knownBy: [input.npc.id] }, { role: 'assistant', text: entry.text, knownBy: [input.npc.id] });
      }
      console.log(`${model}: ${variant}/${item.id} ${sequence.turns.length} generated (quality not yet reviewed)`);
    }
  }
  await fetch(`${base}/api/generate`, { method: 'POST', body: JSON.stringify({ model, keep_alive: 0 }) });
  console.log(path);
}
