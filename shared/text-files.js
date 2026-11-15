import { normalizeExpectedAnswers } from './expected-answers.js';

export const MAX_TEXT_FILE_BYTES = 5 * 1024 * 1024;

export function datasetItems(items) {
  if (!Array.isArray(items) || items.length > 500) throw new Error('Use an array of no more than 500 texts.');
  return items.map((item, index) => {
    const text = typeof item === 'string' ? item : item?.text;
    if (typeof text !== 'string') throw new Error(`Text ${index + 1} must be a string or an object with a text string.`);
    return { text, expectedAnswers: normalizeExpectedAnswers(typeof item === 'string' ? {} : item.expectedAnswers) };
  });
}

export function parseDatasetArray(source) {
  let value;
  try { value = JSON.parse(source); }
  catch { throw new Error('Enter a valid JSON array of texts or labeled text objects.'); }
  return datasetItems(value);
}

export function parseDatasetList(source) {
  let value;
  try { value = JSON.parse(source.replace(/^\uFEFF/, '')); }
  catch { throw new Error('This file is not valid JSON. Your text list has not changed.'); }
  const items = datasetItems(Array.isArray(value) ? value : value?.texts);
  if (!items.length || items.some(item => !item.text.trim())) throw new Error('Import 1–500 nonempty texts. Your text list has not changed.');
  return items;
}

export const datasetValues = items => items.map(item => ({ text: item.text, expectedAnswers: item.expectedAnswers || {} }));

export function parseTextArray(source) {
  let value;
  try { value = JSON.parse(source); }
  catch { throw new Error('Enter a valid JSON array, for example ["Text one", "Text two"].'); }
  if (!Array.isArray(value) || value.some(text => typeof text !== 'string')) throw new Error('Array view requires an array of text strings.');
  if (value.length > 500) throw new Error('Use no more than 500 texts.');
  return value;
}

export function parseTextList(source) {
  let value;
  try { value = JSON.parse(source.replace(/^\uFEFF/, '')); }
  catch { throw new Error('This file is not valid JSON. Your text list has not changed.'); }
  const items = Array.isArray(value) ? value : value?.texts;
  if (!Array.isArray(items) || !items.length || items.length > 500) throw new Error('Import an array of 1–500 texts, or an object with a texts array.');
  return items.map((item, index) => {
    const text = typeof item === 'string' ? item : item?.text;
    if (typeof text !== 'string' || !text.trim()) throw new Error(`Text ${index + 1} must be a nonempty string or an object with a text string. Your text list has not changed.`);
    return text;
  });
}
