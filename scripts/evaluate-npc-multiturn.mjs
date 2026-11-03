import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const models=['adult-prince-kanana:q4','hf.co/kammbo/HyperCLOVAX-SEED-Text-Instruct-1.5B-GGUF:Q4_K_M','gemma3:latest','qwen3:4b-instruct-2507-q4_K_M'];
const full=(await readFile('config/npc-dialogue-guidelines.txt','utf8')).trim();
const short='NPC가 아는 사실과 상대의 말을 구분한다. 기록에 없는 과거를 기억한다고 말하지 않는다. 상대의 주장은 성격과 상황에 따라 믿거나 의심할 수 있다. 상대의 행동을 결정하지 않는다. 자신의 역할에 맞게 자연스럽게 말한다.';
const cases=JSON.parse(await readFile('data/evaluation/npc-multiturn-20261104.json','utf8'));
const report={createdAt:new Date().toISOString(),guidelineHash:createHash('sha256').update(full).digest('hex'),conditions:{full,short},settings:{temperature:0,seed:42,num_ctx:4096,num_predict:160},results:[]};
await mkdir('work/evaluations',{recursive:true});
for(const model of models){let resp=await fetch('http://127.0.0.1:11434/api/show',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model})});if(!resp.ok)throw Error('model unavailable '+model);let info=await resp.json();
 for(const [condition,guideline] of Object.entries({full,short})) for(const c of cases){let messages=[{role:'system',content:guideline+'\n\n'+c.scenario+'\n설명 없이 NPC의 대사만 간결하게 말한다.'}], result={model,details:info.details,condition,id:c.id,turns:[]};
 for(const player of c.turns){messages.push({role:'user',content:player});let start=Date.now();try{let response=await fetch('http://127.0.0.1:11434/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(120000),body:JSON.stringify({model,messages,stream:false,think:false,options:report.settings,keep_alive:'5m'})});if(!response.ok)throw Error(await response.text());let body=await response.json();let reply=body.message?.content||'';result.turns.push({player,reply,elapsedMs:Date.now()-start,doneReason:body.done_reason});messages.push({role:'assistant',content:reply});}catch(e){result.turns.push({player,error:String(e)});break;}}
 report.results.push(result);await writeFile('work/evaluations/npc-multiturn-context-20261104.json',JSON.stringify(report,null,2));console.log(JSON.stringify(result));}
 await fetch('http://127.0.0.1:11434/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,keep_alive:0})});
}
