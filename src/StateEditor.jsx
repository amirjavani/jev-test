import { useRef, useState } from 'react';
import { Braces, Plus, Trash2, Upload } from 'lucide-react';
import { MAX_TEXT_FILE_BYTES, parseTextArray, parseTextList } from '../shared/text-files.js';

export default function StateEditor({ mode, setMode, state, setState, format, setFormat, texts, setTexts, running, listStyle, setListStyle, arrayText, setArrayText, children }) {
  const input = useRef(null);
  const runningRef = useRef(running);
  runningRef.current = running;
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  let arrayError = '';
  if (listStyle === 'array') { try { parseTextArray(arrayText); } catch (e) { arrayError = e.message; } }
  function switchStyle(next) {
    if (next === listStyle) return;
    setError(''); setMessage('');
    if (next === 'array') setArrayText(JSON.stringify(texts.map(item => item.text), null, 2));
    else {
      try { setTexts(parseTextArray(arrayText).map((text, index) => ({ id: texts[index]?.id || crypto.randomUUID(), text }))); }
      catch (e) { setError('Fix the JSON array before switching to text fields. Your draft is preserved.'); return; }
    }
    setListStyle(next);
  }
  function editArray(value) {
    setArrayText(value); setError(''); setMessage('');
    try { setTexts(parseTextArray(value).map((text, index) => ({ id: texts[index]?.id || crypto.randomUUID(), text }))); }
    catch { /* Keep the last valid list while the JSON draft is incomplete. */ }
  }
  async function importTexts(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(''); setMessage(''); setImporting(true);
    try {
      if (file.size > MAX_TEXT_FILE_BYTES) throw new Error('Choose a JSON file no larger than 5 MB.');
      const imported = parseTextList(await file.text());
      if (runningRef.current) throw new Error('Wait for the current run to finish before importing texts.');
      setTexts(imported.map(text => ({ id: crypto.randomUUID(), text })));
      setArrayText(JSON.stringify(imported, null, 2));
      setMode('batch');
      setMessage(`Imported ${imported.length} texts. Ready to run sequentially.`);
    } catch (e) { setError(e.message); } finally { setImporting(false); }
  }
  return <section className="panel state-panel">
    <div className="section-heading"><span className="step">02</span><h2>State</h2><div className="segmented"><button disabled={running} className={mode === 'single' ? 'active' : ''} onClick={() => setMode('single')}>Single</button><button disabled={running} className={mode === 'batch' ? 'active' : ''} onClick={() => setMode('batch')}>Text list</button></div></div>
    {mode === 'batch' ? <>
      <p className="section-description">Each text is sent as its own state, one after another, with the same questions.</p>
      <div className="batch-view-row"><span>List style</span><div className="segmented" role="group" aria-label="Text list style"><button aria-pressed={listStyle === 'fields'} disabled={running || importing} className={listStyle === 'fields' ? 'active' : ''} onClick={() => switchStyle('fields')}>Text fields</button><button aria-pressed={listStyle === 'array'} disabled={running || importing} className={listStyle === 'array' ? 'active' : ''} onClick={() => switchStyle('array')}>Array [ ]</button></div></div>
      <div className="text-import"><button disabled={running || importing} onClick={() => input.current.click()}><Upload size={14} />{importing ? 'Importing…' : 'Import texts JSON'}</button><input ref={input} type="file" accept=".json,application/json" aria-label="Import texts JSON file" hidden onChange={importTexts} /><p className="field-hint">Import replaces this list. Format: {`["First text", "Second text"]`} or {`{"texts": […]}`} · up to 5 MB.</p>{error && <p className="library-error" role="alert">{error}</p>}{message && <p className="library-message" role="status">{message}</p>}</div>
      {listStyle === 'array' ? <><label htmlFor="state-text-array">Texts as a JSON array</label><textarea id="state-text-array" className="code state-array" disabled={running} value={arrayText} onChange={e => editArray(e.target.value)} rows={9} spellCheck="false" aria-invalid={Boolean(arrayError)} aria-describedby="state-array-hint" placeholder={'["Text one", "Text two"]'} /><p id="state-array-hint" className={arrayError ? 'library-error' : 'field-hint'} role={arrayError ? 'alert' : undefined}>{arrayError || 'Edit the same texts as an array of quoted strings. Use \\n inside a string for line breaks.'}</p></> : <><div className="batch-texts">{texts.map((item, index) => <div className="batch-text" key={item.id}><div className="label-row"><label htmlFor={`batch-${item.id}`}>Text {index + 1}</label><button disabled={running || texts.length === 1} className="icon-button danger" aria-label={`Remove text ${index + 1}`} onClick={() => setTexts(all => all.filter(text => text.id !== item.id))}><Trash2 size={14} /></button></div><textarea id={`batch-${item.id}`} disabled={running} rows={3} value={item.text} onChange={e => setTexts(all => all.map(text => text.id === item.id ? { ...text, text: e.target.value } : text))} placeholder="Enter a text to evaluate…" /></div>)}</div>
      <button className="text-button batch-add" disabled={running || texts.length >= 500} onClick={() => setTexts(all => [...all, { id: crypto.randomUUID(), text: '' }])}><Plus size={14} />Add text</button></>}
      <p className="field-hint">{arrayError ? 'Invalid array draft' : `${texts.length} texts`} · one request per text · sent as {`{"text": "…"}`}. Up to 500 texts.</p>
    </> : <>
      <div className="state-format-row"><p className="section-description">The shared context for every question.</p><div className="segmented"><button className={format === 'text' ? 'active' : ''} onClick={() => { if (format === 'json') { try { const parsed = JSON.parse(state); setState(typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)); } catch { /* Preserve unfinished input. */ } } setFormat('text'); }}>Text</button><button className={format === 'json' ? 'active' : ''} onClick={() => { if (format === 'text') setState(JSON.stringify(state, null, 2)); setFormat('json'); }}>JSON</button></div></div>
      <textarea aria-label="State input" className={`state-input ${format === 'json' ? 'code' : ''}`} value={state} onChange={e => setState(e.target.value)} rows={5} spellCheck="false" /><div className="editor-footer"><span><Braces size={13} />{format === 'json' ? 'Structured context' : 'Plain text'}</span><span>{state.length.toLocaleString()} characters</span></div>
    </>}
    {children}
  </section>;
}
