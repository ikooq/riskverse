import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';

try{process.loadEnvFile('.env.local')}catch(error){if(error.code!=='ENOENT')throw error}
const keys=['GEMINI_API_KEY','OPENAI_API_KEY','UPSTASH_REDIS_REST_TOKEN','KV_REST_API_TOKEN','RISKVERSE_ACCESS_CODE'].map(name=>process.env[name]).filter(value=>value&&value.length>=8);
let checked=0;
async function scan(folder){
 for(const entry of await readdir(folder,{withFileTypes:true})){
  const file=path.join(folder,entry.name);
  if(entry.isSymbolicLink())throw Error(`Build must not contain links: ${file}`);
  if(entry.isDirectory()){await scan(file);continue}
  if(/^\.env(?:\.|$)/.test(entry.name))throw Error(`Environment file in build: ${file}`);
  const bytes=await readFile(file);checked++;
  if(keys.some(key=>bytes.includes(Buffer.from(key))))throw Error(`Configured API key found in build: ${file}`);
  if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AIza[A-Za-z0-9_-]{32,}/.test(bytes.toString()))throw Error(`Credential pattern in build: ${file}`);
 }
}
await scan('dist');await scan('dist-server');
console.log(`Checked ${checked} build files. No configured API keys embedded (${keys.length} configured keys checked).`);
