import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUsage, responseUsage, summarizeUsage } from '../shared/usage.js';
import { normalizeRun } from '../shared/runs.js';

test('normalizes reported counts, including zero, without inventing missing usage', () => {
  assert.deepEqual(normalizeUsage({ input_tokens: 120, output_tokens: 12 }), { input_tokens: 120, output_tokens: 12, total_tokens: 132 });
  assert.deepEqual(normalizeUsage({ prompt_tokens: 0, completion_tokens: 0 }), { input_tokens: 0, output_tokens: 0, total_tokens: 0 });
  assert.deepEqual(normalizeUsage({ input_tokens: 5 }), { input_tokens: 5, output_tokens: null, total_tokens: null });
  assert.deepEqual(normalizeUsage({ total_tokens: 20 }), { input_tokens: null, output_tokens: null, total_tokens: 20 });
  for (const bad of [undefined, {}, { credits_used: 12 }, { input_tokens: '12', output_tokens: -1 }, { total_tokens: Infinity }, { total_tokens: 1.5 }]) assert.equal(normalizeUsage(bad), null);
});

test('sums each request once and counts only reported usage from finished requests', () => {
  const entries = [
    { status: 'success', response: { usage: { input_tokens: 120, output_tokens: 12 }, data: { usage: { input_tokens: 120, output_tokens: 12 } } } },
    { status: 'error', response: { data: { usage: { input_tokens: 30, output_tokens: 0 } } } },
    { status: 'success', response: { usage: { output_tokens: 4 } } },
    { status: 'cancelled' }, { status: 'skipped' }, { status: 'pending' },
    { status: 'running', response: { usage: { input_tokens: 999 } } },
  ];
  assert.deepEqual(summarizeUsage(entries), { totals: { input_tokens: 150, output_tokens: 16, total_tokens: 162 }, reported: { input_tokens: 2, output_tokens: 3, total_tokens: 2 }, finished: 4, partial: true });
  const complete = summarizeUsage(entries.slice(0, 2));
  assert.equal(complete.partial, false);
  assert.deepEqual(complete.totals, { input_tokens: 150, output_tokens: 12, total_tokens: 162 });
  assert.deepEqual(summarizeUsage([]).totals, { input_tokens: null, output_tokens: null, total_tokens: null });
});

test('saved and exported moderation runs retain usage outside the boolean data', () => {
  const usage = { input_tokens: 90, output_tokens: 10, total_tokens: 100 };
  const request = { model: 'typesafe/jev-1.14', state: 'Some text', questions: { allowed: { type: 'noul' } } };
  const run = normalizeRun({ provider: 'gapgpt', mode: 'single', request, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), entries: [{ state: request.state, status: 'success', response: { ok: true, status: 200, data: { allowed: true }, usage } }] });
  const reopened = JSON.parse(JSON.stringify(run));
  assert.deepEqual(reopened.entries[0].response.data, { allowed: true });
  assert.deepEqual(responseUsage(reopened.entries[0].response), usage);
  assert.deepEqual(summarizeUsage(reopened.entries).totals, usage);
  assert.deepEqual(responseUsage({ data: { usage: { input_tokens: 90, output_tokens: 10 } } }), usage);
});
