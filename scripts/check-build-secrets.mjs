import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';

try{process.loadEnvFile('.env.local')}catch(error){if(error.code!=='ENOENT')throw error}
const keys=[process.env.GEMINI_API_KEY,process.env.OPENAI_API_KEY].filter(value=>value&&value.length>12);
let checked=0;
async function scan(folder){
 for(const entry of await readdir(folder,{withFileTypes:true})){
  const file=path.join(folder,entry.name);
  if(entry.isSymbolicLink())throw Error(`Build must not contain links: ${file}`);
  if(entry.isDirectory()){await scan(file);continue}
  if(/^\.env(?:\.|$)/.test(entry.name))throw Error(`Environment file in build: ${file}`);
  const bytes=await readFile(file);checked++;
  if(keys.some(key=>bytes.includes(Buffer.from(key))))throw Error(`Configured API key found in build: ${file}`);
 }
}
await scan('dist');await scan('dist-server');
console.log(`Checked ${checked} build files. No configured API keys embedded (${keys.length} configured keys checked).`);
