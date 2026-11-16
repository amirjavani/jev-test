import fs from 'node:fs';
const dir = new URL('./', import.meta.url);
const d = JSON.parse(fs.readFileSync(new URL('results.json', dir), 'utf8'));
d.executionStatus = 'blocked_pending_explicit_external_transfer_approval';
d.blocker = { type: 'automatic_approval_review_rejection', reason: 'Explicit approval is required to send these 20 comments and the project evaluation question to https://api.gapgpt.app/v1/systemone. Restricted execution returned fetch failed; escalated execution was rejected before starting.' };
d.summary = { messages: 20, successful: 0, failed: 20, matched: null, different: null, scorable: 0, accuracy: null, modelHumanReferrals: null, automaticDecisions: 0, automaticCoverage: 0, referenceHuman: 6 };
d.tokenUsage = { totals: { input_tokens: null, output_tokens: null, total_tokens: null }, reported: { input_tokens: 0, output_tokens: 0, total_tokens: 0 }, note: 'No provider responses received; missing usage is not zero.' };
d.pricing = { source: 'https://help.typesafe.ai/articles/5187202169-how-much-does-jev-cost', checkedDate: '2026-11-15', basis: 'manufacturer_estimate_only', inputPerMillionUSD: 0.042, outputPerMillionUSD: 0, inputPerTokenUSD: 0.000000042, outputPerTokenUSD: 0, gapgptTariffVerified: false };
d.cost = { inputUSD: null, outputUSD: null, totalUSD: null, reason: 'No token usage returned; actual GapGPT cost is unknown.' };
fs.writeFileSync(new URL('results.json', dir), JSON.stringify(d, null, 2));
const label = x => x === 'human' ? 'ارجاع به انسان' : x ? 'تأیید' : 'رد';
const rows = d.results.map(r => `| ${r.number} | allowed — ${r.text} | ${label(r.reference)} | نامعلوم | خطای اتصال | قابل محاسبه نیست |`).join('\n');
const md = `# گزارش ارزیابی ${d.list.name}

- تاریخ: ۲۰۲۶/۱۱/۱۵، منطقه زمانی Asia/Tehran
- مدل درخواستی: typesafe/jev-1.14؛ سرویس: GapGPT، https://api.gapgpt.app/v1/systemone
- تعداد پیام‌ها: ۲۰؛ درخواست موفق: صفر؛ تلاش ناموفق با خطای fetch failed: ۲۰.
- وضعیت: متوقف تا دریافت مجوز صریح ارسال داده به سرویس خارجی. اجرای دارای دسترسی شبکه توسط بازبینی خودکار پیش از شروع رد شد.
- قاعده تصمیم: احتمال اصلی Yes بیشتر از ۹۰٪ تأیید؛ کمتر از ۳۰٪ رد؛ بازه ۳۰٪ تا ۹۰٪ با احتساب دو مرز ارجاع به انسان. مقایسه پیش از گردکردن انجام می‌شود.
- نسخه دقیق فهرست، Instructions، Criteria و مثال‌ها در results.json ثبت شده‌اند و تغییر نکرده‌اند. بدنه هر درخواست فقط مدل، متن همان کامنت در state و questions دارد؛ شماره و برچسب مرجع ارسال نمی‌شوند.

## دقت و پوشش

- مطابق و متفاوت: نامعلوم؛ هیچ خروجی مدل دریافت نشد.
- موارد قابل امتیازدهی: صفر؛ دقت تعریف‌نشده است (مخرج صفر)، نه صفر درصد.
- ارجاع مدل به انسان: نامعلوم؛ پوشش تصمیم خودکار: ۰ از ۲۰، برابر صفر درصد.
- مرجع کاربر: ۸ رد، ۶ ارجاع به انسان و ۶ تأیید. رد به false، تأیید به true و ارجاع به انسان به human نگاشت و پیش از اجرا ذخیره شد؛ هیچ برچسبی تغییر نکرد.
- موارد دارای مرجع یا تصمیم انسانی از محاسبه درست/غلط حذف می‌شوند.

## نتیجه هر پیام

| شماره | سؤال و متن ورودی | پاسخ مرجع | احتمال Yes/مجاز بودن | تصمیم مدل | تطابق |
|---|---|---|---|---|---|
${rows}

## موارد متفاوت یا مهم

هیچ اختلاف تجربی قابل گزارش نیست، چون پاسخی از مدل دریافت نشد. سؤال، مجاز بودن خود متن را ارزیابی می‌کند، نه مجاز بودن رفتار توصیف‌شده یا پاسخ به پرسش داخل کامنت.

پیام ۱۳ نقل توهین صریح است؛ سیاست فعلی حتی بازگویی توهین در گزارش را غیرمجاز می‌داند، درحالی‌که مرجع کاربر انسانی است. پیام‌های ۹، ۱۱ و ۱۲ نیز می‌توانند مشمول کنایه تحقیرآمیز سیاست باشند؛ مرجع انسانی کاربر بدون تغییر حفظ شده است. این‌ها توضیح مرز سیاست‌اند و نتیجه مدل نیستند. در پیام ۱۶ انتقاد از تصمیم با حمله به شخص تفاوت دارد؛ پیام ۱۷ بیان عصبانیت از اینترنت است و ارزیابی لفظ آن باید براساس سیاست انجام شود؛ فعلاً تصمیمی به مدل نسبت داده نمی‌شود.

## مصرف توکن و هزینه

| نوع | تعداد توکن | قیمت هر توکن، دلار | هزینه، دلار |
|---|---|---|---|
| ورودی | نامعلوم | 0.000000042 | نامعلوم |
| خروجی | نامعلوم | 0 | نامعلوم |
| مجموع | نامعلوم | — | نامعلوم |

تعرفه سازنده: هر یک میلیون توکن ورودی ۰٫۰۴۲ دلار و خروجی صفر دلار؛ [منبع رسمی TypeSafe](https://help.typesafe.ai/articles/5187202169-how-much-does-jev-cost)، بررسی‌شده در ۲۰۲۶/۱۱/۱۵. این تعرفه صرفاً مبنای «برآورد براساس تعرفه سازنده» است؛ تعرفه و صورتحساب GapGPT تأیید نشده و ممکن است متفاوت باشد. به علت نبود آمار توکن، هیچ مبلغی برآورد نشده است. پوشش گزارش‌دهی ورودی، خروجی و مجموع هرکدام ۰ از ۲۰ است؛ داده ناموجود صفر فرض نشده است.

## محدودیت‌ها

این گزارش وضعیت اجرای ناموفق است و سنجش دقت مدل محسوب نمی‌شود. برای تکمیل ارزیابی، مجوز صریح ارسال همین ۲۰ کامنت و سؤال ارزیابی به GapGPT لازم است. پس از رفع مانع باید درخواست‌ها اجرا شوند؛ در این مرحله هیچ درخواست موفقی وجود نداشته که تکرار شود. هیچ تست مخزن، تست فرانت‌اند یا بیلد اجرا نشد. مجموعه کوچک است و پس از اجرا نیز دقت فقط نسبت به مرجع کاربر و روی موارد دارای مرجع و تصمیم قطعی معنا خواهد داشت.
`;
fs.writeFileSync(new URL('report.md', dir), md);
console.log('Saved report.md and results.json; no model results fabricated.');
