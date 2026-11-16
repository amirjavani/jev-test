// Explicitly authorized first-10 live evaluation. Does not run repository tests.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { combineQuestionLists } from '../../shared/selected-question-lists.js';
import { normalizeUsage } from '../../shared/usage.js';
const root = new URL('../../', import.meta.url);
const dir = new URL('./', import.meta.url);
dotenv.config({ path: fileURLToPath(new URL('.env', root)), quiet: true });
const names = ['Advertising & Spam', 'Disrespect & Violence', 'Inappropriate Sexual Content', 'Iranian Politics', 'Privacy & Personal Information'];
const source = await fs.readFile(new URL('output/post-moderation-dataset.json', root), 'utf8');
const dataset = JSON.parse(source);
const available = await Promise.all((await fs.readdir(new URL('common/question-lists/', root))).filter(f => f.endsWith('.json')).map(async file => ({ file, ...JSON.parse(await fs.readFile(new URL(`common/question-lists/${file}`, root), 'utf8')) })));
const lists = names.map(name => { const list = available.find(l => l.name === name); if (!list || Object.keys(list.questions).length !== 1) throw Error(`Invalid list: ${name}`); return list; });
const questions = combineQuestionLists(lists).questions;
const keys = Object.keys(questions);
const entries = dataset.slice(0, 10).map((item, i) => ({
  number: i + 1, text: item.text, expectedAnswers: item.expectedAnswers,
  // Auxiliary policy references are separate from the supplied overall labels.
  proposedPolicyReferences: Object.fromEntries(keys.map((key, j) => [key, i === 0 && j === 0 ? false : i === 6 && j === 3 ? 'human' : true])),
  status: 'pending',
}));
const classify = p => p > 0.9 ? true : p < 0.3 ? false : 'human';
const aggregate = values => values.includes(false) ? false : values.includes('error') ? 'error' : values.includes('human') ? 'human' : values.every(v => v === true) ? true : 'error';
const pricing = { source: 'https://docs.typesafe.ai/models', verifiedDate: '2026-11-16', basis: 'manufacturer estimate; GapGPT invoice price unverified', inputPerMillionUSD: 0.042, outputPerMillionUSD: 0, inputPerTokenUSD: 0.000000042, outputPerTokenUSD: 0 };
const results = {
  startedAt: new Date().toISOString(), dateTimezone: 'Asia/Tehran', provider: 'GapGPT', endpoint: 'https://api.gapgpt.app/v1/systemone', model: 'typesafe/jev-1.14',
  sourceDataset: { path: 'output/post-moderation-dataset.json', sha256: createHash('sha256').update(source).digest('hex'), totalPosts: dataset.length, selectedRange: [1, 10] },
  evaluationPrompt: await fs.readFile(new URL('common/question-list-evaluation-prompt.md', root), 'utf8'),
  lists: lists.map(({file, id, name, questions}) => ({ file: `common/question-lists/${file}`, id, name, questions })), questions,
  rules: { thresholds: 'unrounded p > 0.9 allowed; p < 0.3 unallowed; otherwise human', aggregation: 'false > human > true; true requires all five true; incomplete results are errors unless a known false already decides rejection', requestMode: 'one request per post containing all five unchanged question definitions; unique names from project combineQuestionLists', input: 'state contains only text; no labels, post numbers, category explanations or proposed references', references: 'Original expectedAnswers.allowed is used only against the aggregate. Per-policy references are assistant proposals frozen before requests, not ground truth.', proposedReferenceNotes: 'Post 1 requests likes: spam false, other policies true. Post 7 mentions Farhangian entrance examination; ambiguous relation to government-sector policy marked human for politics. Other policy references true. Ordinary support/XP/course questions are evaluated as text, not answered; no promotion inferred from a course question.' },
  pricing, referencesRecordedAt: new Date().toISOString(), entries,
};
await fs.writeFile(new URL('inputs-before-run.json', dir), JSON.stringify(results, null, 2) + '\n', { flag: 'wx' });
if (!process.env.GAPGPT_API_KEY?.trim()) throw Error('GAPGPT_API_KEY is not configured.');
for (const entry of entries) {
  const start = performance.now();
  entry.request = { model: results.model, state: { text: entry.text }, questions };
  try {
    const response = await fetch(results.endpoint, { method: 'POST', headers: { Authorization: `Bearer ${process.env.GAPGPT_API_KEY.trim()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(entry.request), signal: AbortSignal.timeout(120000) });
    entry.httpStatus = response.status;
    const raw = (await response.text()).split(process.env.GAPGPT_API_KEY.trim()).join('[REDACTED]');
    try { entry.rawResponse = JSON.parse(raw); } catch { entry.rawResponse = raw; }
    entry.usage = normalizeUsage(entry.rawResponse?.usage);
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    entry.policyResults = Object.fromEntries(keys.map(key => {
      const p = entry.rawResponse?.answers?.[key]?.noul;
      const valid = typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= 1;
      return [key, { probability: valid ? p : null, allowedPercent: valid ? p * 100 : null, violationPercent: valid ? (1-p)*100 : null, decision: valid ? classify(p) : 'error', proposedReference: entry.proposedPolicyReferences[key] }];
    }));
    entry.aggregateAllowed = aggregate(Object.values(entry.policyResults).map(p => p.decision));
    entry.status = Object.values(entry.policyResults).some(p => p.decision === 'error') ? 'error' : 'success';
    if (entry.status === 'error') entry.error = 'Missing or invalid original probability.';
    entry.comparison = typeof entry.aggregateAllowed === 'boolean' && typeof entry.expectedAnswers.allowed === 'boolean' ? entry.aggregateAllowed === entry.expectedAnswers.allowed ? 'match' : 'mismatch' : entry.aggregateAllowed === 'human' ? 'human' : 'unscored';
  } catch (e) { entry.status = 'error'; entry.error = e.message; entry.comparison = 'unscored'; }
  entry.durationMs = Math.round(performance.now() - start);
  await fs.writeFile(new URL('results.json', dir), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify({ post: entry.number, status: entry.status, decision: entry.aggregateAllowed, comparison: entry.comparison, error: entry.error, usage: entry.usage }));
}
results.finishedAt = new Date().toISOString();
const matches = entries.filter(e => e.comparison === 'match').length;
const mismatches = entries.filter(e => e.comparison === 'mismatch').length;
const human = entries.filter(e => e.aggregateAllowed === 'human').length;
const automatic = entries.filter(e => typeof e.aggregateAllowed === 'boolean').length;
const totals = {}, reported = {};
for (const field of ['input_tokens', 'output_tokens', 'total_tokens']) {
  const values = entries.map(e => e.usage?.[field]).filter(n => typeof n === 'number');
  totals[field] = values.length ? values.reduce((a,b) => a+b, 0) : null;
  reported[field] = values.length;
}
results.summary = { successfulRequests: entries.filter(e => e.status === 'success').length, failedRequests: entries.filter(e => e.status === 'error').length, matches, mismatches, human, automatic, accuracy: matches + mismatches ? matches / (matches + mismatches) : null, automaticCoverage: automatic / entries.length, decisions: { allowed: entries.filter(e => e.aggregateAllowed === true).length, unallowed: entries.filter(e => e.aggregateAllowed === false).length, human }, usage: { totals, reported, requests: entries.length }, estimatedCostsUSD: { input: totals.input_tokens === null ? null : totals.input_tokens * pricing.inputPerTokenUSD, output: totals.output_tokens === null ? null : totals.output_tokens * pricing.outputPerTokenUSD, total: totals.input_tokens === null || totals.output_tokens === null ? null : totals.input_tokens * pricing.inputPerTokenUSD + totals.output_tokens * pricing.outputPerTokenUSD }, policyMetrics: Object.fromEntries(keys.map(key => {const pairs = entries.filter(e => typeof e.policyResults?.[key]?.decision === 'boolean' && typeof e.proposedPolicyReferences[key] === 'boolean'); return [key, {referenceSource:'assistant proposed', scored:pairs.length, matches:pairs.filter(e => e.policyResults[key].decision === e.proposedPolicyReferences[key]).length, human:entries.filter(e => e.policyResults?.[key]?.decision === 'human').length}];})) };
await fs.writeFile(new URL('results.json', dir), JSON.stringify(results, null, 2) + '\n');
if (!results.summary.successfulRequests) throw Error('No successful evaluations; no report created.');
const label = value => value === true ? 'مجاز' : value === false ? 'غیرمجاز' : value === 'human' ? 'بررسی انسانی' : 'خطا';
const pct = value => value === null ? 'ناموجود' : (value * 100).toFixed(2) + '٪';
const money = value => value === null ? 'نامشخص' : value.toFixed(9);
const escape = text => text.replaceAll('|', '\\|').replace(/\r?\n/g, '<br>');
const s = results.summary;
let md = `# گزارش ارزیابی پنج فهرست تعدیل محتوا — ۱۰ پست نخست\n\n- تاریخ: ۲۰۲۶-۱۱-۱۶، منطقه زمانی Asia/Tehran\n- مدل: \`${results.model}\`؛ سرویس: GapGPT؛ مسیر: ${results.endpoint}\n- مجموعه: ${dataset.length} پست؛ فقط پست‌های ۱ تا ۱۰ به ترتیب فایل بررسی شدند.\n- درخواست موفق: ${s.successfulRequests}؛ ناموفق: ${s.failedRequests}؛ ۱۰ درخواست، هرکدام شامل پنج سؤال مستقل.\n- نسخه فعلی Instructions، Criteria و مثال‌های درون سؤال‌ها بدون تغییر استفاده شد. نام کلیدهای تکراری با تابع خود پروژه یکتا شد.\n\n## قاعده تصمیم‌گیری\n\nاحتمال اصلی Yes/مجاز بودن، پیش از گردکردن: بیشتر از ۹۰٪ مجاز، کمتر از ۳۰٪ غیرمجاز، و از ۳۰٪ تا ۹۰٪ با احتساب مرزها بررسی انسانی است.\n\nتصمیم نهایی: وجود حتی یک غیرمجاز ← غیرمجاز؛ در نبود غیرمجاز، وجود بررسی انسانی ← بررسی انسانی؛ فقط وقتی هر پنج سؤال مجاز باشند ← مجاز. احتمال‌ها میانگین‌گیری نمی‌شوند. خطای درخواست، مجاز یا بررسی انسانی فرض نمی‌شود.\n\n## دقت و پوشش\n\n- مطابق با برچسب کلی داده: ${matches}؛ متفاوت: ${mismatches}؛ بررسی انسانی نهایی: ${human}.\n- دقت نسبت به برچسب‌های همین دیتاست: ${matches}/${matches + mismatches} = ${pct(s.accuracy)}. بررسی انسانی و خطا در مخرج نیستند.\n- پوشش تصمیم خودکار: ${automatic}/۱۰ = ${pct(s.automaticCoverage)}.\n- توزیع نتیجه: ${s.decisions.allowed} مجاز، ${s.decisions.unallowed} غیرمجاز، ${human} انسانی.\n- برچسب اصلی \`expectedAnswers.allowed\` تنها مرجع تصمیم نهایی است و به پنج سیاست کپی نشده است. این عدد میزان توافق با دیتاست است؛ اعتبار مستقل برچسب‌ها تأیید نشده است.\n- برای جدول مستقل سؤال‌ها، «مرجع پیشنهادی دستیار» پیش از اجرای مدل در inputs-before-run.json ثبت شد و پس از دیدن پاسخ‌ها تغییر نکرد. این مرجع جای برچسب اصلی را نمی‌گیرد.\n\n## نتیجه نهایی هر پیام\n\n| شماره | متن کامل | مرجع دیتاست | تصمیم نهایی مدل | تطابق |\n|---|---|---|---|---|\n`;
for (const e of entries) md += `| ${e.number} | ${escape(e.text)} | ${label(e.expectedAnswers.allowed)} | ${label(e.aggregateAllowed)} | ${{match:'مطابق',mismatch:'متفاوت',human:'ارجاع انسانی؛ بدون امتیاز',unscored:'بدون امتیاز'}[e.comparison]} |\n`;
md += '\n## نتیجه هر سؤال\n\nمرجع این جدول فقط «مرجع پیشنهادی دستیار» است، نه برچسب مستقل ارائه‌شده توسط کاربر.\n';
for (const [j,key] of keys.entries()) {
  md += `\n### ${names[j]}\n\n| شماره | سؤال | مرجع پیشنهادی دستیار | احتمال Yes/مجاز بودن | تصمیم مدل | تطابق با مرجع پیشنهادی |\n|---|---|---|---|---|---|\n`;
  for (const e of entries) {
    const p = e.policyResults?.[key];
    const ref = e.proposedPolicyReferences[key];
    const comparison = typeof p?.decision === 'boolean' && typeof ref === 'boolean' ? p.decision === ref ? 'مطابق' : 'متفاوت' : 'بدون امتیاز';
    md += `| ${e.number} | allowed | ${label(ref)} | ${p ? pct(p.probability) : 'ناموجود'} | ${label(p?.decision)} | ${comparison} |\n`;
  }
}
md += '\n## موارد متفاوت یا مهم\n\n';
for (const e of entries.filter(e => e.comparison !== 'match')) md += `- پست ${e.number}: مرجع ${label(e.expectedAnswers.allowed)}، مدل ${label(e.aggregateAllowed)}.${e.error ? ' خطا: '+e.error : ''}\n`;
md += '\n- پست ۱ درخواست صریح لایک دارد و طبق سیاست اسپم باید رد شود؛ رد این سیاست برای رد نهایی کافی است.\n- پست‌های ۳ و ۵ درباره جستجوی عادی کاربران و کد معرف خود برنامه‌اند؛ معیارهای فعلی صریحاً این کاربردها را مجاز می‌دانند. این موارد استخراج اطلاعات شخصی یا درخواست رمز ورود نیستند.\n- پست‌های ۲ و ۱۰ تعریف معمولی از برنامه‌اند، ولی برچسب دیتاست آن‌ها متفاوت است. این ناسازگاری نیازمند بازبینی مرجع است.\n- پست ۷ درباره کنکور فرهنگیان است. نسبت این اشاره آموزشی با منع گسترده بخش دولتی در سیاست سیاسی مبهم است؛ مرجع پیشنهادی این سؤال پیش از اجرا انسانی ثبت شد. تصمیم نهایی همچنان فقط با برچسب اصلی دیتاست مقایسه می‌شود.\n- پست‌های ۸ و ۹ سؤال درباره XP و شروع آموزش پایتون‌اند و در دیتاست رد شده‌اند؛ معیارهای ذخیره‌شده، پرسش واقعی و غیرتبلیغاتی را به‌خودی‌خود منع نمی‌کنند.\n- موضوع ارزیابی مجاز بودن خود متن است؛ پاسخ پرسش داخل پست، زمان آغاز دوره و درستی رفتار ادعاشده بررسی نشده است.\n\n## مصرف توکن و هزینه\n\n';
md += `| نوع | تعداد توکن گزارش‌شده | قیمت هر توکن، دلار | هزینه برآوردی، دلار |\n|---|---|---|---|\n| ورودی | ${totals.input_tokens ?? 'ناموجود'} | 0.000000042 | ${money(s.estimatedCostsUSD.input)} |\n| خروجی | ${totals.output_tokens ?? 'ناموجود'} | 0 | ${money(s.estimatedCostsUSD.output)} |\n| مجموع | ${totals.total_tokens ?? 'ناموجود'} | — | ${money(s.estimatedCostsUSD.total)} |\n\n`;
md += `پوشش گزارش‌دهی توکن: ورودی ${reported.input_tokens}/۱۰، خروجی ${reported.output_tokens}/۱۰، کل ${reported.total_tokens}/۱۰. تعداد گزارش‌نشده صفر فرض نشده است. کلِ مفقود فقط در صورت وجود شمار ورودی و خروجی از جمع آن‌ها محاسبه می‌شود.\n\n[تعرفه رسمی سازنده](https://docs.typesafe.ai/models)، بررسی‌شده در ۲۰۲۶-۱۱-۱۶: ورودی ۰٫۰۴۲ دلار برای یک میلیون توکن، خروجی صفر دلار. هزینه بالا «برآورد براساس تعرفه سازنده» است؛ تعرفه و صورتحساب واقعی GapGPT تأیید نشده و ممکن است متفاوت باشد. هزینه شامل توکن سؤال‌ها و دستورها طبق مصرف واقعی API است.\n\n## محدودیت‌ها\n\n- این نمونه فقط ۱۰ پست نخست و غیرتصادفی است؛ نتیجه به کل مجموعه تعمیم داده نمی‌شود.\n- مرجع مستقل هر سیاست در دیتاست وجود ندارد؛ مرجع پیشنهادی دستیار حقیقت قطعی یا برچسب انسانی معتبر محسوب نمی‌شود.\n- نمونه شامل چند برچسب کلی قابل بازبینی است؛ دقت صرفاً توافق با نسخه فعلی دیتاست است.\n- بررسی انسانی از امتیازدهی حذف شده است و هزینه، برآورد تعرفه سازنده است.\n- متن پست‌ها تنها داده ورودی مدل بود؛ برچسب‌ها، شماره پست و مرجع پیشنهادی ارسال نشدند. هیچ تست مخزن، تست فرانت‌اند یا بیلد اجرا نشد و درخواست موفق تکرار نشد.\n\nنسخه دقیق سؤال‌ها، ورودی‌ها، مراجع ثبت‌شده پیش از اجرا، پاسخ خام API، احتمال‌های بدون گردکردن، تصمیم‌ها، مصرف توکن و محاسبات هزینه در [results.json](results.json) محفوظ است.\n`;
await fs.writeFile(new URL('report.fa.md', dir), md, { flag: 'wx' });
console.log(JSON.stringify({summary:results.summary, report:fileURLToPath(new URL('report.fa.md',dir))},null,2));
