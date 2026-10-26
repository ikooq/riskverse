import {defineConfig,loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
import {createVisionHandler} from './server/vision';

export default defineConfig(({mode,isSsrBuild})=>{
 const env=loadEnv(mode,process.cwd(),['OPENAI_','GEMINI_']);
 return {
  plugins:[react(),{
   name:'riskverse-api',
   configureServer(server){
    const handler=createVisionHandler({geminiKey:process.env.GEMINI_API_KEY||env.GEMINI_API_KEY,geminiModel:process.env.GEMINI_MODEL||env.GEMINI_MODEL,key:process.env.OPENAI_API_KEY||env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL||env.OPENAI_MODEL});
    server.middlewares.use('/api',(req,res)=>{req.url='/api'+req.url;void handler(req,res)});
   },
  }],
  build:isSsrBuild?{target:'node22'}:{rollupOptions:{output:{manualChunks:{three:['three']}}}},
 };
});
