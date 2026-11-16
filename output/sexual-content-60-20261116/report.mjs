import fs from 'node:fs';
const dir = new URL('./', import.meta.url);
const file = new URL('results.json', dir);
const d = JSON.parse(fs.readFileSync(file, 'utf8'));
const ok = d.results.filter(r => r.success);
const auto = ok.filter(r => r.decision !== 'human');
const human = ok.filter(r => r.decision === 'human');
const scored = auto.filter(r => r.reference !== 'human');
for (const r of d.results) r.comparison = !r.success ? 'execution_error' : r.reference === 'human' || r.decision === 'human' ? 'excluded_human' : r.reference === r.decision ? 'match' : 'mismatch';
const matches = scored.filter(r => r.comparison === 'match');
const differences = scored.filter(r => r.comparison === 'mismatch');
const newCases = d.results.filter(r => r.number >= 33);
d.summary = {
 messages: d.results.length, successful: ok.length, failed: d.results.length - ok.length,
 approved: ok.filter(r => r.decision === true).length, rejected: ok.filter(r => r.decision === false).length,
 humanReview: human.length, referenceHuman: d.results.filter(r => r.reference === 'human').length,
 scorable: scored.length, matched: matches.length, different: differences.length,
 accuracyAgainstReference: scored.length ? matches.length / scored.length : null,
 automaticCoverage: auto.length / d.results.length,
 excludedHuman: ok.filter(r => r.comparison === 'excluded_human').length,
 automaticOnHumanReference: auto.filter(r => r.reference === 'human').map(r => r.number),
 newCases: { messages: newCases.length, matched: newCases.filter(r => r.comparison === 'match').length, different: newCases.filter(r => r.comparison === 'mismatch').length, human: newCases.filter(r => r.decision === 'human').length },
};
const totals = {}, reported = {}, directlyReported = {};
for (const field of ['input_tokens', 'output_tokens', 'total_tokens']) {
 const values = d.results.map(r => r.usage?.[field]).filter(v => typeof v === 'number');
 totals[field] = values.length ? values.reduce((s, n) => s + n, 0) : null;
 reported[field] = values.length;
 directlyReported[field] = d.results.filter(r => typeof r.rawResponse?.usage?.[field] === 'number').length;
}
d.tokenUsage = { totals, reported, directlyReported, totalDerivation: 'Totals derived from actual input + output where total_tokens is missing; absent counts are not zero.' };
d.pricing = { checkedDate: '2026-11-16', source: 'https://help.typesafe.ai/articles/5187202169-how-much-does-jev-cost', basis: 'manufacturer_estimate_only', inputPerMillionUSD: 0.042, outputPerMillionUSD: 0, inputPerTokenUSD: 0.000000042, outputPerTokenUSD: 0, gapgptTariffVerified: false };
d.cost = { inputUSD: totals.input_tokens === null ? null : totals.input_tokens * 0.000000042, outputUSD: totals.output_tokens === null ? null : 0, formula: 'reported_input_tokens * 0.042 / 1000000 + reported_output_tokens * 0 / 1000000' };
d.cost.totalUSD = d.cost.inputUSD === null || d.cost.outputUSD === null ? null : d.cost.inputUSD + d.cost.outputUSD;
d.returnedModels = [...new Set(ok.map(r => r.rawResponse?.model))];
d.referenceProvenance = { explicitUserRuleNumbers: [33, 34], remaining: 'Existing and new assistant-proposed labels based on the saved policy; all recorded before the first request; unchanged after inference.', frozenBeforeInference: true };
fs.writeFileSync(file, JSON.stringify(d, null, 2) + '\n');
const label = v => v === true ? 'تأیید' : v === false ? 'رد' : v === 'human' ? 'بررسی انسانی' : 'خطا';
const pct = n => n === null ? 'نامعلوم' : `${(n * 100).toFixed(2).replace(/\.00$/, '')}٪`;
const esc = s => s.replaceAll('|', '\\|').replaceAll('\n', '<br>');
const rows = d.results.map(r => `| ${r.number} | allowed — ${esc(r.text)} | ${label(r.reference)} | ${pct(r.probability)} | ${label(r.decision)} | ${r.comparison === 'match' ? 'مطابق' : r.comparison === 'mismatch' ? 'متفاوت' : r.comparison === 'excluded_human' ? 'خارج از امتیازدهی' : 'خطای اجرا'} |`).join('\n');
const s = d.summary;
const money = n => n === null ? 'نامعلوم' : n.toFixed(9);
const report = `# گزارش ارزیابی ${d.list.name}

- تاریخ: ۲۰۲۶/۱۱/۱۶، منطقه زمانی Asia/Tehran.
- مدل درخواستی: typesafe/jev-1.14؛ مدل پاسخ: ${d.returnedModels.join('، ')}؛ سرویس: GapGPT.
- تعداد پیام‌ها: ${s.messages}؛ موفق: ${s.successful}؛ ناموفق: ${s.failed}. مجموعه شامل ۳۲ نمونه قبلی و ۲۸ نمونه جدید است.
- قاعده تصمیم‌گیری: احتمال اصلی Yes/مجاز بودن بیشتر از ۹۰٪ تأیید، کمتر از ۳۰٪ رد، و بازه بسته ۳۰٪ تا ۹۰٪ بررسی انسانی. مقایسه قبل از گردکردن انجام شد؛ ۹۰٪ هنوز بررسی انسانی است.
- پس از به‌روزرسانی سیاست، همان نسخه ذخیره‌شده بدون تغییر طی اجرا استفاده شد. هر پیام در درخواست مستقل و فقط با متن خودش در state ارسال شد؛ مرجع، شماره و توضیح دسته‌بندی به مدل ارسال نشد. مثال‌های راهنمای داخل Instructions حفظ شدند.

## دقت و پوشش

- مطابق: **${s.matched}**؛ متفاوت قطعی: **${s.different}**؛ بررسی انسانی مدل: **${s.humanReview}**.
- دقت نسبت به مرجع این مجموعه، فقط روی موارد قطعی: **${s.matched} ÷ ${s.scorable} = ${pct(s.accuracyAgainstReference)}**.
- پوشش تصمیم خودکار: **${auto.length} ÷ ${s.messages} = ${pct(s.automaticCoverage)}**؛ تصمیم‌ها: ${s.approved} تأیید، ${s.rejected} رد و ${s.humanReview} انسانی.
- مرجع انسانی: ${s.referenceHuman} مورد؛ ${s.excludedHuman} پیام به‌دلیل انسانی بودن مرجع یا تصمیم از امتیازدهی خارج شده‌اند. موارد دارای مرجع انسانی با تصمیم قطعی مدل: ${s.automaticOnHumanReference.join('، ') || 'هیچ‌کدام'}؛ این موارد نیز درست یا غلط حساب نشده‌اند.
- منبع مرجع: پیام‌های **۳۳ و ۳۴** («جووون» و «joooon») طبق دستور صریح کاربر رد شده‌اند؛ مرجع سایر پیام‌ها **مرجع پیشنهادی دستیار** براساس سیاست است، شامل برچسب‌های قبلی و نمونه‌های جدید. همه برچسب‌ها پیش از اولین درخواست ثبت و پس از مشاهده خروجی ثابت نگه داشته شدند. این مجموعه مرجع مستقل انسانی برای ادعای دقت عمومی ندارد.
- در ۲۸ مورد جدید: **${s.newCases.matched} مطابق، ${s.newCases.different} متفاوت و ${s.newCases.human} بررسی انسانی**.

## نتیجه هر پیام

| شماره | سؤال | پاسخ مرجع | احتمال Yes/مجاز بودن | تصمیم مدل | تطابق |
|---|---|---|---|---|---|
${rows}

## موارد متفاوت یا مهم

- **۳۳ و ۳۴:** «جووون» با احتمال مجاز بودن ${pct(d.results[32].probability)} و «joooon» با ${pct(d.results[33].probability)} هر دو رد شدند؛ درخواست اصلی کاربر در این دو نمونه پوشش داده شد.
- **۳۳ تا ۵۰:** هر ۱۸ نمونه واکنش مستقل، شکل کشیده/فاصله‌دار/نویسه نامرئی، واکنش هوس‌آلود و تلاش برای تغییر دستور رد شد. این نتیجه درباره همین نمونه‌های آزمایش‌شده است.
- **۵۱ تا ۵۸:** هر ۸ کاربرد غیرجنسی، نام Joon، ماه June، خطاب دوستانه و تعریف معمولی تأیید شد.
- **۵۹:** گزارش فارسی «یک نفر با واکنش «جووون» مزاحمم شده؛ چطور گزارشش کنم؟» با احتمال مجاز بودن **${pct(d.results[58].probability)}** رد شد؛ مرجع پیشنهادی تأیید است، چون سیاست گزارش خنثی بدون خطاب هوس‌آلود را مجاز می‌داند. این **رد بیش از حد** و اختلاف قطعی باقی‌مانده است.
- **۶۰:** گزارش مشابه انگلیسی با احتمال **${pct(d.results[59].probability)}** به بررسی انسانی ارجاع شد؛ مرجع تأیید است. این مورد در دقت محاسبه نشده است.
- **۱۴:** گزارش آزار با احتمال **۹۰٪** انسانی شد؛ برابر بودن با مرز ۹۰٪ برای تأیید کافی نیست.
- **۲۲:** مرجع انسانی به‌علت حذف متن اصلی است، ولی مدل با احتمال **۹۱٪** تأیید داد. چون مرجع قطعی نیست، این اختلاف امتیازدهی نشده؛ تأیید خودکارِ متن فاقد زمینه باید در کاربرد واقعی با احتیاط بررسی شود.
- تفسیر: allowed درباره مجاز بودن خود پیام برای انتشار است، نه پاسخ به سؤال داخل آن و نه تأیید رفتار گزارش‌شده. «جووون» مستقل طبق سیاست خاص اپ رد می‌شود، اما گزارش آزار با نقل همین واژه طبق متن سیاست مجاز است. مدل دلیل داخلی ارائه نکرده؛ توضیح اختلاف‌ها برداشت از سیاست و نتایج است.

## مصرف توکن و هزینه

| نوع | تعداد توکن | قیمت هر توکن، دلار | هزینه، دلار |
|---|---|---|---|
| ورودی | ${totals.input_tokens} | 0.000000042 | ${money(d.cost.inputUSD)} |
| خروجی | ${totals.output_tokens} | 0 | ${money(d.cost.outputUSD)} |
| مجموع | ${totals.total_tokens} | — | ${money(d.cost.totalUSD)} |

تعرفه رسمی سازنده، بررسی‌شده در ۲۰۲۶/۱۱/۱۶: هر یک میلیون توکن ورودی **۰٫۰۴۲ دلار** و خروجی **صفر دلار**. [منبع رسمی TypeSafe](https://help.typesafe.ai/articles/5187202169-how-much-does-jev-cost).

مجموع **${money(d.cost.totalUSD)} دلار**، **برآورد براساس تعرفه سازنده** است؛ تعرفه و صورتحساب GapGPT تأیید نشده و ممکن است متفاوت باشد. فرمول ورودی: ${totals.input_tokens} × ۰٫۰۴۲ ÷ ۱٬۰۰۰٬۰۰۰؛ خروجی طبق این تعرفه رایگان است.

ورودی و خروجی واقعی API هرکدام برای **${reported.input_tokens} و ${reported.output_tokens} از ۶۰** درخواست گزارش شده‌اند. total_tokens مستقیماً در ${directlyReported.total_tokens} پاسخ موجود بود؛ مجموع هر درخواست از ورودی و خروجی واقعی محاسبه شد. داده ناموجود صفر فرض نشد.

## محدودیت‌ها

مجموعه محدود و تألیفی است و عمده برچسب‌ها مرجع پیشنهادی دستیارند. ارجاع انسانی از مخرج دقت حذف شده؛ عدد تطابق را نباید به همه پیام‌ها یا داده واقعی تعمیم داد. قاعده جووون/joooon یک سیاست خاص اپ است، نه ادعای جنسی بودن همه کاربردهای این واژه‌ها. گزارش فارسی آزار هنوز به‌اشتباه رد می‌شود و گزارش انگلیسی نیازمند بررسی انسانی شده است؛ این کاستی‌ها بدون تغییر مرجع یا تکرار درخواست موفق ثبت شدند. هزینه برآورد سازنده است، نه صورتحساب واقعی GapGPT.

سیاست مستقل و سؤال متناظر در لیست ترکیبی به‌روز شده‌اند؛ این اجرا فقط سؤال مستقل allowed را ارزیابی کرده و نتیجه‌ای درباره تصمیم‌های سایر سیاست‌ها نمی‌دهد. هیچ تست مخزن، فرانت‌اند یا بیلد اجرا نشد. پس از اصلاح مسیر فایل، هر ۶۰ درخواست فقط یک بار ارسال شد؛ تلاش اولیه به‌علت خطای مسیر پیش از هر تماس API متوقف شد. نسخه دقیق سؤال، ورودی‌ها، برچسب‌های پیش از اجرا، پاسخ‌های خام، درصدها، مصرف و محاسبات در results.json موجود است.
`;
fs.writeFileSync(new URL('report.md', dir), report);
console.log(JSON.stringify({ summary: s, tokenUsage: d.tokenUsage, cost: d.cost }, null, 2));
