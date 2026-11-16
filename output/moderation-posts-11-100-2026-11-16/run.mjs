// User-authorized continuation: only dataset rows 11–100 go to GapGPT.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { combineQuestionLists } from '../../shared/selected-question-lists.js';
import { normalizeUsage } from '../../shared/usage.js';
const root = new URL('../../', import.meta.url);
const dir = new URL('./', import.meta.url);
dotenv.config({path:fileURLToPath(new URL('.env',root)),quiet:true});
const key = process.env.GAPGPT_API_KEY?.trim();
if (!key) throw Error('GAPGPT_API_KEY missing');
const priorPath = new URL('output/moderation-first-10-2026-11-16/results.json',root);
const prior = JSON.parse(await fs.readFile(priorPath,'utf8'));
const source = await fs.readFile(new URL('output/post-moderation-dataset.json',root),'utf8');
const dataset = JSON.parse(source);
const sha256 = createHash('sha256').update(source).digest('hex');
if (prior.sourceDataset.sha256 !== sha256) throw Error('Dataset changed since first run');
if (prior.entries.length !== 10 || prior.entries.some(e=>e.status!=='success')) throw Error('Expected original ten successful records');
const lists = await Promise.all(prior.lists.map(async l=>JSON.parse(await fs.readFile(new URL(l.file,root),'utf8'))));
if(JSON.stringify(combineQuestionLists(lists).questions)!==JSON.stringify(prior.questions)) throw Error('Policy definitions changed');
const results = {
  startedAt:new Date().toISOString(), dateTimezone:'Asia/Tehran', provider:prior.provider,endpoint:prior.endpoint,model:prior.model,
  sourceDataset:{...prior.sourceDataset,selectedRange:[11,100]}, lists:prior.lists,questions:prior.questions,evaluationPrompt:prior.evaluationPrompt,
  rules:{...prior.rules,references:'The supplied expectedAnswers.allowed is frozen before requests and used only against the combined decision. No independent per-policy reference labels are supplied or scored for this batch.',proposedReferenceNotes:undefined},
  pricing:{...prior.pricing,verifiedDate:'2026-11-16'},referencesRecordedAt:new Date().toISOString(),
  entries:dataset.slice(10,100).map((item,i)=>({number:i+11,text:item.text,expectedAnswers:item.expectedAnswers,status:'pending'})),
};
await fs.writeFile(new URL('inputs-before-run.json',dir),JSON.stringify(results,null,2)+'\n',{flag:'wx'});
await fs.writeFile(new URL('first-10-original-results.json',dir),JSON.stringify(prior,null,2)+'\n',{flag:'wx'});
await fs.copyFile(new URL('output/moderation-first-10-2026-11-16/report.fa.md',root),new URL('first-10-original-report.fa.md',dir),fs.constants.COPYFILE_EXCL);
const classify=p=>p>0.9?true:p<0.3?false:'human';
const aggregate=vs=>vs.includes(false)?false:vs.includes('error')?'error':vs.includes('human')?'human':true;
const keys=Object.keys(results.questions);
for(const entry of results.entries){
  entry.request={model:results.model,state:{text:entry.text},questions:results.questions};
  entry.status='running';
  await fs.writeFile(new URL('results.json',dir),JSON.stringify(results,null,2)+'\n');
  const start=performance.now();
  try{
    const response=await fetch(results.endpoint,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(entry.request),signal:AbortSignal.timeout(120000)});
    entry.httpStatus=response.status;
    const raw=(await response.text()).split(key).join('[REDACTED]');
    try{entry.rawResponse=JSON.parse(raw);}catch{entry.rawResponse=raw;}
    entry.usage=normalizeUsage(entry.rawResponse?.usage);
    if(!response.ok)throw Error(`HTTP ${response.status}`);
    entry.policyResults=Object.fromEntries(keys.map(name=>{
      const answer=entry.rawResponse?.answers?.[name];
      const p=answer?.noul;
      const valid=typeof p==='number'&&Number.isFinite(p)&&p>=0&&p<=1&&(answer.type===undefined||answer.type==='noul');
      return [name,{probability:valid?p:null,allowedPercent:valid?p*100:null,violationPercent:valid?(1-p)*100:null,decision:valid?classify(p):'error'}];
    }));
    entry.aggregateAllowed=aggregate(Object.values(entry.policyResults).map(p=>p.decision));
    entry.status=Object.values(entry.policyResults).some(p=>p.decision==='error')?'error':'success';
    if(entry.status==='error')entry.error='Missing or invalid original probability';
    entry.comparison=typeof entry.aggregateAllowed==='boolean'&&typeof entry.expectedAnswers.allowed==='boolean'?(entry.aggregateAllowed===entry.expectedAnswers.allowed?'match':'mismatch'):entry.aggregateAllowed==='human'?'human':'unscored';
  }catch(e){entry.status='error';entry.error=e.message;entry.comparison='unscored';}
  entry.durationMs=Math.round(performance.now()-start);
  await fs.writeFile(new URL('results.json',dir),JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify({post:entry.number,status:entry.status,decision:entry.aggregateAllowed,comparison:entry.comparison,error:entry.error}));
}
results.finishedAt=new Date().toISOString();
await fs.writeFile(new URL('results.json',dir),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify({finished:true,succeeded:results.entries.filter(e=>e.status==='success').length,failed:results.entries.filter(e=>e.status==='error').length}));
