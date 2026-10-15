import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createIntegratedApp } from '../scripts/serve.mjs';

test('Vue application, legacy sources, runtime config and private-file boundaries share one origin', async () => {
  const server = createIntegratedApp({ environment: { DRIVE_LOG_EMULATORS: '1' } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const home = await (await fetch(base)).text();
    assert.match(home, /id="app"/);
    assert.match(home, /assets\/index-.*\.js/);
    const legacy = await (await fetch(`${base}/legacy/`)).text();
    assert.match(legacy, /data-view-target="settings"/);
    const dashboard = await (await fetch(`${base}/legacy/logs/`)).text();
    assert.match(dashboard, /id="page-title">DashBoard/);
    assert.match(dashboard, /id="detail-next"/);
    for (const url of ['/legacy/app.js','/legacy/styles.css','/legacy/logs/app.js','/legacy/logs/services.js','/legacy/logs/style.css']) assert.equal((await fetch(base+url)).status, 200, url);
    for (const url of ['/logs/.env','/logs/.firebaserc','/logs/../package.json']) assert.equal((await fetch(base+url)).status, 404, url);
    const runtime = await (await fetch(`${base}/api/runtime-config`)).json();
    assert.equal(runtime.kakaoMapJavascriptKey, '');
    const config = await (await fetch(`${base}/api/app-config`)).json();
    assert.equal(config.useEmulators, true);
    assert.equal(config.firebaseConfig.projectId, 'demo-drive-log');
  } finally { server.close(); await once(server, 'close'); }
});
