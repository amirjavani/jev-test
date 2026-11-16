import fs from 'node:fs';
const dir='output/iran-politics-30-20261115-retry/';
const d=JSON.parse(fs.readFileSync(dir+'results.json','utf8'));
const label=x=>x==='human'?'بررسی ادمین':x===true?'تأیید':x===false?'رد':'خطای اجرا';
const ok=d.results.filter(r=>r.success),auto=ok.filter(r=>r.decision!=='human'),scorable=auto.filter(r=>r.reference!=='human'),matched=scorable.filter(r=>r.reference===r.decision),different=scorable.filter(r=>r.reference!==r.decision),human=ok.filter(r=>r.decision==='human');
const totals={},reported={};
for(const f of ['input_tokens','output_tokens','total_tokens']){const values=d.results.map(r=>r.usage?.[f]).filter(v=>typeof v==='number');reported[f]=values.length;totals[f]=values.length?values.reduce((a,b)=>a+b,0):null;}
const inputCost=totals.input_tokens===null?null:totals.input_tokens*0.042/1000000,outputCost=totals.output_tokens===null?null:0;
d.executionStatus='completed';
d.summary={messages:d.results.length,successful:ok.length,failed:d.results.length-ok.length,scorable:scorable.length,matched:matched.length,different:different.length,accuracy:scorable.length?matched.length/scorable.length:null,modelHumanReferrals:human.length,automaticDecisions:auto.length,automaticCoverage:auto.length/d.results.length,referenceHuman:d.results.filter(r=>r.reference==='human').length,automaticOnHumanReference:auto.filter(r=>r.reference==='human').map(r=>r.number),humanOnDefiniteReference:human.filter(r=>r.reference!=='human').map(r=>r.number)};
d.tokenUsage={totals,reported,totalDerivation:'total_tokens inferred as input_tokens + output_tokens when not supplied, using shared/usage.js'};
d.pricing={source:'https://help.typesafe.ai/articles/5187202169-how-much-does-jev-cost',checkedDate:'2026-11-15',basis:'manufacturer_estimate_only',inputPerMillionUSD:0.042,outputPerMillionUSD:0,inputPerTokenUSD:0.000000042,outputPerTokenUSD:0,gapgptTariffVerified:false};
d.cost={inputUSD:inputCost,outputUSD:outputCost,totalUSD:inputCost===null||outputCost===null?null:inputCost+outputCost};
d.requestDisclosure={state:'individual message only',questions:'exact stored questions including instructions and criteria',examplesSent:false,referencesSent:false};
for(const r of d.results)r.comparison=!r.success?'error':r.reference==='human'||r.decision==='human'?'human_review':r.reference===r.decision?'match':'different';
fs.writeFileSync(dir+'results.json',JSON.stringify(d,null,2)+'\n');
const pct=n=>(n*100).toFixed(2)+'٪';
const rows=d.results.map(r=>`| ${r.number} | allowed — ${r.text} | ${label(r.reference)} | ${r.success?pct(r.probability):'ناموجود'} | ${label(r.decision)} | ${r.comparison==='match'?'مطابق':r.comparison==='different'?'متفاوت':'خارج از امتیازدهی؛ بررسی انسانی'} |`).join('\n');
const s=d.summary;
const md=`# گزارش ارزیابی سیاست داخلی ایران

- تاریخ: ۲۰۲۶/۱۱/۱۵؛ منطقه زمانی تهران
- سرویس: GapGPT؛ آدرس: https://api.gapgpt.app/v1/systemone
- مدل درخواست‌شده: typesafe/jev-1.14؛ مدل گزارش‌شده در پاسخ‌ها: ${[...new Set(ok.map(r=>r.rawResponse.model))].join(', ')}
- تعداد پیام‌ها: ۳۰؛ درخواست موفق: ${ok.length}؛ ناموفق در این اجرا: ${30-ok.length}.
- قاعده تصمیم: احتمال اصلی Yes بیشتر از ۹۰٪ تأیید؛ کمتر از ۳۰٪ رد؛ از ۳۰٪ تا ۹۰٪ شامل هر دو مرز بررسی ادمین. مقایسه پیش از گردکردن انجام شد؛ پیام ۹ با احتمال دقیق ۹۰٪ به ادمین ارجاع می‌شود.
- هر پیام جداگانه با همان Instructions و Criteria ذخیره‌شده اجرا شد. شماره، پاسخ مرجع، سایر پیام‌ها و مثال‌های فهرست به مدل ارسال نشدند. سؤال و سیاست تغییر نکردند.

## دقت و پوشش

- موارد قابل امتیازدهی: ${s.scorable}؛ مطابق: ${s.matched}؛ متفاوت: ${s.different}.
- دقت نسبت به پاسخ‌های مرجع کاربر: ${s.matched} ÷ ${s.scorable} = **${pct(s.accuracy)}**.
- ارجاع مدل به ادمین: ${s.modelHumanReferrals} از ۳۰ (${pct(s.modelHumanReferrals/30)}).
- پوشش تصمیم خودکار: ${s.automaticDecisions} از ۳۰ = **${pct(s.automaticCoverage)}**.
- مرجع کاربر در ${s.referenceHuman} پیام انسانی است؛ موارد با مرجع انسانی یا تصمیم انسانی در دقت درست/غلط شمرده نشدند.
- مدل در پیام‌های ${s.automaticOnHumanReference.join('، ')} با وجود مرجع انسانی، تصمیم خودکار داد. در پیام‌های ${s.humanOnDefiniteReference.join('، ')} با وجود مرجع قطعی، به ادمین ارجاع داد.
- منبع تمام پاسخ‌های مرجع، خود کاربر است: تأیید به true، رد به false و نیاز به تأیید ادمین به human نگاشت و پیش از اجرا ذخیره شد. هیچ مرجعی پس از مشاهده نتایج تغییر نکرد.

## نتیجه هر پیام

| شماره | سؤال و متن ورودی | پاسخ مرجع | احتمال Yes/مجاز بودن | تصمیم مدل | تطابق |
|---|---|---|---|---|---|
${rows}

## موارد متفاوت یا مهم

- پیام‌های ${different.map(r=>r.number).join('، ')} اختلاف قطعی با مرجع کاربر دارند.
- پیام ۱۱: مدل با احتمال مجاز بودن ۴٪ رد کرد، درحالی‌که مرجع کاربر تأیید است. سیاست فعلی هر اشاره به اسرائیل را حتی در جغرافیا ممنوع می‌داند؛ بنابراین این اختلاف، تعارض مرجع با سیاست ذخیره‌شده نیز هست.
- پیام‌های ۲۰ و ۲۸: هر دو با احتمال مجاز بودن ۹۷٪ تأیید شدند؛ مرجع کاربر رد است. در خود این پیام‌ها ایران یا موضوع ممنوع مشخصی نام برده نشده و سیاست فعلی بحث کشورهای دیگر را در نبود موارد ممنوع مجاز می‌داند. این پیام‌ها مستقل از بقیه مجموعه ارسال شدند؛ زمینه ضمنی جنگ ایران/اسرائیل در درخواست وجود نداشت.
- پیام ۱: احتمال مجاز بودن ۱۲٪ و تصمیم رد، در برابر مرجع انسانی. متن مجلس و دولت را نام می‌برد؛ طبق سیاست فعلی اگر اشاره به نهادهای ایران تشخیص داده شود، رد می‌شود. این مورد در دقت شمرده نشد.
- پیام ۲۲: احتمال مجاز بودن ۹۱٪ و تصمیم تأیید، در برابر مرجع انسانی. مدل این کنایه را به ادمین ارجاع نداد؛ این مورد هم خارج از دقت است.
- پیام‌های کنایه‌آمیز با ارجاع انسانی، از جمله ۳ و ۸، لزوماً خطای قطعی نیستند و طبق تعریف گزارش در دقت وارد نمی‌شوند.
- سؤال، مجاز بودن خود متن را می‌سنجد؛ پاسخ به سؤال داخل پیام یا داوری درباره رفتار توصیف‌شده نیست.

## مصرف توکن و هزینه

| نوع | تعداد توکن | قیمت هر توکن، دلار | هزینه، دلار |
|---|---|---|---|
| ورودی | ${totals.input_tokens} | 0.000000042 | ${inputCost.toFixed(9)} |
| خروجی | ${totals.output_tokens} | 0 | ${outputCost.toFixed(9)} |
| مجموع | ${totals.total_tokens} | — | ${(inputCost+outputCost).toFixed(9)} |

تعرفه سازنده: هر یک میلیون توکن ورودی ۰٫۰۴۲ دلار؛ هر یک میلیون توکن خروجی صفر دلار. [منبع رسمی TypeSafe](https://help.typesafe.ai/articles/5187202169-how-much-does-jev-cost)، بررسی‌شده در ۲۰۲۶/۱۱/۱۵.

مجموع **${(inputCost+outputCost).toFixed(9)} دلار** صرفاً برآورد براساس تعرفه سازنده است؛ تعرفه و صورتحساب GapGPT تأیید نشده و ممکن است متفاوت باشد. مصرف ورودی و خروجی از پاسخ واقعی هر ۳۰ درخواست استخراج شد (پوشش ${reported.input_tokens}/۳۰ و ${reported.output_tokens}/۳۰). API مجموع توکن را جداگانه گزارش نکرده؛ مجموع از جمع ورودی و خروجی محاسبه شده است. محاسبات با مقدار اصلی انجام شده‌اند.

## محدودیت‌ها

این دقت فقط نسبت به مرجع کاربر و روی ${s.scorable} پیام دارای مرجع و تصمیم قطعی است؛ با وجود تعارض‌های مرجع و سیاست، نباید آن را دقت قطعی اجرای سیاست دانست. ${human.length} ارجاع انسانی نشان می‌دهد پوشش تصمیم خودکار محدود است. این مجموعه کوچک و انتخاب‌شده نماینده همه کاربردها نیست.

اجرای قبلی به خطای شبکه و رد مجوز منجر شده بود؛ فایل‌های قبلی حفظ شدند. این گزارش فقط اجرای مجدد موفق را پوشش می‌دهد. هیچ درخواست موفقی تکرار نشد و هیچ تست مخزن، فرانت‌اند یا بیلد اجرا نشد. پاسخ‌های خام، نسخه دقیق فهرست و سؤال، برچسب‌های مرجع، احتمال‌ها، توکن‌ها و محاسبات هزینه در results.json ذخیره شده‌اند.
`;
fs.writeFileSync(dir+'report.md',md);
console.log(JSON.stringify({summary:d.summary,usage:d.tokenUsage,cost:d.cost}));
