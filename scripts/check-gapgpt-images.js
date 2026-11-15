// Explicit, paid live check. Never runs as part of npm test.
import 'dotenv/config';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server/app.js';
import { attachImages } from '../shared/image-files.js';

if (!process.env.GAPGPT_API_KEY?.trim()) throw new Error('Set GAPGPT_API_KEY in .env first.');
const server = createApp({ commonDir: null }).listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const url = `http://127.0.0.1:${server.address().port}/api/evaluate`;
const results = [];
const questions = {
  has_circle: { type: 'noul', instructions: 'Is there a circle in the pictures in `images`?' },
  object_color: { type: 'choice', instructions: 'What is the color of the main colored object in the first picture in `images`? Ignore the background.', criteria: { red: 'Red', blue: 'Blue', green: 'Green', yellow: 'Yellow', other: 'Another color or no colored object' } },
};
try {
  for (const [file, color, circle] of [['red-circle.png', 'red', true], ['blue-square.png', 'blue', false]]) {
    const bytes = await readFile(new URL(`../examples/images/${file}`, import.meta.url));
    const { states, assets } = attachImages(['Evaluate the attached picture.'], undefined, [{ id: randomUUID(), asset: { type: 'image', format: 'png', data_base64: bytes.toString('base64') } }]);
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'gapgpt', request: { model: 'typesafe/jev-1.14', state: states[0], assets, questions } }) });
    const body = await response.json();
    const answers = body.data?.answers;
    const probability = answers?.has_circle?.noul;
    const passed = response.ok && body.ok && answers?.object_color?.choice === color && typeof probability === 'number' && (circle ? probability >= 0.9 : probability <= 0.1);
    const result = { file, expected: { color, circle }, passed: Boolean(passed), response: body };
    results.push(result);
    console.log(JSON.stringify(result));
    if (!response.ok) break;
  }
  const passed = results.length === 2 && results.every(result => result.passed);
  await mkdir(new URL('../.local/', import.meta.url), { recursive: true });
  await writeFile(new URL('../.local/gapgpt-image-check.json', import.meta.url), JSON.stringify({ checkedAt: new Date().toISOString(), model: 'typesafe/jev-1.14', passed, results }, null, 2));
  console.log(passed ? 'PASS: GapGPT correctly distinguished both image-only inputs.' : 'FAIL: See .local/gapgpt-image-check.json for the provider response.');
  if (!passed) process.exitCode = 1;
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
