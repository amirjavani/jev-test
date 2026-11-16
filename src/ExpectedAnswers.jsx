export default function ExpectedAnswers({ questions, value = {}, onChange, disabled, prefix }) {
  function update(name, answer) {
    const next = { ...value };
    if (answer === undefined) delete next[name]; else Object.defineProperty(next, name, { value: answer, enumerable: true, configurable: true, writable: true });
    onChange(next);
  }
  return <fieldset className="expected-answers" disabled={disabled}>
    <legend>Expected per question</legend>
    {!questions ? <p className="field-hint">Complete the question definitions to select answers.</p> : Object.entries(questions).map(([name, q], index) => {
      const id = `${prefix}-expected-${index}`;
      const answer = Object.hasOwn(value, name) ? value[name] : undefined;
      const describe = value => typeof value === 'string' ? value : value === undefined || value === null ? '' : JSON.stringify(value);
      const instructions = describe(q.instructions);
      const label = <label htmlFor={id} title={instructions || name}><span className="expected-question-name">{name}</span>{instructions && <span className="expected-question-text">{instructions}</span>}</label>;
      if (q.type === 'box') return <div className="expected-question box" key={name}>{label}<input id={id} aria-label={`Expected answer for ${name}`} value={answer === undefined ? '' : typeof answer === 'string' ? answer : JSON.stringify(answer)} placeholder='{"top":0,"bottom":1,"left":0,"right":1}' onChange={e => { if (!e.target.value.trim()) update(name, undefined); else { try { update(name, JSON.parse(e.target.value)); } catch { update(name, e.target.value); } } }} /></div>;
      const optionLabel = (key, description) => description ? `${key} · ${describe(description)}` : key;
      const options = q.type === 'noul' ? [['true', optionLabel('Yes', q.criteria?.true)], ['false', optionLabel('No', q.criteria?.false)], ['human', 'Human review']]
        : q.type === 'choice' ? Object.entries(q.criteria).map(([key, description]) => [key, optionLabel(key, description)])
        : q.criteria.map((label, level) => [String(level), `${level} · ${typeof label === 'string' ? label : JSON.stringify(label)}`]);
      const selected = answer === undefined ? '' : String(answer);
      return <div className={`expected-question ${q.type}`} key={name}>{label}<select id={id} aria-label={`Expected answer for ${name}`} title={options.find(([key]) => key === selected)?.[1] || 'Unlabeled'} value={answer === undefined ? '' : `answer:${selected}`} onChange={e => { const raw = e.target.value; update(name, raw === '' ? undefined : q.type === 'noul' ? raw === 'answer:human' ? 'human' : raw === 'answer:true' : q.type === 'score' ? Number(raw.slice(7)) : raw.slice(7)); }}>
        <option value="">—</option>
        {answer !== undefined && !options.some(([key]) => key === selected) && <option value={`answer:${selected}`}>{selected} · review label</option>}
        {options.map(([key, label]) => <option key={key} value={`answer:${key}`}>{label}</option>)}
      </select></div>;
    })}
    {Object.keys(value).length > 0 && <button type="button" className="expected-clear" onClick={() => onChange({})}>Clear</button>}
    {questions && Object.keys(value).some(name => !Object.hasOwn(questions, name)) && <p className="library-error">Dataset labels do not match the selected questions. You can still run; outputs will be shown without accuracy comparison.</p>}
  </fieldset>;
}
