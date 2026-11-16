import test from 'node:test';
import assert from 'node:assert/strict';
import { selectTextRange } from '../shared/text-range.js';
import { evaluateSequentially } from '../shared/runs.js';

const items = Array.from({ length: 392 }, (_, index) => ({ text: `Text ${index + 1}`, expectedAnswers: { allowed: index % 2 === 0 } }));

test('blank bounds select all; ranges are inclusive and preserve dataset and labels', () => {
  assert.deepEqual(selectTextRange(items).items, items);
  const first100 = selectTextRange(items, { start: '1', end: '100' });
  assert.equal(first100.items.length, 100);
  assert.equal(first100.items[99].text, 'Text 100');
  assert.deepEqual(selectTextRange(items, { start: '392' }).items, [items[391]]);
  assert.deepEqual(selectTextRange(items, { end: '1' }).items, [items[0]]);
  assert.equal(items.length, 392);
});

test('invalid and stale bounds are rejected rather than silently expanding the run', () => {
  for (const range of [{ start: '0' }, { start: '-1' }, { start: '1.5' }, { end: '393' }, { start: '20', end: '10' }, { end: 'abc' }]) {
    assert.throws(() => selectTextRange(items, range), /Enter a text range/);
  }
  assert.throws(() => selectTextRange([]), /Add/);
});

test('sequential execution sends only selected texts with matching expected labels', async () => {
  const selected = selectTextRange(items, { start: '100', end: '102' }).items;
  const sent = [];
  const entries = await evaluateSequentially({
    signal: new AbortController().signal,
    states: selected.map(({ text }) => ({ text })),
    expectedAnswers: selected.map(item => item.expectedAnswers),
    evaluate: async state => { sent.push(state.text); return { ok: true, data: { allowed: true } }; },
    onUpdate: () => {},
  });
  assert.deepEqual(sent, ['Text 100', 'Text 101', 'Text 102']);
  assert.deepEqual(entries.map(entry => entry.expectedAnswers), selected.map(item => item.expectedAnswers));
});
