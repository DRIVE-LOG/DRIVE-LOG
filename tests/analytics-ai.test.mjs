import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeLogs,
  chartSeries,
  normalizeLog,
} from '../functions/lib/analytics.js';
import {
  validateChat,
  validateImage,
  validateNickname,
  normalizeEmail,
  isAdmin,
  isMember,
} from '../functions/lib/policies.js';
import { buildMessages, requestGms } from '../functions/lib/ai.js';
const row = (id, values = {}) => ({
  id,
  timestamp: `2026-10-15T00:00:${String(id).padStart(2, '0')}Z`,
  user: 'driver-a',
  log_level: 'INFO',
  ...values,
});
test('analytics preserves missing values, zero and negative acceleration', () => {
  const report = analyzeLogs([
    row(1, { Speed: 0, Accel: -4 }),
    row(2, { Speed: 140, EngTemp: 115 }),
    row(3, { Speed: null, FuelEff: NaN }),
    { timestamp: null, Speed: 999 },
  ]);
  assert.equal(report.total, 3);
  assert.equal(report.metrics.Speed.mean, 70);
  assert.equal(report.metrics.FuelEff.mean, null);
  assert.deepEqual(
    report.anomalies.map((x) => x.label),
    ['급감속', '과속', '엔진 과열'],
  );
  assert.equal(
    normalizeLog(row(1, { Speed: '120', log_level: 'WARN' })).Speed,
    null,
  );
  assert.equal(
    normalizeLog(row(1, { log_level: 'WARN' })).log_level,
    'WARNING',
  );
});
test('threshold boundary and invalid settings do not manufacture anomalies', () => {
  assert.equal(
    analyzeLogs([row(1, { Speed: 120, Accel: -3, GForce: 2.5 })]).anomalies
      .length,
    0,
  );
  assert.equal(
    analyzeLogs([row(1, { Speed: 150 })], { Speed: NaN }).anomalies.length,
    0,
  );
});
test('chart sorts chronologically, preserves gaps and bounds plotted points', () => {
  assert.deepEqual(
    chartSeries([row(2), row(1, { Speed: 0 })], 'Speed').points.map(
      (p) => p.value,
    ),
    [0, null],
  );
  const data = Array.from({ length: 1000 }, (_, i) => ({
    ...row(1),
    timestamp: new Date(i * 1000),
    Speed: i,
  }));
  const chart = chartSeries(data, 'Speed');
  assert.ok(chart.points.length <= 300);
  assert.equal(chart.aggregated, true);
  assert.equal(chart.points[0].value, 1.5);
  assert.equal(analyzeLogs(data).metrics.Speed.max, 999);
});
test('member roles and payload validation reject bypasses', () => {
  assert.equal(isMember({ role: 'default' }), false);
  assert.equal(isAdmin({ role: 'user' }), false);
  assert.equal(isMember({ role: 'admin' }), true);
  assert.equal(validateNickname(' 운전자 '), '운전자');
  assert.equal(normalizeEmail('Driver@Example.com'), 'driver@example.com');
  for (const email of ['', 'x', 'x@ y.com'])
    assert.throws(() => normalizeEmail(email));
  assert.throws(() => validateNickname(' '.repeat(30)));
  assert.throws(() => validateImage({ type: 'image/svg+xml', size: 10 }));
  assert.throws(() =>
    validateImage({ type: 'image/png', size: 6 * 1024 * 1024 }),
  );
  assert.throws(() => validateChat({ message: 'x', requestId: '../../users' }));
  assert.deepEqual(
    validateChat({ message: ' 안녕 ', requestId: 'request-123' }),
    { message: '안녕', requestId: 'request-123', driverId: '' },
  );
});
test('AI context uses selected driver and measured values, bounds history', () => {
  const messages = buildMessages(
    [row(1, { Speed: 20 }), row(2, { user: 'driver-b', Speed: 200 })],
    Array.from({ length: 30 }, () => ({ role: 'user', content: '이전 질문' })),
    '분석',
    'driver-a',
  );
  assert.equal(messages.length, 22);
  assert.equal(messages.at(-1).content, '분석');
  const context = JSON.parse(messages[0].content.split('분석 데이터: ')[1]);
  assert.equal(context.total, 1);
  assert.equal(context.metrics.Speed.mean, 20);
  assert.equal(context.metrics.FuelEff.mean, null);
});
test('GMS client requires configuration and rejects external endpoints', async () => {
  await assert.rejects(requestGms({}), /GMS 연결 설정/);
  await assert.rejects(
    requestGms({
      apiKey: 'test',
      model: 'test',
      baseUrl: 'https://example.com',
    }),
    /GMS 프록시/,
  );
});
test('GMS request protocol and failures are handled without fabricated answers', async () => {
  const options = {
    apiKey: 'test',
    model: 'test-model',
    baseUrl: 'https://gms.ssafy.io/gmsapi/api.openai.com/v1',
    messages: [{ role: 'user', content: '테스트' }],
  };
  const answer = await requestGms({
    ...options,
    fetchImpl: async (url, init) => {
      assert.equal(url.pathname, '/gmsapi/api.openai.com/v1/chat/completions');
      assert.equal(init.headers.Authorization, 'Bearer test');
      assert.equal(JSON.parse(init.body).model, 'test-model');
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: ' 응답 ' } }] }),
      };
    },
  });
  assert.equal(answer, '응답');
  await assert.rejects(
    requestGms({
      ...options,
      fetchImpl: async () => ({ ok: false, status: 429 }),
    }),
    /한도/,
  );
  await assert.rejects(
    requestGms({
      ...options,
      fetchImpl: async () => ({ ok: true, json: async () => ({}) }),
    }),
    /비어/,
  );
});
