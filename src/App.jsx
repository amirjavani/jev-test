import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Braces, Check, ChevronDown, Copy, FlaskConical, Layers3, LoaderCircle, Play, Plus, RotateCcw, Trash2, Zap } from 'lucide-react';
import { validateRequest } from '../shared/validation.js';

const initialQuestions = [
  { id: 'refund', type: 'noul', instructions: 'Is a refund requested?', format: 'text', criteria: '' },
  { id: 'team', type: 'choice', instructions: 'Which team should handle this?', format: 'text', criteria: '{\n  "billing": "Payments and refunds",\n  "technical": "Software errors"\n}' },
  { id: 'urgency', type: 'score', instructions: 'How urgent is it?', format: 'text', criteria: '[\n  "Routine",\n  "Urgent",\n  "Emergency"\n]' },
];
const descriptions = { noul: 'Probability of yes, from 0 to 1.', choice: 'Choose one option from named criteria.', score: 'Rate against ordered levels, starting at 0.', box: 'Locate an object in an image. Experimental; gateway support may vary.' };
const pretty = value => JSON.stringify(value, null, 2);
const pct = value => `${(Number(value) * 100).toFixed(1)}%`;

function Question({ q, index, update, remove }) {
  return <article className="question">
    <div className="question-top"><span className="question-index">{String(index + 1).padStart(2, '0')}</span><input aria-label={`Question ${index + 1} name`} className="question-name" value={q.id} onChange={e => update({ id: e.target.value })} placeholder="question_name" /><select aria-label={`Question ${index + 1} type`} className={`type-select ${q.type}`} value={q.type} onChange={e => update({ type: e.target.value, criteria: e.target.value === 'choice' ? '{\n  "option_a": "First option",\n  "option_b": "Second option"\n}' : e.target.value === 'score' ? '["Low", "Medium", "High"]' : '' })}>{['noul', 'choice', 'score', 'box'].map(t => <option key={t} value={t}>{t}</option>)}</select><button className="icon-button danger" aria-label={`Delete question ${index + 1}`} onClick={remove}><Trash2 size={15} /></button></div>
    <div className="label-row"><label htmlFor={`instructions-${index}`}>Instructions</label><select aria-label={`Question ${index + 1} instruction format`} className="mini-select" value={q.format} onChange={e => update({ format: e.target.value, instructions: e.target.value === 'json' ? pretty({ question: q.instructions }) : (() => { try { const v = JSON.parse(q.instructions); return typeof v === 'string' ? v : pretty(v); } catch { return q.instructions; } })() })}><option value="text">Text</option><option value="json">JSON</option></select></div>
    <textarea id={`instructions-${index}`} className={q.format === 'json' ? 'code' : ''} rows={q.format === 'json' ? 3 : 2} value={q.instructions} onChange={e => update({ instructions: e.target.value })} placeholder="Ask one specific question…" />
    {q.type !== 'box' && <><label htmlFor={`criteria-${index}`}>{q.type === 'choice' ? 'Choices' : q.type === 'score' ? 'Ordered levels' : 'Yes / no criteria'} <span className="label-note">{q.type === 'noul' ? 'optional · JSON object' : q.type === 'score' ? 'JSON array · 1–10 levels' : 'JSON object · 1–255 choices'}</span></label><textarea id={`criteria-${index}`} className="code criteria" rows={q.type === 'noul' ? 2 : 4} value={q.criteria} placeholder={q.type === 'noul' ? '{"true": "A refund is requested", "false": "No refund requested"}' : ''} onChange={e => update({ criteria: e.target.value })} /></>}
    <p className="field-hint">{descriptions[q.type]}</p>
  </article>;
}

