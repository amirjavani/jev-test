import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeExpectedAnswers, questionLabels, withQuestionLabels } from '../shared/expected-answers.js';
import { datasetValues, parseDatasetArray, parseDatasetList } from '../shared/text-files.js';
import { evaluateSequentially, normalizeRun } from '../shared/runs.js';

const questions = {
  allowed: { type: 'noul' },
  team: { type: 'choice', criteria: { billing: 'Billing', technical: 'Technical', '': 'Empty key' } },
  urgency: { type: 'score', criteria: ['Routine', 'Urgent', 'Emergency'] },
  location: { type: 'box' },
};

test('expected answers belong to the question definition even when policy lists reuse allowed', () => {
  const spam = { allowed: { type: 'noul', instructions: 'Is this free of spam?' } };
  const politics = { allowed: { type: 'noul', instructions: 'Is this free of politics?' } };
  let item = withQuestionLabels({ text: 'A political news story' }, spam, { allowed: true });
  assert.deepEqual(questionLabels(item, politics), {});
  item = withQuestionLabels(item, politics, { allowed: false });
  assert.deepEqual(questionLabels(item, politics), { allowed: false });
  assert.deepEqual(questionLabels(item, spam), { allowed: true });
  assert.deepEqual(questionLabels(item, { ...spam, urgency: questions.urgency }), { allowed: true });
  item = withQuestionLabels(item, politics, {});
  assert.deepEqual(questionLabels(item, politics), {});
  assert.deepEqual(questionLabels(item, spam), { allowed: true });
  assert.deepEqual(questionLabels(withQuestionLabels({}, spam, { missing: true }), spam), { missing: true });
});

test('validates optional typed labels, retaining false, zero, and empty choice names', () => {
  const labels = { allowed: false, team: '', urgency: 0, location: { top: .1, bottom: .8, left: 0, right: 1 } };
  assert.deepEqual(normalizeExpectedAnswers(labels, questions), labels);
  assert.deepEqual(normalizeExpectedAnswers(undefined, questions), {});
  assert.deepEqual(normalizeExpectedAnswers({ allowed: 'human' }, questions), { allowed: 'human' });
  for (const invalid of [null, [], { allowed: 0 }, { team: 'missing' }, { urgency: -1 }, { urgency: 3 }, { unknown: true }, { location: { top: .9, bottom: .1, left: 0, right: 1 } }]) {
    assert.throws(() => normalizeExpectedAnswers(invalid, questions));
  }
});

test('dataset labels stay with their text through export/import, reorder, and array edits', () => {
  const items = [{ text: 'متن اول', expectedAnswers: { allowed: false, urgency: 0 } }, { text: 'Second\ntext', expectedAnswers: { allowed: true } }, { text: 'Unlabeled', expectedAnswers: {} }];
  const exported = JSON.stringify({ version: 1, questions, texts: datasetValues(items) });
  assert.deepEqual(parseDatasetList(exported), items);
  assert.deepEqual(parseDatasetArray(JSON.stringify(datasetValues([items[1], items[0]]))), [items[1], items[0]]);
  assert.deepEqual(parseDatasetArray('["Changed text"]'), [{ text: 'Changed text', expectedAnswers: {} }]);
  for (const source of ['[{"text":"x","expectedAnswers":null}]', '[{"text":"x","expectedAnswers":{"allowed":[]}}]', '["valid",null]']) assert.throws(() => parseDatasetList(source));
});

test('labels are snapshotted separately, preserved for cancelled and skipped rows, and never sent to evaluate', async () => {
  const abort = new AbortController();
  const states = [{ text: 'First' }, { text: 'Second' }, { text: 'Third' }];
  const expectedAnswers = [{ allowed: true }, { allowed: false }, { urgency: 0 }];
  const received = [];
  const entries = await evaluateSequentially({ states, expectedAnswers, signal: abort.signal, onUpdate: () => {}, evaluate: async state => {
    received.push(structuredClone(state));
    if (received.length === 2) { abort.abort(); throw new Error('Cancelled'); }
    expectedAnswers[0].allowed = false;
    return { ok: true, status: 200, data: { allowed: true } };
  } });
  assert.deepEqual(received, states.slice(0, 2));
  assert.deepEqual(entries.map(entry => entry.status), ['success', 'cancelled', 'skipped']);
  assert.deepEqual(entries.map(entry => entry.expectedAnswers), [{ allowed: true }, { allowed: false }, { urgency: 0 }]);
  const request = { model: 'typesafe/jev-1.14', state: states[0], questions };
  const run = normalizeRun({ provider: 'gapgpt', mode: 'batch', request, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), entries });
  assert.deepEqual(JSON.parse(JSON.stringify(run)).entries.map(entry => entry.expectedAnswers), entries.map(entry => entry.expectedAnswers));
  assert.ok(!Object.hasOwn(run.request, 'expectedAnswers'));
});
