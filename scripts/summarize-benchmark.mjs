import { readFile } from 'node:fs/promises';
const quantile=(values,q)=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.max(0,Math.ceil(q*sorted.length)-1)]??null;};
const rows=[];
for(const path of process.argv.slice(2)){
 const report=JSON.parse(await readFile(path,'utf8'));
 if(!report.model||!Array.isArray(report.results)||report.dryRun)throw new Error(`Not a model benchmark: ${path}`);
 const generated=report.results.filter(x=>x.metrics);
 const warm=generated.filter(x=>x.metrics.loadMs<1000);
 rows.push({model:report.model,quantization:report.modelDetails?.quantization_level,cases:report.results.length,structurallyValid:report.results.filter(x=>x.status==='structurally_valid').length,warmSamples:warm.length,warmMedianMs:quantile(warm.map(x=>x.wallMs),.5),warmP95Ms:quantile(warm.map(x=>x.wallMs),.95),coldLoadMs:generated[0]?.metrics.loadMs,outputTokens:generated.reduce((n,x)=>n+x.metrics.outputTokens,0),humanReview:'required'});
}
console.log(JSON.stringify(rows,null,2));
