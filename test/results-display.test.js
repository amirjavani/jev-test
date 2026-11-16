import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { evaluateDataset } from '../shared/evaluation.js';

let server;
let AnswerComparisons;
let RunOutput;
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, logLevel: 'silent' });
  ({ AnswerComparisons } = await server.ssrLoadModule('/src/EvaluationResults.jsx'));
  ({ default: RunOutput } = await server.ssrLoadModule('/src/RunOutput.jsx'));
});
after(async () => { await server?.close(); });

const questions = {
  hate_discrimination_allowed: { type: 'noul' },
  sexual_content_allowed: { type: 'noul' },
  privacy_allowed: { type: 'noul' },
};
const entry = {
  index: 0, state: 'Example text', status: 'success',
  expectedAnswers: { hate_discrimination_allowed: true, sexual_content_allowed: false, privacy_allowed: 'human' },
  response: { ok: true, status: 200, data: { hate_discrimination_allowed: true, sexual_content_allowed: false, privacy_allowed: false },
    noulProbabilities: { hate_discrimination_allowed: 1, sexual_content_allowed: 0, privacy_allowed: 0.1234 } },
};

test('model cells show genuine violation and allowed percentages, including zero and human-review cases', () => {
  const evaluation = evaluateDataset([entry], questions).entries[0];
  const html = renderToStaticMarkup(createElement(AnswerComparisons, { evaluation, index: 0 }));
  const cells = [...html.matchAll(/<dl class="model-percentages">(.*?)<\/dl>/g)].map(match => match[1]);
  assert.equal(cells.length, 3);
  assert.match(cells[0], /Violation \(No\).*0\.0%.*Allowed \(Yes\).*100\.0%/);
  assert.match(cells[1], /Violation \(No\).*100\.0%.*Allowed \(Yes\).*0\.0%/);
  assert.match(cells[2], /Violation \(No\).*87\.7%.*Allowed \(Yes\).*12\.3%/);
  assert.ok(!cells.some(cell => /\btrue\b|\bfalse\b/.test(cell)));
  assert.match(html, /Human review/);
});

test('combined lists retain moderation percentage labels under their distinct question names', () => {
  const name = 'سیاست داخلی ایران / allowed';
  const combinedEntry = { ...entry, expectedAnswers: { [name]: true }, response: { ...entry.response, data: { [name]: true }, noulProbabilities: { [name]: 0.95 } } };
  const evaluation = evaluateDataset([combinedEntry], { [name]: { type: 'noul' } }).entries[0];
  const html = renderToStaticMarkup(createElement(AnswerComparisons, { evaluation, index: 0 }));
  assert.match(html, /Violation \(No\).*5\.0%.*Allowed \(Yes\).*95\.0%/);
});

test('legacy boolean-only outputs do not turn hard decisions into fabricated probabilities', () => {
  const legacy = { ...entry, response: { ...entry.response, noulProbabilities: undefined } };
  const evaluation = evaluateDataset([legacy], questions).entries[0];
  const html = renderToStaticMarkup(createElement(AnswerComparisons, { evaluation, index: 0 }));
  assert.equal((html.match(/Probability unavailable/g) || []).length, 3);
  assert.ok(!html.includes('model-percentages'));
});

test('moderation Results use the percentage table without a duplicate true/false JSON block', () => {
  const run = { mode: 'single', provider: 'gapgpt', startedAt: '2026-11-15T00:00:00Z', finishedAt: '2026-11-15T00:00:01Z',
    request: { model: 'test', state: entry.state, questions }, entries: [entry] };
  const html = renderToStaticMarkup(createElement(RunOutput, { run, built: {}, running: false, keyLoaded: false }));
  assert.match(html, /87\.7%/);
  assert.match(html, /12\.3%/);
  assert.ok(!html.includes('&quot;privacy_allowed&quot;: false'));
  assert.ok(!html.includes('&quot;hate_discrimination_allowed&quot;: true'));
});
