import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { validateRequest } from '../shared/validation.js';

const request = { model: 'typesafe/jev-1.14', state: { text: 'Please refund the duplicate payment.' }, questions: { refund: { type: 'noul', instructions: { question: 'Is a refund requested?' } }, team: { type: 'choice', instructions: ['Which team?'], criteria: { billing: 'Payments', technical: 'Bugs' } }, urgency: { type: 'score', criteria: ['Routine', 'Urgent', 'Emergency'] } } };
async function serve(t, options) {
  const server = createApp(options).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return `http://127.0.0.1:${server.address().port}`;
}
const post = (url, body) => fetch(`${url}/api/evaluate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('accepts the supplied mixed question shapes and validates typed criteria', () => {
  assert.equal(validateRequest(request), request);
  for (const questions of [{}, { x: { type: 'unknown' } }, { x: { type: 'choice', criteria: [] } }, { x: { type: 'score', criteria: [] } }, { x: { type: 'score', criteria: Array(11).fill('Level') } }, { x: { type: 'noul', criteria: { maybe: 'Maybe' } } }]) assert.throws(() => validateRequest({ ...request, questions }));
  for (const state of [null, 42, true]) assert.throws(() => validateRequest({ ...request, state }));
});
test('config reports availability without exposing keys, missing key blocks upstream calls', async t => {
  const url = await serve(t, { env: { TYPESAFE_API_KEY: 'secret-direct' }, fetchImpl: () => { throw new Error('Must not call'); } });
  const configText = await (await fetch(`${url}/api/config`)).text();
  assert.ok(!configText.includes('secret-direct'));
  const config = JSON.parse(configText);
  assert.equal(config.providers[0].configured, false);
  assert.equal(config.providers[1].configured, true);
  const response = await post(url, { provider: 'gapgpt', request });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /GAPGPT_API_KEY/);
});
test('forwards the exact request to GapGPT with server-only bearer auth', async t => {
  let call;
  const data = { answers: { refund: { type: 'noul', noul: .98 } }, usage: { input_tokens: 120, output_tokens: 12 } };
  const url = await serve(t, { env: { GAPGPT_API_KEY: 'secret-gap' }, fetchImpl: async (endpoint, options) => { call = { endpoint, options }; return new Response(JSON.stringify(data)); } });
  const response = await post(url, { provider: 'gapgpt', request });
  assert.equal(response.status, 200);
  assert.equal(call.endpoint, 'https://api.gapgpt.app/v1/systemone');
  assert.equal(call.options.headers.Authorization, 'Bearer secret-gap');
  assert.deepEqual(JSON.parse(call.options.body), request);
  const body = await response.json();
  assert.deepEqual(body.data, data);
  assert.equal(body.ok, true);
  assert.equal(typeof body.durationMs, 'number');
});
test('direct provider and experimental headers are selected correctly', async t => {
  let call;
  const url = await serve(t, { env: { TYPESAFE_API_KEY: 'direct' }, fetchImpl: async (endpoint, options) => { call = { endpoint, options }; return new Response('{}'); } });
  await post(url, { provider: 'typesafe', longContext: true, request: { ...request, model: 'jev-1.14.0', questions: { region: { type: 'box', instructions: 'Locate the item in photo.' } }, assets: { photo: { type: 'image', format: 'png', data_base64: 'example' } } } });
  assert.equal(call.endpoint, 'https://api.typesafe.ai/v1/systemone');
  assert.equal(call.options.headers['TypeSafe-Danger-Zone-Images'], 'true');
  assert.equal(call.options.headers['TypeSafe-Danger-Zone-Long-Context'], 'true');
});
test('preserves upstream status and body while redacting echoed secrets', async t => {
  const url = await serve(t, { env: { GAPGPT_API_KEY: 'secret-gap' }, fetchImpl: async () => new Response('{"error":"bad key secret-gap"}', { status: 401 }) });
  const response = await post(url, { provider: 'gapgpt', request });
  assert.equal(response.status, 401);
  assert.deepEqual((await response.json()).data, { error: 'bad key [REDACTED]' });
});
test('rejects unsupported providers and invalid requests before network access', async t => {
  const url = await serve(t, { env: {}, fetchImpl: () => { throw new Error('Must not call'); } });
  for (const provider of ['custom', '__proto__', 'constructor']) assert.equal((await post(url, { provider, request })).status, 400);
  assert.equal((await post(url, { provider: 'gapgpt', request: { ...request, questions: {} } })).status, 400);
  const malformed = await fetch(`${url}/api/evaluate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(malformed.status, 400);
});
test('network errors and timeouts have actionable responses', async t => {
  for (const [name, status] of [['TypeError', 502], ['TimeoutError', 504]]) {
    const url = await serve(t, { env: { GAPGPT_API_KEY: 'secret' }, fetchImpl: async () => { const e = new Error('secret'); e.name = name; throw e; } });
    const response = await post(url, { provider: 'gapgpt', request });
    assert.equal(response.status, status);
    assert.ok(!(await response.text()).includes('secret'));
  }
});
