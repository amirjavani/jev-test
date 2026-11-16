import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Check, ChevronDown, Layers3, LoaderCircle, Plus, RotateCcw, Trash2, Zap } from 'lucide-react';
import { validateRequest } from '../shared/validation.js';
import { editorsFromQuestions, questionsFromEditors } from '../shared/question-lists.js';
import QuestionLibrary from './QuestionLibrary.jsx';
import StateEditor from './StateEditor.jsx';
import RunOutput from './RunOutput.jsx';
import { evaluateSequentially, sameQuestions } from '../shared/runs.js';
import { datasetItems, datasetValues, parseDatasetArray } from '../shared/text-files.js';
import { normalizeExpectedAnswers, questionLabels, withQuestionLabels } from '../shared/expected-answers.js';
import ImageUpload from './ImageUpload.jsx';
import { attachImages, checkImageRequestSize } from '../shared/image-files.js';
import { defaultQuestions, defaultExamples, imageExampleQuestions, imageExampleLabels } from '../shared/examples.js';
import { readImage } from './image-upload.js';
import redCircleUrl from '../examples/images/red-circle.png?url';
import blueSquareUrl from '../examples/images/blue-square.png?url';

const initialQuestions = editorsFromQuestions(defaultQuestions);
const exampleBatch = () => defaultExamples.map(item => withQuestionLabels({ id: crypto.randomUUID(), text: item.text }, defaultQuestions, item.expectedAnswers));
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
  const [singleLabels, setSingleLabels] = useState(() => withQuestionLabels({}, defaultQuestions, defaultExamples[0].expectedAnswers));
  const [stateMode, setStateMode] = useState('single');
  const [batchStyle, setBatchStyle] = useState('fields');
  const [batchArray, setBatchArray] = useState('');
  const [batchItems, setBatchItems] = useState(exampleBatch);
  const [savedQuestionList, setSavedQuestionList] = useState(null);
  const [questions, setQuestions] = useState(() => initialQuestions.map(q => ({ ...q, key: crypto.randomUUID() })));
  const labelQuestions = useMemo(() => { try { return questionsFromEditors(questions); } catch { return null; } }, [questions]);
  const expectedAnswers = questionLabels(singleLabels, labelQuestions);
  const batchTexts = useMemo(() => batchItems.map(item => ({ ...item, expectedAnswers: questionLabels(item, labelQuestions) })), [batchItems, labelQuestions]);
  function setExpectedAnswers(answers) {
    setSingleLabels(item => withQuestionLabels(item, labelQuestions, answers));
  }
  function setBatchTexts(update) {
    setBatchItems(items => {
      const visible = items.map(item => ({ ...item, expectedAnswers: questionLabels(item, labelQuestions) }));
      const next = typeof update === 'function' ? update(visible) : update;
      return next.map(item => withQuestionLabels(item, labelQuestions, item.expectedAnswers || {}));
    });
  }
  useEffect(() => {
    if (!labelQuestions || batchStyle !== 'array') return;
    try { parseDatasetArray(batchArray); setBatchArray(pretty(datasetValues(batchTexts))); }
    catch { /* Keep an unfinished array draft. */ }
  }, [labelQuestions]);
  const [assets, setAssets] = useState('');
  const [images, setImages] = useState([]);
  const [preparingImages, setPreparingImages] = useState(false);
  const [longContext, setLongContext] = useState(false);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [configError, setConfigError] = useState('');
  const [configLoading, setConfigLoading] = useState(true);
  const controller = useRef(null);
  async function loadConfig(signal) {
    setConfigLoading(true); setConfigError('');
    try {
      const response = await fetch('/api/config', { signal, cache: 'no-store' });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!Array.isArray(data.providers)) throw new Error();
      setProviders(data.providers);
      if (data.capabilities?.noulProbabilities !== true) setConfigError('The API server is outdated. Restart the local server to enable percentage results.');
    } catch (e) { if (e.name !== 'AbortError') setConfigError('Could not check the API key. Make sure the local server is running.'); }
    finally { if (!signal?.aborted) setConfigLoading(false); }
  }
  useEffect(() => {
    const configController = new AbortController();
    loadConfig(configController.signal);
    return () => { configController.abort(); controller.current?.abort(); };
  }, []);
  const selected = providers.find(p => p.id === provider);
  const keyStatus = configLoading ? 'checking' : configError || !selected ? 'unknown' : selected.configured ? 'loaded' : 'missing';
  const keyVariable = provider === 'gapgpt' ? 'GAPGPT_API_KEY' : 'TYPESAFE_API_KEY';
  const built = useMemo(() => {
    try {
      if (preparingImages) throw new Error('Wait for images to finish preparing.');
      const map = questionsFromEditors(questions);
      let parsedState;
      let states;
      let labels;
      if (stateMode === 'batch') {
        if (batchStyle === 'array') for (const item of parseDatasetArray(batchArray)) normalizeExpectedAnswers(item.expectedAnswers, map);
        const activeItems = batchTexts;
        const activeTexts = activeItems.map(item => item.text);
        labels = activeItems.map(item => normalizeExpectedAnswers(item.expectedAnswers, map));
        if (!activeTexts.length || activeTexts.length > 500) throw new Error('Add 1–500 texts.');
        const empty = activeTexts.findIndex(text => !text.trim());
        if (empty !== -1) throw new Error(`Text ${empty + 1} is empty. Enter text or remove it.`);
        states = activeTexts.map(text => ({ text }));
        parsedState = states[0];
      } else {
        try { parsedState = stateFormat === 'json' ? JSON.parse(state) : state; } catch { throw new Error('State contains invalid JSON.'); }
        states = [parsedState];
        labels = [normalizeExpectedAnswers(expectedAnswers, map)];
      }
      let advancedAssets;
      if (assets.trim()) { try { advancedAssets = JSON.parse(assets); } catch { throw new Error('Assets contain invalid JSON.'); } }
      if (advancedAssets !== undefined) validateRequest({ model, state: parsedState, questions: map, assets: advancedAssets });
      const attached = attachImages(states, advancedAssets, images);
      states = attached.states;
      const request = { model, state: states[0], questions: map, ...(attached.assets ? { assets: attached.assets } : {}) };
      validateRequest(request);
      if (request.assets) for (const item of states) checkImageRequestSize({ ...request, state: item });
      return { request, states, expectedAnswers: labels };
    } catch (e) { return { error: e.message }; }
  }, [questions, model, state, stateFormat, assets, images, preparingImages, stateMode, batchTexts, batchStyle, batchArray, expectedAnswers]);
  const stale = result && (!built.request || result.provider !== provider || result.longContext !== longContext || result.mode !== stateMode || !sameQuestions(result.request, built.request) || pretty(result.entries.map(entry => entry.state)) !== pretty(built.states) || pretty(result.entries.map(entry => entry.expectedAnswers || {})) !== pretty(built.expectedAnswers));
  async function run() {
    if (running || built.error) return;
    const abort = new AbortController(); controller.current = abort;
    const snapshot = { version: 1, mode: stateMode, provider, longContext, request: built.request, startedAt: new Date().toISOString(), finishedAt: null, entries: [], ...(savedQuestionList ? { questionList: { id: savedQuestionList.id, name: savedQuestionList.name } } : {}) };
    setRunning(true); setResult(snapshot);
    try {
      const entries = await evaluateSequentially({
        states: built.states, expectedAnswers: built.expectedAnswers, signal: abort.signal,
        onUpdate: entries => setResult({ ...snapshot, entries }),
        evaluate: async (state, signal) => {
          const response = await fetch('/api/evaluate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: snapshot.provider, request: { ...snapshot.request, state }, longContext: snapshot.longContext }), signal });
          const data = await response.json();
          return { ...data, ok: response.ok && data.ok === true, status: response.status };
        },
      });
      setResult({ ...snapshot, entries, finishedAt: new Date().toISOString() });
    } finally { setRunning(false); }
  }
  function reset() { if (preparingImages) return; setImages([]); setSingleLabels(withQuestionLabels({}, defaultQuestions, defaultExamples[0].expectedAnswers)); setState('{\n  "text": "The customer requests a refund for a duplicate payment."\n}'); setStateFormat('json'); setStateMode('single'); setBatchStyle('fields'); setBatchArray(''); setBatchItems(exampleBatch()); setQuestions(initialQuestions.map(q => ({ ...q, key: crypto.randomUUID() }))); setAssets(''); setLongContext(false); setResult(null); }
  function imageQuestions() {
    setQuestions(editorsFromQuestions(imageExampleQuestions).map(q => ({ ...q, key: crypto.randomUUID() })));
  }
  async function loadImageExample(kind) {
    setPreparingImages(true);
    try {
      const response = await fetch(kind === 'red-circle' ? redCircleUrl : blueSquareUrl);
      if (!response.ok) throw new Error('Could not load the example image.');
      const file = new File([await response.blob()], `${kind}.png`, { type: 'image/png' });
      const image = await readImage(file);
      setImages([image]); setAssets(''); imageQuestions();
      setState('Inspect the attached picture.'); setStateFormat('text'); setStateMode('single');
      setSingleLabels(withQuestionLabels({}, imageExampleQuestions, imageExampleLabels[kind]));
    } finally { setPreparingImages(false); }
  }
  function loadExampleTexts(values, sourceQuestions) {
    if (!sameQuestions(sourceQuestions, labelQuestions)) throw new Error('Reload the selected question list before loading its examples; the question definitions have changed.');
    const items = datasetItems(values).map(item => ({ text: item.text, expectedAnswers: normalizeExpectedAnswers(item.expectedAnswers, sourceQuestions) }));
    setBatchTexts(items.map(item => ({ ...item, id: crypto.randomUUID() })));
    setBatchArray(pretty(datasetValues(items))); setBatchStyle('array'); setStateMode('batch');
  }
  return <><header className="topbar"><a className="brand" href="/"><span className="brand-mark"><Layers3 size={21} /></span>jev<span className="brand-slash">/</span><span className="brand-light">test</span><span className="local-badge">LOCAL PLAYGROUND</span></a><a className="docs-link" href="https://docs.typesafe.ai/api/system-one" target="_blank" rel="noreferrer">Documentation <ArrowUpRight size={15} /></a></header>
    <main><div className="page-heading"><div><div className="eyebrow"><span /> SYSTEM ONE · TYPESAFE</div><h1>Small questions. Clear decisions.</h1><p>Give Jev your context, define your questions, and inspect every answer.</p></div><span className="version-tag"><Zap size={14} /> JEV 1.14</span></div>
    <div className="workspace"><div className="editor-column"><section className="panel connection"><div className="section-heading"><span className="step">01</span><h2>Connection</h2><span className="heading-note">Your inference route</span></div><div className="connection-fields"><label>Provider<select value={provider} disabled={running} onChange={e => { setProvider(e.target.value); setModel(providers.find(p => p.id === e.target.value)?.model || 'typesafe/jev-1.14'); }}>{(providers.length ? providers : [{ id: 'gapgpt', name: 'GapGPT' }]).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Model<input value={model} onChange={e => setModel(e.target.value)} spellCheck="false" /></label></div><div className={`key-status ${keyStatus}`} role="status" aria-live="polite"><div className="key-status-heading">{keyStatus === 'checking' ? <LoaderCircle className="spin" size={16} /> : keyStatus === 'loaded' ? <Check size={16} /> : <span className="status-dot" />}<strong>{keyStatus === 'checking' ? 'Checking API key…' : keyStatus === 'loaded' ? 'API key loaded' : keyStatus === 'missing' ? 'API key not loaded' : 'API key status unavailable'}</strong><button disabled={configLoading} onClick={() => loadConfig()} aria-label="Refresh API key status"><RotateCcw size={13} /> Recheck</button></div><p>{keyStatus === 'checking' ? 'Reading the selected provider’s server configuration.' : keyStatus === 'unknown' ? configError || 'Provider configuration is unavailable.' : keyStatus === 'loaded' ? `${keyVariable} is available on the server. The key stays hidden.` : `Set ${keyVariable} in .env and restart the server, then recheck.`}</p></div><div className="connection-status"><span className="endpoint">{selected?.endpoint.replace('https://', '') || 'api.gapgpt.app/v1/systemone'}</span></div></section>
    <StateEditor questions={labelQuestions} expectedAnswers={expectedAnswers} setExpectedAnswers={setExpectedAnswers} mode={stateMode} setMode={setStateMode} state={state} setState={setState} format={stateFormat} setFormat={setStateFormat} texts={batchTexts} setTexts={setBatchTexts} running={running} listStyle={batchStyle} setListStyle={setBatchStyle} arrayText={batchArray} setArrayText={setBatchArray}><ImageUpload images={images} setImages={setImages} running={running} busy={preparingImages} setBusy={setPreparingImages} batch={stateMode === 'batch'} onExample={imageQuestions} onLoadExample={loadImageExample} /></StateEditor>
    <section className="panel questions-panel"><div className="section-heading"><span className="step">03</span><h2>Questions <span className="count">{questions.length}</span></h2><button className="text-button" onClick={() => setQuestions([...questions, { key: crypto.randomUUID(), id: `question_${questions.length + 1}`, type: 'noul', instructions: '', format: 'text', criteria: '' }])}><Plus size={15} /> Add question</button></div><p className="section-description">One focused decision per question. All evaluated together.</p><QuestionLibrary questions={questions} onLoad={setQuestions} onSelectionChange={setSavedQuestionList} running={running} onLoadTexts={loadExampleTexts} /><div className="question-list">{questions.map((q, index) => <Question key={q.key} q={q} index={index} update={patch => setQuestions(all => all.map(item => item.key === q.key ? { ...item, ...patch } : item))} remove={() => setQuestions(all => all.filter(item => item.key !== q.key))} />)}</div></section>
    <details className="panel advanced"><summary>Advanced settings <ChevronDown size={16} /></summary><label className="checkbox"><input type="checkbox" checked={longContext} onChange={e => setLongContext(e.target.checked)} /> Experimental long context</label><label htmlFor="assets">Image assets <span className="label-note">optional · JSON object</span></label><textarea id="assets" className="code" rows={4} value={assets} onChange={e => setAssets(e.target.value)} placeholder={'{"photo": {"type": "image", "format": "png", "data_base64": "…"}}'} /><p className="field-hint">Reference an asset key in your state or instructions. Images and Box enable the experimental images header. Gateway support may vary.</p></details>
    </div><RunOutput run={result} setRun={setResult} built={built} running={running} onRun={run} onCancel={() => controller.current?.abort()} onReset={reset} keyLoaded={keyStatus === 'loaded'} savedList={savedQuestionList} stale={stale} AnswerComponent={Answer} /></div><footer className="page-footer"><span>Jev Test <span>·</span> A space to experiment.</span><span>React + TypeSafe System One</span></footer></main></>;
}
