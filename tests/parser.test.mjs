import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLog, parseKstTimestamp } from '../functions/lib/parser.js';
import { filterLogs, summarize, kstDay } from '../functions/lib/query.js';
import { inspectUpload, identifyRecords, uploadDocumentId, uploadWithConcurrency } from '../functions/lib/upload.js';
// Small synthetic cases keep the tests independent of supplied coursework files.
const source = [
  '[2025-07-05 08:00:00 | user_ssafy | INFO | Speed=10 km/h Accel=-1 m/s²',
  '[2025-07-05 09:00:00 | user_ssafy | WARNING | Event=Collision Speed=0 km/h',
  '[2025-07-06 10:00:00 | user_driver | CRITICAL | Event=AirbagDeployed GForce=3G',
  '[2025-07-07 11:00:00 | user_driver | INFO | Speed= km/h',
].join('\n');
const inspected = inspectUpload(source);
const logs = inspected.records.map((record, index) => ({ ...record.log, id: String(index) }));
const line = message => `[2025-07-05 08:00:00 | user_test | INFO | ${message}`;

test('overlapping files reuse logs while identical repeated rows and partial retries remain distinct', async () => {
  const small = inspectUpload(source.split('\n').slice(0, 2).join('\n'));
  const full = await identifyRecords(inspected.records), subset = await identifyRecords(small.records);
  assert.equal(new Set([...full, ...subset].map(row => row.id)).size, 4);
  const [first, second] = await identifyRecords([{raw:'same',lineNumber:1},{raw:'same',lineNumber:2}]);
  assert.notEqual(first.id, second.id);
  const existing = [{raw:'same',id:'owner_file-old-1'}];
  assert.equal(uploadDocumentId(first, 'owner', existing), 'owner_file-old-1');
  assert.equal(uploadDocumentId(second, 'owner', existing), `owner_${second.id}`);
  assert.equal(uploadDocumentId(first, 'owner', [{raw:'same',id:`owner_${second.id}`}]), `owner_${first.id}`);
  const retry = await identifyRecords([{raw:'same',lineNumber:1}]);
  assert.equal(retry[0].id, first.id);
});

