import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApp } from './app.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const app = createApp();
if (process.argv.includes('--dev')) {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(root, 'dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(root, 'dist/index.html')));
}
const port = Number(process.env.PORT) || 3000;
app.listen(port, '127.0.0.1', () => console.log(`Jev Test is running at http://localhost:${port}`));
