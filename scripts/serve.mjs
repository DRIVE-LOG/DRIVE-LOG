import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createApp } from '../infotainment/server.js';
import { resolveWebConfig } from './web-config.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
export function createIntegratedApp(options) {
  const app = createApp({ ...options, serveStatic: false });
  app.get('/api/app-config', async (_request, response) => {
    try {
      response
        .set('Cache-Control', 'no-store')
        .json(await resolveWebConfig(options?.environment));
    } catch {
      response.status(503).json({ error: 'Firebase 설정을 확인해 주세요.' });
    }
  });
  app.use(
    '/assets',
    express.static(path.join(root, 'infotainment/public/assets')),
  );
  app.get('/favicon.svg', (_request, response) =>
    response.sendFile(path.join(root, 'dist/favicon.svg')),
  );
  app.use('/legacy', express.static(path.join(root, 'infotainment/public')));
  app.use(
    '/legacy/logs',
    express.static(path.join(root, 'dist'), {
      dotfiles: 'deny',
      index: 'index.html',
      setHeaders(response) {
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('X-Content-Type-Options', 'nosniff');
      },
    }),
  );
  app.get(['/logs', '/logs/'], (_request, response) =>
    response.redirect('/#/logs'),
  );
  app.use(
    express.static(path.join(root, 'build/web'), {
      dotfiles: 'deny',
      setHeaders: (response) =>
        response.setHeader('X-Content-Type-Options', 'nosniff'),
    }),
  );
  return app;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.DRIVE_LOG_PORT || 4173);
  const server = createIntegratedApp().listen(port, '127.0.0.1', () =>
    console.log(`Integrated app: http://127.0.0.1:${port}`),
  );
  server.on('error', (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
