import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { examplesForList, normalizeExamples } from '../shared/question-examples.js';

const id = 'b5d81d1a-398e-4e8c-a041-62c3e7cb9075';
const combined = { ...JSON.parse(await readFile(new URL(`../common/question-lists/${id}.json`, import.meta.url), 'utf8')), id };

test('bundled examples remain available when a running API omits them, regardless of list scope', () => {
  for (const scope of ['common', 'local', undefined]) {
    const list = { id, name: combined.name, questions: combined.questions, scope };
    assert.deepEqual(examplesForList(list, [combined]), combined.exampleTexts);
  }
  const localCopy = { id: 'local-copy', questions: combined.questions, scope: 'local' };
  assert.deepEqual(examplesForList(localCopy, [combined]), combined.exampleTexts);
  assert.deepEqual(examplesForList({ ...localCopy, questions: { custom: { type: 'noul' } } }, [combined]), []);
  assert.deepEqual(examplesForList(null, [combined]), []);
});

test('legacy string examples gain matching labels by text without relabeling edited canonical examples', () => {
  const examples = [combined.exampleTexts[12], combined.exampleTexts[0]];
  const legacy = { id, questions: combined.questions, exampleTexts: examples.map(item => item.text) };
  assert.deepEqual(examplesForList(legacy, [combined]), examples);
  const edited = { ...legacy, exampleTexts: [{ text: examples[0].text, expectedAnswers: {} }] };
  assert.deepEqual(examplesForList(edited, [combined]), edited.exampleTexts);
  assert.deepEqual(normalizeExamples(['Test'], { allowed: { type: 'noul' } }, [{ allowed: false }]), [{ text: 'Test', expectedAnswers: { allowed: false } }]);
  assert.throws(() => normalizeExamples(null, combined.questions), /array/);
  assert.throws(() => normalizeExamples([{ text: 'Test', expectedAnswers: { other: true } }], combined.questions));
});
