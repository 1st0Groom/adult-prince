import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { buildMessages, generateReply, PROMPT_VERSION } from '../packages/dialogue/index.js';
const cases = JSON.parse(await readFile(new URL('../data/evaluation/dialogue.json', import.meta.url), 'utf8'));
const dry = process.argv.includes('--dry-run');
if (!dry && (!process.env.LOCAL_AI_BASE_URL || !process.env.LOCAL_AI_MODEL)) throw new Error('Set LOCAL_AI_BASE_URL and LOCAL_AI_MODEL, or use --dry-run');
const results = [];
for (const item of cases) {
  if (dry) { buildMessages(item.input); results.push({ id: item.id, status: 'prepared', rubric: item.rubric }); continue; }
  const start = performance.now();
  try { results.push({ id: item.id, status: 'generated', reply: await generateReply(item.input, { baseUrl: process.env.LOCAL_AI_BASE_URL, model: process.env.LOCAL_AI_MODEL }), latencyMs: Math.round(performance.now() - start), rubric: item.rubric, humanReview: null }); }
  catch (error) { results.push({ id: item.id, status: 'error', error: error.message }); }
}
await mkdir('work/evaluations', { recursive: true });
const path = `work/evaluations/${Date.now()}-${dry ? 'dry' : 'model'}.json`;
await writeFile(path, JSON.stringify({ promptVersion: PROMPT_VERSION, model: dry ? null : process.env.LOCAL_AI_MODEL, dryRun: dry, results }, null, 2));
console.log(`${results.length} cases; ${results.filter(x => x.status === 'error').length} errors; ${path}`);
if (results.some(x => x.status === 'error')) process.exitCode = 1;
