import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {parseVision} from '../src/visionSchema';

const base=new URL(process.env.RISKVERSE_API_URL||'http://127.0.0.1:8789');
if(!['https:','http:'].includes(base.protocol)||base.username||base.password)throw Error('Expected an HTTP(S) site origin');
const cases=JSON.parse(await readFile('docs/NEW_PHOTO_CASES.json','utf8')) as {id:string;file:string;imageUrl:string;sourceUrl:string;author:string;license:string;visibleReference:string}[];
const folder=resolve('output/ai-evaluation/new-images');await mkdir(folder,{recursive:true});
const selected=process.argv[2]?cases.filter(c=>c.id===process.argv[2]):cases;if(!selected.length)throw Error('Unknown case');
const healthResponse=await fetch(new URL('/api/health',base));if(!healthResponse.ok)throw Error(`API health: HTTP ${healthResponse.status}`);
const health=await healthResponse.json();if(!health.ready||health.provider!=='gemini')throw Error('Gemini is not configured');
const results=[];
for(const test of selected){
 const file=resolve(folder,test.file);
 let bytes;try{bytes=await readFile(file)}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;const response=await fetch(test.imageUrl);if(!response.ok)throw Error(`Download ${test.id}: HTTP ${response.status}`);bytes=Buffer.from(await response.arrayBuffer());await writeFile(file,bytes)}
 const body=JSON.stringify({image:`data:image/jpeg;base64,${bytes.toString('base64')}`});if(Buffer.byteLength(body)>4_000_000)throw Error(`Hosting payload limit: ${test.id}`);
 const started=performance.now();
 try{
  const response=await fetch(new URL('/api/analyze',base),{method:'POST',headers:{'content-type':'application/json','origin':base.origin},body,signal:AbortSignal.timeout(65000)});
  const data=await response.json();const report=response.ok?parseVision(data.report):undefined;
  results.push({...test,httpStatus:response.status,durationMs:Math.round(performance.now()-started),requestBytes:Buffer.byteLength(body),...(report?{provider:data.provider,model:data.model,analyzedAt:data.analyzedAt,report}:{code:data.code,error:data.error})});
 }catch(error){results.push({...test,durationMs:Math.round(performance.now()-started),error:error instanceof Error?error.message:'Request failed'})}
}
const out=process.env.RISKVERSE_EVAL_OUTPUT||'output/ai-evaluation/new-photo-results.json';await mkdir(resolve(out,'..'),{recursive:true});
await writeFile(out,JSON.stringify({evaluatedAt:new Date().toISOString(),apiBase:base.origin,method:'Live API requests. Visible references recorded before results; no expert ground truth or accuracy claim.',cases:results},null,2)+'\n');
console.log(JSON.stringify({output:out,site:base.origin,cases:results.map(r=>({id:r.id,httpStatus:'httpStatus'in r?r.httpStatus:null,durationMs:r.durationMs,observations:'report'in r?r.report?.observations.length:0,summary:'report'in r?r.report?.summary:undefined,error:'error'in r?r.error:undefined}))},null,2));
if(results.some(r=>!('httpStatus'in r)||r.httpStatus!==200))process.exitCode=1;
