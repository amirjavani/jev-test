import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { validateRequest } from '../shared/validation.js';
import { mkdtemp, readdir, readFile, writeFile, mkdir, unlink, rmdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { normalizeList, editorsFromQuestions, questionsFromEditors } from '../shared/question-lists.js';
import { evaluateSequentially, normalizeRun } from '../shared/runs.js';

const request = { model: 'typesafe/jev-1.14', state: { text: 'Please refund the duplicate payment.' }, questions: { refund: { type: 'noul', instructions: { question: 'Is a refund requested?' } }, team: { type: 'choice', instructions: ['Which team?'], criteria: { billing: 'Payments', technical: 'Bugs' } }, urgency: { type: 'score', criteria: ['Routine', 'Urgent', 'Emergency'] } } };
async function serve(t, options) {
  const server = createApp({ commonDir: null, ...options }).listen(0, '127.0.0.1');
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
  assert.deepEqual(body.usage, { input_tokens: 120, output_tokens: 12, total_tokens: 132 });
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

test('GapGPT receives uploaded images, references, and the experimental images header', async t => {
  let forwarded;
  const url = await serve(t, { env: { GAPGPT_API_KEY: 'secret-gap' }, fetchImpl: async (endpoint, options) => {
    forwarded = { endpoint, headers: options.headers, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ answers: { circle: { type: 'noul', noul: 0.99 } } }));
  } });
  const imageRequest = { model: request.model, state: { context: 'Look at the pictures.', images: ['uuid-photo'] }, questions: { circle: { type: 'noul', instructions: 'Is there a circle in `images`?' } }, assets: { 'uuid-photo': { type: 'image', format: 'png', data_base64: 'image-bytes' } } };
  const response = await post(url, { provider: 'gapgpt', request: imageRequest });
  assert.equal(response.status, 200);
  assert.equal(forwarded.endpoint, 'https://api.gapgpt.app/v1/systemone');
  assert.equal(forwarded.headers['TypeSafe-Danger-Zone-Images'], 'true');
  assert.deepEqual(forwarded.body, imageRequest);
  assert.equal((await response.json()).data.answers.circle.noul, 0.99);
});
test('allowed-only moderation returns a boolean and omits diagnostic fields', async t => {
  const definition = JSON.parse(await readFile(new URL('../common/question-lists/89a42172-28b6-48dc-b63a-545e45fce988.json', import.meta.url), 'utf8'));
  let probability;
  let forwarded;
  const url = await serve(t, { env: { GAPGPT_API_KEY: 'secret-gap' }, fetchImpl: async (_endpoint, options) => {
    forwarded = JSON.parse(options.body);
    return new Response(JSON.stringify({ answers: { allowed: { type: 'noul', noul: probability }, reason: 'diagnostic', phone: 'example', email: 'example' }, usage: { output_tokens: 10 } }));
  } });
  const moderationRequest = { ...request, state: { text: 'لطفاً پاسخ را به ایمیلم بفرستید: reader@example.com' }, questions: definition.questions };
  for (const [value, allowed] of [[0, false], [0.49, false], [0.5, true], [0.99, true], [1, true]]) {
    probability = value;
    const response = await post(url, { provider: 'gapgpt', request: moderationRequest });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data, { allowed });
    assert.deepEqual(body.noulProbabilities, { allowed: value });
    assert.deepEqual(body.usage, { input_tokens: null, output_tokens: 10, total_tokens: null });
    assert.deepEqual(forwarded, moderationRequest);
  }
  for (const value of [undefined, null, '0.9', -0.1, 1.1]) {
    probability = value;
    const response = await post(url, { provider: 'gapgpt', request: moderationRequest });
    assert.equal(response.status, 502);
    const body = await response.json();
    assert.match(body.error, /valid allowed probability/);
    assert.equal(body.usage.output_tokens, 10);
    assert.ok(!Object.hasOwn(body, 'allowed'));
  }
});

