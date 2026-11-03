import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { buildMessages, validateReply, PROMPT_VERSION } from '../packages/dialogue/index.js';
const models = process.argv.slice(2);
if (!models.length) throw new Error('Specify installed Ollama model tags');
const cases = JSON.parse(await readFile(new URL('../data/evaluation/dialogue.json', import.meta.url), 'utf8'));
const base = 'http://127.0.0.1:11434';
await mkdir('work/evaluations', { recursive: true });
for (const model of models) {
  const metadataResponse = await fetch(`${base}/api/show`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({model}) });
  if (!metadataResponse.ok) { console.log(`${model}: unavailable`); process.exitCode = 1; continue; }
  const metadata = await metadataResponse.json();
  const version = await (await fetch(`${base}/api/version`)).json();
  const tags = await (await fetch(`${base}/api/tags`)).json();
  const digest = tags.models?.find(item => item.name === model)?.digest ?? null;
  const report = { model, digest, runtime: version, promptVersion: PROMPT_VERSION, createdAt: new Date().toISOString(), modelDetails: metadata.details, settings: {num_ctx:4096, num_predict:350, temperature:0.4, seed:42}, results: [] };
  const path = `work/evaluations/${Date.now()}-${model.replace(/[^a-zA-Z0-9-]/g,'_')}.json`;
  for (const item of cases) {
    const start = performance.now();
    const result = {id:item.id, rubric:item.rubric, humanReview:null};
    try {
      const response = await fetch(`${base}/api/chat`, {method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(120000),body:JSON.stringify({model,messages:buildMessages(item.input),stream:false,format:'json',think:false,keep_alive:'5m',options:report.settings})});
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0,200)}`);
      const body = await response.json();
      result.raw = body.message?.content;
      result.metrics = {totalMs:body.total_duration/1e6,loadMs:body.load_duration/1e6,promptTokens:body.prompt_eval_count,outputTokens:body.eval_count,decodeTokensPerSecond:body.eval_duration ? body.eval_count/(body.eval_duration/1e9):null,doneReason:body.done_reason};
      try {result.reply=validateReply(result.raw,item.input);result.status='structurally_valid';} catch(error) {result.status='invalid';result.error=error.message;}
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
