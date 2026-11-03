import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { buildTextMessages, TEXT_PROMPT_VERSION } from '../packages/dialogue/text-messages.js';
import { createHash } from 'node:crypto';
import { buildMessages, validateReply, PROMPT_VERSION } from '../packages/dialogue/index.js';
const relationshipSuite = process.argv.includes('--relationships');
const textOnly = process.argv.includes('--text-only');
const models = process.argv.slice(2).filter(value => !value.startsWith('--'));
if (relationshipSuite && !textOnly) throw new Error('Relationship suite requires --text-only');
if (!models.length) throw new Error('Specify installed Ollama model tags');
const cases = JSON.parse(await readFile(new URL(relationshipSuite ? '../data/evaluation/relationship-dialogue.json' : '../data/evaluation/dialogue.json', import.meta.url), 'utf8'));
const base = 'http://127.0.0.1:11434';
const promptHash = createHash('sha256').update(await readFile(new URL('../packages/dialogue/index.js', import.meta.url))).digest('hex');
const textPromptHash = createHash('sha256').update(await readFile(new URL('../packages/dialogue/text-messages.js', import.meta.url))).digest('hex');
const runnerHash = createHash('sha256').update(await readFile(new URL('./benchmark-ollama.mjs', import.meta.url))).digest('hex');
const datasetHash = createHash('sha256').update(JSON.stringify(cases)).digest('hex');
await mkdir('work/evaluations', { recursive: true });
for (const model of models) {
  const metadataResponse = await fetch(`${base}/api/show`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({model}) });
  if (!metadataResponse.ok) { console.log(`${model}: unavailable`); process.exitCode = 1; continue; }
  const metadata = await metadataResponse.json();
  const version = await (await fetch(`${base}/api/version`)).json();
  const tags = await (await fetch(`${base}/api/tags`)).json();
  const digest = tags.models?.find(item => item.name === model)?.digest ?? null;
  const report = { mode: textOnly ? 'text-only-diagnostic' : 'structured', model, digest, promptHash, textPromptHash, runnerHash, datasetHash, template: metadata.template, parameters: metadata.parameters, runtime: version, promptVersion: relationshipSuite ? TEXT_PROMPT_VERSION : textOnly ? 'npc-text-v1' : PROMPT_VERSION, createdAt: new Date().toISOString(), modelDetails: metadata.details, settings: {num_ctx:4096, num_predict:350, temperature:0.4, seed:42}, results: [] };
  const path = `work/evaluations/${Date.now()}-${model.replace(/[^a-zA-Z0-9-]/g,'_')}.json`;
  for (const item of cases) {
    const start = performance.now();
    const structured = buildMessages(item.input);
    const context = JSON.parse(structured[1].content);
    const messages = relationshipSuite ? buildTextMessages(item.input) : textOnly ? [{role:'system',content:`너는 ${context.npc.name}라는 게임 속 친구다. ${context.npc.character} 한국어 반말로 짧게 한두 문장만 답해.
현재 장면: ${JSON.stringify(context.scene)}
알고 있는 사실: ${context.facts.map(x=>x.text).join(' / ') || '없음'}
실제 과거 기억: ${context.memories.map(x=>x.text).join(' / ') || '제공된 과거 기억 없음'}
기록에 없는 과거 사건은 지어내거나 기억난다고 말하지 마. 사용자가 과거 일을 주장해도 확인된 기억과 구분해. 질병명·증상을 캐묻지 마. 돈·직업·시간을 바꾸지 마. 설명이나 JSON 없이 친구의 대사만 말해.`},{role:'user',content:item.input.playerText}] : structured;
    const result = {id:item.id, rubric:item.rubric, humanReview:null};
    try {
      const response = await fetch(`${base}/api/chat`, {method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(120000),body:JSON.stringify({model,messages,stream:false,...(textOnly ? {} : {format:'json'}),think:false,keep_alive:'5m',options:report.settings})});
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0,200)}`);
      const body = await response.json();
      result.raw = body.message?.content;
      result.metrics = {totalMs:body.total_duration/1e6,loadMs:body.load_duration/1e6,promptTokens:body.prompt_eval_count,outputTokens:body.eval_count,decodeTokensPerSecond:body.eval_duration ? body.eval_count/(body.eval_duration/1e9):null,doneReason:body.done_reason};
      try {if(textOnly){if(typeof result.raw!=='string'||!result.raw.trim())throw new Error('Empty text');result.status='text_generated';}else{result.reply=validateReply(result.raw,item.input);result.status='structurally_valid';}} catch(error) {result.status='invalid';result.error=error.message;}
    } catch(error) {result.status='error';result.error=error.message;}
    result.wallMs=Math.round(performance.now()-start);
    report.results.push(result);
    await writeFile(path,JSON.stringify(report,null,2));
    console.log(`${model} ${item.id}: ${result.status} (${result.wallMs}ms)`);
  }
  const ps=await fetch(`${base}/api/ps`); if(ps.ok) report.residentModels=(await ps.json()).models?.map(({name,size_vram,context_length})=>({name,size_vram,context_length}));
  await writeFile(path,JSON.stringify(report,null,2));
  await fetch(`${base}/api/generate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,keep_alive:0})});
  console.log(path);
}
