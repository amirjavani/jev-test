import test from 'node:test';
import assert from 'node:assert/strict';
import { expectedAnswerWarning, questionLabels, referenceLabels, withQuestionLabels } from '../shared/expected-answers.js';
import { evaluateSequentially, normalizeRun } from '../shared/runs.js';
import { evaluateDataset } from '../shared/evaluation.js';

const questions = {
  'Spam / allowed': { type: 'noul', instructions: 'Free of spam?' },
  'Politics / allowed': { type: 'noul', instructions: 'Free of politics?' },
};

test('single dataset label can run multiple policies, retain outputs, and round-trip without scoring', async () => {
  const states = [{ text: 'سلام' }];
  const sent = [];
  const entries = await evaluateSequentially({ states, expectedAnswers: [{ allowed: false }], signal: new AbortController().signal, onUpdate: () => {}, evaluate: async state => {
    sent.push(state);
    return { ok: true, data: { 'Spam / allowed': true, 'Politics / allowed': false } };
  } });
  assert.deepEqual(sent, states);
  const evaluation = evaluateDataset(entries, questions);
  assert.equal(evaluation.summary.scored, 0);
  assert.equal(evaluation.summary.accuracy, null);
  assert.equal(evaluation.warnings.length, 1);
  assert.equal(evaluation.entries[0].comparisons['Spam / allowed'].predicted, true);
  assert.equal(evaluation.entries[0].comparisons['Politics / allowed'].predicted, false);
  const run = normalizeRun({ provider: 'gapgpt', mode: 'batch', request: { model: 'test', state: states[0], questions }, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), entries });
  assert.deepEqual(run.entries[0].expectedAnswers, { allowed: false });
  assert.equal(evaluateDataset(JSON.parse(JSON.stringify(run)).entries, questions).warnings.length, 1);
});

test('policy changes retain scoped references without comparing them to a different policy', () => {
  const original = { allowed: { type: 'noul', instructions: 'Overall moderation' } };
  const changed = { allowed: { type: 'noul', instructions: 'Only spam' } };
  const record = withQuestionLabels({ text: 'x' }, original, { allowed: true });
  assert.deepEqual(questionLabels(record, changed), {});
  assert.deepEqual(referenceLabels(record, changed), { allowed: true });
  const entry = { status: 'success', expectedAnswers: referenceLabels(record, changed), comparisonDisabled: true, response: { ok: true, data: { allowed: true } } };
  assert.match(expectedAnswerWarning(entry, changed), /different question definitions/);
  assert.equal(evaluateDataset([entry], changed).summary.scored, 0);
  assert.equal(evaluateDataset([{ ...entry, comparisonDisabled: false }], original).summary.correct, 1);
});

test('partial matching labels still score; a typed mismatch warns without counting correct or wrong', () => {
  const entry = { status: 'success', expectedAnswers: { 'Spam / allowed': true }, response: { ok: true, data: { 'Spam / allowed': true } } };
  assert.equal(evaluateDataset([entry], questions).summary.correct, 1);
  const mismatch = evaluateDataset([{ ...entry, expectedAnswers: { 'Spam / allowed': 'invalid boolean' } }], questions);
  assert.equal(mismatch.summary.scored, 0);
  assert.equal(mismatch.warnings.length, 1);
});
