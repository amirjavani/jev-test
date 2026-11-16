import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { defaultExamples, defaultQuestions, imageExampleQuestions, imageExampleLabels } from '../shared/examples.js';
import { normalizeExpectedAnswers } from '../shared/expected-answers.js';
import { parseDatasetList } from '../shared/text-files.js';

test('all bundled text and common policy examples retain valid optional reference answers', async () => {
  const folder = new URL('../common/question-lists/', import.meta.url);
  for (const file of await readdir(folder)) {
    if (!file.endsWith('.json')) continue;
    const list = JSON.parse(await readFile(new URL(file, folder), 'utf8'));
    assert.ok(list.exampleTexts.every(item => typeof item === 'object' && typeof item.text === 'string' && item.expectedAnswers), file);
    for (const { expectedAnswers: answers } of list.exampleTexts) {
      assert.deepEqual(normalizeExpectedAnswers(answers, list.questions), answers);
    }
    const dataset = file.startsWith('89a42172') ? 'advertisement-spam-texts' : file.startsWith('e2b74593') ? 'sexual-content-texts' : null;
    if (dataset) {
      const imported = parseDatasetList(await readFile(new URL(`../examples/${dataset}.json`, import.meta.url), 'utf8'));
      assert.deepEqual(imported.map(item => item.text), list.exampleTexts.map(item => item.text));
      for (const [index, item] of list.exampleTexts.entries()) {
        for (const [name, answer] of Object.entries(item.expectedAnswers)) assert.equal(imported[index].expectedAnswers[name], answer);
      }
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
