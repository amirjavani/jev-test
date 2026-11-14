import { mkdir, readdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { normalizeList } from '../shared/question-lists.js';
import { normalizeRun, sameQuestions } from '../shared/runs.js';

const validId = id => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id);
export function registerQuestionLists(app, directory = fileURLToPath(new URL('../.local/question-lists/', import.meta.url)), commonDirectory = fileURLToPath(new URL('../common/question-lists/', import.meta.url))) {
  const readList = async (folder, id, scope) => {
    const raw = JSON.parse(await readFile(path.join(folder, `${id}.json`), 'utf8'));
    const exampleTexts = Array.isArray(raw.exampleTexts) && raw.exampleTexts.length <= 500 && raw.exampleTexts.every(text => typeof text === 'string' && text.trim()) ? raw.exampleTexts : undefined;
    return { ...normalizeList(raw), id, scope, updatedAt: raw.updatedAt, ...(exampleTexts ? { exampleTexts } : {}) };
  };
  const loadList = async id => {
    if (commonDirectory) {
      try { return await readList(commonDirectory, id, 'common'); }
      catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
    return readList(directory, id, 'local');
  };
  app.get('/api/question-lists/:id/runs', async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) return res.status(400).json({ error: 'Invalid saved list ID.' });
    try {
      await loadList(id);
      const folder = path.join(directory, `${id}.runs`);
      const files = await readdir(folder).catch(e => { if (e.code === 'ENOENT') return []; throw e; });
      const runs = await Promise.all(files.filter(file => file.endsWith('.json') && validId(file.slice(0, -5))).map(async file => {
        const run = JSON.parse(await readFile(path.join(folder, file), 'utf8'));
        return { id: file.slice(0, -5), startedAt: run.startedAt, count: run.entries.length, succeeded: run.entries.filter(entry => entry.status === 'success').length };
      }));
      res.json({ runs: runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt)) });
    } catch (e) { res.status(e.code === 'ENOENT' ? 404 : 500).json({ error: 'Could not read saved outputs for this question list.' }); }
  });
  app.get('/api/question-lists/:id/runs/:runId', async (req, res) => {
    const { id, runId } = req.params;
    if (!validId(id) || !validId(runId)) return res.status(400).json({ error: 'Invalid saved output ID.' });
    try { res.json(JSON.parse(await readFile(path.join(directory, `${id}.runs`, `${runId}.json`), 'utf8'))); }
    catch (e) { res.status(e.code === 'ENOENT' ? 404 : 500).json({ error: 'Could not read the saved output.' }); }
  });
  app.post('/api/question-lists/:id/runs', async (req, res) => {
    const { id } = req.params;
    if (!validId(id)) return res.status(400).json({ error: 'Invalid saved list ID.' });
    let run;
    try { run = normalizeRun(req.body); } catch (e) { return res.status(400).json({ error: e.message }); }
    let list;
    try { list = await loadList(id); } catch (e) { return res.status(e.code === 'ENOENT' ? 404 : 500).json({ error: 'Save or select a question list first.' }); }
    if (!sameQuestions(list.questions, run.request.questions)) return res.status(409).json({ error: 'These outputs use different questions. Select a matching saved question list or save the questions used by this run.' });
    const runId = randomUUID();
    const saved = { ...run, id: runId, questionList: { id, name: list.name, questions: run.request.questions }, savedAt: new Date().toISOString() };
    try {
      const folder = path.join(directory, `${id}.runs`);
      await mkdir(folder, { recursive: true });
      await writeFile(path.join(folder, `${runId}.json`), `${JSON.stringify(saved, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      res.json(saved);
    } catch { res.status(500).json({ error: 'Could not save outputs. Check folder permissions.' }); }
  });
  app.get('/api/question-lists', async (_req, res) => {
    try {
      await mkdir(directory, { recursive: true });
      const readLists = async (folder, scope) => {
        if (!folder) return [];
        const files = await readdir(folder).catch(e => { if (e.code === 'ENOENT') return []; throw e; });
        return Promise.all(files.filter(file => file.endsWith('.json') && validId(file.slice(0, -5))).map(file => readList(folder, file.slice(0, -5), scope).catch(() => null)));
      };
      const [common, local] = await Promise.all([readLists(commonDirectory, 'common'), readLists(directory, 'local')]);
      const commonIds = new Set(common.filter(Boolean).map(list => list.id));
      const lists = [...common, ...local.filter(list => list && !commonIds.has(list.id))].filter(Boolean);
      res.json({ lists: lists.sort((a, b) => a.name.localeCompare(b.name)) });
    } catch { res.status(500).json({ error: 'Could not read saved question lists.' }); }
  });
  app.post('/api/question-lists', async (req, res) => {
    let list;
    const id = req.body?.id ?? randomUUID();
    if (!validId(id)) return res.status(400).json({ error: 'Invalid saved list ID.' });
    try { list = normalizeList(req.body); } catch (e) { return res.status(400).json({ error: e.message }); }
    let existing;
    try { existing = await loadList(id); } catch (e) { if (e.code !== 'ENOENT') return res.status(500).json({ error: 'Could not read the existing question list.' }); }
    const scope = existing?.scope === 'common' ? 'common' : 'local';
    const targetDirectory = scope === 'common' ? commonDirectory : directory;
    const saved = { ...list, id, scope, updatedAt: new Date().toISOString(), ...(existing?.exampleTexts ? { exampleTexts: existing.exampleTexts } : {}) };
    const temporary = path.join(targetDirectory, `${id}.${randomUUID()}.tmp`);
    try {
      await mkdir(targetDirectory, { recursive: true });
      await writeFile(temporary, `${JSON.stringify(saved, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      await rename(temporary, path.join(targetDirectory, `${id}.json`));
      res.json(saved);
    } catch { res.status(500).json({ error: 'Could not save the question list. Check folder permissions.' }); }
    finally { await unlink(temporary).catch(() => {}); }
  });
}
