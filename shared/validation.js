const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const content = v => typeof v === 'string' || object(v) || Array.isArray(v);
export function validateRequest(body) {
  if (!object(body)) throw new Error('Request must be an object.');
  if (typeof body.model !== 'string' || !body.model.trim()) throw new Error('Model is required.');
  if (!content(body.state)) throw new Error('State must be text, an object, or an array.');
  if (!object(body.questions) || !Object.keys(body.questions).length) throw new Error('Add at least one question.');
  for (const [name, q] of Object.entries(body.questions)) {
    if (!name.trim()) throw new Error('Every question needs a name.');
    if (!object(q) || !['noul', 'choice', 'score', 'box'].includes(q.type)) throw new Error(`${name}: unsupported question type.`);
    if (q.instructions != null && !content(q.instructions)) throw new Error(`${name}: instructions must be text, an object, or an array.`);
    if (q.type === 'choice' && (!object(q.criteria) || Object.keys(q.criteria).length < 1 || Object.keys(q.criteria).length > 255 || Object.values(q.criteria).some(v => v !== null && !content(v)))) throw new Error(`${name}: provide 1–255 named choices with text or structured descriptions.`);
    if (q.type === 'score' && (!Array.isArray(q.criteria) || q.criteria.length < 1 || q.criteria.length > 10 || q.criteria.some(v => !content(v)))) throw new Error(`${name}: provide 1–10 ordered score levels.`);
    if (q.type === 'noul' && q.criteria != null && (!object(q.criteria) || Object.keys(q.criteria).some(k => !['true', 'false'].includes(k)) || Object.values(q.criteria).some(v => !content(v)))) throw new Error(`${name}: Noul criteria may contain only true and false descriptions.`);
  }
  if (body.assets !== undefined && (!object(body.assets) || !Object.keys(body.assets).length)) throw new Error('Assets must be a nonempty JSON object.');
  return body;
}
