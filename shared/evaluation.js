import { normalizeExpectedAnswers } from './expected-answers.js';

const own = (value, key) => value !== null && typeof value === 'object' && Object.hasOwn(value, key);
const finite = value => typeof value === 'number' && Number.isFinite(value);
export const comparisonRules = Object.freeze({ noulApproveAbove: 0.9, noulRejectBelow: 0.3, humanReview: 'probability from 0.3 through 0.9 inclusive, or a manual human label; excluded from automatic accuracy', score: 'nearest level for integer labels; exact for fractional labels', boxIouThreshold: 0.5 });

// Compare the original probability, before rounding it for display.
export function classifyNoulProbability(probability) {
  if (!finite(probability) || probability < 0 || probability > 1) return null;
  if (probability > comparisonRules.noulApproveAbove) return true;
  if (probability < comparisonRules.noulRejectBelow) return false;
  return 'human';
}

export function normalizeNoulProbabilities(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const probabilities = Object.fromEntries(Object.entries(value).filter(([, p]) => finite(p) && p >= 0 && p <= 1));
  return Object.keys(probabilities).length ? probabilities : undefined;
}

function validBox(box) {
  return box !== null && typeof box === 'object' && !Array.isArray(box)
    && ['top', 'bottom', 'left', 'right'].every(key => finite(box[key]) && box[key] >= 0 && box[key] <= 1)
    && box.top <= box.bottom && box.left <= box.right;
}

export function boxOverlap(a, b) {
  const intersection = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
    * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const union = (a.right - a.left) * (a.bottom - a.top) + (b.right - b.left) * (b.bottom - b.top) - intersection;
  return union > 0 ? intersection / union : ['top', 'bottom', 'left', 'right'].every(key => a[key] === b[key]) ? 1 : 0;
}

function prediction(entry, name, question) {
  if (entry.status !== 'success' || entry.response?.ok !== true) return { predicted: null };
  const data = entry.response.data;
  const answer = own(data?.answers, name) ? data.answers[name] : own(data, name) ? data[name] : undefined;
  if (answer?.type !== undefined && answer.type !== question.type) return { predicted: null };
  if (question.type === 'noul') {
    const reported = own(entry.response.noulProbabilities, name);
    const probability = reported ? entry.response.noulProbabilities[name] : answer?.noul;
    if (!reported && probability === undefined && typeof answer === 'boolean') return { predicted: answer };
    return finite(probability) && probability >= 0 && probability <= 1
      ? { predicted: classifyNoulProbability(probability), probability } : { predicted: null };
  }
  if (question.type === 'choice') {
    const choice = answer?.choice ?? answer;
    return typeof choice === 'string' && own(question.criteria, choice) ? { predicted: choice } : { predicted: null };
  }
  if (question.type === 'score') {
    const score = answer?.score ?? answer;
    return finite(score) && score >= 0 && score <= question.criteria.length - 1
      ? { predicted: Math.round(score), score } : { predicted: null };
  }
  const box = answer?.box ?? answer;
  return question.type === 'box' && validBox(box)
    ? { predicted: Object.fromEntries(['top', 'bottom', 'left', 'right'].map(key => [key, box[key]])) } : { predicted: null };
}

export function compareEntry(entry, questions) {
  return Object.fromEntries(Object.entries(questions).map(([name, question]) => {
    const actual = { type: question.type, ...prediction(entry, name, question) };
    if (!own(entry.expectedAnswers, name)) return [name, { status: 'unlabeled', ...actual }];
    const expected = entry.expectedAnswers[name];
    const base = { expected, ...actual };
    try { normalizeExpectedAnswers({ [name]: expected }, { [name]: question }); }
    catch { return [name, { ...base, status: 'unavailable', reason: 'Invalid expected answer' }]; }
    if (['pending', 'running'].includes(entry.status)) return [name, { ...base, status: 'pending', reason: 'Waiting for model answer' }];
    if (entry.status !== 'success' || entry.response?.ok !== true) return [name, { ...base, status: 'unavailable', reason: entry.status === 'skipped' ? 'Input skipped' : 'No successful model response' }];
    if (actual.predicted === null) return [name, { ...base, status: 'unavailable', reason: 'Model answer missing or invalid' }];
    if (question.type === 'noul' && actual.predicted === 'human') return [name, { ...base, status: 'review', reason: 'Yes/allowed probability is between 30% and 90%, inclusive; human approval is required.' }];
    if (question.type === 'noul' && expected === 'human') return [name, { ...base, status: 'review', reason: 'Decide manually; resolve the expected answer to Yes or No to score.' }];
    let correct;
    if (question.type === 'box') {
      base.iou = boxOverlap(expected, actual.predicted);
      correct = base.iou >= comparisonRules.boxIouThreshold;
    } else if (question.type === 'score' && !Number.isInteger(expected)) {
      base.predicted = actual.score;
      correct = Math.abs(expected - actual.score) <= 1e-9;
    } else correct = expected === actual.predicted;
    return [name, { ...base, status: correct ? 'correct' : 'wrong' }];
  }));
}

const counts = () => ({ correct: 0, wrong: 0, pending: 0, unavailable: 0, unlabeled: 0, review: 0 });
function accuracy(count) {
  const scored = count.correct + count.wrong;
  return { ...count, scored, labeled: scored + count.pending + count.unavailable + count.review, accuracy: scored ? count.correct / scored : null };
}

export function evaluateDataset(entries, questions) {
  const perQuestion = Object.fromEntries(Object.keys(questions).map(name => [name, counts()]));
  const total = counts();
  const inputCounts = counts();
  const evaluated = entries.map((entry, index) => {
    const comparisons = compareEntry(entry, questions);
    const count = counts();
    for (const [name, comparison] of Object.entries(comparisons)) {
      count[comparison.status]++;
      perQuestion[name][comparison.status]++;
      total[comparison.status]++;
    }
    const result = accuracy(count);
    const inputStatus = !result.labeled ? 'unlabeled' : result.unavailable ? 'unavailable' : result.pending ? 'pending' : result.review ? 'review' : result.wrong ? 'wrong' : 'correct';
    inputCounts[inputStatus]++;
    return { index: entry.index ?? index, comparisons, ...result };
  });
  return { version: 1, rules: { ...comparisonRules }, summary: accuracy(total), inputs: accuracy(inputCounts),
    perQuestion: Object.fromEntries(Object.entries(perQuestion).map(([name, count]) => [name, accuracy(count)])), entries: evaluated };
}
