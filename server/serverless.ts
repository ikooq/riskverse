import type {IncomingMessage,ServerResponse} from 'node:http';
import {createVisionHandler,type Config} from './vision.js';

/** Best-effort limits per warm function instance. Provider quotas remain the global limit. */
export function createServerlessHandler(env:NodeJS.ProcessEnv=process.env,vision?:Config,now=Date.now){
 const number=(key:string,fallback:number,min:number,max:number)=>{const n=env[key]===undefined?fallback:Number(env[key]);if(!Number.isInteger(n)||n<min||n>max)throw Error(`Invalid ${key}`);return n};
 const perMinute=number('RISKVERSE_REQUESTS_PER_MINUTE',5,1,100);
 const daily=number('RISKVERSE_DAILY_ANALYSES',30,0,10000);
 const clients=new Map<string,{start:number;count:number}>();
 let day='',calls=0;
 const config=vision??{geminiKey:env.GEMINI_API_KEY,geminiModel:env.GEMINI_MODEL,key:env.OPENAI_API_KEY,model:env.OPENAI_MODEL};
 const handler=createVisionHandler({...config,fetcher:async(input,init)=>{
  const today=new Date(now()).toISOString().slice(0,10);if(day!==today){day=today;calls=0}
  if(calls>=daily)return new Response(JSON.stringify({error:{code:'insufficient_quota'}}),{status:429});
  calls++;return (config.fetcher||fetch)(input,init);
 }});
 return async(req:IncomingMessage,res:ServerResponse)=>{
  const send=(status:number,code:string,error:string,retry?:number)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(retry?{'Retry-After':String(retry)}:{})});res.end(JSON.stringify({code,error}))};
  // The deployment's API uses the request host, including Vercel preview domains.
  if(req.headers.origin){try{const origin=new URL(req.headers.origin);if(origin.host!==req.headers.host||!['https:','http:'].includes(origin.protocol)){send(403,'INVALID_ORIGIN','Недопустимый источник запроса.');return}}catch{send(403,'INVALID_ORIGIN','Недопустимый источник запроса.');return}}
  if((req.url||'').split('?')[0]==='/api/analyze'&&req.method==='POST'){
   const today=new Date(now()).toISOString().slice(0,10);if(day!==today){day=today;calls=0}
   if(calls>=daily){send(429,'DAILY_LIMIT','Достигнут дневной лимит анализа. Повторите позже.',3600);return}
   const time=now();for(const [key,value]of clients)if(time-value.start>=60000)clients.delete(key);
   // This header is overwritten by Vercel's proxy. Local Node runtime uses socket IP instead.
   const ip=env.VERCEL==='1'?String(req.headers['x-vercel-forwarded-for']||req.socket.remoteAddress||'unknown'):req.socket.remoteAddress||'unknown';
   let rate=clients.get(ip);if(!rate){if(clients.size>=1000){send(429,'SERVER_BUSY','Сервер занят. Повторите позже.',60);return}rate={start:time,count:0};clients.set(ip,rate)}
   if(rate.count>=perMinute){send(429,'RATE_LIMIT','Слишком много запросов. Повторите через минуту.',Math.max(1,Math.ceil((rate.start+60000-time)/1000)));return}rate.count++;
  }
  try{await handler(req,res)}catch{if(!res.headersSent)send(500,'SERVER_ERROR','Не удалось выполнить запрос.')}
 };
}
