import { useEffect, useRef, useState } from 'react';
import { Download, Save, Upload } from 'lucide-react';
import { editorsFromQuestions, MAX_LIST_BYTES, normalizeList, questionsFromEditors } from '../shared/question-lists.js';

export default function QuestionLibrary({ questions, onLoad, onSelectionChange, onLoadTexts, running }) {
  const [lists, setLists] = useState([]);
  const [selected, setSelected] = useState('');
  const [name, setName] = useState('My questions');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileInput = useRef(null);
  const activeList = lists.find(list => list.id === selected);
  useEffect(() => { onSelectionChange(lists.find(list => list.id === selected) || null); }, [lists, selected, onSelectionChange]);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/question-lists', { signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then(data => setLists(data.lists))
      .catch(e => { if (e.name !== 'AbortError') setError('Could not load saved lists. Restart the server and refresh.'); });
    return () => controller.abort();
  }, []);
  function currentList() { return normalizeList({ version: 1, name, questions: questionsFromEditors(questions) }); }
  function load(list) { onLoad(editorsFromQuestions(list.questions).map(q => ({ ...q, key: crypto.randomUUID() }))); setName(list.name); setError(''); }
  async function save(asCopy = false) {
    setError(''); setMessage('');
    try {
      const list = currentList();
      setBusy(true);
      const response = await fetch('/api/question-lists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...list, ...(selected && asCopy !== true ? { id: selected } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save question list.');
      setLists(all => [...all.filter(item => item.id !== data.id), data].sort((a, b) => a.name.localeCompare(b.name)));
      setSelected(data.id); setMessage(data.scope === 'common' ? 'Shared changes saved. Available to everyone using this project.' : 'Saved in this project. Excluded from Git.');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  function exportFile() {
    setError(''); setMessage('');
    try {
      const list = currentList();
      const url = URL.createObjectURL(new Blob([`${JSON.stringify(list, null, 2)}\n`], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${list.name.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'questions'}.json`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Exported question list as JSON.');
    } catch (e) { setError(e.message); }
  }
  async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(''); setMessage(''); setBusy(true);
    try {
      if (file.size > MAX_LIST_BYTES) throw new Error('Choose a JSON file smaller than 1 MB.');
      let value;
      try { value = JSON.parse(await file.text()); } catch { throw new Error('This file is not valid JSON. Your questions have not changed.'); }
      const list = normalizeList(value);
      load(list); setSelected(''); setMessage('Imported questions. Save locally to keep them in this project.');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <div className="question-library">
    <div className="library-fields"><label htmlFor="saved-question-list">Question lists<select id="saved-question-list" value={selected} disabled={busy} onChange={e => {
      setSelected(e.target.value); setMessage(''); setError('');
      const list = lists.find(item => item.id === e.target.value);
      if (list) { load(list); setMessage(`Loaded ${list.name}.`); } else setName('My questions');
    }}><option value="">New local list</option>{[['common', 'Common · public & editable'], ['local', 'Local · ignored by Git']].map(([scope, label]) => <optgroup key={scope} label={label}>{lists.filter(list => (list.scope || 'local') === scope).map(list => <option key={list.id} value={list.id}>{list.name} ({Object.keys(list.questions).length})</option>)}</optgroup>)}</select></label>
    <label htmlFor="question-list-name">List name<input id="question-list-name" value={name} maxLength={100} disabled={busy} onChange={e => { setName(e.target.value); setMessage(''); }} /></label></div>
    <div className="library-actions"><button disabled={busy} onClick={() => save()}><Save size={13} />{busy ? 'Working…' : activeList?.scope === 'common' ? 'Save shared changes' : selected ? 'Save changes' : 'Save locally'}</button>{activeList?.scope === 'common' && <button disabled={busy} onClick={() => save(true)}>Save local copy</button>}<button disabled={busy} onClick={() => fileInput.current.click()}><Upload size={13} />Import JSON</button><button disabled={busy} onClick={exportFile}><Download size={13} />Export JSON</button><input ref={fileInput} aria-label="Import question list file" type="file" accept=".json,application/json" hidden onChange={importFile} /></div>
    {activeList?.scope === 'common' && <div className="common-list-note"><strong>Public & editable</strong><p>Shared with everyone using this project. Save shared changes to update the common list, or save a local copy for your own variant.</p>{activeList.exampleTexts?.length > 0 && <button disabled={running || busy} onClick={() => { onLoadTexts(activeList.exampleTexts); setMessage(`Loaded ${activeList.exampleTexts.length} example texts in State. Ready to test.`); }}>Load {activeList.exampleTexts.length} example texts</button>}</div>}
    <p className="field-hint">Choose a saved list to load it. Lists contain questions only; state stays as entered.</p>
    {message && <p className="library-message" role="status">{message}</p>}{error && <p className="library-error" role="alert">{error}</p>}
  </div>;
}
