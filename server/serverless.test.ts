import {afterEach,describe,expect,it,vi} from 'vitest';
import {createServer,type IncomingMessage,type Server} from 'node:http';
import {createServerlessHandler} from './serverless';
const servers:Server[]=[];
afterEach(async()=>{await Promise.all(servers.splice(0).map(s=>new Promise<void>(resolve=>{s.close(()=>resolve());s.closeAllConnections()})))});
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXtQAAAAASUVORK5CYII=';
const report={summary:'Один объект.',limitations:['Нужна проверка.'],observations:[]};
async function start(env:NodeJS.ProcessEnv={},parsed=false){
 const provider=vi.fn(async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(report)}]}}]})));
 const handler=createServerlessHandler(env,{geminiKey:'test-only',fetcher:provider});
 const server=createServer(async(req,res)=>{if(parsed&&req.method==='POST'){const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));(req as IncomingMessage&{body:unknown}).body=JSON.parse(Buffer.concat(chunks).toString())}await handler(req,res)});servers.push(server);
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));return{base:`http://127.0.0.1:${(server.address() as {port:number}).port}`,provider};
}
const post=(base:string,data:unknown={image},headers={})=>fetch(base+'/api/analyze',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(data)});
describe('Vercel transport',()=>{
 it('handles the parsed body after the platform consumed the Node request stream',async()=>{const{base,provider}=await start({},true);const response=await post(base);expect(response.status).toBe(200);expect((await response.json()).report).toEqual(report);expect(provider).toHaveBeenCalledOnce()});
 it('blocks external origins without spending provider quota',async()=>{const{base,provider}=await start();expect((await post(base,{image},{origin:'https://example.org'})).status).toBe(403);expect(provider).not.toHaveBeenCalled()});
 it('limits actual provider attempts while allowing a malformed image to be corrected',async()=>{const{base,provider}=await start({RISKVERSE_DAILY_ANALYSES:'1'});expect((await post(base,{image:'bad'})).status).toBe(400);expect((await post(base)).status).toBe(200);const blocked=await post(base);expect(blocked.status).toBe(429);expect((await blocked.json()).code).toBe('DAILY_LIMIT');expect(provider).toHaveBeenCalledOnce()});
 it('returns JSON for rate limits so the browser can explain the retry',async()=>{const{base}=await start({RISKVERSE_REQUESTS_PER_MINUTE:'1'});expect((await post(base)).status).toBe(200);const blocked=await post(base);expect(blocked.headers.get('retry-after')).toBeTruthy();expect((await blocked.json()).code).toBe('RATE_LIMIT')});
});
