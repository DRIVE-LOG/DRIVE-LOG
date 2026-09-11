import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createApp } from '../infotainment/server.js';

const root = fileURLToPath(new URL('../', import.meta.url));
export function createIntegratedApp(options) {
  const app = createApp(options);
  app.use('/logs', express.static(path.join(root, 'dist'), {
    dotfiles: 'deny', index: 'index.html',
    setHeaders(response) {
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('X-Content-Type-Options', 'nosniff');
    },
  }));
  return app;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.DRIVE_LOG_PORT || 4173);
  const server = createIntegratedApp().listen(port, '127.0.0.1', () => console.log(`Integrated app: http://127.0.0.1:${port}`));
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
}
