import {createRuntimeServer,runtimeConfig} from './runtime';

try{process.loadEnvFile('.env.local')}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error}
const config=runtimeConfig();
const server=await createRuntimeServer(config,{geminiKey:process.env.GEMINI_API_KEY,geminiModel:process.env.GEMINI_MODEL,key:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL});
server.on('error',(error)=>{console.error(`RISKVERSE failed to start: ${error.message}`);process.exitCode=1});
server.listen(config.port,config.host,()=>console.log(`RISKVERSE: http://${config.host}:${config.port} · frontend + API`));
let stopping=false;
const stop=()=>{if(stopping)return;stopping=true;server.close(()=>{process.exitCode=0});server.closeIdleConnections();setTimeout(()=>server.closeAllConnections(),65000).unref()};
process.on('SIGTERM',stop);process.on('SIGINT',stop);
