import test from 'node:test';
import assert from 'node:assert/strict';
import { compareEntry, evaluateDataset, boxOverlap } from '../shared/evaluation.js';
import { normalizeRun } from '../shared/runs.js';

const questions = {
  allowed: { type: 'noul' },
  team: { type: 'choice', criteria: { billing: 'Billing', technical: 'Technical', '': 'Empty option' } },
  urgency: { type: 'score', criteria: ['Low', 'Medium', 'High'] },
  location: { type: 'box' },
};
const success = (expectedAnswers, data) => ({ expectedAnswers, status: 'success', response: { ok: true, data } });

test('compares boolean moderation and typed probabilities using the existing inclusive 0.5 threshold', () => {
  for (const [actual, expected, status] of [[true, true, 'correct'], [false, false, 'correct'], [false, true, 'wrong']]) {
    assert.equal(compareEntry(success({ allowed: expected }, { allowed: actual }), questions).allowed.status, status);
  }
  for (const [noul, expected, status] of [[0, false, 'correct'], [0.49999, false, 'correct'], [.5, true, 'correct'], [1, false, 'wrong']]) {
    const result = compareEntry(success({ allowed: expected }, { answers: { allowed: { type: 'noul', noul } } }), questions).allowed;
    assert.equal(result.status, status);
    assert.equal(result.probability, noul);
  }
});

test('choices match exact options and scores compare the nearest level, retaining zero and fractional labels', () => {
  const entry = success({ team: '', urgency: 0 }, { answers: { team: { type: 'choice', choice: '' }, urgency: { type: 'score', score: .49 } } });
  let results = compareEntry(entry, questions);
  assert.equal(results.team.status, 'correct');
  assert.equal(results.urgency.status, 'correct');
  assert.equal(results.urgency.predicted, 0);
  entry.response.data.answers.urgency.score = .5;
  assert.equal(compareEntry(entry, questions).urgency.status, 'wrong');
  entry.expectedAnswers.urgency = 1.7;
  entry.response.data.answers.urgency.score = 1.7;
  results = compareEntry(entry, questions);
  assert.equal(results.urgency.status, 'correct');
  assert.equal(results.urgency.predicted, 1.7);
  entry.response.data.answers.urgency.score = 1.8;
  assert.equal(compareEntry(entry, questions).urgency.status, 'wrong');
  assert.equal(compareEntry(success({ team: 'billing' }, { answers: { team: { choice: 'technical' } } }), questions).team.status, 'wrong');
});

test('box comparisons use IoU with an inclusive 50 percent threshold and handle degenerate boxes', () => {
  const expected = { top: 0, bottom: 1, left: 0, right: 1 };
  const compare = box => compareEntry(success({ location: expected }, { answers: { location: { type: 'box', box } } }), questions).location;
  assert.equal(compare(expected).status, 'correct');
  const half = { ...expected, right: .5 };
  assert.equal(compare(half).iou, .5);
  assert.equal(compare(half).status, 'correct');
  assert.equal(compare({ ...expected, right: .49 }).status, 'wrong');
  const point = { top: 0, bottom: 0, left: 0, right: 0 };
  assert.equal(boxOverlap(point, point), 1);
  assert.equal(boxOverlap(point, { ...point, left: 1, right: 1 }), 0);
});

test('missing, invalid, failed, and unfinished predictions are not silently treated as wrong or false', () => {
  for (const data of [{}, { allowed: 0 }, { allowed: null }, { answers: { allowed: { noul: -1 } } }, { answers: { allowed: { noul: NaN } } }, { answers: { allowed: { type: 'choice', noul: .9 } } }]) {
    const result = compareEntry(success({ allowed: false }, data), questions).allowed;
    assert.equal(result.status, 'unavailable');
    assert.equal(result.predicted, null);
  }
  for (const entry of [{ status: 'error' }, { status: 'skipped' }, { status: 'cancelled' }, { status: 'success', response: { ok: false } }]) {
    assert.equal(compareEntry({ ...entry, expectedAnswers: { allowed: false } }, questions).allowed.status, 'unavailable');
  }
  for (const status of ['pending', 'running']) assert.equal(compareEntry({ status, expectedAnswers: { allowed: true } }, questions).allowed.status, 'pending');
  assert.equal(compareEntry(success({}, { allowed: false }), questions).allowed.status, 'unlabeled');
  assert.equal(compareEntry(success({ allowed: 'false' }, { allowed: false }), questions).allowed.status, 'unavailable');
  assert.equal(compareEntry(success({ team: 'billing' }, { team: 'Billing' }), questions).team.status, 'unavailable');
  assert.equal(compareEntry(success({ urgency: 0 }, { urgency: -1 }), questions).urgency.status, 'unavailable');
  assert.equal(compareEntry(success({ location: { top: 0, bottom: 1, left: 0, right: 1 } }, { location: { top: 1, bottom: 0, left: 0, right: 1 } }), questions).location.status, 'unavailable');
});

