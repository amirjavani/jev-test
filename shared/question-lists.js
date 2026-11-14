import { validateRequest } from './validation.js';

export const MAX_LIST_BYTES = 1024 * 1024;
export function normalizeList(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Import a JSON question map or an object containing questions.');
  const wrapped = Object.hasOwn(value, 'questions') && typeof value.questions?.type !== 'string';
  if (wrapped && value.version !== undefined && value.version !== 1) throw new Error('Unsupported question list version.');
  const questions = wrapped ? value.questions : value;
  validateRequest({ model: 'validation', state: '', questions });
  const clean = Object.fromEntries(Object.entries(questions).map(([id, q]) => [id, {
    type: q.type,
    ...(q.instructions !== undefined ? { instructions: q.instructions } : {}),
    ...(q.criteria !== undefined && q.type !== 'box' ? { criteria: q.criteria } : {}),
  }]));
  const name = wrapped && typeof value.name === 'string' ? value.name.trim() : 'Imported questions';
  if (!name || name.length > 100) throw new Error('List name must contain 1–100 characters.');
  const list = { version: 1, name, questions: clean };
  if (new TextEncoder().encode(JSON.stringify(list)).length > MAX_LIST_BYTES) throw new Error('Question lists must be smaller than 1 MB.');
  return list;
}

export function questionsFromEditors(editors) {
  const questions = Object.create(null);
  for (const q of editors) {
    const id = q.id.trim();
    if (Object.hasOwn(questions, id)) throw new Error(`Duplicate question name: ${id}`);
    let instructions;
    try { instructions = q.format === 'json' ? JSON.parse(q.instructions) : q.instructions; }
    catch { throw new Error(`${id || 'Question'}: invalid instructions JSON.`); }
    questions[id] = { type: q.type, ...(q.instructionsOmitted && instructions === '' ? {} : { instructions }) };
    if (q.type !== 'box' && q.criteria.trim()) {
      try { questions[id].criteria = JSON.parse(q.criteria); }
      catch { throw new Error(`${id || 'Question'}: invalid criteria JSON.`); }
    }
  }
  return normalizeList({ name: 'Questions', questions }).questions;
}

export function editorsFromQuestions(questions) {
  return Object.entries(questions).map(([id, q]) => ({
    id, type: q.type,
    instructionsOmitted: q.instructions === undefined,
    format: typeof q.instructions === 'string' || q.instructions === undefined ? 'text' : 'json',
    instructions: q.instructions === undefined ? '' : typeof q.instructions === 'string' ? q.instructions : JSON.stringify(q.instructions, null, 2),
    criteria: q.criteria === undefined ? '' : JSON.stringify(q.criteria, null, 2),
  }));
}
