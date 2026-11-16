import fs from 'node:fs';
import 'dotenv/config';
import { normalizeUsage } from '../shared/usage.js';

const folder = `output/respect-20-20261115-${Date.now()}`;
fs.mkdirSync(folder);
const list = JSON.parse(fs.readFileSync('common/question-lists/5f20c9da-7bd8-48e8-82f9-d0b8bf5d406c.json', 'utf8'));
const texts = [
  'واقعاً چقدر بی‌شعوری! قبل از حرف زدن یکم فکر کن.',
  'تو با این سطح فهم و شعورت بهتره اصلاً نظر ندی.',
  'خفه شو بابا، کسی نظر تو رو نخواست.',
  'بعضیا واقعاً ثابت کردن که مغز فقط برای پر کردن جمجمه‌شونه!',
  'چه آدم مزخرف و غیرقابل تحملی هستی، واقعاً حالم ازت به هم می‌خوره.',
  'برو اول یاد بگیر آدم باشی بعد بیا درباره بقیه حرف بزن.',
  'این همه حماقت رو از کجا یاد گرفتی؟ واقعاً استعداد خاصی داری!',
  'تو حتی ارزش جواب دادن هم نداری، برو گمشو.',
  'ظاهراً بعضیا هنوز در مرحله تکامل فکری متوقف شدن!',
  'به نظرم کسی که این تصمیم رو گرفته یا اصلاً فکر نکرده یا عمداً خواسته خرابکاری کنه.',
  'واقعاً شاهکار کردی! فقط مونده بود همین یکی رو خراب کنی.',
  'این حرفی که زدی خیلی بوی بی‌سوادی می‌ده، البته شاید من اشتباه می‌کنم.',
  'فلانی بهم گفت بی‌شعور و بعد هم بدون توضیح از گروه خارج شد.',
  'این چه وضعشه آخه؟ آدم از دست بعضیا دیوونه می‌شه!',
  'من با نظر شما کاملاً مخالفم و فکر می‌کنم استدلالتون اشتباهه.',
  'این تصمیم واقعاً مزخرفه و باید دوباره بررسی بشه.',
  'لعنت به این اینترنت! وسط کار دوباره قطع شد.',
  'لطفاً به جای حمله شخصی، درباره موضوع بحث کنیم.',
  'من از عملکرد این تیم اصلاً راضی نیستم؛ کیفیت کارشون خیلی پایینه.',
  'این حرفت توهین‌آمیز بود و انتظار دارم محترمانه‌تر صحبت کنی.',
];
const refs = [...Array(8).fill(false), ...Array(6).fill('human'), ...Array(6).fill(true)];
const data = { date: '2026-11-15', timezone: 'Asia/Tehran', startedAt: new Date().toISOString(), model: 'typesafe/jev-1.14', endpoint: 'https://api.gapgpt.app/v1/systemone', list, referenceSource: 'user', thresholds: { approveAbove: 0.9, rejectBelow: 0.3, inclusiveHumanRange: [0.3, 0.9] }, results: texts.map((text, i) => ({ number: i + 1, text, reference: refs[i] })) };
const save = () => fs.writeFileSync(`${folder}/results.json`, JSON.stringify(data, null, 2));
save();
console.log(`FOLDER=${folder}`);
const key = process.env.GAPGPT_API_KEY?.trim();
if (!key) throw Error('GAPGPT_API_KEY missing; references saved, no requests sent');
let next = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (next < data.results.length) {
    const row = data.results[next++];
    const start = Date.now();
    try {
      const response = await fetch(data.endpoint, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: data.model, state: row.text, questions: list.questions }), signal: AbortSignal.timeout(120000) });
      row.httpStatus = response.status;
      row.rawBody = (await response.text()).split(key).join('[REDACTED]');
      try { row.rawResponse = JSON.parse(row.rawBody); } catch {}
      row.usage = normalizeUsage(row.rawResponse?.usage);
      const p = row.rawResponse?.answers?.allowed?.noul;
      row.probability = typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= 1 ? p : null;
      row.percent = row.probability === null ? null : row.probability * 100;
      row.success = response.ok && row.probability !== null;
      row.decision = row.success ? p > 0.9 ? true : p < 0.3 ? false : 'human' : null;
    } catch (error) {
      row.success = false;
      row.error = error.message.split(key).join('[REDACTED]');
    }
    row.durationMs = Date.now() - start;
    save();
    console.log(JSON.stringify({ number: row.number, success: row.success, probability: row.probability, error: row.error }));
  }
}));
data.finishedAt = new Date().toISOString();
save();
