import fs from 'node:fs';
const dir='output/iran-politics-30-20261115/';
const d=JSON.parse(fs.readFileSync(dir+'results.json','utf8'));
d.executionStatus='blocked_by_automatic_approval_review';
d.blocker='Network requests failed in sandbox. Escalated execution rejected by automatic approval review because disclosure of internal question instructions and criteria needs explicit approval. No successful model responses.';
d.requestDisclosure={state:'Only individual user message',questions:'Exact stored instructions and criteria',examplesSent:false,referencesSent:false};
d.pricing={source:'https://help.typesafe.ai/articles/5187202169-how-much-does-jev-cost',checkedDate:'2026-11-15',basis:'manufacturer_estimate_only',inputPerMillionUSD:0.042,outputPerMillionUSD:0,inputPerTokenUSD:0.000000042,outputPerTokenUSD:0,gapgptTariffVerified:false};
d.summary={messages:30,successful:0,networkFailures:30,scorable:0,matched:0,different:0,accuracy:null,automaticCoverage:0,modelHumanReferrals:null,referenceHuman:9};
d.tokenUsage={input:null,output:null,total:null,reportingCoverage:0};
d.cost={inputUSD:null,outputUSD:null,totalUSD:null};
fs.writeFileSync(dir+'results.json',JSON.stringify(d,null,2)+'\n');
const label=x=>x==='human'?'بررسی ادمین':x===true?'تأیید':'رد';
const rows=d.results.map(r=>`| ${r.number} | allowed — ${r.text} | ${label(r.reference)} | ناموجود | خطای شبکه؛ بدون تصمیم | قابل امتیازدهی نیست |`).join('\n');
const md=`# گزارش ارزیابی سیاست داخلی ایران

- تاریخ: ۲۰۲۶/۱۱/۱۵؛ منطقه زمانی: تهران
- مدل تنظیم‌شده: typesafe/jev-1.14؛ سرویس: GapGPT
- تعداد پیام‌ها: ۳۰؛ پاسخ موفق: صفر؛ تلاش ناموفق شبکه: ۳۰. اجرای مجدد با دسترسی شبکه پیش از اجرا توسط بررسی خودکار مجوز رد شد.
- وضعیت: ارزیابی تکمیل نشده؛ هیچ احتمال یا تصمیمی از مدل دریافت نشده است.
- قاعده تصمیم‌گیری: احتمال اصلی Yes بیشتر از ۹۰٪ تأیید، کمتر از ۳۰٪ رد، و بازه شامل دو مرز ۳۰٪ تا ۹۰٪ بررسی ادمین؛ مقایسه پیش از گردکردن.

## دقت و پوشش

- مطابق: صفر؛ متفاوت: صفر؛ موارد قابل امتیازدهی: صفر. این اعداد به معنی درست بودن پاسخ‌ها نیستند.
- دقت: ناموجود؛ مخرج صفر است (۰ مورد مطابق از ۰ مورد قابل امتیازدهی).
- پوشش تصمیم خودکار: ۰ از ۳۰، برابر صفر درصد.
- ارجاع مدل به ادمین: ناموجود؛ مدل پاسخی نداده است. تعداد مرجع‌های انسانی کاربر: ۹.
- منبع تمام پاسخ‌های مرجع: خود کاربر؛ تأیید به true، رد به false و نیاز به تأیید ادمین به human تبدیل و پیش از اجرا ذخیره شد. هیچ مرجعی تغییر نکرد.
- ارجاع انسانی و خطای اجرا در صورت و مخرج دقت شمرده نمی‌شوند.

## نتیجه هر پیام

| شماره | سؤال و متن ورودی | پاسخ مرجع | احتمال Yes/مجاز بودن | تصمیم مدل | تطابق |
|---|---|---|---|---|---|
${rows}

## موارد متفاوت یا مهم

- پیام ۱۱: پاسخ مرجع کاربر «تأیید» است، اما سیاست ذخیره‌شده هر اشاره به اسرائیل، حتی جغرافیایی و آموزشی، را رد می‌کند. این تعارض مستقل از خروجی مدل است؛ مرجع تغییر نکرد.
- پیام ۱: نام مجلس و دولت در متن آمده، درحالی‌که مرجع انسانی است. اگر اشاره به نهادهای ایران تفسیر شود، سیاست فعلی آن را رد می‌کند؛ کشور در خود پیام تصریح نشده است.
- پیام‌های ۳، ۸، ۹، ۱۲، ۱۴، ۱۹، ۲۰، ۲۴، ۲۸ و ۳۰ مرجع رد دارند، اما ارتباط با ایران یا یکی از موضوعات ممنوع همیشه در خود پیام روشن نیست. چون هر پیام جداگانه ارسال می‌شود، زمینه بقیه پیام‌ها در اختیار مدل قرار نمی‌گیرد؛ این موضوع می‌تواند منشأ اختلاف باشد.
- هدف سؤال، مجاز بودن خود متن است؛ پاسخ به پرسش داخل پیام یا داوری درباره رفتار توصیف‌شده نیست.
- نسخه دقیق فهرست، سؤال، ورودی‌ها، مرجع‌ها و خطاهای واقعی در JSON ثبت شده‌اند. هیچ پاسخ خام مدل موجود نیست؛ فیلد پاسخ خام به همین دلیل ساخته نشده است.

## مصرف توکن و هزینه

| نوع | تعداد توکن گزارش‌شده | قیمت هر توکن، دلار | هزینه، دلار |
|---|---|---|---|
| ورودی | ناموجود | 0.000000042 | نامعلوم |
| خروجی | ناموجود | 0 | نامعلوم |
| مجموع | ناموجود | — | نامعلوم |

تعرفه رسمی سازنده: هر یک میلیون توکن ورودی ۰٫۰۴۲ دلار و خروجی صفر دلار، بررسی‌شده در ۲۰۲۶/۱۱/۱۵. [منبع رسمی TypeSafe](https://help.typesafe.ai/articles/5187202169-how-much-does-jev-cost).

این تعرفه صرفاً مبنای برآورد براساس تعرفه سازنده است؛ تعرفه و صورتحساب GapGPT تأیید نشده است. پوشش گزارش‌دهی توکن صفر از ۳۰ است. توکن ناموجود صفر فرض نشده و مجموع هزینه دلاری نامعلوم است.

## محدودیت‌ها

هیچ ارزیابی موفقی انجام نشد؛ خطای اولیه fetch failed بود. بررسی خودکار مجوز، اجرای دارای دسترسی شبکه را به دلیل نیاز به مجوز صریح برای افشای Instructions و Criteria داخلی رد کرد. بدنه درخواست طراحی‌شده شامل متن هر پیام و سؤال ذخیره‌شده است؛ پاسخ‌های مرجع و مثال‌های فهرست به API ارسال نمی‌شوند. برای ادامه، تأیید صریح ارسال متن سیاست داخلی به GapGPT لازم است.

این مجموعه فقط ۳۰ پیام دارد و حتی پس از اجرای موفق نماینده همه کاربردها نخواهد بود. هیچ تست مخزن، تست فرانت‌اند یا بیلد اجرا نشد.
`;
fs.writeFileSync(dir+'report.md',md);
console.log('Saved report.md and results.json');
