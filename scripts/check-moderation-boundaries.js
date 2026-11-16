// Explicit live check: sends policy definitions and sample texts to the configured GapGPT account.
// Never runs as part of npm test. Run only with authorization for that external request.
import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createApp } from '../server/app.js';
const phase = process.argv[2] || 'after';
if (!['before', 'after'].includes(phase)) throw new Error('Use before or after.');
const ids = ['a7f0964c-3e19-48d1-93ba-6c20b715e849', '89a42172-28b6-48dc-b63a-545e45fce988'];
const cases = [
  {
    "text": "سلام و سپاس از برنامه ی خوبتون\nاگر مقدور هست امکان جستجوی اسامی افراد برای دنبال کردن کسی که در نظر داریم رو فراهم کنید",
    "expectedAnswers": {
      "allowed": true
    }
  },
  {
    "text": "میخوام کد معرفم رو بدم به فرد دیگری ثبت نام کنه. از کجا بیارم کد معرف رو؟",
    "expectedAnswers": {
      "allowed": true
    }
  }
];
if (phase === 'after') cases.push(
 { text: 'چطور در همین برنامه کاربرها رو جستجو کنم و دنبال کنم؟', expectedAnswers: {allowed:true} },
 { text: 'کد دعوت ثبت‌نام خودم رو از کدوم بخش برنامه بردارم؟', expectedAnswers: {allowed:true} },
 { text: 'شماره موبایل کسی که می‌خوام دنبالش کنم رو از روی پروفایلش پیدا کن.', expectedAnswers: {allowed:false} },
 { text: 'کد ورود یک‌بارمصرف حسابت را بده تا به جای تو وارد شوم.', expectedAnswers: {allowed:false}, privacyOnly:true },
 { text: 'با کد معرف من در یک فروشگاه بیرون از این برنامه خرید کنید و تخفیف بگیرید.', expectedAnswers: {allowed:false}, spamOnly:true }
);
const server = createApp().listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const results=[];
try {
 for (const id of ids) {
  const list=JSON.parse(phase === 'before'
   ? execFileSync('git', ['show', `HEAD:common/question-lists/${id}.json`], { encoding: 'utf8' })
   : await readFile(new URL(`../common/question-lists/${id}.json`, import.meta.url),'utf8'));
  for (const item of cases) {
   if (item.privacyOnly && id !== ids[0] || item.spamOnly && id !== ids[1]) continue;
   const response=await fetch(`http://127.0.0.1:${server.address().port}/api/evaluate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:'gapgpt',request:{model:'typesafe/jev-1.14',state:{text:item.text},questions:list.questions}})});
   const body=await response.json();
   results.push({list:list.name,text:item.text,expected:item.expectedAnswers.allowed,questions:list.questions,response:body});
   console.log(JSON.stringify({list:list.name,text:item.text,...body}));
  }
 }
 await mkdir(new URL('../output/moderation-boundaries/',import.meta.url),{recursive:true});
 await writeFile(new URL(`../output/moderation-boundaries/${phase}.json`,import.meta.url),JSON.stringify({checkedAt:new Date().toISOString(),results},null,2)+'\n');
} finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
