import { readFile,readdir } from 'node:fs/promises';
const root=new URL('../data/training/',import.meta.url);
const files=['seed-train.jsonl','seed-holdout.jsonl'];
const ids=new Set(),dialogues=new Set();const results=[];
const evalDir=new URL('../data/evaluation/',import.meta.url);
const evaluationText=(await Promise.all((await readdir(evalDir)).filter(name=>name.endsWith('.json')).map(name=>readFile(new URL(name,evalDir),'utf8')))).join('\n');
for(const file of files){
 const lines=(await readFile(new URL(file,root),'utf8')).trim().split(/\r?\n/);let count=0;
 for(const line of lines){
  const item=JSON.parse(line);
  if(typeof item.id!=='string'||ids.has(item.id)||typeof item.category!=='string'||!Array.isArray(item.messages)||item.messages.length!==3)throw Error(`Invalid record in ${file}`);
  ids.add(item.id);
  for(const [i,role] of ['system','user','assistant'].entries())if(item.messages[i]?.role!==role||typeof item.messages[i]?.content!=='string'||!item.messages[i].content.trim())throw Error(`Invalid role/content in ${item.id}`);
  const key=item.messages.map(x=>x.content).join('\n');if(dialogues.has(key))throw Error(`Duplicate dialogue: ${item.id}`);dialogues.add(key);
  if(evaluationText.includes(item.messages[1].content))throw Error(`Exact evaluation prompt overlap: ${item.id}`);
  count++;
 }
 results.push({file,count});
}
console.log(JSON.stringify({status:'valid',results,limitations:'Checks exact text and schema only, not semantic overlap, quality, privacy or readiness.'},null,2));
