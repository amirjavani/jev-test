import { useRef, useState } from 'react';
import { Braces, Download, Plus, Trash2, Upload } from 'lucide-react';
import { MAX_TEXT_FILE_BYTES, datasetValues, parseDatasetArray, parseDatasetList } from '../shared/text-files.js';
import { normalizeExpectedAnswers } from '../shared/expected-answers.js';
import ExpectedAnswers from './ExpectedAnswers.jsx';
import { selectTextRange } from '../shared/text-range.js';
import { downloadJson } from './download-json.js';

export default function StateEditor({ range, setRange, mode, setMode, state, setState, format, setFormat, texts, setTexts, running, listStyle, setListStyle, arrayText, setArrayText, questions, expectedAnswers, setExpectedAnswers, children }) {
  const input = useRef(null);
  const runningRef = useRef(running);
  runningRef.current = running;
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  let arrayError = '';
  if (listStyle === 'array') { try { parseDatasetArray(arrayText); } catch (e) { arrayError = e.message; } }
  let selection;
  let rangeError = '';
  try { selection = selectTextRange(texts, range); } catch (e) { rangeError = e.message; }
  const sliderMax = Math.max(2, texts.length);
  const sliderFirst = Math.max(1, Math.min(texts.length || 1, Number(range.start) || 1));
  const sliderLast = Math.max(sliderFirst, Math.min(texts.length || 1, Number(range.end) || texts.length || 1));
  function switchStyle(next) {
    if (next === listStyle) return;
    setError(''); setMessage('');
    if (next === 'array') setArrayText(JSON.stringify(datasetValues(texts), null, 2));
    else {
      try { setTexts(parseDatasetArray(arrayText).map(item => ({ id: crypto.randomUUID(), ...item }))); }
      catch (e) { setError('Fix the JSON array before switching to text fields. Your draft is preserved.'); return; }
    }
    setListStyle(next);
  }
  function editArray(value) {
    setArrayText(value); setError(''); setMessage('');
    try { setTexts(parseDatasetArray(value).map(item => ({ id: crypto.randomUUID(), ...item }))); }
    catch { /* Keep the last valid list while the JSON draft is incomplete. */ }
  }
  async function importTexts(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(''); setMessage(''); setImporting(true);
    try {
      if (file.size > MAX_TEXT_FILE_BYTES) throw new Error('Choose a JSON file no larger than 5 MB.');
      const imported = parseDatasetList(await file.text());
      if (runningRef.current) throw new Error('Wait for the current run to finish before importing texts.');
      setTexts(imported.map(item => ({ id: crypto.randomUUID(), ...item })));
      setArrayText(JSON.stringify(datasetValues(imported), null, 2));
      setRange({ start: '', end: '' });
      setMode('batch');
      setMessage(`Imported ${imported.length} texts. Ready to run sequentially.`);
    } catch (e) { setError(e.message); } finally { setImporting(false); }
  }
  function exportDataset() {
    setError(''); setMessage('');
    try {
      if (!questions) throw new Error('Complete the questions before exporting a dataset.');
      const items = listStyle === 'array' ? parseDatasetArray(arrayText) : texts;
      if (!items.length || items.some(item => !item.text.trim())) throw new Error('Enter nonempty texts before exporting.');
      const labeled = items.map(item => ({ text: item.text, expectedAnswers: normalizeExpectedAnswers(item.expectedAnswers) }));
      const dataset = { version: 1, questions, texts: datasetValues(labeled) };
      if (new Blob([JSON.stringify(dataset, null, 2)]).size > MAX_TEXT_FILE_BYTES) throw new Error('Dataset exceeds the 5 MB import limit. Export fewer texts.');
      downloadJson(dataset, 'jev-dataset.json');
      setMessage('Exported texts and expected answers.');
    } catch (e) { setError(e.message); }
  }
  return <section className="panel state-panel">
    <div className="section-heading"><h2>State</h2><div className="segmented"><button disabled={running} className={mode === 'single' ? 'active' : ''} onClick={() => setMode('single')}>Single</button><button disabled={running} className={mode === 'batch' ? 'active' : ''} onClick={() => setMode('batch')}>Text list</button></div></div>
    {mode === 'batch' ? <>
      <p className="section-description">Each text is sent as its own state, one after another, with the same questions.</p>
      <fieldset className="text-range" disabled={running || importing} aria-describedby="text-range-hint">
        <legend>Test range</legend>
        <div className="dual-range" style={{ '--range-start': `${(sliderFirst - 1) / (sliderMax - 1) * 100}%`, '--range-end': `${(sliderLast - 1) / (sliderMax - 1) * 100}%` }}>
          <div className="dual-range-track"><div /></div>
          <input type="range" aria-label="Range start text" min="1" max={sliderMax} step="1" value={sliderFirst} disabled={texts.length < 2} onChange={e => setRange({ start: String(Math.min(Number(e.target.value), sliderLast)), end: String(sliderLast) })} />
          <input type="range" aria-label="Range end text" min="1" max={sliderMax} step="1" value={sliderLast} disabled={texts.length < 2} onChange={e => setRange({ start: String(sliderFirst), end: String(Math.max(Number(e.target.value), sliderFirst)) })} />
        </div>
        <div className="text-range-inputs">
          <label htmlFor="text-range-start">From<input id="text-range-start" type="number" min="1" max={texts.length} step="1" placeholder="1" value={range.start} aria-invalid={Boolean(rangeError)} onChange={e => setRange(current => ({ ...current, start: e.target.value }))} /></label>
          <label htmlFor="text-range-end">To<input id="text-range-end" type="number" min="1" max={texts.length} step="1" placeholder={String(texts.length)} value={range.end} aria-invalid={Boolean(rangeError)} onChange={e => setRange(current => ({ ...current, end: e.target.value }))} /></label>
          <button type="button" onClick={() => setRange({ start: '', end: '' })}>All texts</button>
        </div>
        <p id="text-range-hint" className={rangeError ? 'library-error' : 'field-hint'} role={rangeError ? 'alert' : 'status'}>{rangeError || `Testing texts ${selection.first}–${selection.last} · ${selection.items.length} of ${texts.length} texts. Both ends included. Leave blank for all texts.`}</p>
      </fieldset>
      <div className="batch-view-row"><span>List style</span><div className="segmented" role="group" aria-label="Text list style"><button aria-pressed={listStyle === 'fields'} disabled={running || importing} className={listStyle === 'fields' ? 'active' : ''} onClick={() => switchStyle('fields')}>Text fields</button><button aria-pressed={listStyle === 'array'} disabled={running || importing} className={listStyle === 'array' ? 'active' : ''} onClick={() => switchStyle('array')}>Array [ ]</button></div></div>
      <div className="text-import"><button disabled={running || importing} onClick={() => input.current.click()}><Upload size={14} />{importing ? 'Importing…' : 'Import texts JSON'}</button><button disabled={running || importing || Boolean(arrayError)} onClick={exportDataset}><Download size={14} />Export dataset JSON</button><input ref={input} type="file" accept=".json,application/json" aria-label="Import texts JSON file" hidden onChange={importTexts} /><p className="field-hint">Import replaces this list. Format: {`["First text", "Second text"]`} or {`{"texts": […]}`} · labeled objects may include expectedAnswers · up to 5 MB.</p>{error && <p className="library-error" role="alert">{error}</p>}{message && <p className="library-message" role="status">{message}</p>}</div>
      {listStyle === 'array' ? <><label htmlFor="state-text-array">Dataset as a JSON array · text + expected answers</label><textarea id="state-text-array" className="code state-array" disabled={running} value={arrayText} onChange={e => editArray(e.target.value)} rows={9} spellCheck="false" aria-invalid={Boolean(arrayError)} aria-describedby="state-array-hint" placeholder={'[{"text": "Example text", "expectedAnswers": {"allowed": true}}]'} /><p id="state-array-hint" className={arrayError ? 'library-error' : 'field-hint'} role={arrayError ? 'alert' : undefined}>{arrayError || 'Each item contains text and expectedAnswers keyed by question name. Use true, false, or "human" for yes/no labels. Plain strings can still be imported. Use \\n inside a string for line breaks.'}</p></> : <><div className="batch-texts">{texts.map((item, index) => <div className="batch-text" key={item.id}><div className="label-row"><label htmlFor={`batch-${item.id}`}>Text {index + 1}</label><button disabled={running || texts.length === 1} className="icon-button danger" aria-label={`Remove text ${index + 1}`} onClick={() => setTexts(all => all.filter(text => text.id !== item.id))}><Trash2 size={14} /></button></div><textarea id={`batch-${item.id}`} disabled={running} rows={3} value={item.text} onChange={e => setTexts(all => all.map(text => text.id === item.id ? { ...text, text: e.target.value } : text))} placeholder="Enter a text to evaluate…" /><ExpectedAnswers prefix={item.id} questions={questions} value={item.expectedAnswers} disabled={running} onChange={expectedAnswers => setTexts(all => all.map(text => text.id === item.id ? { ...text, expectedAnswers } : text))} /></div>)}</div>
      <button className="text-button batch-add" disabled={running || texts.length >= 500} onClick={() => setTexts(all => [...all, { id: crypto.randomUUID(), text: '' }])}><Plus size={14} />Add text</button></>}
      <p className="field-hint">{arrayError ? 'Invalid array draft' : `${texts.length} texts`} · one request per text · sent as {`{"text": "…"}`}. Up to 500 texts.</p>
    </> : <>
      <div className="state-format-row"><p className="section-description">The shared context for every question.</p><div className="segmented"><button className={format === 'text' ? 'active' : ''} onClick={() => { if (format === 'json') { try { const parsed = JSON.parse(state); setState(typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)); } catch { /* Preserve unfinished input. */ } } setFormat('text'); }}>Text</button><button className={format === 'json' ? 'active' : ''} onClick={() => { if (format === 'text') setState(JSON.stringify(state, null, 2)); setFormat('json'); }}>JSON</button></div></div>
      <textarea aria-label="State input" className={`state-input ${format === 'json' ? 'code' : ''}`} value={state} onChange={e => setState(e.target.value)} rows={5} spellCheck="false" /><div className="editor-footer"><span><Braces size={13} />{format === 'json' ? 'Structured context' : 'Plain text'}</span><span>{state.length.toLocaleString()} characters</span></div>
    </>}
    {mode === 'single' && <ExpectedAnswers prefix="single" questions={questions} value={expectedAnswers} onChange={setExpectedAnswers} disabled={running} />}
    {children}
  </section>;
}
