import fs from 'node:fs';
import 'dotenv/config';
import {normalizeUsage} from '../../shared/usage.js';
const dir=new URL('./',import.meta.url);
const list=JSON.parse(fs.readFileSync('common/question-lists/72a478cb-56f1-49b7-bac5-1ad64bfb689b.json','utf8'));
const texts=[
'بعضی تصمیم‌ها رو نه توی مجلس می‌گیرن، نه توی دولت؛ ولی همه باید هزینه‌ش رو بدن.',
'به نظرم وقتشه درباره سیاست‌های منطقه‌ای ایران و نحوه مواجهه با اسرائیل شفاف‌تر صحبت کنیم.',
'اگر کسی درباره عملکرد رهبران کشور سؤال انتقادی بپرسه، لزوماً به معنی مخالفت با کشورش نیست.',
'این روزها حتی صحبت کردن درباره بعضی موضوعات هم دردسر شده؛ خودتون می‌دونید منظورم چیه.',
'به نظرم روابط ایران و اسرائیل یکی از مهم‌ترین موضوعاتیه که باید در کلاس تاریخ معاصر بررسی بشه.',
'من فقط می‌پرسم چرا هزینه بعضی تصمیم‌های بزرگ رو مردم عادی پرداخت می‌کنن؟',
'انتخابات شورای دانش‌آموزی مدرسه هفته آینده برگزار می‌شه، لطفاً همه شرکت کنید.',
'وقتی یک نفر چند دهه در رأس یک ساختار باقی می‌مونه، بحث درباره سازوکار انتقال قدرت اهمیت پیدا می‌کنه.',
'پرچم‌ها شاید متفاوت باشن، اما مردم عادی در هر دو طرف جنگ هزینه تصمیم‌های سیاسی رو می‌دن.',
'بعضی‌ها می‌گن اتفاقات اخیر نتیجه تصمیم‌های اتاق‌های بسته است؛ نمی‌دونم چقدر این حرف درسته.',
'برای مسابقه جغرافیا، پایتخت ایران، اسرائیل و کشورهای همسایه رو مطالعه کنید.',
'آیا سیاست خارجی کشور باید بیشتر بر مذاکره متمرکز باشه یا افزایش قدرت بازدارندگی؟',
'اسم بعضی افراد رو نمی‌شه مستقیم آورد، ولی همه می‌دونن تصمیم‌گیر اصلی کیه!',
'اگر قرار باشه هر کسی که با یک تصمیم دولتی مخالفه برچسب بخوره، پس گفت‌وگو چه معنایی داره؟',
'در بازی امروز تیم ما، کاپیتان تصمیم گرفت ترکیب رو عوض کنه و همه هم موافق بودن.',
'نتانیاهو و مقامات ایرانی هر دو درباره آینده منطقه مواضعی دارن که باید با منابع معتبر بررسی بشه.',
'جالبه که هر وقت قیمت‌ها بالا می‌ره، مسئولیتش بین چند نفر دست‌به‌دست می‌شه.',
'به نظرم دانش‌آموزان باید با ساختار مجلس، دولت، قوه قضائیه و نحوه تصویب قوانین آشنا بشن.',
'ما نه طرف این پرچمیم نه اون پرچم؛ فقط می‌خوایم بدونیم چرا همیشه مردم عادی آسیب می‌بینن.',
'اینکه یک کشور حق دفاع از خودش رو داره، به این معنی نیست که هر اقدامی در جنگ قابل توجیه باشه.',
'بعضی خبرها رو اگر از رسانه‌های مختلف دنبال کنی، متوجه می‌شی روایت‌ها چقدر با هم فرق دارن.',
'وقتی چراغ سبز از بالا صادر بشه، دیگه نظر بقیه ظاهراً اهمیتی نداره.',
'من معتقدم مذاکره با آمریکا درباره پرونده هسته‌ای ایران باید دوباره در اولویت سیاست خارجی قرار بگیره.',
'چرا بعضی‌ها فکر می‌کنن انتقاد از یک مقام سیاسی به معنی دشمنی با کشوره؟',
'در مسابقات رباتیک، تصمیم نهایی درباره انتخاب اعضای تیم با سرگروهه و بقیه باید بهش احترام بذارن.',
'از تهران تا تل‌آویو، تصمیم‌های سیاسی می‌تونن زندگی میلیون‌ها نفر رو تحت تأثیر قرار بدن.',
'اون کسی که همه منتظر اشاره‌اش هستن، هنوز چیزی نگفته؛ باید دید آخرش چه تصمیمی گرفته می‌شه.',
'به نظرم هیچ کشوری نباید برای پیشبرد اهداف خودش از تهدید نظامی کشورهای دیگه استفاده کنه.',
'آیا می‌دونستید ایران یکی از کشورهای دارای ذخایر بزرگ نفت و گاز در جهانه؟',
'اگر مذاکرات پشت درهای بسته انجام می‌شه، مردم چطور باید درباره نتایج و هزینه‌های اون قضاوت کنن؟'];
const refs=['human',false,false,'human',false,'human',true,false,false,'human',true,false,'human',false,true,false,'human',false,false,false,true,'human',false,false,true,false,'human',false,true,false];
const data={date:'2026-11-15',model:'typesafe/jev-1.14',endpoint:'https://api.gapgpt.app/v1/systemone',list,referenceSource:'user',thresholds:{approveAbove:0.9,rejectBelow:0.3},results:texts.map((text,i)=>({number:i+1,text,reference:refs[i]}))};
const save=()=>fs.writeFileSync(new URL('results.json',dir),JSON.stringify(data,null,2));
save();
if(!process.env.GAPGPT_API_KEY) throw Error('GAPGPT_API_KEY missing');
let next=0;
await Promise.all(Array.from({length:3},async()=>{while(next<data.results.length){const row=data.results[next++];const start=Date.now();try{const r=await fetch(data.endpoint,{method:'POST',headers:{Authorization:`Bearer ${process.env.GAPGPT_API_KEY.trim()}`,'Content-Type':'application/json'},body:JSON.stringify({model:data.model,state:row.text,questions:list.questions}),signal:AbortSignal.timeout(120000)});const raw=await r.text();row.httpStatus=r.status;row.rawBody=raw.split(process.env.GAPGPT_API_KEY.trim()).join('[REDACTED]');try{row.rawResponse=JSON.parse(row.rawBody);}catch{}row.usage=normalizeUsage(row.rawResponse?.usage);const p=row.rawResponse?.answers?.allowed?.noul;row.probability=typeof p==='number'&&p>=0&&p<=1?p:null;row.percent=row.probability===null?null:row.probability*100;row.success=r.ok&&row.probability!==null;row.decision=row.success?(p>0.9?true:p<0.3?false:'human'):null;}catch(e){row.success=false;row.error=e.message;}row.durationMs=Date.now()-start;save();console.log(JSON.stringify({number:row.number,success:row.success,probability:row.probability}));}}));
