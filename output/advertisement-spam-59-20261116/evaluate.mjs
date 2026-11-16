import fs from 'node:fs';
import 'dotenv/config';
import { normalizeUsage } from '../../shared/usage.js';

const dir = new URL('./', import.meta.url);
const resultFile = new URL('results.json', dir);
if (fs.existsSync(resultFile)) throw Error('Existing results preserved; do not repeat this run.');
const listPath = 'common/question-lists/89a42172-28b6-48dc-b63a-545e45fce988.json';
const list = JSON.parse(fs.readFileSync(listPath, 'utf8'));
if (list.exampleTexts.length !== 59) throw Error('Expected exactly 59 examples.');
const data = {
  date: '2026-11-16', timezone: 'Asia/Tehran', startedAt: new Date().toISOString(),
  model: 'typesafe/jev-1.14', service: 'GapGPT', endpoint: 'https://api.gapgpt.app/v1/systemone',
  authorization: 'User requested evaluating these same 59 bundled examples with the configured model and reporting under common/question-list-evaluation-prompt.md.',
  listPath, list, referenceSource: 'Existing bundled reference labels, authored by the assistant when updating the policy; frozen before execution; not independent human ground truth.',
  thresholds: { approveAbove: 0.9, rejectBelow: 0.3, inclusiveHumanRange: [0.3, 0.9] },
  executionStatus: 'running',
  results: list.exampleTexts.map((example, index) => ({ number: index + 1, text: example.text, reference: example.expectedAnswers.allowed })),
};
const save = () => fs.writeFileSync(resultFile, JSON.stringify(data, null, 2) + '\n');
save();
const key = process.env.GAPGPT_API_KEY?.trim();
if (!key) throw Error('GAPGPT_API_KEY missing; no request sent.');
let next = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (next < data.results.length) {
    const row = data.results[next++];
    const start = Date.now();
    try {
      const response = await fetch(data.endpoint, {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: data.model, state: row.text, questions: list.questions }),
        signal: AbortSignal.timeout(120000),
      });
      row.httpStatus = response.status;
      row.rawBody = (await response.text()).split(key).join('[REDACTED]');
      try { row.rawResponse = JSON.parse(row.rawBody); } catch {}
      row.usage = normalizeUsage(row.rawResponse?.usage);
      const p = row.rawResponse?.answers?.allowed?.noul;
      row.probability = typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= 1 ? p : null;
      row.percent = row.probability === null ? null : p * 100;
      row.success = response.ok && row.probability !== null;
      row.decision = row.success ? p > 0.9 ? true : p < 0.3 ? false : 'human' : null;
      if (!row.success) row.error = response.ok ? 'Missing or invalid allowed probability' : `HTTP ${response.status}`;
    } catch (error) {
      row.success = false;
      row.error = String(error.message).split(key).join('[REDACTED]');
      if (error.cause?.code) row.errorCode = error.cause.code;
    }
    row.durationMs = Date.now() - start;
    save();
    console.log(JSON.stringify({ number: row.number, success: row.success, probability: row.probability, error: row.error }));
  }
}));
data.executionStatus = 'completed';
data.finishedAt = new Date().toISOString();
save();
