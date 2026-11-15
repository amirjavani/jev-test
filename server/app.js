import express from 'express';
import { validateRequest } from '../shared/validation.js';
import { registerQuestionLists } from './question-lists.js';
import { normalizeUsage } from '../shared/usage.js';

export function createApp({ env = process.env, fetchImpl = fetch, storageDir, commonDir } = {}) {
  const app = express();
  const providers = {
    gapgpt: { name: 'GapGPT', url: 'https://api.gapgpt.app/v1/systemone', key: env.GAPGPT_API_KEY, model: 'typesafe/jev-1.14' },
    typesafe: { name: 'TypeSafe', url: 'https://api.typesafe.ai/v1/systemone', key: env.TYPESAFE_API_KEY, model: 'jev-1.14.0' },
  };
  app.use(express.json({ limit: '32mb' }));
  registerQuestionLists(app, storageDir, commonDir);
  app.get('/api/config', (_req, res) => res.json({ providers: Object.entries(providers).map(([id, p]) => ({ id, name: p.name, endpoint: p.url, model: p.model, configured: Boolean(p.key?.trim()) })) }));
  app.post('/api/evaluate', async (req, res) => {
    const { provider, request, longContext = false } = req.body ?? {};
    if (!Object.hasOwn(providers, provider ?? '')) return res.status(400).json({ error: 'Select a supported provider.' });
    const config = providers[provider];
    try { validateRequest(request); } catch (e) { return res.status(400).json({ error: e.message }); }
    if (!config.key?.trim()) return res.status(503).json({ error: `Set ${provider === 'gapgpt' ? 'GAPGPT_API_KEY' : 'TYPESAFE_API_KEY'} in .env and restart the server.` });
    const headers = { Authorization: `Bearer ${config.key.trim()}`, 'Content-Type': 'application/json' };
    if (request.assets || Object.values(request.questions).some(q => q.type === 'box')) headers['TypeSafe-Danger-Zone-Images'] = 'true';
    if (longContext) headers['TypeSafe-Danger-Zone-Long-Context'] = 'true';
    const start = performance.now();
    try {
      const response = await fetchImpl(config.url, { method: 'POST', headers, body: JSON.stringify(request), signal: AbortSignal.timeout(120_000) });
      const raw = await response.text();
      let data;
      try { data = JSON.parse(raw); } catch { data = { message: raw.slice(0, 4000) }; }
      // Redact the credential even if an upstream error unexpectedly echoes it.
      let safeData = JSON.parse(JSON.stringify(data).split(config.key.trim()).join('[REDACTED]'));
      const usage = normalizeUsage(safeData?.usage);
      // Moderation questions return independent booleans rather than diagnostic fields.
      const decisions = Object.entries(request.questions);
      let noulProbabilities;
      if (response.ok && decisions.every(([name, question]) => (name === 'allowed' || name.endsWith('_allowed')) && question.type === 'noul')) {
        const results = [];
        for (const [name] of decisions) {
          const probability = safeData?.answers?.[name]?.noul;
          if (typeof probability !== 'number' || !Number.isFinite(probability) || probability < 0 || probability > 1) {
            return res.status(502).json({ error: `The provider did not return a valid allowed probability for ${name}. Try again.`, ...(usage ? { usage } : {}) });
          }
          results.push([name, probability >= 0.5]);
        }
        noulProbabilities = Object.fromEntries(decisions.map(([name]) => [name, safeData.answers[name].noul]));
        safeData = Object.fromEntries(results);
      }
      res.status(response.ok ? 200 : response.status).json({ ok: response.ok, status: response.status, durationMs: Math.round(performance.now() - start), data: safeData, ...(noulProbabilities ? { noulProbabilities } : {}), ...(usage ? { usage } : {}) });
    } catch (e) {
      res.status(e.name === 'TimeoutError' ? 504 : 502).json({ error: e.name === 'TimeoutError' ? 'The provider timed out after 120 seconds.' : 'Could not reach the provider. Check your network and try again.' });
    }
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
  app.use((err, _req, res, next) => {
    if (!err) return next();
    res.status(err.status === 413 ? 413 : 400).json({ error: err.status === 413 ? 'Request exceeds 32 MB.' : 'Invalid JSON request.' });
  });
  return app;
}
