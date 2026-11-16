import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeExpectedAnswers } from '../shared/expected-answers.js';
import { normalizeList } from '../shared/question-lists.js';
import { combineQuestionLists, examplesForSelectedLists } from '../shared/selected-question-lists.js';

const first = { id: 'first', name: 'First', scope: 'common', questions: { refund: { type: 'noul', instructions: 'Refund requested?' } }, exampleTexts: [{ text: 'Refund please', expectedAnswers: { refund: true } }] };
const second = { id: 'second', name: 'Second', scope: 'local', questions: { urgent: { type: 'noul', instructions: 'Urgent?' } }, exampleTexts: [{ text: 'Hurry', expectedAnswers: { urgent: true } }] };

test('empty and single selections retain the existing list identity', () => {
  assert.equal(combineQuestionLists([]), null);
  assert.equal(combineQuestionLists([first]), first);
});

test('multiple selections combine questions without reusing a saved list id or mutating sources', () => {
  const snapshot = structuredClone([first, second]);
  const combined = combineQuestionLists([first, second]);
  assert.deepEqual(combined.questions, { ...first.questions, ...second.questions });
  assert.equal(combined.id, undefined);
  assert.equal(combined.scope, undefined);
  assert.deepEqual([first, second], snapshot);
  assert.deepEqual(combineQuestionLists([second]).questions, second.questions);
});

test('identical shared questions are deduplicated, including reordered object fields', () => {
  const duplicate = { name: 'Duplicate', questions: { refund: { instructions: 'Refund requested?', type: 'noul' } } };
  assert.deepEqual(combineQuestionLists([first, duplicate]).questions, first.questions);
});

test('conflicting definitions retain both questions with source names and correctly mapped labels', () => {
  const conflict = { name: 'Conflict', questions: { refund: { type: 'noul', instructions: 'Different?' } }, exampleTexts: [{ text: 'Other policy', expectedAnswers: { refund: false } }] };
  const combined = combineQuestionLists([first, conflict]);
  assert.deepEqual(combined.questions, { 'First / refund': first.questions.refund, 'Conflict / refund': conflict.questions.refund });
  const examples = examplesForSelectedLists([first, conflict]);
  assert.deepEqual(examples.map(item => item.expectedAnswers), [{ 'First / refund': true }, { 'Conflict / refund': false }]);
  for (const item of examples) normalizeExpectedAnswers(item.expectedAnswers, combined.questions);
  assert.deepEqual(normalizeList(combined), combined);
});

test('generated names avoid existing names and repeated list names without dropping definitions', () => {
  const conflict = { name: 'First', questions: { refund: { type: 'noul', instructions: 'Different?' }, 'First / refund': { type: 'noul' } } };
  const combined = combineQuestionLists([first, conflict, { ...first, id: 'copy' }]);
  assert.deepEqual(Object.keys(combined.questions), ['First / refund (2)', 'First / refund (3)', 'First / refund']);
  assert.equal(combined.questions['First / refund (2)'].instructions, 'Refund requested?');
  assert.equal(combined.questions['First / refund (3)'].instructions, 'Different?');
  assert.deepEqual(combineQuestionLists([first]).questions, first.questions);
});

test('combined examples retain each source label and bundled fallback', () => {
  const withoutExamples = { ...first, exampleTexts: undefined };
  assert.deepEqual(examplesForSelectedLists([withoutExamples, second], [first]), [...first.exampleTexts, ...second.exampleTexts]);
  assert.deepEqual(examplesForSelectedLists([]), []);
});

test('all bundled policy lists can be selected together and keep valid example labels', async () => {
  const { readdir } = await import('node:fs/promises');
  const directory = new URL('../common/question-lists/', import.meta.url);
  const lists = await Promise.all((await readdir(directory)).filter(name => name.endsWith('.json')).map(async name => ({ ...JSON.parse(await readFile(new URL(name, directory), 'utf8')), id: name })));
  const combined = combineQuestionLists(lists);
  assert.ok(Object.keys(combined.questions).length > 1);
  for (const example of examplesForSelectedLists(lists)) normalizeExpectedAnswers(example.expectedAnswers, combined.questions);
  for (const list of lists) for (const definition of Object.values(list.questions)) {
    assert.ok(Object.values(combined.questions).some(question => JSON.stringify(question) === JSON.stringify(definition)));
  }
});
