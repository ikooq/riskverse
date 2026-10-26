import {afterEach,describe,expect,it,vi} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {request,type Server} from 'node:http';
import {createRuntimeServer,runtimeConfig,type RuntimeConfig} from './runtime';
const servers:Server[]=[],folders:string[]=[];
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXtQAAAAASUVORK5CYII=';
const result={summary:'Снимок',limitations:['Нужна проверка'],observations:[]};
const provider=()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(result)}]}}]}));
async function start(overrides:Partial<RuntimeConfig>={},fetcher:typeof fetch=vi.fn(async()=>provider()),now?:()=>number){
 const folder=await mkdtemp(path.join(tmpdir(),'riskverse-runtime-'));folders.push(folder);
 await mkdir(path.join(folder,'demo'));await writeFile(path.join(folder,'demo/verified-ai-audit.json'),'{"format":"riskverse-audit"}');await mkdir(path.join(folder,'assets'));await writeFile(path.join(folder,'index.html'),'<h1>RISKVERSE</h1>');await writeFile(path.join(folder,'assets/app-test.js'),'window.riskverse=true');await writeFile(path.join(folder,'.env.local'),'never-public');
 const config={...runtimeConfig({}),dist:folder,...overrides};
 for(let attempt=0;attempt<5;attempt++){
  const server=await createRuntimeServer(config,{geminiKey:'test-only',fetcher},now);servers.push(server);
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  try{await fetch(base+'/healthz');return base}catch(error){if((error as {cause?:{message?:string}}).cause?.message!=='bad port')throw error;server.close();server.closeAllConnections()}
 }
 throw Error('Could not allocate a permitted port');
}
const post=(base:string,body:unknown={image},headers:Record<string,string>={})=>fetch(base+'/api/analyze',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
// Fetch may normalize/replace Host; a raw HTTP request represents a reverse proxy.
const proxyPost=(base:string,origin:string)=>new Promise<number>((resolve,reject)=>{
 const body=JSON.stringify({image});
 const req=request(base+'/api/analyze',{method:'POST',headers:{Host:'riskverse.example',Origin:origin,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},res=>{res.resume();res.once('end',()=>resolve(res.statusCode||0))});req.once('error',reject);req.end(body);
});
afterEach(async()=>{await Promise.all(servers.splice(0).map(s=>new Promise<void>(resolve=>{s.close(()=>resolve());s.closeAllConnections()})));await Promise.all(folders.splice(0).map(f=>rm(f,{force:true,recursive:true})))});
describe('built app runtime',()=>{
 it('requires the configured public host and origin behind a deployment proxy',async()=>{const fake=vi.fn(async()=>provider()),base=await start({publicOrigin:'https://riskverse.example'},fake);expect((await post(base)).status).toBe(403);expect(await proxyPost(base,'https://foreign.example')).toBe(403);expect(await proxyPost(base,'https://riskverse.example')).toBe(200);expect(fake).toHaveBeenCalledTimes(1);});
 it('serves the built app, assets, SPA navigation and API from one origin',async()=>{const base=await start();expect(await(await fetch(base)).text()).toContain('RISKVERSE');const asset=await fetch(base+'/assets/app-test.js');expect(asset.headers.get('content-type')).toContain('javascript');expect(asset.headers.get('cache-control')).toContain('immutable');expect((await fetch(base+'/workspace',{headers:{Accept:'text/html'}})).status).toBe(200);expect((await fetch(base+'/assets/missing.js')).status).toBe(404);const sample=await fetch(base+'/demo/verified-ai-audit.json');expect(sample.status).toBe(200);expect(sample.headers.get('content-type')).toContain('application/json');expect((await(await fetch(base+'/api/health')).json()).provider).toBe('gemini');expect((await post(base)).status).toBe(200)});
 it('never exposes hidden files, traversal, source paths or arbitrary methods',async()=>{const base=await start();for(const route of ['/.env.local','/%2eenv.local','/assets/%2e%2e/.env.local','/src/App.tsx','/api/unknown'])expect((await fetch(base+route)).status).toBe(404);const response=await fetch(base,{method:'POST'});expect(response.status).toBe(405);expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");expect((await fetch(base,{method:'HEAD'})).headers.get('content-length')).toBeTruthy()});
 it('rejects a foreign origin before any provider request',async()=>{const fake=vi.fn(async()=>provider()),base=await start({},fake);expect((await post(base,{image},{Origin:'https://other.example'})).status).toBe(403);expect(fake).not.toHaveBeenCalled()});
 it('caps requests per client, then permits them after the window',async()=>{let time=Date.parse('2026-10-25T12:00:00Z');const fake=vi.fn(async()=>provider()),base=await start({requestsPerMinute:1},fake,()=>time);expect((await post(base)).status).toBe(200);const blocked=await post(base);expect(blocked.status).toBe(429);expect(blocked.headers.get('retry-after')).toBeTruthy();expect(fake).toHaveBeenCalledTimes(1);time+=60001;expect((await post(base)).status).toBe(200)});
 it('counts provider attempts only and stops at the daily budget',async()=>{let time=Date.parse('2026-10-25T12:00:00Z');const fake=vi.fn(async()=>provider()),base=await start({dailyAnalyses:1},fake,()=>time);expect((await post(base,{image:'invalid'})).status).toBe(400);expect((await post(base)).status).toBe(200);const blocked=await post(base);expect((await blocked.json()).code).toBe('DAILY_LIMIT');expect(fake).toHaveBeenCalledTimes(1);time+=86400000;expect((await post(base)).status).toBe(200)});
 it('does not queue simultaneous provider calls',async()=>{let complete!:(r:Response)=>void;const fake=vi.fn(()=>new Promise<Response>(resolve=>{complete=resolve})),base=await start({},fake);const pending=post(base);await vi.waitFor(()=>expect(fake).toHaveBeenCalledTimes(1));expect((await post(base)).status).toBe(429);complete(provider());expect((await pending).status).toBe(200)});
 it('validates configuration and explains an absent frontend build',async()=>{expect(()=>runtimeConfig({PORT:'no'})).toThrow('PORT');expect(()=>runtimeConfig({RISKVERSE_DAILY_ANALYSES:'-1'})).toThrow();expect(()=>runtimeConfig({PUBLIC_ORIGIN:'https://example.com/path'})).toThrow();await expect(createRuntimeServer({...runtimeConfig({}),dist:path.join(tmpdir(),'missing-riskverse-build')},{})).rejects.toThrow('npm run build')});
});
