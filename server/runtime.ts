import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import {createReadStream} from 'node:fs';
import {realpath, stat} from 'node:fs/promises';
import path from 'node:path';
import {createVisionHandler, type Config as VisionConfig} from './vision';

export type RuntimeConfig={host:string;port:number;dist:string;publicOrigin?:string;requestsPerMinute:number;dailyAnalyses:number};
export function runtimeConfig(env:NodeJS.ProcessEnv=process.env,root=process.cwd()):RuntimeConfig{
 const integer=(name:string,fallback:number,min:number,max:number)=>{const value=env[name]===undefined?fallback:Number(env[name]);if(!Number.isInteger(value)||value<min||value>max)throw Error(`${name}: expected an integer between ${min} and ${max}.`);return value};
 const host=env.HOST?.trim()||'127.0.0.1';
 let publicOrigin:string|undefined;
 if(env.PUBLIC_ORIGIN){const url=new URL(env.PUBLIC_ORIGIN);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('PUBLIC_ORIGIN must be an http(s) origin without a path.');publicOrigin=url.origin}
 return {host,port:integer('PORT',8787,1,65535),dist:path.resolve(root,'dist'),publicOrigin,requestsPerMinute:integer('RISKVERSE_REQUESTS_PER_MINUTE',5,1,100),dailyAnalyses:integer('RISKVERSE_DAILY_ANALYSES',100,0,10000)};
}
const MIME:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2'};
function json(res:ServerResponse,status:number,value:unknown,retry?:number){if(res.destroyed||res.headersSent)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...(retry?{'Retry-After':String(retry)}:{})});res.end(JSON.stringify(value))}

/** Limits are process-local, intentionally conservative behind a reverse proxy. */
export async function createRuntimeServer(config:RuntimeConfig,vision:VisionConfig,now=Date.now){
 const root=await realpath(config.dist).catch(()=>{throw Error('Build not found. Run npm run build before npm start.')});
 if(!(await stat(path.join(root,'index.html')).catch(()=>null))?.isFile())throw Error('Build not found. Run npm run build before npm start.');
 const clients=new Map<string,{start:number;count:number}>();
 let active=false,day='',calls=0;
 const handler=createVisionHandler({...vision,fetcher:async(input,init)=>{
  const today=new Date(now()).toISOString().slice(0,10);if(today!==day){day=today;calls=0}
  if(calls>=config.dailyAnalyses)return new Response(JSON.stringify({error:{code:'insufficient_quota'}}),{status:429,headers:{'Content-Type':'application/json'}});
  calls++;return (vision.fetcher||fetch)(input,init);
 }});
 const server=createServer((req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' data: blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  res.setTimeout(65000,()=>res.destroy());
  void route(req,res).catch(()=>json(res,500,{error:'Внутренняя ошибка сервера.'}));
 });
 server.headersTimeout=10000;server.requestTimeout=65000;server.keepAliveTimeout=5000;
 async function route(req:IncomingMessage,res:ServerResponse){
  let name:string;try{name=decodeURIComponent((req.url||'/').split('?')[0])}catch{json(res,400,{error:'Некорректный адрес.'});return}
  if(!name.startsWith('/')||name.includes('\\')||name.includes('\0')||name.split('/').some(s=>s.startsWith('.'))){json(res,404,{error:'Файл не найден.'});return}
  if(name==='/healthz'||name==='/readyz'){json(res,200,{status:'ok'});return}
  if(name==='/api'||name.startsWith('/api/')){
   if(config.publicOrigin){const expected=new URL(config.publicOrigin);if(req.headers.host!==expected.host||req.headers.origin&&req.headers.origin!==expected.origin){json(res,403,{error:'Недопустимый источник запроса.'});return}}
   if(name==='/api/analyze'&&req.method==='POST'){
    if(active){json(res,429,{code:'SERVER_BUSY',error:'Анализ уже выполняется. Дождитесь завершения.'},5);return}
    const today=new Date(now()).toISOString().slice(0,10);if(today!==day){day=today;calls=0}
    if(calls>=config.dailyAnalyses){json(res,429,{code:'DAILY_LIMIT',error:'Достигнут дневной лимит анализа этого сервера. Повторите завтра.'},Math.max(1,Math.ceil((Date.parse(`${today}T00:00:00Z`)+86400000-now())/1000)));return}
    const time=now(),ip=req.socket.remoteAddress||'unknown';
    for(const [key,value] of clients)if(time-value.start>=60000)clients.delete(key);
    let rate=clients.get(ip);if(!rate){if(clients.size>=1000){json(res,429,{error:'Сервер временно перегружен.'},60);return}rate={start:time,count:0};clients.set(ip,rate)}
    if(rate.count>=config.requestsPerMinute){json(res,429,{code:'RATE_LIMIT',error:'Слишком много запросов. Повторите через минуту.'},Math.max(1,Math.ceil((rate.start+60000-time)/1000)));return}
    rate.count++;active=true;
    const release=()=>{active=false;res.off('close',release);res.off('finish',release)};res.once('close',release);res.once('finish',release);
   }
   await handler(req,res);return;
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){res.setHeader('Allow','GET, HEAD');json(res,405,{error:'Метод не поддерживается.'});return}
  let target=path.resolve(root,'.'+name),info=await stat(target).catch(()=>null);
  if(!info?.isFile()){
   if(path.extname(name)||name!=='/'&&!req.headers.accept?.includes('text/html')){json(res,404,{error:'Файл не найден.'});return}
   target=path.join(root,'index.html');info=await stat(target);
  }
  const actual=await realpath(target),relative=path.relative(root,actual);
  if(relative.startsWith('..')||path.isAbsolute(relative)||!MIME[path.extname(actual)]){json(res,404,{error:'Файл не найден.'});return}
  res.writeHead(200,{'Content-Type':MIME[path.extname(actual)],'Content-Length':info.size,'Cache-Control':relative.startsWith('assets'+path.sep)?'public, max-age=31536000, immutable':'no-cache'});
  if(req.method==='HEAD'){res.end();return}
  const stream=createReadStream(actual);stream.on('error',()=>res.destroy());stream.pipe(res);
 }
 return server;
}
