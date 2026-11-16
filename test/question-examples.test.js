import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { examplesForList, normalizeExamples } from '../shared/question-examples.js';

const id = 'e2b74593-c7d2-4cb1-a4c6-847752d5a230';
const bundled = { ...JSON.parse(await readFile(new URL(`../common/question-lists/${id}.json`, import.meta.url), 'utf8')), id };

test('bundled examples remain available when a running API omits them, regardless of list scope', () => {
  for (const scope of ['common', 'local', undefined]) {
    const list = { id, name: bundled.name, questions: bundled.questions, scope };
    assert.deepEqual(examplesForList(list, [bundled]), bundled.exampleTexts);
  }
  const localCopy = { id: 'local-copy', questions: bundled.questions, scope: 'local' };
  assert.deepEqual(examplesForList(localCopy, [bundled]), bundled.exampleTexts);
  assert.deepEqual(examplesForList({ ...localCopy, questions: { custom: { type: 'noul' } } }, [bundled]), []);
  assert.deepEqual(examplesForList(null, [bundled]), []);
});

test('legacy string examples gain matching labels by text without relabeling edited canonical examples', () => {
  const examples = [bundled.exampleTexts[12], bundled.exampleTexts[0]];
  const legacy = { id, questions: bundled.questions, exampleTexts: examples.map(item => item.text) };
  assert.deepEqual(examplesForList(legacy, [bundled]), examples);
  const edited = { ...legacy, exampleTexts: [{ text: examples[0].text, expectedAnswers: {} }] };
  assert.deepEqual(examplesForList(edited, [bundled]), edited.exampleTexts);
  assert.deepEqual(normalizeExamples(['Test'], { allowed: { type: 'noul' } }, [{ allowed: false }]), [{ text: 'Test', expectedAnswers: { allowed: false } }]);
  assert.throws(() => normalizeExamples(null, bundled.questions), /array/);
  assert.throws(() => normalizeExamples([{ text: 'Test', expectedAnswers: { other: true } }], bundled.questions));
});
