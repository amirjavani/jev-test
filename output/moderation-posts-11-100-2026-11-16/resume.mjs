// Resume pending rows only; user explicitly approved repeating the uncertain row 36.
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { normalizeUsage } from '../../shared/usage.js';
const dir=new URL('./',import.meta.url);
dotenv.config({path:fileURLToPath(new URL('../../.env',import.meta.url)),quiet:true});
const key=process.env.GAPGPT_API_KEY?.trim();
if(!key)throw Error('Missing key');
const results=JSON.parse(await fs.readFile(new URL('results.json',dir),'utf8'));
const uncertain=results.entries.filter(e=>e.status==='running');
if(uncertain.some(e=>e.number!==36))throw Error('Unapproved uncertain request');
results.recovery={uncertainPriorRequest:{post:36,reason:'Process exited after a file write error before its response could be persisted',priorOutcome:'unknown',usage:null},retryExplicitlyAuthorizedByUser:true,reportedUsageExcludesUnrecordedAttempt:true};
async function writeJson(file,value){
 const target=new URL(file,dir),temporary=new URL(file+'.tmp',dir);
 const content=JSON.stringify(value,null,2)+'\n';
 let last;
 for(let attempt=0;attempt<10;attempt++)try{await fs.writeFile(temporary,content);await fs.rename(temporary,target);return;}catch(e){last=e;await new Promise(resolve=>setTimeout(resolve,200*(attempt+1)));}
 throw last;
}
const classify=p=>p>0.9?true:p<0.3?false:'human';
const keys=Object.keys(results.questions);
for(const entry of results.entries){
 if(entry.status==='success'||entry.status==='error')continue;
 entry.request={model:results.model,state:{text:entry.text},questions:results.questions};
 entry.status='running';
 await writeJson('results.json',results);
 const start=performance.now();
 try{
  const response=await fetch(results.endpoint,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(entry.request),signal:AbortSignal.timeout(120000)});
  entry.httpStatus=response.status;
  const raw=(await response.text()).split(key).join('[REDACTED]');
  try{entry.rawResponse=JSON.parse(raw);}catch{entry.rawResponse=raw;}
  entry.usage=normalizeUsage(entry.rawResponse?.usage);
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  entry.policyResults=Object.fromEntries(keys.map(name=>{const answer=entry.rawResponse?.answers?.[name],p=answer?.noul;const valid=typeof p==='number'&&Number.isFinite(p)&&p>=0&&p<=1&&(answer.type===undefined||answer.type==='noul');return[name,{probability:valid?p:null,allowedPercent:valid?p*100:null,violationPercent:valid?(1-p)*100:null,decision:valid?classify(p):'error'}];}));
  const decisions=Object.values(entry.policyResults).map(p=>p.decision);
  entry.aggregateAllowed=decisions.includes(false)?false:decisions.includes('error')?'error':decisions.includes('human')?'human':true;
  entry.status=decisions.includes('error')?'error':'success';
  if(entry.status==='error')entry.error='Missing or invalid probability';
  entry.comparison=typeof entry.aggregateAllowed==='boolean'&&typeof entry.expectedAnswers.allowed==='boolean'?(entry.aggregateAllowed===entry.expectedAnswers.allowed?'match':'mismatch'):entry.aggregateAllowed==='human'?'human':'unscored';
 }catch(e){entry.status='error';entry.error=e.message;entry.comparison='unscored';}
 entry.durationMs=Math.round(performance.now()-start);
 // Store a small per-post record before updating the full checkpoint.
 await writeJson(`post-${entry.number}.json`,entry);
 await writeJson('results.json',results);
 console.log(JSON.stringify({post:entry.number,status:entry.status,decision:entry.aggregateAllowed,comparison:entry.comparison,error:entry.error}));
}
results.finishedAt=new Date().toISOString();
await writeJson('results.json',results);
console.log(JSON.stringify({finished:true,succeeded:results.entries.filter(e=>e.status==='success').length,failed:results.entries.filter(e=>e.status==='error').length}));
