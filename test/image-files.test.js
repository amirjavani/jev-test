import test from 'node:test';
import assert from 'node:assert/strict';
import { attachImages, imageLayout, checkImageRequestSize, MAX_IMAGE_REQUEST_BYTES } from '../shared/image-files.js';
import { normalizeRun } from '../shared/runs.js';

test('large and narrow images fit the API bounds without stretching their contents', () => {
  assert.deepEqual(imageLayout(4032, 3024), { width: 1568, height: 1176, drawWidth: 1568, drawHeight: 1176 });
  assert.deepEqual(imageLayout(100, 4000), { width: 280, height: 1568, drawWidth: 39, drawHeight: 1568 });
  assert.deepEqual(imageLayout(20, 50), { width: 280, height: 280, drawWidth: 20, drawHeight: 50 });
  assert.deepEqual(imageLayout(560, 420), { width: 560, height: 420, drawWidth: 560, drawHeight: 420 });
  assert.throws(() => imageLayout(0, 42));
});

test('uploaded images preserve all state types, batch order, and advanced assets', () => {
  const images = [{ id: 'image-unique', asset: { type: 'image', format: 'png', data_base64: 'bytes' } }];
  const states = ['text', { text: 'context', images: ['existing data'] }, ['array context']];
  const advanced = { reference: { type: 'image', format: 'jpeg', data_base64: 'other' } };
  const result = attachImages(states, advanced, images);
  assert.deepEqual(result.states, states.map(context => ({ context, images: ['image-unique'] })));
  assert.deepEqual(result.assets, { ...advanced, 'image-unique': images[0].asset });
  assert.equal(Object.keys(advanced).length, 1);
  assert.deepEqual(attachImages(states, undefined, []), { states });
  assert.throws(() => attachImages(states, result.assets, images), /conflicts/);
});

test('request size accounts for base64 and UTF-8 bytes', () => {
  checkImageRequestSize({ state: 'small' });
  assert.throws(() => checkImageRequestSize({ state: 'x'.repeat(MAX_IMAGE_REQUEST_BYTES) }), /too large/);
});

test('saved image runs retain the image bytes and referenced states', () => {
  const { states, assets } = attachImages(['context'], undefined, [{ id: 'photo-key', asset: { type: 'image', format: 'png', data_base64: 'bytes' } }]);
  const request = { model: 'typesafe/jev-1.14', state: states[0], assets, questions: { circle: { type: 'noul', instructions: 'Is there a circle?' } } };
  const run = normalizeRun({ provider: 'gapgpt', mode: 'single', request, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), entries: [{ state: states[0], status: 'success', response: { ok: true, status: 200, data: { answers: { circle: { noul: 1 } } } } }] });
  assert.deepEqual(run.request, request);
  assert.deepEqual(run.entries[0].state, states[0]);
});
