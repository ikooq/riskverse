import {createServer} from 'node:http';
import {createVisionHandler} from './vision';
try{process.loadEnvFile('.env.local')}catch{}
createServer(createVisionHandler({geminiKey:process.env.GEMINI_API_KEY,geminiModel:process.env.GEMINI_MODEL,key:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL})).listen(8787,'127.0.0.1',()=>console.log('RISKVERSE API: http://127.0.0.1:8787'));
