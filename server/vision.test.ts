import {afterEach,describe,expect,it,vi} from 'vitest';
import {createServer,type Server} from 'node:http';
import {createVisionHandler,type Config} from './vision';
const servers:Server[]=[];
async function start(config:Config){
 // An OS-assigned port can belong to Fetch's restricted-port list. Retry the
 // allocation, not the assertion, so API failures remain visible.
 for(let attempt=0;attempt<5;attempt++){
  const server=createServer(createVisionHandler(config));servers.push(server);
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  const address=server.address() as {port:number},base=`http://127.0.0.1:${address.port}`;
  try{const response=await fetch(base+'/api/health');await response.arrayBuffer();return base}
  catch(error){
   const cause=(error as {cause?:{message?:string}}).cause;
   if(cause?.message!=='bad port')throw error;
   await new Promise<void>(resolve=>{server.close(()=>resolve());server.closeAllConnections()});
  }
 }
 throw Error('Could not allocate a local port accepted by Fetch');
}
afterEach(async()=>{await Promise.all(servers.splice(0).map(s=>new Promise<void>((resolve)=>{s.close(()=>resolve());s.closeAllConnections()})))});
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXtQAAAAASUVORK5CYII=';
const report={summary:'На фото виден объект.',limitations:['Нужны размеры.'],observations:[{id:'1',label:'Паллета',kind:'pallet',region:{x:.1,y:.2,w:.3,h:.4},concern:'potential_hazard',visibleEvidence:'Предмет на разметке.',uncertainty:'Назначение разметки неизвестно.',recommendation:'Проверить проход.'}]};
const post=(base:string,body:unknown,headers={})=>fetch(base+'/api/analyze',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
const completed=(value:unknown)=>new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]}));
const geminiCompleted=(value:unknown)=>new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]}));
describe('vision API (local transport, mocked provider)',()=>{
 it('reports missing configuration and never calls provider',async()=>{const provider=vi.fn();const base=await start({fetcher:provider});expect((await(await fetch(base+'/api/health')).json()).ready).toBe(false);expect((await post(base,{image})).status).toBe(503);expect(provider).not.toHaveBeenCalled()});
 it('sends an image and strict schema, returns validated observations',async()=>{const provider=vi.fn(async(_input:Parameters<typeof fetch>[0],_options?:RequestInit)=>completed(report));const base=await start({key:'test-only',fetcher:provider});const r=await post(base,{image});expect(r.status).toBe(200);expect((await r.json()).report).toEqual(report);const options=provider.mock.calls[0][1] as RequestInit;const sent=JSON.parse(String(options.body));expect(sent.store).toBe(false);expect(sent.text.format.strict).toBe(true);expect(sent.input[0].content[1].image_url).toBe(image)});
 it('uses Gemini for multimodal analysis when a Gemini key is configured',async()=>{const provider=vi.fn(async()=>geminiCompleted(report));const base=await start({geminiKey:'gemini-test-key',fetcher:provider});const health=await(await fetch(base+'/api/health')).json();expect(health).toMatchObject({ready:true,provider:'gemini',model:'gemini-3.1-flash-lite'});const response=await post(base,{image});expect(response.status).toBe(200);expect((await response.json())).toMatchObject({report,provider:'gemini',model:'gemini-3.1-flash-lite'});const [url,options]=provider.mock.calls[0] as unknown as [string,RequestInit];expect(url).toContain('generativelanguage.googleapis.com');expect(new Headers(options.headers).get('x-goog-api-key')).toBe('gemini-test-key');const sent=JSON.parse(String(options.body));expect(sent.systemInstruction.parts[0].text).toContain('being present is not by itself a potential hazard');expect(sent.systemInstruction.parts[0].text).toContain('Do not infer a vehicle lane');expect(sent.generationConfig.responseMimeType).toBe('application/json');expect(sent.generationConfig.responseSchema.properties.observations.type).toBe('ARRAY');expect(sent.generationConfig.responseSchema.properties.observations.items.properties.region.properties.x.minimum).toBe(0);expect(sent.generationConfig.thinkingConfig.thinkingLevel).toBe('MINIMAL');expect(sent.contents[0].parts[1].inline_data.mime_type).toBe('image/png');expect(sent.contents[0].parts[1].inline_data.data).toBe(image.split(',')[1])});
 it('rejects external origin and disguised uploads before provider call',async()=>{const provider=vi.fn();const base=await start({key:'test-only',fetcher:provider});expect((await post(base,{image},{Origin:'https://example.com'})).status).toBe(403);expect((await post(base,{image:'https://example.com/private.jpg'})).status).toBe(400);expect((await post(base,{image:'data:image/png;base64,YWJjZA=='})).status).toBe(400);expect(provider).not.toHaveBeenCalled()});
 it('does not leak upstream credentials or error bodies',async()=>{const base=await start({key:'test-only',fetcher:vi.fn(async()=>new Response('private provider detail',{status:401}))});const r=await post(base,{image});const body=await r.text();expect(r.status).toBe(502);expect(body).not.toContain('private');expect(body).not.toContain('test-only')});
 it('rejects out-of-image regions and duplicate IDs',async()=>{for(const invalid of [{...report,observations:[{...report.observations[0],region:{x:.9,y:0,w:.5,h:.5}}]},{...report,observations:[report.observations[0],report.observations[0]]}]){const base=await start({key:'test-only',fetcher:vi.fn(async()=>completed(invalid))});expect((await post(base,{image})).status).toBe(502)}});
 it('handles model refusal explicitly',async()=>{const base=await start({key:'test-only',fetcher:vi.fn(async()=>new Response(JSON.stringify({status:'completed',output:[{content:[{type:'refusal'}]}]})))});expect((await post(base,{image})).status).toBe(422)});
 it('distinguishes an exhausted balance from ordinary rate limits',async()=>{for(const code of ['credit_balance_exhausted','rate_limit_exceeded']){const base=await start({key:'test-only',fetcher:vi.fn(async()=>new Response(JSON.stringify({error:{code}}),{status:429}))});const r=await post(base,{image});expect((await r.json()).code).toBe(code==='credit_balance_exhausted'?'BILLING_REQUIRED':'RATE_LIMIT')}});
 it('explains a Gemini project-access denial without exposing provider payloads',async()=>{const base=await start({geminiKey:'test-only',fetcher:vi.fn(async()=>new Response(JSON.stringify({error:{status:'PERMISSION_DENIED',message:'Your project has been denied access. Please contact support.'}}),{status:403}))});const response=await post(base,{image});const body=await response.json();expect(response.status).toBe(403);expect(body.code).toBe('PROJECT_ACCESS_DENIED');expect(body.error).toContain('Google');expect(body.error).not.toContain('Please contact support')});
});
