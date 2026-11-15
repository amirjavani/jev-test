import { datasetItems } from './text-files.js';
import { normalizeExpectedAnswers } from './expected-answers.js';
import { sameQuestions } from './runs.js';

export function normalizeExamples(items, questions, legacyAnswers = []) {
  if (!Array.isArray(items)) throw new Error('Example texts must be an array.');
  const examples = datasetItems(items.map((item, index) => typeof item === 'string'
    ? { text: item, expectedAnswers: legacyAnswers?.[index] || {} } : item));
  return examples.map(item => {
    if (!item.text.trim()) throw new Error('Example texts must not be empty.');
    return { text: item.text, expectedAnswers: normalizeExpectedAnswers(item.expectedAnswers, questions) };
  });
}

export function examplesForList(list, bundledLists = []) {
  if (!list) return [];
  const matching = bundledLists.find(candidate => candidate.id === list.id && sameQuestions(candidate.questions, list.questions))
    || bundledLists.find(candidate => sameQuestions(candidate.questions, list.questions));
  const bundled = matching ? normalizeExamples(matching.exampleTexts || [], matching.questions, matching.exampleExpectedAnswers) : [];
  if (!Array.isArray(list.exampleTexts)) return bundled;
  const examples = normalizeExamples(list.exampleTexts, list.questions, list.exampleExpectedAnswers);
  // Old servers expose strings without labels; match by text, never by array position.
  return examples.map((item, index) => typeof list.exampleTexts[index] === 'string' && !Object.keys(item.expectedAnswers).length
    ? { ...item, expectedAnswers: bundled.find(reference => reference.text === item.text)?.expectedAnswers || {} } : item);
}