test('combined moderation returns four independent booleans without an overall decision', async t => {
  const definition = JSON.parse(await readFile(new URL('../common/question-lists/b5d81d1a-398e-4e8c-a041-62c3e7cb9075.json', import.meta.url), 'utf8'));
  const probabilities = { advertising_spam_allowed: 0.9, iran_politics_allowed: 0.1, profanity_allowed: 0.7, respect_allowed: 0.2 };
  assert.deepEqual(Object.keys(definition.questions), Object.keys(probabilities));
  const data = { answers: Object.fromEntries(Object.entries(probabilities).map(([name, noul]) => [name, { type: 'noul', noul }])), reason: 'not needed', phone: 'not needed' };
  let forwarded;
  const url = await serve(t, { env: { GAPGPT_API_KEY: 'secret-gap' }, fetchImpl: async (_endpoint, options) => {
    forwarded = JSON.parse(options.body);
    return new Response(JSON.stringify(data));
  } });
  const moderationRequest = { ...request, questions: definition.questions };
  const response = await post(url, { provider: 'gapgpt', request: moderationRequest });
  assert.equal(response.status, 200);
  const combined = await response.json();
  assert.deepEqual(combined.data, { advertising_spam_allowed: true, iran_politics_allowed: false, profanity_allowed: true, respect_allowed: false });
  assert.deepEqual(combined.noulProbabilities, probabilities);
  assert.deepEqual(forwarded, moderationRequest);
  for (const name of Object.keys(probabilities)) {
    const answer = data.answers[name];
    delete data.answers[name];
    const invalid = await post(url, { provider: 'gapgpt', request: moderationRequest });
    assert.equal(invalid.status, 502);
    const body = await invalid.json();
    assert.ok(body.error.includes(name));
    assert.ok(!Object.hasOwn(body, 'data'), 'missing answers must not return partial decisions');
    data.answers[name] = answer;
  }
  const mixed = await post(url, { provider: 'gapgpt', request: { ...moderationRequest, questions: { ...definition.questions, refund: request.questions.refund } } });
  assert.equal(mixed.status, 200);
  assert.deepEqual((await mixed.json()).data, data, 'mixed question configurations must retain the full upstream response');
});

test('allowed-only moderation preserves upstream errors', async t => {
  const data = { error: 'Rate limited' };
  const url = await serve(t, { env: { GAPGPT_API_KEY: 'secret-gap' }, fetchImpl: async () => new Response(JSON.stringify(data), { status: 429 }) });
  const response = await post(url, { provider: 'gapgpt', request: { ...request, questions: { allowed: { type: 'noul', instructions: 'Is this message allowed?' } } } });
  assert.equal(response.status, 429);
  assert.deepEqual((await response.json()).data, data);
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

test('question JSON round-trips structured instructions and criteria without state or credentials', () => {
  const questions = { ...request.questions, box: { type: 'box', instructions: 'Locate photo' }, nullable: { type: 'noul', instructions: null, criteria: { true: ['yes'], false: { description: 'no' } } } };
  const list = normalizeList({ name: 'Mixed questions', questions, state: 'private state', apiKey: 'private-key' });
  assert.deepEqual(questionsFromEditors(editorsFromQuestions(list.questions)), questions);
  assert.deepEqual(normalizeList(JSON.parse(JSON.stringify(list))), list);
  assert.deepEqual(normalizeList(questions).questions, questions);
  const reservedNames = { questions: { type: 'noul' }, version: { type: 'noul' }, name: { type: 'noul' } };
  assert.deepEqual(normalizeList(reservedNames).questions, reservedNames);
  assert.ok(!JSON.stringify(list).includes('private'));
  assert.throws(() => normalizeList({ version: 99, questions }));
  assert.throws(() => normalizeList({ questions: {} }));
  assert.throws(() => questionsFromEditors([{ id: 'same', type: 'noul', instructions: '', format: 'text', criteria: '' }, { id: 'same', type: 'noul', instructions: '', format: 'text', criteria: '' }]));
});

test('saved lists persist across app instances, update, and reject invalid writes', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'jev-question-lists-'));
  t.after(async () => { for (const file of await readdir(directory)) await unlink(path.join(directory, file)); await rmdir(directory); });
  const url = await serve(t, { env: {}, storageDir: directory });
  const save = body => fetch(`${url}/api/question-lists`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.deepEqual((await (await fetch(`${url}/api/question-lists`)).json()).lists, []);
  const response = await save({ name: 'Refund / team', questions: request.questions, apiKey: 'never-save-this', state: 'never-save-this' });
  assert.equal(response.status, 200);
  const saved = await response.json();
  const disk = await readFile(path.join(directory, `${saved.id}.json`), 'utf8');
  assert.ok(!disk.includes('never-save-this'));
  assert.deepEqual(JSON.parse(disk).questions, request.questions);
  const otherUrl = await serve(t, { env: {}, storageDir: directory });
  assert.deepEqual((await (await fetch(`${otherUrl}/api/question-lists`)).json()).lists[0].questions, request.questions);
  assert.equal((await save({ ...saved, name: 'Updated list' })).status, 200);
  assert.equal(JSON.parse(await readFile(path.join(directory, `${saved.id}.json`), 'utf8')).name, 'Updated list');
  assert.equal((await save({ ...saved, id: '../../escape' })).status, 400);
  assert.equal((await save({ ...saved, questions: {} })).status, 400);
  assert.equal((await readdir(directory)).length, 1);
});

