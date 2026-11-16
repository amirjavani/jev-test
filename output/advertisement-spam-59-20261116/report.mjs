import fs from 'node:fs';
import crypto from 'node:crypto';
const dir = new URL('./', import.meta.url);
const file = new URL('results.json', dir);
const d = JSON.parse(fs.readFileSync(file, 'utf8'));
const datasetPath = 'examples/advertisement-spam-texts.json';
const datasetRaw = fs.readFileSync(datasetPath, 'utf8');
const dataset = JSON.parse(datasetRaw);
if (dataset.length !== d.results.length || dataset.some((e, i) => e.text !== d.results[i].text || typeof e.expectedAnswers?.allowed !== 'boolean')) throw Error('Reference dataset mismatch');
d.referenceSource = {
  type: 'assistant_proposed_existing_dataset', path: datasetPath,
  sha256: crypto.createHash('sha256').update(datasetRaw).digest('hex'),
  dataset,
  provenance: 'Labels were authored before this evaluation in the previous task and retained in the exported example dataset. The current common list had empty labels. They were therefore imported from the existing matching dataset after inference; none were inferred from or changed to match model output. References were not recorded in the run snapshot before requests, a procedural limitation.',
};
for (const [i, row] of d.results.entries()) {
  row.reference = dataset[i].expectedAnswers.allowed;
  row.comparison = !row.success ? 'execution_error' : row.decision === 'human' ? 'excluded_human' : row.decision === row.reference ? 'match' : 'mismatch';
}
const ok = d.results.filter(r => r.success);
const automatic = ok.filter(r => r.decision !== 'human');
const human = ok.filter(r => r.decision === 'human');
const matched = automatic.filter(r => r.comparison === 'match');
const different = automatic.filter(r => r.comparison === 'mismatch');
d.returnedModels = [...new Set(ok.map(r => r.rawResponse?.model))];
d.summary = {
  messages: d.results.length, successful: ok.length, failed: d.results.length - ok.length,
  approved: ok.filter(r => r.decision === true).length, rejected: ok.filter(r => r.decision === false).length,
  humanReview: human.length, scorable: automatic.length, matched: matched.length, different: different.length,
  accuracyAgainstProposedReference: automatic.length ? matched.length / automatic.length : null,
  automaticCoverage: automatic.length / d.results.length,
};
const totals = {}, reported = {}, directlyReported = {};
for (const field of ['input_tokens', 'output_tokens', 'total_tokens']) {
  const values = d.results.map(r => r.usage?.[field]).filter(v => typeof v === 'number');
  totals[field] = values.length ? values.reduce((sum, n) => sum + n, 0) : null;
  reported[field] = values.length;
  directlyReported[field] = d.results.filter(r => typeof r.rawResponse?.usage?.[field] === 'number').length;
}
d.tokenUsage = { totals, reported, directlyReported, totalDerivation: 'Missing total_tokens is calculated from actual reported input_tokens plus output_tokens; missing values are never treated as zero.' };
d.pricing = {
  source: 'https://help.typesafe.ai/articles/5187202169-how-much-does-jev-cost', checkedDate: '2026-11-16',
  inputPerMillionUSD: 0.042, outputPerMillionUSD: 0, inputPerTokenUSD: 0.000000042, outputPerTokenUSD: 0,
  basis: 'manufacturer_estimate_only', gapgptTariffVerified: false,
};
d.cost = {
  inputUSD: totals.input_tokens === null ? null : totals.input_tokens * d.pricing.inputPerTokenUSD,
  outputUSD: totals.output_tokens === null ? null : totals.output_tokens * d.pricing.outputPerTokenUSD,
  formula: 'reported_input_tokens * 0.042 / 1000000 + reported_output_tokens * 0 / 1000000',
};
d.cost.totalUSD = d.cost.inputUSD === null || d.cost.outputUSD === null ? null : d.cost.inputUSD + d.cost.outputUSD;
fs.writeFileSync(file, JSON.stringify(d, null, 2) + '\n');
const label = v => v === true ? 'تأیید' : v === false ? 'رد' : v === 'human' ? 'بررسی انسانی' : 'خطا';
const pct = v => v === null ? 'نامعلوم' : `${(v * 100).toFixed(2).replace(/\.00$/, '')}٪`;
const escape = text => text.replaceAll('|', '\\|').replaceAll('\n', '<br>');
const rows = d.results.map(r => `| ${r.number} | allowed — ${escape(r.text)} | ${label(r.reference)} | ${pct(r.probability)} | ${label(r.decision)} | ${r.comparison === 'match' ? 'مطابق' : r.comparison === 'mismatch' ? 'متفاوت' : r.comparison === 'excluded_human' ? 'خارج از امتیازدهی' : 'خطا'} |`).join('\n');
const s = d.summary;
const report = `# گزارش ارزیابی ${d.list.name}

- تاریخ: ۲۰۲۶/۱۱/۱۶، منطقه زمانی Asia/Tehran.
- مدل درخواستی: typesafe/jev-1.14؛ مدل گزارش‌شده در پاسخ‌ها: ${d.returnedModels.join('، ')}.
- سرویس: GapGPT؛ نشانی: https://api.gapgpt.app/v1/systemone.
- تعداد پیام‌ها: ${s.messages}؛ درخواست موفق: ${s.successful}؛ ناموفق: ${s.failed}.
- قاعده تصمیم‌گیری: احتمال اصلی Yes/مجاز بودن بیشتر از ۹۰٪ تأیید، کمتر از ۳۰٪ رد، و ۳۰٪ تا ۹۰٪ شامل دو مرز بررسی انسانی. تصمیم‌ها پیش از گردکردن درصد محاسبه شدند.
- هر پیام در یک درخواست مستقل اجرا شد؛ state فقط متن پیام بود. شماره پیام، پاسخ مرجع و توضیح دسته‌بندی به مدل ارسال نشد. همان Instructions و Criteria فعلی، بدون تغییر، استفاده شد؛ مثال‌های موجود در Instructions حفظ شدند.

## دقت و پوشش

- مطابق: **${s.matched}**؛ متفاوت قطعی: **${s.different}**؛ بررسی انسانی مدل: **${s.humanReview}**؛ خطای اجرا: **${s.failed}**.
- تطابق روی موارد قابل امتیازدهی با مرجع پیشنهادی دستیار: **${s.matched} ÷ ${s.scorable} = ${pct(s.accuracyAgainstProposedReference)}**. این عدد دقت قطعی در برابر مرجع مستقل انسانی نیست.
- پوشش تصمیم خودکار: **${automatic.length} ÷ ${s.messages} = ${pct(s.automaticCoverage)}**.
- تصمیم‌ها: **${s.approved} تأیید، ${s.rejected} رد، ${s.humanReview} بررسی انسانی**. ارجاع انسانی درست یا غلط شمرده نشده است.
- منبع مرجع: **مرجع پیشنهادی دستیار**، همان برچسب‌های ساخته‌شده در مرحله قبلی و موجود در فایل examples/advertisement-spam-texts.json؛ این‌ها برچسب اختصاصی کاربر یا داوری مستقل انسانی نیستند.
- نکته ثبت مرجع: هنگام اجرای فعلی، expectedAnswers نسخه Common List خالی بود و در نتیجه مرجع در snapshot اولیه اجرا ثبت نشد. پس از اجرا، همان برچسب‌های از پیش موجودِ فایل نمونه‌ها با تطبیق دقیق متن و ترتیب هر ۵۹ پیام وارد گزارش شدند. هیچ برچسبی براساس نتیجه مدل ساخته یا تغییر داده نشد. این انحراف از ترتیب ثبت مرجع در بند ۵ دستور ارزیابی، محدودیت فرایندی این اجراست. نسخه اولیه لیست با برچسب‌های خالی و فایل مرجع جداگانه هر دو در JSON نگهداری شده‌اند.

## نتیجه هر پیام

| شماره | سؤال | پاسخ مرجع | احتمال Yes/مجاز بودن | تصمیم مدل | تطابق |
|---|---|---|---|---|---|
${rows}

## موارد متفاوت یا مهم

- اختلاف قطعی با مرجع پیشنهادی: ${different.length === 0 ? '**هیچ موردی ثبت نشد**.' : different.map(r => r.number).join('، ')}
- **پیام ۵۷**، «Someone sent “asdfghjkl”; how do I report this spam?»: احتمال مجاز بودن **۷۴٪**؛ بررسی انسانی، در برابر مرجع تأیید. طبق سیاست، گزارش معنادار با نقل نمونه کوتاه بی‌معنی می‌تواند مجاز باشد؛ مدل به آستانه تأیید نرسیده است. این مورد اشتباه قطعی محسوب نمی‌شود.
- **پیام ۵۹**، «شماره: [حذف‌شده]؛ ایمیل: [حذف‌شده].»: احتمال مجاز بودن **۸۶٪**؛ بررسی انسانی، در برابر مرجع تأیید. مقدار قابل بازیابی درج نشده و مرجع آن را مجاز می‌داند، اما ۸۶٪ برای تأیید خودکار کافی نیست.
- پیام‌های **۱۲ تا ۱۵** معرفی دوره‌ها و دوئل‌های داخل اپ را بدون لینک یا تخلف دیگر مطرح کردند و تأیید شدند. پیام‌های **۱۶ تا ۱۹** تبلیغ بیرونی یا ترکیبی بودند و رد شدند.
- پیام‌های **۲۰ تا ۲۶** درخواست لایک، کامنت و تعامل‌گیری بودند و همگی رد شدند. پیام‌های **۲۷ تا ۳۱** رشته بی‌معنی، تکرار و زباله متنی بودند و همگی رد شدند.
- پیام‌های **۳۲ تا ۴۵** شماره، ایمیل، دامنه یا لینک آشکار و پنهان، از جمله شماره با حروف، لینک داخلی اپ و مسیر نسبی را داشتند و همگی رد شدند. لینک آموزشی در پیام‌های **۵ و ۶** و شماره غیرتبلیغاتی در پیام **۱۰** نیز رد شدند.
- پیام‌های **۵۰ و ۵۱** پرسش درباره خرابی دکمه لایک/کامنت بودند و تأیید شدند؛ پیام **۵۴** امتیاز و شناسه دوره بود و با شماره تلفن اشتباه گرفته نشد.
- نگاشت تفسیری: سؤال allowed، مجاز بودن **خود متن برای انتشار** را می‌سنجد؛ پاسخ پرسش داخل پیام یا تأیید رفتار توصیف‌شده را تولید نمی‌کند. بنابراین گزارش معنادار اسپم با خود اسپم تفاوت دارد، ولی درج شماره/ایمیل/لینک حتی در گزارش یا معرفی امکانات داخلی طبق سیاست رد می‌شود. توضیح‌های این بخش برداشت از سیاست و خروجی‌اند؛ مدل دلیل داخلی تصمیم خود را ارائه نکرده است.

## مصرف توکن و هزینه

| نوع | تعداد توکن | قیمت هر توکن، دلار | هزینه، دلار |
|---|---|---|---|
| ورودی | ${totals.input_tokens} | 0.000000042 | ${d.cost.inputUSD?.toFixed(9) ?? 'نامعلوم'} |
| خروجی | ${totals.output_tokens} | 0 | ${d.cost.outputUSD?.toFixed(9) ?? 'نامعلوم'} |
| مجموع | ${totals.total_tokens} | — | ${d.cost.totalUSD?.toFixed(9) ?? 'نامعلوم'} |

تعرفه رسمی سازنده، بررسی‌شده در ۲۰۲۶/۱۱/۱۶: هر یک میلیون توکن ورودی **۰٫۰۴۲ دلار**؛ هر یک میلیون توکن خروجی **صفر دلار**. [منبع رسمی TypeSafe](https://help.typesafe.ai/articles/5187202169-how-much-does-jev-cost).

مجموع **${d.cost.totalUSD?.toFixed(9) ?? 'نامعلوم'} دلار**، **برآورد براساس تعرفه سازنده** است. تعرفه و صورتحساب واقعی GapGPT تأیید نشده و ممکن است متفاوت باشد. هزینه از تعداد واقعی توکن‌ها ضرب در قیمت هر توکن محاسبه شده است؛ قیمت و هزینه نامعلوم حدس زده نشده‌اند.

پوشش مصرف گزارش‌شده توسط API: ورودی **${reported.input_tokens} از ${s.messages}** و خروجی **${reported.output_tokens} از ${s.messages}**. فیلد total_tokens مستقیماً در **${directlyReported.total_tokens}** پاسخ آمده؛ مجموع ${reported.total_tokens} درخواست از جمع ورودی و خروجی واقعی محاسبه شده است. داده ناموجود صفر فرض نشده است.

## محدودیت‌ها

این ۵۹ نمونه فارسی، انگلیسی و فینگلیش مجموعه‌ای محدود و تألیفی‌اند؛ نتیجه تضمین عملکرد روی پیام‌های واقعی یا همه روش‌های دورزدن نیست. برچسب‌ها مرجع پیشنهادی دستیار هستند و داوری مستقل انسانی ندارند؛ دو مورد بررسی انسانی از مخرج تطابق حذف شده‌اند. ۱۰۰٪ تطابق در موارد قطعی، به معنای تأیید خودکار همه پیام‌های مجاز یا تطابق قطعی همه ۵۹ پیام نیست. ثبت مرجع در snapshot اجرا پس از درخواست‌ها با اتکا به فایل مرجع از پیش موجود انجام شد؛ این نقص فرایندی صریحاً در بالا ثبت شده است. هزینه، برآورد سازنده است و صورتحساب واقعی GapGPT نیست.

هیچ تست مخزن، تست فرانت‌اند یا بیلد اجرا نشد. هر ۵۹ درخواست فقط یک بار اجرا شد و درخواست موفق تکرار نشد. نسخه دقیق لیست، ورودی‌ها، مرجع‌ها و منشأ آن‌ها، پاسخ خام، احتمال‌ها، درصدها، تصمیم‌ها، توکن‌ها و محاسبات هزینه در results.json ذخیره شده‌اند.
`;
fs.writeFileSync(new URL('report.md', dir), report);
console.log(JSON.stringify({ summary: s, tokenUsage: d.tokenUsage, cost: d.cost }, null, 2));
