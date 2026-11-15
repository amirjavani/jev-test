import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { defaultExamples, defaultQuestions, imageExampleQuestions, imageExampleLabels } from '../shared/examples.js';
import { normalizeExpectedAnswers } from '../shared/expected-answers.js';
import { parseDatasetList } from '../shared/text-files.js';

test('all bundled text and common policy examples have a valid reference answer for every question', async () => {
  const folder = new URL('../common/question-lists/', import.meta.url);
  for (const file of await readdir(folder)) {
    if (!file.endsWith('.json')) continue;
    const list = JSON.parse(await readFile(new URL(file, folder), 'utf8'));
    assert.ok(list.exampleTexts.every(item => typeof item === 'object' && typeof item.text === 'string' && item.expectedAnswers), file);
    for (const { expectedAnswers: answers } of list.exampleTexts) {
      assert.deepEqual(Object.keys(answers).sort(), Object.keys(list.questions).sort(), file);
      assert.deepEqual(normalizeExpectedAnswers(answers, list.questions), answers);
    }
    if (file.startsWith('b5d81d1a')) {
      assert.equal(list.exampleTexts.length, 40);
      assert.deepEqual(list.exampleTexts[10].expectedAnswers, { advertising_spam_allowed: true, iran_politics_allowed: false, profanity_allowed: true, respect_allowed: true });
      assert.deepEqual(list.exampleTexts[14].expectedAnswers, { advertising_spam_allowed: true, iran_politics_allowed: true, profanity_allowed: false, respect_allowed: true });
      assert.deepEqual(parseDatasetList(await readFile(new URL('../examples/combined-moderation-texts.json', import.meta.url), 'utf8')), list.exampleTexts);
    }
    if (file.startsWith('89a42172')) {
      const imported = parseDatasetList(await readFile(new URL('../examples/advertisement-spam-texts.json', import.meta.url), 'utf8'));
      assert.deepEqual(imported, list.exampleTexts);
    }
  }
  const imported = parseDatasetList(await readFile(new URL('../examples/texts.json', import.meta.url), 'utf8'));
  assert.deepEqual(imported, defaultExamples);
  for (const { expectedAnswers } of defaultExamples) assert.deepEqual(normalizeExpectedAnswers(expectedAnswers, defaultQuestions), expectedAnswers);
});

test('bundled image example labels distinguish the red circle and blue square', () => {
  assert.deepEqual(imageExampleLabels['red-circle'], { has_circle: true, object_color: 'red' });
  assert.deepEqual(imageExampleLabels['blue-square'], { has_circle: false, object_color: 'blue' });
  for (const labels of Object.values(imageExampleLabels)) assert.deepEqual(normalizeExpectedAnswers(labels, imageExampleQuestions), labels);
});
