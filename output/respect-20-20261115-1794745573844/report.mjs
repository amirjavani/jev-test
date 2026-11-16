import fs from 'node:fs';
const dir = new URL('./', import.meta.url);
const d = JSON.parse(fs.readFileSync(new URL('results.json', dir), 'utf8'));
const ok = d.results.filter(r => r.success);
const auto = ok.filter(r => r.decision !== 'human');
const human = ok.filter(r => r.decision === 'human');
const scored = auto.filter(r => r.reference !== 'human');
const matched = scored.filter(r => r.reference === r.decision);
const different = scored.filter(r => r.reference !== r.decision);
d.executionStatus = 'completed';
d.authorization = { source: 'user_explicit_consent', scope: 'These 20 comments, question and evaluation criteria may be sent to GapGPT for this evaluation.' };
d.returnedModels = [...new Set(ok.map(r => r.rawResponse.model))];
d.summary = { messages: d.results.length, successful: ok.length, failed: d.results.length - ok.length, rejected: ok.filter(r => r.decision === false).length, approved: ok.filter(r => r.decision === true).length, modelHumanReferrals: human.length, automaticDecisions: auto.length, automaticCoverage: auto.length / d.results.length, referenceHuman: d.results.filter(r => r.reference === 'human').length, scorable: scored.length, matched: matched.length, different: different.length, accuracy: scored.length ? matched.length / scored.length : null, automaticOnHumanReference: auto.filter(r => r.reference === 'human').map(r => r.number), humanOnDefiniteReference: human.filter(r => r.reference !== 'human').map(r => r.number) };
const totals = {}, reported = {}, directlyReported = {};
for (const field of ['input_tokens', 'output_tokens', 'total_tokens']) {
  const values = d.results.map(r => r.usage?.[field]).filter(v => typeof v === 'number');
  totals[field] = values.length ? values.reduce((a, b) => a + b, 0) : null;
  reported[field] = values.length;
  directlyReported[field] = d.results.filter(r => typeof r.rawResponse?.usage?.[field] === 'number').length;
}
d.tokenUsage = { totals, reported, directlyReported, totalDerivation: 'Each total_tokens is derived from actual input_tokens + output_tokens; the provider did not return total_tokens.' };
d.pricing = { source: 'https://help.typesafe.ai/articles/5187202169-how-much-does-jev-cost', checkedDate: '2026-11-15', basis: 'manufacturer_estimate_only', inputPerMillionUSD: 0.042, outputPerMillionUSD: 0, inputPerTokenUSD: 0.000000042, outputPerTokenUSD: 0, gapgptTariffVerified: false };
d.cost = { inputUSD: totals.input_tokens * d.pricing.inputPerTokenUSD, outputUSD: totals.output_tokens * d.pricing.outputPerTokenUSD, formula: 'input_tokens * 0.042 / 1000000 + output_tokens * 0 / 1000000' };
d.cost.totalUSD = d.cost.inputUSD + d.cost.outputUSD;
for (const row of d.results) {
  row.comparison = row.reference === 'human' || row.decision === 'human' ? 'excluded_human' : row.success ? row.reference === row.decision ? 'match' : 'mismatch' : 'execution_error';
}
fs.writeFileSync(new URL('results.json', dir), JSON.stringify(d, null, 2));
const label = x => x === 'human' ? 'ارجاع به انسان' : x === true ? 'تأیید' : x === false ? 'رد' : 'خطای اجرا';
const pct = x => `${(x * 100).toFixed(1).replace(/\.0$/, '')}٪`;
const rows = d.results.map(r => `| ${r.number} | allowed — ${r.text} | ${label(r.reference)} | ${r.percent.toFixed(2).replace(/\.00$/, '')}٪ | ${label(r.decision)} | ${r.comparison === 'excluded_human' ? 'خارج از امتیازدهی (انسانی)' : r.comparison === 'match' ? 'مطابق' : 'متفاوت'} |`).join('\n');
const md = `# گزارش ارزیابی ${d.list.name}

- تاریخ: ۲۰۲۶/۱۱/۱۵، منطقه زمانی Asia/Tehran
- سرویس: GapGPT، https://api.gapgpt.app/v1/systemone
- مدل درخواستی: typesafe/jev-1.14؛ مدل گزارش‌شده در هر ۲۰ پاسخ: jev-1.14.0
- تعداد کامنت‌ها: ۲۰؛ درخواست موفق: ${ok.length}؛ ناموفق: ${d.results.length - ok.length}.
- قاعده تصمیم: احتمال اصلی Yes/مجاز بودن بیشتر از ۹۰٪ تأیید، کمتر از ۳۰٪ رد، و از ۳۰٪ تا ۹۰٪ شامل هر دو مرز ارجاع به انسان. تصمیم با مقدار اصلی و قبل از گردکردن درصد محاسبه شد.
- هر کامنت در یک درخواست مستقل با همان Instructions و Criteria فعلی اجرا شد. تنها متن همان کامنت در state قرار گرفت؛ شماره، برچسب مرجع و سایر کامنت‌ها به مدل داده نشدند. سؤال، معیارها و مثال‌های فهرست تغییر نکردند؛ مثال‌های داخل Instructions به همان شکل حفظ شدند.

## دقت و پوشش

- موارد قابل امتیازدهی: **${scored.length}**؛ مطابق: **${matched.length}**؛ متفاوت قطعی: **${different.length}**.
- دقت نسبت به مرجع کاربر در موارد قطعی: **${matched.length} ÷ ${scored.length} = ${pct(d.summary.accuracy)}**.
- تصمیم‌های مدل: **${d.summary.rejected} رد، ${d.summary.approved} تأیید و ${human.length} ارجاع به انسان**.
- پوشش تصمیم خودکار: **${auto.length} از ۲۰ = ${pct(d.summary.automaticCoverage)}**؛ سهم ارجاع انسانی مدل: ${pct(human.length / 20)}.
- منبع مرجع، کاربر است: پیام‌های ۱ تا ۸ رد، ۹ تا ۱۴ انسانی و ۱۵ تا ۲۰ تأیید. این برچسب‌ها پیش از اجرا به false، human و true نگاشت و ذخیره شدند و پس از مشاهده خروجی تغییر نکردند.
- پیام‌های **۹، ۱۲ و ۱۳** مرجع انسانی دارند ولی مدل آن‌ها را رد کرد. پیام‌های **۱۶، ۱۷ و ۱۹** مرجع تأیید دارند ولی مدل آن‌ها را به انسان ارجاع داد. این ۶ مورد درست یا غلط شمرده نشدند.
- در مجموع ۹ پیام به دلیل انسانی بودن مرجع یا تصمیم مدل از مخرج دقت حذف شدند؛ ۱۰۰٪ به معنای تطابق همه ۲۰ پیام نیست.

## نتیجه هر پیام

| شماره | سؤال و متن ورودی | پاسخ مرجع | احتمال Yes/مجاز بودن | تصمیم مدل | تطابق |
|---|---|---|---|---|---|
${rows}

## موارد متفاوت یا مهم

- پیام‌های ۱ تا ۸ همگی طبق مرجع رد شدند؛ پیام ۶ با احتمال ۲۷٪ هنوز زیر مرز ۳۰٪ است.
- پیام ۹ با احتمال ۹٪ رد شد؛ مرجع انسانی است. اشاره به توقف تکامل فکری می‌تواند مصداق تحقیر غیرمستقیم سیاست باشد. این توضیح، تفسیر متن سیاست است؛ API دلیل تصمیم را برنگردانده است.
- پیام ۱۰ با احتمال ۵۰٪، پیام ۱۱ با احتمال دقیق ۳۰٪ و پیام ۱۴ با احتمال ۷۱٪ به انسان ارجاع شدند. مرز ۳۰٪ پیام ۱۱ شامل بازه انسانی است و نباید رد محسوب شود.
- پیام ۱۲ با احتمال ۴٪ رد شد؛ مرجع انسانی است. افزودن «شاید من اشتباه می‌کنم» لزوماً اثر تحقیر نسبت به سواد مخاطب را از بین نمی‌برد؛ این تفسیر سیاست است، نه توضیح تولیدشده توسط مدل.
- پیام ۱۳ با احتمال ۹٪ رد شد؛ مرجع انسانی است. این پیام گزارش یک توهین است، اما سیاست فعلی بازگویی عبارت توهین‌آمیز را حتی در گزارش غیرمجاز می‌داند. این تفاوت میان مجاز بودن خود متن و محکوم کردن رفتار گزارش‌شده مهم است.
- پیام ۱۶ با احتمال ۳۶٪ به انسان ارجاع شد، در برابر مرجع تأیید. انتقاد متوجه تصمیم است؛ سیاست انتقاد از عملکرد و نظر را مجاز می‌داند، اما ارزیابی خودکار نتوانسته تأیید قطعی بدهد.
- پیام ۱۷ با احتمال ۳۲٪ به انسان ارجاع شد، در برابر مرجع تأیید. پیام عصبانیت از اینترنت را بیان می‌کند؛ مرز میان ناسزا و ابراز ناراحتی در این مورد نیاز به بررسی انسانی پیدا کرده است. علت داخلی مدل مشخص نیست.
- پیام ۱۹ با احتمال ۸۶٪ به انسان ارجاع شد، در برابر مرجع تأیید. جمله نقد کیفیت عملکرد تیم است؛ حتی احتمال ۸۶٪ با آستانه فعلی برای تأیید کافی نیست.
- پیام‌های ۱۵، ۱۸ و ۲۰ به ترتیب با احتمال‌های ۹۶٪، ۹۸٪ و ۹۲٪ تأیید شدند و با مرجع کاربر تطابق دارند.

سؤال، مجاز بودن خود کامنت را طبق سیاست می‌سنجد؛ به پرسش احتمالی داخل آن پاسخ نمی‌دهد و صرفاً درباره مجاز بودن رفتار توصیف‌شده داوری نمی‌کند. برای هر کامنت فقط یک تصمیم مستقل allowed ثبت شده است.

## مصرف توکن و هزینه

| نوع | تعداد توکن | قیمت هر توکن، دلار | هزینه، دلار |
|---|---|---|---|
| ورودی | ${totals.input_tokens} | 0.000000042 | ${d.cost.inputUSD.toFixed(9)} |
| خروجی | ${totals.output_tokens} | 0 | ${d.cost.outputUSD.toFixed(9)} |
| مجموع | ${totals.total_tokens} | — | ${d.cost.totalUSD.toFixed(9)} |

تعرفه رسمی سازنده: هر یک میلیون توکن ورودی **۰٫۰۴۲ دلار** و هر یک میلیون توکن خروجی **صفر دلار**؛ [منبع رسمی TypeSafe](https://help.typesafe.ai/articles/5187202169-how-much-does-jev-cost)، بررسی‌شده در ۲۰۲۶/۱۱/۱۵.

مجموع **${d.cost.totalUSD.toFixed(9)} دلار**، «برآورد براساس تعرفه سازنده» است. تعرفه و صورتحساب GapGPT تأیید نشده و ممکن است متفاوت باشد. فرمول هزینه ورودی: ${totals.input_tokens} × ۰٫۰۴۲ ÷ ۱٬۰۰۰٬۰۰۰؛ هزینه خروجی طبق تعرفه سازنده صفر است.

مصرف ورودی و خروجی در هر ۲۰ پاسخ واقعی API گزارش شده است: پوشش هرکدام ۲۰ از ۲۰. API فیلد total_tokens را گزارش نکرده؛ مجموع برای هر درخواست و کل اجرا از جمع ورودی و خروجی محاسبه شده است. داده ناموجود صفر فرض نشده است.

## محدودیت‌ها

دقت ۱۰۰٪ فقط نسبت به برچسب کاربر و در ۱۱ مورد قطعی قابل امتیازدهی است؛ ۶ ارجاع انسانی مدل و ۶ مرجع انسانی کاربر (با هم‌پوشانی ۳ مورد) دامنه این عدد را محدود می‌کنند. این مجموعه کوچک فارسی، آزمونی برای پوشش فینگلیش، سانسور و خشونت ارائه نمی‌کند و نتیجه آن را نمی‌توان به تمام قابلیت‌های سیاست تعمیم داد. پاسخ API شامل احتمال است و دلیل تصمیم مدل را ارائه نمی‌کند. هزینه برآورد سازنده است و صورتحساب واقعی GapGPT نیست.

این اجرا پس از مجوز صریح کاربر انجام شد. گزارش اجرای ناموفق قبلی جداگانه حفظ شده است؛ هر ۲۰ درخواست این اجرای جدید یک بار موفق شدند و هیچ درخواست موفقی تکرار نشد. هیچ تست مخزن، تست فرانت‌اند یا بیلد اجرا نشد. نسخه دقیق فهرست، ورودی‌ها، مرجع‌ها، پاسخ خام، احتمال‌ها، تصمیم‌ها، توکن‌ها و محاسبات هزینه در results.json موجود است.
`;
fs.writeFileSync(new URL('report.md', dir), md);
console.log(JSON.stringify({ summary: d.summary, tokenUsage: d.tokenUsage, cost: d.cost }, null, 2));
