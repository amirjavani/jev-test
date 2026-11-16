import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download, FlaskConical, Layers3, LoaderCircle, Play, RotateCcw, Save } from 'lucide-react';
import { normalizeRun, sameQuestions } from '../shared/runs.js';
import { downloadJson } from './download-json.js';
import { responseUsage, summarizeUsage } from '../shared/usage.js';
import { evaluateDataset } from '../shared/evaluation.js';
import { AccuracySummary, AnswerComparisons } from './EvaluationResults.jsx';

const pretty = value => JSON.stringify(value, null, 2);
const tokenFields = [['input_tokens', 'Input'], ['output_tokens', 'Output'], ['total_tokens', 'Total']];
function TokenUsage({ usage, summary }) {
  return <section className={`token-usage ${summary ? 'run-token-usage' : ''}`} aria-label={summary ? 'Total run token usage' : 'Request token usage'}>
    <div className="token-usage-heading"><strong>{summary ? 'Total usage · this run' : 'Request token usage'}</strong>{summary && <span>{summary.finished} finished</span>}</div>
    <dl>{tokenFields.map(([field, label]) => <div key={field}><dt>{label}</dt><dd>{usage?.[field] == null ? '—' : usage[field].toLocaleString()}</dd>{summary && summary.reported[field] < summary.finished && <small>{summary.reported[field]}/{summary.finished} reported</small>}</div>)}</dl>
    {summary ? summary.partial && <p className="field-hint">Partial totals · unreported token counts are excluded.</p> : !usage && <p className="field-hint">Token usage unavailable for this request.</p>}
  </section>;
}
export default function RunOutput({ run, setRun, built, running, onRun, onCancel, onReset, keyLoaded, savedList, stale, AnswerComponent }) {
  const [tab, setTab] = useState('results');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([]);
  const [revision, setRevision] = useState(0);
  const [historyId, setHistoryId] = useState('');
  useEffect(() => { setTab('results'); setError(''); setMessage(''); }, [run?.startedAt]);
  useEffect(() => { setHistoryId(run?.id || ''); }, [run?.id]);
  useEffect(() => {
    setHistory([]); setHistoryId('');
    if (!savedList) return;
    const abort = new AbortController();
    fetch(`/api/question-lists/${savedList.id}/runs`, { signal: abort.signal }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error); setHistory(data.runs);
    }).catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => abort.abort();
  }, [savedList?.id, revision]);
  const entries = run?.entries || [];
  const onlyNoulQuestions = run && Object.values(run.request.questions).every(question => question.type === 'noul');
  const usageSummary = summarizeUsage(entries);
  const evaluation = useMemo(() => run ? evaluateDataset(run.entries, run.request.questions) : null, [run]);
  const complete = entries.filter(entry => ['success', 'error', 'cancelled', 'skipped'].includes(entry.status)).length;
  const hasResults = entries.some(entry => ['success', 'error'].includes(entry.status));
  const matches = savedList && run && sameQuestions(savedList.questions, run.request.questions);
  const requestPreview = built.request && (built.states.length === 1 ? built.request : built.states.map(state => ({ ...built.request, state })));
  const canApplyLabels = run?.finishedAt && !running && built.request && sameQuestions(run.request, built.request)
    && sameQuestions(entries.map(entry => entry.state), built.states)
    && !sameQuestions(entries.map(entry => entry.expectedAnswers || {}), built.expectedAnswers);
  function applyLabels() {
    const { id, savedAt, evaluation, ...snapshot } = run;
    setRun({ ...snapshot, entries: entries.map((entry, index) => ({ ...entry, expectedAnswers: structuredClone(built.expectedAnswers[index]) })) });
    setMessage('Applied current labels to existing answers. No API call was made.');
  }
  async function copy() {
    try { await navigator.clipboard.writeText(pretty(tab === 'request' ? requestPreview : entries)); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { setError('Clipboard unavailable. Select and copy the JSON manually.'); }
  }
  function exportOutputs() {
    setError(''); setMessage('');
    try {
      const output = normalizeRun(run);
      if (run.questionList) output.questionList = { id: run.questionList.id, name: run.questionList.name, questions: output.request.questions };
      if (run.id) output.id = run.id;
      if (run.savedAt) output.savedAt = run.savedAt;
      downloadJson(output, `jev-outputs-${new Date(run.startedAt).toISOString().replace(/[:.]/g, '-')}.json`);
      setMessage('Exported inputs and outputs as JSON.');
    } catch (e) { setError(e.message); }
  }
  async function save() {
    setError(''); setMessage(''); setSaving(true);
    try {
      const response = await fetch(`/api/question-lists/${savedList.id}/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(run) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setRun(data); setRevision(value => value + 1); setMessage(`Outputs saved for ${savedList.name}.`);
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  async function load(id) {
    setHistoryId(id); if (!id) return;
    setLoading(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/question-lists/${savedList.id}/runs/${id}`);
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setRun(data);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }
  return <aside className="output-column"><section className="panel output-panel">
    <div className="section-heading"><span className="output-icon"><FlaskConical size={17} /></span><h2>Output</h2><span className={`output-status ${run?.finishedAt ? 'success' : ''}`}>{running ? `${complete}/${entries.length} DONE` : run?.finishedAt ? 'FINISHED' : 'READY'}</span></div>
    <div className="output-history"><label htmlFor="saved-outputs">Saved outputs{savedList ? ` · ${savedList.name}` : ''}</label><select id="saved-outputs" value={historyId} disabled={!savedList || running || loading || saving} onChange={e => load(e.target.value)}><option value="">{loading ? 'Loading…' : savedList ? 'Choose a saved run' : 'Select a saved question list first'}</option>{history.map(item => <option key={item.id} value={item.id}>{new Date(item.startedAt).toLocaleString()} · {item.succeeded}/{item.count} succeeded</option>)}</select></div>
    {run && <TokenUsage usage={usageSummary.totals} summary={usageSummary} />}
    {evaluation && <AccuracySummary evaluation={evaluation} />}
    <div className="output-tabs">{[['results', 'Results'], ['raw', 'Raw JSON'], ['request', 'Request']].map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}<button aria-label="Copy JSON" title="Copy JSON" className="copy-button" disabled={tab === 'request' ? !requestPreview : !entries.length} onClick={copy}>{copied ? <Check size={15} /> : <Copy size={15} />}</button></div>
    <div className="output-body" aria-live="polite">
      {error && <div role="alert" className="error-message">{error}</div>}{message && <div className="library-message" role="status">{message}</div>}
      {stale && run && <div className="notice">Showing a previous run. Inputs or settings have changed.</div>}
      {run && <div className="run-context">{run.provider} · {run.request.model} · {run.questionList?.name || 'Current questions'}</div>}
      {tab === 'request' ? built.error ? <div className="notice">{built.error}</div> : <pre>{pretty(requestPreview)}</pre> : entries.length ? tab === 'raw' ? <pre>{pretty(entries)}</pre> : entries.map(entry => <details className={`batch-result ${entry.status}`} key={entry.index} open><summary><span>{run.mode === 'batch' ? 'Text' : 'Input'} {entry.index + 1}</span><span className="entry-status">{entry.status}</span></summary><div className="batch-result-body"><pre className="input-preview">{typeof entry.state === 'string' ? entry.state : pretty(entry.state)}</pre>
        {entry.status === 'running' && <p className="field-hint">Evaluating this input…</p>}{entry.status === 'pending' && <p className="field-hint">Waiting for the previous input.</p>}
        {entry.status === 'skipped' && <p className="field-hint">Skipped after cancellation.</p>}
        <AnswerComparisons evaluation={evaluation.entries.find(item => item.index === entry.index)} index={entry.index} />
        {(entry.error || entry.response?.error) && <div className="error-message">{entry.error || entry.response.error}</div>}
        {entry.response && <><div className="result-meta"><span>HTTP {entry.response.status}</span><span>{entry.response.durationMs ?? '—'} ms</span></div>{entry.response.ok && onlyNoulQuestions ? null : entry.response.ok && entry.response.data?.answers ? Object.entries(entry.response.data.answers).filter(([, answer]) => answer?.type !== 'noul').map(([name, answer]) => <AnswerComponent key={name} name={name} answer={answer} />) : entry.response.data && <pre>{pretty(entry.response.data)}</pre>}</>}
        {['success', 'error', 'cancelled'].includes(entry.status) && <TokenUsage usage={responseUsage(entry.response)} />}
      </div></details>) : <div className="empty-output"><div className="empty-illustration"><Layers3 size={30} /></div><h3>Your next decision starts here</h3><p>Test text, images, or a list of texts. Each response appears separately as it finishes.</p></div>}
    </div>
    <div className="run-area">{built.error && <p className="validation-message">{built.error}</p>}<button className="run-button" disabled={saving || loading || (!running && (!!built.error || !keyLoaded))} onClick={running ? onCancel : onRun}>{running ? <><LoaderCircle className="spin" size={17} />{run?.mode === 'batch' ? 'Cancel remaining texts' : 'Cancel evaluation'}</> : <><Play size={15} fill="currentColor" />Run {built.states?.length > 1 ? `${built.states.length} texts sequentially` : 'evaluation'}<span>→</span></>}</button>
      {canApplyLabels && <button className="save-outputs" disabled={saving || loading} onClick={applyLabels}><Check size={14} />Apply current labels · reuse answers</button>}
      <button className="save-outputs" disabled={!hasResults || !run?.finishedAt || !matches || running || saving || loading || Boolean(run?.id)} onClick={save}><Save size={14} />{saving ? 'Saving…' : run?.id ? 'Output saved' : 'Save outputs to question list'}</button>
      <button className="save-outputs" disabled={!hasResults || !run?.finishedAt || running || loading} onClick={exportOutputs}><Download size={14} />Export outputs JSON</button>
      <p className="field-hint">{!savedList ? 'Save or select a question list to store its outputs.' : run && !matches ? 'Select a saved list matching the questions used in this run.' : `Outputs will be saved locally under ${savedList.name}, excluded from Git.`}</p>
      <div className="run-footer"><span>{built.states?.length || 0} request{built.states?.length !== 1 ? 's' : ''} · same questions</span><button disabled={running || saving || loading} onClick={onReset}><RotateCcw size={12} />Reset example</button></div>
    </div>
  </section></aside>;
}