test('summary counts users, warning, critical and missing measurements', () => {
  assert.equal(inspected.total, 4); assert.equal(inspected.invalid, 0); assert.equal(inspected.quality, 1);
  assert.deepEqual(summarize(logs), { total: 4, users: 2, warning: 1, critical: 1, quality: 1 });
});
test('signed acceleration, text fields and both coordinates survive parsing', () => {
  const { log } = parseLog(line('Speed=0 km/h  Accel=-12.8 m/s²  Brake=ON  Event=Collision  Impact=High  Location=35.1796,129.0756'));
  assert.equal(log.Speed, 0); assert.equal(log.Accel, -12.8); assert.equal(log.Brake, 'ON'); assert.equal(log.Event, 'Collision'); assert.equal(log.Impact, 'High');
  assert.deepEqual(log.Location, { latitude: 35.1796, longitude: 129.0756 }); assert.equal(log.hasQualityIssue, false);
});
test('missing values are null, never silently zero; absent fields remain absent', () => {
  const { log } = parseLog(line('Speed= km/h  Accel= m/s²  GForce=G'));
  assert.deepEqual(log.missingFields, ['Speed', 'Accel', 'GForce']); assert.equal(log.Speed, null); assert.equal(Object.hasOwn(log, 'EngTemp'), false);
});
test('invalid units, impossible coordinates, negative speed and duplicate fields are flagged', () => {
  const { log } = parseLog(line('Speed=-2 km/h  Dist=12abc  Location=91,181  Brake=MAYBE  FuelEff=2 km/L  FuelEff=3 km/L'));
  assert.equal(log.Speed, null); assert.equal(log.Dist, null); assert.equal(log.Location, null); assert.equal(log.Brake, null); assert.equal(log.invalidFields.length, 5);
});
test('malformed headers, invalid calendar dates, levels and empty messages are rejected', () => {
  for (const bad of ['', null, 'hello', '[2025-02-30 00:00:00 | u | INFO | hi', '[2025-01-01 24:00:00 | u | INFO | hi', '[2025-01-01 00:00:00 | u | UNKNOWN | hi', '[2025-01-01 00:00:00 | u | INFO | ']) assert.equal(parseLog(bad).log, null);
});
test('KST timestamp conversion is strict and independent of machine timezone', () => {
  assert.equal(parseKstTimestamp('2025-07-05 08:00:00'), '2025-07-04T23:00:00.000Z');
  assert.equal(parseKstTimestamp('2024-02-29 00:00:00.12'), '2024-02-28T15:00:00.120Z');
  assert.equal(parseKstTimestamp('2025-02-29 00:00:00'), null);
  assert.equal(kstDay('2025-07-04T23:00:00Z'), '2025-07-05');
});
test('field separators, optional closing bracket and WARN alias are accepted', () => {
  const { log } = parseLog('[2025-07-05 08:00:00 | u | WARN | Speed=12 km/h Accel=-2 m/s2 Brake=OFF]');
  assert.equal(log.Speed, 12); assert.equal(log.Accel, -2); assert.equal(log.Brake, 'OFF'); assert.equal(log.log_level, 'WARNING');
});
test('prototype-like keys cannot overwrite structured fields', () => {
  const { log } = parseLog(line('constructor=bad  timestamp=bad  user=other  Speed=5 km/h'));
  assert.equal(log.user, 'user_test'); assert.equal(log.timestamp, '2025-07-04T23:00:00.000Z'); assert.equal(log.Speed, 5);
});
test('date filtering is inclusive in KST and sorted latest first', () => {
  const result = filterLogs(logs, { start: '2025-07-05', end: '2025-07-05' });
  assert.equal(result.length, 2); assert.ok(result.every(log => kstDay(log.timestamp) === '2025-07-05'));
  for (let index = 1; index < result.length; index++) assert.ok(new Date(result[index - 1].timestamp) >= new Date(result[index].timestamp));
  assert.equal(filterLogs(logs, { start: '2025-07-08', end: '2025-07-05' }).length, 0);
});
test('date, user, level and case-insensitive keyword filters combine', () => {
  const result = filterLogs(logs, { start: '2025-07-05', end: '2025-07-07', user: 'user_ssafy', level: 'WARNING', search: 'collision' });
  assert.ok(result.length > 0); assert.ok(result.every(log => log.user === 'user_ssafy' && log.log_level === 'WARNING' && log.Event === 'Collision'));
  assert.equal(filterLogs(logs, { search: 'not-in-this-data' }).length, 0); assert.equal(filterLogs(logs, { level: 'ERROR' }).length, 0);
});
test('upload preserves original line numbers, invalid raw rows and handles BOM/CRLF', () => {
  const result = inspectUpload(`\uFEFF${line('Speed=1 km/h')}\r\n\r\nbroken\r\n`);
  assert.equal(result.total, 2); assert.equal(result.invalid, 1); assert.equal(result.records[1].lineNumber, 3); assert.equal(result.records[1].raw, 'broken');
  assert.throws(() => inspectUpload('  '), /로그가 없습니다/); assert.throws(() => inspectUpload('a\0b'), /텍스트/);
  assert.throws(() => inspectUpload('a\n'.repeat(10001)), /10,000행/); assert.throws(() => inspectUpload('a'.repeat(10001)), /10,000자/);
  const spaced = `  ${line('Speed=1 km/h')}  `;
  assert.equal(inspectUpload(spaced).records[0].raw, spaced);
  assert.equal(parseLog(spaced).log.raw, spaced);
});
test('concurrency is bounded, failures retained, progress ends honestly and retries only failed rows', async () => {
  const rows = Array.from({ length: 21 }, (_, id) => ({ id })); let inFlight = 0, maximum = 0; const progress = [];
  const result = await uploadWithConcurrency(rows, async row => {
    inFlight++; maximum = Math.max(maximum, inFlight); await new Promise(resolve => setTimeout(resolve, 2)); inFlight--;
    if (row.id % 5 === 0) throw new Error('write failed');
  }, status => progress.push(status), 3);
  assert.equal(maximum, 3); assert.equal(result.succeeded, 16); assert.equal(result.failures.length, 5);
  assert.deepEqual(progress.at(-1), { completed: 21, total: 21, succeeded: 16, failed: 5 });
  const retried = []; await uploadWithConcurrency(result.failures.map(item => item.record), async row => retried.push(row.id));
  assert.deepEqual(retried.sort((a,b) => a-b), [0,5,10,15,20]);
});