test('batch evaluates texts strictly one at a time and retains per-text failures', async () => {
  const events = [];
  let active = 0;
  const entries = await evaluateSequentially({
    states: ['first', 'second', 'third'], signal: new AbortController().signal,
    onUpdate: entries => events.push(entries.map(entry => entry.status)),
    evaluate: async state => {
      active++; assert.equal(active, 1, 'requests must never overlap');
      await Promise.resolve(); active--;
      if (state === 'second') throw new Error('Network failed');
      return { ok: true, status: 200, data: { answers: { check: { type: 'noul', noul: 0.9 } }, input: state } };
    },
  });
  assert.deepEqual(entries.map(entry => entry.status), ['success', 'error', 'success']);
  assert.equal(entries[1].error, 'Network failed');
  assert.equal(entries[2].response.data.input, 'third');
  assert.ok(events.every(statuses => statuses.filter(status => status === 'running').length <= 1));
  assert.ok(events.some(statuses => statuses.join() === 'success,running,pending'));
});

test('batch cancellation keeps completed outputs and never starts queued texts', async () => {
  const controller = new AbortController();
  const called = [];
  const entries = await evaluateSequentially({ states: ['first', 'second', 'third'], signal: controller.signal, onUpdate: () => {}, evaluate: async state => {
    called.push(state);
    if (state === 'second') { controller.abort(); throw new Error('Aborted'); }
    return { ok: true, status: 200, data: {} };
  } });
  assert.deepEqual(called, ['first', 'second']);
  assert.deepEqual(entries.map(entry => entry.status), ['success', 'cancelled', 'skipped']);
});

