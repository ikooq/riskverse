import {createHash} from 'node:crypto';
import {ApiError} from './httpError.js';

// Lua executes atomically on the primary Redis node, including the expiration.
const RATE_SCRIPT=`local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; if n>tonumber(ARGV[1]) then return {0,redis.call('TTL',KEYS[1])} end; return {1,0}`;
const DAILY_SCRIPT=`local n=tonumber(redis.call('GET',KEYS[1]) or '0'); if n>=tonumber(ARGV[1]) then return {0,tonumber(ARGV[2])} end; redis.call('INCR',KEYS[1]); redis.call('EXPIRE',KEYS[1],tonumber(ARGV[2])+60); return {1,0}`;
export type SharedLimits={rate:(ip:string)=>Promise<void>;providerAttempt:()=>Promise<void>};
export function sharedLimits(env:NodeJS.ProcessEnv,perMinute:number,daily:number,fetcher:typeof fetch=fetch,now=Date.now):SharedLimits|null{
 const url=env.KV_REST_API_URL||env.UPSTASH_REDIS_REST_URL,token=env.KV_REST_API_TOKEN||env.UPSTASH_REDIS_REST_TOKEN;
 if(!url&&!token)return null;
 const unavailable=()=>new ApiError(503,'LIMITER_UNAVAILABLE','Проверка лимита временно недоступна. Новый анализ не запущен. Повторите позже.',15);
 let endpoint:URL;try{endpoint=new URL(url||'');if(endpoint.protocol!=='https:'||!endpoint.hostname.endsWith('.upstash.io')||endpoint.username||endpoint.password||endpoint.search||endpoint.hash||!token)throw Error()}catch{throw unavailable()}
 const prefix=`riskverse:${env.VERCEL_ENV==='preview'?'preview':'production'}`;
 async function run(script:string,key:string,args:number[],code:string,message:string){
  let result:unknown;
  try{const response=await fetcher(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(['EVAL',script,1,key,...args]),signal:AbortSignal.timeout(2500)});if(!response.ok)throw Error();const data=await response.json() as {result?:unknown;error?:unknown};if(data.error)throw Error();result=data.result}catch{throw unavailable()}
  if(!Array.isArray(result)||result.length!==2||![0,1].includes(Number(result[0]))||!Number.isFinite(Number(result[1])))throw unavailable();
  if(Number(result[0])===0)throw new ApiError(429,code,message,Math.max(1,Number(result[1])));
 }
 return{
  async rate(ip){const hash=createHash('sha256').update(prefix+'|'+ip).digest('hex').slice(0,32);await run(RATE_SCRIPT,`${prefix}:minute:${hash}`,[perMinute],'RATE_LIMIT','Слишком много запросов. Повторите через минуту.')},
  async providerAttempt(){const time=now(),date=new Date(time).toISOString().slice(0,10),ttl=Math.max(1,Math.ceil((Date.parse(`${date}T00:00:00Z`)+86400000-time)/1000));await run(DAILY_SCRIPT,`${prefix}:day:${date}`,[daily,ttl],'DAILY_LIMIT','Дневной лимит анализа сайта исчерпан. Повторите завтра.')},
 };
}