test('dataset and per-question accuracy use scored labels with explicit coverage and input exact-match counts', () => {
  const q = { allowed: questions.allowed, team: questions.team };
  const labels = { allowed: true, team: 'billing' };
  const entries = [
    success(labels, { allowed: true, team: 'technical' }),
    success({ allowed: false }, { allowed: false, team: 'technical' }),
    success(labels, { allowed: false }),
    { status: 'error', expectedAnswers: labels },
    { status: 'pending', expectedAnswers: { allowed: true } },
    { status: 'skipped', expectedAnswers: labels },
    success({}, { allowed: true, team: 'billing' }),
  ];
  const report = evaluateDataset(entries, q);
  assert.deepEqual(report.summary, { correct: 2, wrong: 2, pending: 1, unavailable: 5, unlabeled: 4, review: 0, scored: 4, labeled: 10, accuracy: .5 });
  assert.equal(report.perQuestion.allowed.accuracy, 2 / 3);
  assert.equal(report.perQuestion.team.accuracy, 0);
  assert.equal(report.perQuestion.team.scored, 1);
  assert.equal(report.inputs.accuracy, .5);
  assert.equal(report.inputs.scored, 2);
  assert.equal(evaluateDataset([], q).summary.accuracy, null);
  assert.equal(evaluateDataset([success({}, { allowed: false })], q).summary.accuracy, null);
});

test('moderation keeps real probabilities and human review stays manual at every probability', () => {
  const q = { allowed: questions.allowed };
  for (const probability of [0, .49, .5, 1]) {
    const entry = success({ allowed: 'human' }, { allowed: probability >= .5 });
    entry.response.noulProbabilities = { allowed: probability };
    const result = compareEntry(entry, q).allowed;
    assert.equal(result.status, 'review');
    assert.equal(result.probability, probability);
    assert.equal(result.predicted, probability >= .5);
    const report = evaluateDataset([entry], q);
    assert.equal(report.summary.review, 1);
    assert.equal(report.summary.scored, 0);
    assert.equal(report.summary.accuracy, null);
    assert.equal(report.inputs.review, 1);
    entry.expectedAnswers.allowed = true;
    assert.equal(compareEntry(entry, q).allowed.status, probability >= .5 ? 'correct' : 'wrong');
  }
  assert.equal(compareEntry(success({ allowed: false }, { allowed: false }), q).allowed.probability, undefined);
});

test('human labels and moderation probabilities survive save/reload without becoming model input', () => {
  const request = { model: 'typesafe/jev-1.14', state: 'Text', questions: { allowed: questions.allowed } };
  const entry = { state: 'Text', ...success({ allowed: 'human' }, { allowed: true }) };
  entry.response.noulProbabilities = { allowed: .51 };
  const run = normalizeRun({ provider: 'gapgpt', mode: 'single', request, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), entries: [entry] });
  assert.deepEqual(run.entries[0].response.noulProbabilities, { allowed: .51 });
  assert.equal(run.evaluation.entries[0].comparisons.allowed.probability, .51);
  assert.equal(run.evaluation.entries[0].comparisons.allowed.status, 'review');
  assert.deepEqual(evaluateDataset(run.entries, run.request.questions), JSON.parse(JSON.stringify(run.evaluation)));
  assert.ok(!Object.hasOwn(run.request, 'noulProbabilities'));
});

test('saved/exported evaluation is recomputed from the run snapshot, ignoring supplied metrics', () => {
  const request = { model: 'typesafe/jev-1.14', state: 'Text', questions: { allowed: questions.allowed } };
  const run = normalizeRun({ provider: 'gapgpt', mode: 'single', request, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(),
    evaluation: { summary: { accuracy: 1 } }, entries: [{ index: 0, state: 'Text', ...success({ allowed: true }, { allowed: false }) }] });
  assert.equal(run.evaluation.summary.accuracy, 0);
  assert.equal(run.evaluation.entries[0].comparisons.allowed.status, 'wrong');
  const reopened = JSON.parse(JSON.stringify(run));
  assert.deepEqual(evaluateDataset(reopened.entries, reopened.request.questions), run.evaluation);
  assert.ok(!Object.hasOwn(run.request, 'evaluation'));
});
