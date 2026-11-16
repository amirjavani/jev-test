const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

const canonical = value => Array.isArray(value) ? value.map(canonical) : object(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const questionKey = (name, question) => JSON.stringify([name, canonical(question)]);

export function questionLabels(record, questions) {
  if (!questions) return {};
  if (!record.expectedAnswerScopes) return record.expectedAnswers || {};
  return Object.fromEntries([...Object.entries(record.unmatchedExpectedAnswers || {}), ...Object.entries(questions).flatMap(([name, question]) => {
    const key = questionKey(name, question);
    return Object.hasOwn(record.expectedAnswerScopes, key) ? [[name, record.expectedAnswerScopes[key]]] : [];
  })]);
}

export function withQuestionLabels(record, questions, answers) {
  if (!questions) return record;
  const expectedAnswerScopes = { ...record.expectedAnswerScopes };
  for (const [name, question] of Object.entries(questions)) {
    const key = questionKey(name, question);
    if (Object.hasOwn(answers, name)) expectedAnswerScopes[key] = answers[name];
    else delete expectedAnswerScopes[key];
  }
  const unmatchedExpectedAnswers = Object.fromEntries(Object.entries(answers).filter(([name]) => !Object.hasOwn(questions, name)));
  return { ...record, expectedAnswers: answers, expectedAnswerScopes, unmatchedExpectedAnswers };
}

// Inactive scoped labels stay visible as reference data without being reassigned
// to a different policy that happens to use the same question name.
export function referenceLabels(record, questions) {
  const active = questionLabels(record, questions);
  if (Object.keys(active).length || !Object.keys(record.expectedAnswers || {}).length) return active;
  return record.expectedAnswers;
}

export function expectedAnswerWarning(entry, questions) {
  const answers = entry.expectedAnswers || {};
  if (!Object.keys(answers).length) return '';
  if (entry.comparisonDisabled === true) return 'Dataset expected answers belong to different question definitions. Model outputs are shown without accuracy comparison.';
  try { normalizeExpectedAnswers(answers, questions); }
  catch { return 'Dataset expected answers do not match the selected questions (names or answer types). Model outputs are shown without accuracy comparison.'; }
  return '';
}

// Labels are local metadata, never part of a System One request.
export function normalizeExpectedAnswers(value = {}, questions) {
  if (!object(value)) throw new Error('Expected answers must be an object keyed by question name.');
  return Object.fromEntries(Object.entries(value).map(([name, answer]) => {
    const q = questions?.[name];
    if (questions && !Object.hasOwn(questions, name)) throw new Error(`Expected answer ${name}: question no longer exists. Clear the label or restore the question.`);
    const box = object(answer) && ['top', 'bottom', 'left', 'right'].every(key => typeof answer[key] === 'number' && Number.isFinite(answer[key]) && answer[key] >= 0 && answer[key] <= 1)
      && answer.top <= answer.bottom && answer.left <= answer.right && Object.keys(answer).length === 4;
    const valid = q ? q.type === 'noul' ? typeof answer === 'boolean' || answer === 'human'
      : q.type === 'choice' ? typeof answer === 'string' && Object.hasOwn(q.criteria, answer)
      : q.type === 'score' ? typeof answer === 'number' && Number.isFinite(answer) && answer >= 0 && answer <= q.criteria.length - 1
      : q.type === 'box' && box
      : typeof answer === 'boolean' || typeof answer === 'string' || (typeof answer === 'number' && Number.isFinite(answer)) || box;
    if (!valid) throw new Error(`Expected answer ${name}: select a valid answer for this question.`);
    return [name, box ? { top: answer.top, bottom: answer.bottom, left: answer.left, right: answer.right } : answer];
  }));
}
