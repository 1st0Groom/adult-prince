import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const path=new URL('../data/training/seed-holdout.jsonl',import.meta.url);
const source=await readFile(path,'utf8');const cases=source.trim().split(/\r?\n/).map(JSON.parse);
const base='http://127.0.0.1:11434';const settings={num_ctx:4096,num_predict:120,temperature:0.4,seed:42};
await mkdir('work/evaluations',{recursive:true});
for(const model of process.argv.slice(2)){
 const tags=await(await fetch(base+'/api/tags')).json();const meta=await(await fetch(base+'/api/show',{method:'POST',body:JSON.stringify({model})})).json();
 const report={model,digest:tags.models?.find(x=>x.name===model)?.digest,template:meta.template,settings,datasetHash:createHash('sha256').update(source).digest('hex'),results:[]};
 const file=`work/evaluations/${Date.now()}-seed-holdout-${model.replace(/[^a-zA-Z0-9-]/g,'_')}.json`;
 for(const item of cases){
  const messages=item.messages.slice(0,2);const start=performance.now();
  const response=await fetch(base+'/api/chat',{method:'POST',signal:AbortSignal.timeout(120000),body:JSON.stringify({model,messages,stream:false,think:false,options:settings,keep_alive:'5m'})});
  if(!response.ok)throw Error(`HTTP ${response.status}`);const body=await response.json();
  if(!body.message?.content?.trim())throw Error('Empty response');
  report.results.push({id:item.id,category:item.category,messages,text:body.message.content,reference:item.messages[2].content,wallMs:Math.round(performance.now()-start),doneReason:body.done_reason,outputTokens:body.eval_count,humanReview:null});
  await writeFile(file,JSON.stringify(report,null,2));console.log(`${model} ${item.id}: ${body.message.content}`);
 }
 await fetch(base+'/api/generate',{method:'POST',body:JSON.stringify({model,keep_alive:0})});console.log(file);
}