function Answer({ name, answer }) {
  if (!answer || typeof answer !== 'object') return <article className="answer"><strong>{name}</strong><pre>{pretty(answer)}</pre></article>;
  return <article className="answer"><div className="answer-head"><span>{name}</span><span className={`badge ${answer.type}`}>{answer.type || 'answer'}</span></div><div className="answer-value">{answer.type === 'noul' ? pct(answer.noul) : answer.type === 'choice' ? answer.choice : answer.type === 'score' ? Number(answer.score).toFixed(3) : 'Bounding box'}</div><p className="field-hint">{answer.type === 'noul' ? 'Probability of yes' : answer.type === 'score' ? 'Expected score · zero-based levels' : answer.type === 'choice' ? 'Selected choice' : pretty(answer.box)}</p>{typeof answer.confidence === 'number' && <div className="confidence">Confidence <strong>{pct(answer.confidence)}</strong></div>}{answer.probabilities && <div className="probabilities">{Object.entries(answer.probabilities).map(([key, value]) => <div className="probability" key={key}><div><span>{typeof answer.legend?.[key] === 'string' ? `${key} · ${answer.legend[key]}` : key}</span><span>{pct(value)}</span></div><div className="track"><div style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} /></div></div>)}</div>}</article>;
}

export default function App() {
  const [providers, setProviders] = useState([]);
  const [provider, setProvider] = useState('gapgpt');
  const [model, setModel] = useState('typesafe/jev-1.14');
  const [state, setState] = useState('{\n  "text": "The customer requests a refund for a duplicate payment."\n}');
  const [stateFormat, setStateFormat] = useState('json');
  const [questions, setQuestions] = useState(() => initialQuestions.map(q => ({ ...q, key: crypto.randomUUID() })));
  const [assets, setAssets] = useState('');
  const [longContext, setLongContext] = useState(false);
  const [tab, setTab] = useState('results');
  const [result, setResult] = useState(null);
  const [submitted, setSubmitted] = useState(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [configError, setConfigError] = useState('');
  const controller = useRef(null);
  useEffect(() => { fetch('/api/config').then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => setProviders(data.providers)).catch(() => setConfigError('Could not load provider configuration. Restart the local server.')); return () => controller.current?.abort(); }, []);
  const selected = providers.find(p => p.id === provider);
  const built = useMemo(() => {
    try {
      const map = Object.create(null);
      for (const q of questions) {
        const id = q.id.trim();
        if (Object.hasOwn(map, id)) throw new Error(`Duplicate question name: ${id}`);
        let instructions;
        try { instructions = q.format === 'json' ? JSON.parse(q.instructions) : q.instructions; } catch { throw new Error(`${id || 'Question'}: invalid instructions JSON.`); }
        map[id] = { type: q.type, instructions };
        if (q.type !== 'box' && q.criteria.trim()) {
          try { map[id].criteria = JSON.parse(q.criteria); } catch { throw new Error(`${id || 'Question'}: invalid criteria JSON.`); }
        }
      }
      let parsedState;
      try { parsedState = stateFormat === 'json' ? JSON.parse(state) : state; } catch { throw new Error('State contains invalid JSON.'); }
      const request = { model, state: parsedState, questions: map };
      if (assets.trim()) { try { request.assets = JSON.parse(assets); } catch { throw new Error('Assets contain invalid JSON.'); } }
      validateRequest(request);
      return { request };
    } catch (e) { return { error: e.message }; }
  }, [questions, model, state, stateFormat, assets]);
  const stale = result && pretty(submitted) !== pretty({ provider, request: built.request, longContext });
  async function run() {
    if (built.error) { setError(built.error); return; }
    const abort = new AbortController(); controller.current = abort;
    setRunning(true); setError(''); setResult(null); setSubmitted({ provider, request: built.request, longContext }); setTab('results');
    try {
      const response = await fetch('/api/evaluate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, request: built.request, longContext }), signal: abort.signal });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
      if (!response.ok) { setError(`Provider returned HTTP ${response.status}. See the raw response for details.`); setTab('raw'); }
    } catch (e) { setError(e.name === 'AbortError' ? 'Request cancelled.' : e.message); } finally { setRunning(false); }
  }
  function reset() { setState('{\n  "text": "The customer requests a refund for a duplicate payment."\n}'); setStateFormat('json'); setQuestions(initialQuestions.map(q => ({ ...q, key: crypto.randomUUID() }))); setAssets(''); setLongContext(false); setResult(null); setError(''); }
  async function copy() { try { await navigator.clipboard.writeText(pretty(tab === 'request' ? built.request : result?.data)); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setError('Clipboard unavailable. Select and copy the JSON manually.'); } }

  return <><header className="topbar"><a className="brand" href="/"><span className="brand-mark"><Layers3 size={21} /></span>jev<span className="brand-slash">/</span><span className="brand-light">test</span><span className="local-badge">LOCAL PLAYGROUND</span></a><a className="docs-link" href="https://docs.typesafe.ai/api/system-one" target="_blank" rel="noreferrer">Documentation <ArrowUpRight size={15} /></a></header>
    <main><div className="page-heading"><div><div className="eyebrow"><span /> SYSTEM ONE · TYPESAFE</div><h1>Small questions. Clear decisions.</h1><p>Give Jev your context, define your questions, and inspect every answer.</p></div><span className="version-tag"><Zap size={14} /> JEV 1.14</span></div>
    <div className="workspace"><div className="editor-column"><section className="panel connection"><div className="section-heading"><span className="step">01</span><h2>Connection</h2><span className="heading-note">Your inference route</span></div><div className="connection-fields"><label>Provider<select value={provider} disabled={running} onChange={e => { setProvider(e.target.value); setModel(providers.find(p => p.id === e.target.value)?.model || 'typesafe/jev-1.14'); }}>{(providers.length ? providers : [{ id: 'gapgpt', name: 'GapGPT' }]).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Model<input value={model} onChange={e => setModel(e.target.value)} spellCheck="false" /></label></div><div className={`connection-status ${selected?.configured ? 'connected' : ''}`}><span className="status-dot" />{configError || (selected?.configured ? 'API key loaded from .env' : 'Add your API key to .env, then restart the server')}<span className="endpoint">{selected?.endpoint.replace('https://', '') || 'api.gapgpt.app/v1/systemone'}</span></div></section>
    <section className="panel state-panel"><div className="section-heading"><span className="step">02</span><h2>State</h2><div className="segmented"><button className={stateFormat === 'text' ? 'active' : ''} onClick={() => { if (stateFormat === 'json') { try { const parsed = JSON.parse(state); setState(typeof parsed === 'string' ? parsed : pretty(parsed)); } catch { /* Preserve unfinished input. */ } } setStateFormat('text'); }}>Text</button><button className={stateFormat === 'json' ? 'active' : ''} onClick={() => { if (stateFormat === 'text') setState(pretty(state)); setStateFormat('json'); }}>JSON</button></div></div><p className="section-description">The shared context for every question.</p><textarea aria-label="State input" className={`state-input ${stateFormat === 'json' ? 'code' : ''}`} value={state} onChange={e => setState(e.target.value)} rows={5} spellCheck="false" /><div className="editor-footer"><span><Braces size={13} /> {stateFormat === 'json' ? 'Structured context' : 'Plain text'}</span><span>{state.length.toLocaleString()} characters</span></div></section>
    <section className="panel questions-panel"><div className="section-heading"><span className="step">03</span><h2>Questions <span className="count">{questions.length}</span></h2><button className="text-button" onClick={() => setQuestions([...questions, { key: crypto.randomUUID(), id: `question_${questions.length + 1}`, type: 'noul', instructions: '', format: 'text', criteria: '' }])}><Plus size={15} /> Add question</button></div><p className="section-description">One focused decision per question. All evaluated together.</p><div className="question-list">{questions.map((q, index) => <Question key={q.key} q={q} index={index} update={patch => setQuestions(all => all.map(item => item.key === q.key ? { ...item, ...patch } : item))} remove={() => setQuestions(all => all.filter(item => item.key !== q.key))} />)}</div></section>
    <details className="panel advanced"><summary>Advanced settings <ChevronDown size={16} /></summary><label className="checkbox"><input type="checkbox" checked={longContext} onChange={e => setLongContext(e.target.checked)} /> Experimental long context</label><label htmlFor="assets">Image assets <span className="label-note">optional · JSON object</span></label><textarea id="assets" className="code" rows={4} value={assets} onChange={e => setAssets(e.target.value)} placeholder={'{"photo": {"type": "image", "format": "png", "data_base64": "…"}}'} /><p className="field-hint">Reference an asset key in your state or instructions. Images and Box enable the experimental images header. Gateway support may vary.</p></details>
    </div><aside className="output-column"><section className="panel output-panel"><div className="section-heading"><span className="output-icon"><FlaskConical size={17} /></span><h2>Output</h2><span className={`output-status ${result?.ok ? 'success' : ''}`}>{running ? 'RUNNING' : result?.ok ? 'COMPLETE' : 'READY'}</span></div><div className="output-tabs">{[['results', 'Results'], ['raw', 'Raw JSON'], ['request', 'Request']].map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}<button aria-label="Copy JSON" title="Copy JSON" className="copy-button" disabled={tab === 'request' ? !built.request : !result} onClick={copy}>{copied ? <Check size={15} /> : <Copy size={15} />}</button></div>
    <div className="output-body" aria-live="polite">{error && <div role="alert" className="error-message">{error}</div>}{stale && <div className="notice">Inputs have changed. Run again to update these results.</div>}{tab === 'request' ? built.error ? <div className="notice">{built.error}</div> : <pre>{pretty(built.request)}</pre> : tab === 'raw' && result ? <pre>{pretty(result.data)}</pre> : tab === 'results' && result?.ok ? <><div className="result-meta"><span><span className="status-dot" /> HTTP {result.status}</span><span>{result.durationMs} ms</span></div>{result.data?.answers && Object.keys(result.data.answers).length ? Object.entries(result.data.answers).map(([name, answer]) => <Answer key={name} name={name} answer={answer} />) : <pre>{pretty(result.data)}</pre>}{result.data?.usage && <div className="usage"><span>Token usage</span><strong>{result.data.usage.input_tokens ?? '—'} in <span>/</span> {result.data.usage.output_tokens ?? '—'} out</strong></div>}</> : <div className="empty-output"><div className={`empty-illustration ${running ? 'spinning' : ''}`}>{running ? <LoaderCircle size={30} /> : <Layers3 size={30} />}</div><h3>{running ? 'Making the call…' : 'Your next decision starts here'}</h3><p>{running ? 'Jev is evaluating your questions against the shared state.' : 'Run your questions to see typed answers, probabilities, and confidence.'}</p><div className="empty-types"><span>noul</span><span>choice</span><span>score</span></div></div>}</div>
    <div className="run-area">{built.error && <p className="validation-message">{built.error}</p>}<button className="run-button" disabled={!running && (!!built.error || !selected?.configured)} onClick={running ? () => controller.current?.abort() : run}>{running ? <><LoaderCircle className="spin" size={17} /> Cancel request</> : <><Play size={15} fill="currentColor" /> Run evaluation <span>→</span></>}</button><div className="run-footer"><span>{questions.length} question{questions.length !== 1 ? 's' : ''} · one request</span><button disabled={running} onClick={reset}><RotateCcw size={12} /> Reset example</button></div></div></section><div className="tip"><Zap size={16} /><p><strong>Built for decisions.</strong> Jev returns structured judgments. Keep questions specific and combine the answers in your code.</p></div></aside></div><footer className="page-footer"><span>Jev Test <span>·</span> A space to experiment.</span><span>React + TypeSafe System One</span></footer></main></>;
}
