import { validateRequest } from './validation.js';
import { responseUsage } from './usage.js';
import { normalizeExpectedAnswers } from './expected-answers.js';
import { evaluateDataset, normalizeNoulProbabilities } from './evaluation.js';

export const sameQuestions = (a, b) => {
  const ordered = value => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value;
  return JSON.stringify(ordered(a)) === JSON.stringify(ordered(b));
};

// Await each evaluation before starting the next; failed items do not stop the queue.
export async function evaluateSequentially({ states, expectedAnswers = [], comparisonDisabled = [], evaluate, signal, onUpdate }) {
  const entries = states.map((state, index) => ({ index, state, ...(expectedAnswers[index] && Object.keys(expectedAnswers[index]).length ? { expectedAnswers: structuredClone(expectedAnswers[index]) } : {}), ...(comparisonDisabled[index] ? { comparisonDisabled: true } : {}), status: 'pending' }));
  const publish = () => onUpdate(entries.map(entry => ({ ...entry })));
  publish();
  for (const entry of entries) {
    if (signal.aborted) { entry.status = 'skipped'; continue; }
    entry.status = 'running'; publish();
    try {
      entry.response = await evaluate(entry.state, signal);
      entry.status = entry.response.ok ? 'success' : 'error';
    } catch (e) {
      entry.status = signal.aborted ? 'cancelled' : 'error';
      entry.error = signal.aborted ? 'Request cancelled.' : e.message;
    }
    publish();
  }
  publish();
  return entries;
}

export function normalizeRun(value) {
  if (!value || !['gapgpt', 'typesafe'].includes(value.provider)) throw new Error('Invalid run provider.');
  if (!['single', 'batch'].includes(value.mode)) throw new Error('Invalid run mode.');
  validateRequest(value.request);
  if (!Array.isArray(value.entries) || !value.entries.length || value.entries.length > 500) throw new Error('Runs must contain 1–500 results.');
  for (const key of ['startedAt', 'finishedAt']) if (typeof value[key] !== 'string' || !Number.isFinite(Date.parse(value[key]))) throw new Error('Run timestamps are required.');
  const entries = value.entries.map((entry, index) => {
    if (!entry || !['success', 'error', 'cancelled', 'skipped'].includes(entry.status)) throw new Error('Wait for the run to finish before saving.');
    validateRequest({ ...value.request, state: entry.state });
    if (entry.status === 'success' && (!entry.response || entry.response.ok !== true)) throw new Error('Successful results need a response.');
    const expectedAnswers = normalizeExpectedAnswers(entry.expectedAnswers);
    const noulProbabilities = normalizeNoulProbabilities(entry.response?.noulProbabilities);
    return { index, state: entry.state, status: entry.status,
      ...(Object.keys(expectedAnswers).length ? { expectedAnswers } : {}),
      ...(entry.comparisonDisabled === true ? { comparisonDisabled: true } : {}),
      ...(entry.error ? { error: String(entry.error) } : {}),
      ...(entry.response ? { response: { ok: entry.response.ok === true, status: entry.response.status, durationMs: entry.response.durationMs, data: entry.response.data, ...(noulProbabilities ? { noulProbabilities } : {}), ...(responseUsage(entry.response) ? { usage: responseUsage(entry.response) } : {}), ...(entry.response.error ? { error: String(entry.response.error) } : {}) } } : {}),
    };
  });
  if (!entries.some(entry => entry.status === 'success' || entry.status === 'error')) throw new Error('There are no completed results to save.');
  const { model, questions, assets, state } = value.request;
  const evaluation = evaluateDataset(entries, questions);
  return { version: 1, mode: value.mode, provider: value.provider, longContext: value.longContext === true,
    request: { model, state, questions, ...(assets ? { assets } : {}) },
    startedAt: value.startedAt, finishedAt: value.finishedAt, entries,
    ...(evaluation.summary.labeled || evaluation.warnings.length ? { evaluation } : {}) };
}
