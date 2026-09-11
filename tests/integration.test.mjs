import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createIntegratedApp } from '../scripts/serve.mjs';

test('PJT1 shell and PJT2 dashboard are served on one origin with independent assets', async () => {
  const server = createIntegratedApp({ environment: {} }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const home = await (await fetch(base)).text();
    assert.match(home, /data-view-target="settings"/);
    assert.match(home, /data-src="\/logs\/\?embedded=1"/);
    assert.match(home, /aria-label="HOME"/);
    const dashboard = await (await fetch(`${base}/logs/`)).text();
    assert.match(dashboard, /id="page-title">DashBoard/);
    assert.match(dashboard, /id="detail-next"/);
    for (const url of ['/app.js','/styles.css','/logs/app.js','/logs/services.js','/logs/style.css']) assert.equal((await fetch(base+url)).status, 200, url);
    for (const url of ['/logs/.env','/logs/.firebaserc','/logs/../package.json']) assert.equal((await fetch(base+url)).status, 404, url);
    const runtime = await (await fetch(`${base}/api/runtime-config`)).json();
    assert.equal(runtime.kakaoMapJavascriptKey, '');
  } finally { server.close(); await once(server, 'close'); }
});
