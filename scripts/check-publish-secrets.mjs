import {execFileSync} from 'node:child_process';
try{process.loadEnvFile('.env.local')}catch(error){if(error.code!=='ENOENT')throw error}
const keys=[process.env.GEMINI_API_KEY,process.env.OPENAI_API_KEY].filter(value=>value&&value.length>12);
const files=execFileSync('git',['diff','--cached','--name-only','-z']).toString().split('\0').filter(Boolean);
for(const file of files){
 if(/(^|\/)(?:\.env(?:\.|$)|node_modules\/|output\/|\.vercel\/)/.test(file)&&file!=='.env.example')throw Error(`Private or generated path staged: ${file}`);
 const bytes=execFileSync('git',['show',`:${file}`],{maxBuffer:20*1024*1024});
 if(keys.some(key=>bytes.includes(Buffer.from(key))))throw Error(`Configured API key staged: ${file}`);
 if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AIza[A-Za-z0-9_-]{32,}/.test(bytes.toString()))throw Error(`Credential pattern staged: ${file}`);
}
console.log(`Checked ${files.length} staged files. No configured keys or credential patterns found; environment files excluded.`);