test('output history persists per question list with exact input and question snapshots', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'jev-output-history-'));
  t.after(async () => {
    assert.equal(path.dirname(directory), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith('jev-output-history-'));
    await rm(directory, { recursive: true, force: true });
  });
  const url = await serve(t, { env: {}, storageDir: directory });
  const jsonPost = (route, body) => fetch(`${url}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const list = await (await jsonPost('/api/question-lists', { name: 'Billing', questions: request.questions })).json();
  const route = `/api/question-lists/${list.id}/runs`;
  const run = { provider: 'gapgpt', mode: 'batch', request, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), entries: [
    { state: { text: 'First text' }, expectedAnswers: { refund: true }, status: 'success', response: { ok: true, status: 200, durationMs: 12, data: { answers: { refund: { type: 'noul', noul: .9 } } } } },
    { state: { text: 'Second text' }, expectedAnswers: { refund: false }, status: 'error', response: { ok: false, status: 429, durationMs: 5, data: { error: 'Rate limited' } } },
    { state: { text: 'Third text' }, status: 'skipped' },
  ], apiKey: 'do-not-store' };
  const response = await jsonPost(route, run);
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal(saved.questionList.id, list.id);
  assert.deepEqual(saved.entries.map(entry => entry.state), run.entries.map(entry => entry.state));
  assert.deepEqual(saved.entries.map(entry => entry.expectedAnswers), run.entries.map(entry => entry.expectedAnswers));
  assert.deepEqual(saved.questionList.questions, request.questions);
  assert.ok(!JSON.stringify(saved).includes('do-not-store'));
  const otherUrl = await serve(t, { env: {}, storageDir: directory });
  const history = await (await fetch(`${otherUrl}${route}`)).json();
  assert.equal(history.runs[0].id, saved.id);
  assert.equal(history.runs[0].count, 3);
  assert.equal(history.runs[0].succeeded, 1);
  assert.deepEqual(await (await fetch(`${otherUrl}${route}/${saved.id}`)).json(), saved);
  assert.equal((await jsonPost(route, { ...run, entries: run.entries.map(entry => ({ ...entry, expectedAnswers: {} })), request: { ...request, questions: { different: { type: 'noul' } } } })).status, 409);
  assert.equal((await jsonPost(route, { ...run, entries: [{ ...run.entries[0], expectedAnswers: { missing_question: true } }] })).status, 400);
  assert.equal((await jsonPost(route, { ...run, entries: [{ state: 'x', status: 'running' }] })).status, 400);
  assert.equal((await jsonPost('/api/question-lists/../../escape/runs', run)).status, 404);
  const otherList = await (await jsonPost('/api/question-lists', { name: 'Other list', questions: request.questions })).json();
  assert.deepEqual((await (await fetch(`${url}/api/question-lists/${otherList.id}/runs`)).json()).runs, []);
  await jsonPost('/api/question-lists', { ...list, questions: { changed: { type: 'noul' } } });
  assert.deepEqual((await (await fetch(`${url}${route}/${saved.id}`)).json()).questionList.questions, request.questions);
  assert.throws(() => normalizeRun({ ...run, entries: [] }));
});

test('common spam example is public, editable, and keeps local copies and outputs separate', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'jev-common-lists-'));
  t.after(async () => {
    assert.equal(path.dirname(root), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith('jev-common-lists-'));
    await rm(root, { recursive: true, force: true });
  });
  const commonDir = path.join(root, 'common');
  const storageDir = path.join(root, 'local');
  const id = '89a42172-28b6-48dc-b63a-545e45fce988';
  const fixture = await readFile(new URL(`../common/question-lists/${id}.json`, import.meta.url), 'utf8');
  const definition = JSON.parse(fixture);
  normalizeList(definition);
  assert.ok(definition.exampleTexts.length > 0);
  assert.deepEqual(Object.keys(definition.questions), ['allowed']);
  await mkdir(commonDir);
  await writeFile(path.join(commonDir, `${id}.json`), fixture);
  const url = await serve(t, { env: {}, commonDir, storageDir });
  const otherUrl = await serve(t, { env: {}, commonDir, storageDir: path.join(root, 'other-local') });
  const getLists = async base => (await (await fetch(`${base}/api/question-lists`)).json()).lists;
  const save = async (base, body) => fetch(`${base}/api/question-lists`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const common = (await getLists(url))[0];
  assert.equal(common.scope, 'common');
  assert.deepEqual(common.exampleTexts, definition.exampleTexts);
  assert.ok(common.exampleTexts.every(item => item.text && Object.hasOwn(item.expectedAnswers, 'allowed')));
  assert.equal((await getLists(otherUrl))[0].id, id);
  const edited = { ...common, name: 'Edited shared spam policy', questions: { ...common.questions, extra_check: { type: 'noul', instructions: 'Is this a referral offer?' } } };
  const response = await save(url, edited);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).scope, 'common');
  const reopened = (await getLists(otherUrl))[0];
  assert.equal(reopened.name, edited.name);
  assert.deepEqual(reopened.questions, edited.questions);
  assert.deepEqual(reopened.exampleTexts, definition.exampleTexts);
  assert.equal((await readdir(storageDir)).filter(file => file.endsWith('.json')).length, 0);
  const copy = await (await save(url, { name: 'My spam policy', questions: edited.questions, exampleTexts: reopened.exampleTexts })).json();
  assert.equal(copy.scope, 'local');
  assert.deepEqual(copy.exampleTexts, reopened.exampleTexts);
  assert.notEqual(copy.id, id);
  assert.equal((await getLists(otherUrl)).length, 1);
  assert.equal((await getLists(url)).length, 2);
  assert.deepEqual((await getLists(url)).find(list => list.id === copy.id).exampleTexts, reopened.exampleTexts);
  assert.equal((await save(url, { name: 'Invalid examples', questions: edited.questions, exampleTexts: [{ text: 'Test', expectedAnswers: { missing: true } }] })).status, 400);
  const run = { provider: 'gapgpt', mode: 'single', request: { ...request, questions: edited.questions }, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), entries: [{ state: 'Sample text', status: 'success', response: { ok: true, status: 200, data: { answers: {} } } }] };
  const output = await fetch(`${url}/api/question-lists/${id}/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(run) });
  assert.equal(output.status, 200);
  assert.ok((await readdir(storageDir)).includes(`${id}.runs`));
  assert.deepEqual(await readdir(commonDir), [`${id}.json`]);
});
