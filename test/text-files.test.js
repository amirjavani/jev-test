import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTextArray, parseTextList } from '../shared/text-files.js';

test('imports common text list JSON shapes without changing text or order', () => {
  const texts = ['First text\nwith a second line', 'لطفاً مبلغ پرداخت تکراری را برگردانید.', '  Keep spaces  '];
  for (const value of [texts, { texts }, texts.map(text => ({ text })), { texts: texts.map(text => ({ text })) }]) {
    assert.deepEqual(parseTextList(JSON.stringify(value)), texts);
  }
  assert.deepEqual(parseTextList('\uFEFF["UTF-8 BOM"]'), ['UTF-8 BOM']);
});

test('rejects malformed, empty, oversized-count, and partially invalid text lists', () => {
  for (const source of ['{', 'null', '"text"', '{}', '[]', '{"texts":[]}', '["valid", 3]', '["valid", " "]', '[{"text":false}]', JSON.stringify(Array(501).fill('text'))]) {
    assert.throws(() => parseTextList(source));
  }
  assert.equal(parseTextList(JSON.stringify(Array(500).fill('text'))).length, 500);
  assert.throws(() => parseTextList('["valid", null]'), /Text 2/);
});

test('array editor preserves text field values and rejects non-string array drafts', () => {
  const texts = ['Line one\nLine two', 'متن آزمایشی', '', '  spaces  ', 'A "quote" and \\ slash'];
  assert.deepEqual(parseTextArray(JSON.stringify(texts, null, 2)), texts);
  assert.deepEqual(parseTextArray('[]'), []);
  for (const source of ['[', '{"texts":["text"]}', '[{"text":"text"}]', '["text",null]', '["text",3]', JSON.stringify(Array(501).fill('text'))]) assert.throws(() => parseTextArray(source));
});
