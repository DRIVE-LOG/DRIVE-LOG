import test from 'node:test';
import assert from 'node:assert/strict';
import { processRawLog } from '../functions/processor.js';
function fixture(raw) {
  const records = new Map([['raw/doc1', raw]]); let writes = 0;
  const snapshot = { ref: 'raw/doc1', data: () => raw };
  const db = {
    collection: name => ({ doc: id => `${name}/${id}` }),
    async runTransaction(action) {
      const staged = new Map();
      await action({ get: async ref => ({ exists: records.has(ref), data: () => records.get(ref) }), set: (ref, data) => staged.set(ref, data), update: (ref, data) => staged.set(ref, { ...records.get(ref), ...data }) });
      for (const [key, value] of staged) { records.set(key, value); writes++; }
    },
  };
  return { records, get writes() { return writes; }, args: { db, snapshot, docId: 'doc1', Timestamp: { fromDate: date => date.toISOString() }, serverTimestamp: () => 'server-time' } };
}
test('valid raw record creates canonical parsed record and marks processed atomically', async () => {
  const testCase = fixture({ ownerUid: 'owner', log: '[2025-07-05 08:00:00 | u | INFO | Accel=-2 m/s²', status: 'pending', fileName: 'drive.txt', lineNumber: 3 });
  await processRawLog(testCase.args);
  const parsed = testCase.records.get('telematics_logs/doc1');
  assert.equal(parsed.Accel, -2); assert.equal(parsed.ownerUid, 'owner'); assert.equal(parsed.timestamp, '2025-07-04T23:00:00.000Z'); assert.equal(parsed.sourceId, 'doc1');
  assert.equal(testCase.records.get('raw/doc1').status, 'processed');
});
test('duplicate function delivery does not create or overwrite another record', async () => {
  const testCase = fixture({ ownerUid: 'owner', log: '[2025-07-05 08:00:00 | u | INFO | Speed=2 km/h', status: 'pending' });
  await processRawLog(testCase.args); await processRawLog(testCase.args);
  assert.equal(testCase.records.size, 2); assert.equal(testCase.writes, 2);
});
test('malformed log is retained and marked rejected, never silently lost', async () => {
  const testCase = fixture({ ownerUid: 'owner', log: 'broken raw text', status: 'pending' });
  await processRawLog(testCase.args);
  assert.equal(testCase.records.size, 1); assert.equal(testCase.records.get('raw/doc1').status, 'rejected');
  assert.equal(testCase.records.get('raw/doc1').log, 'broken raw text'); assert.ok(testCase.records.get('raw/doc1').parseError);
});
test('missing owner is rejected and absent events are safe', async () => {
  const testCase = fixture({ log: '[2025-07-05 08:00:00 | u | INFO | Speed=1 km/h', status: 'pending' });
  await processRawLog(testCase.args); assert.equal(testCase.records.get('raw/doc1').status, 'rejected');
  assert.deepEqual(await processRawLog({ snapshot: null }), { skipped: true });
});
test('transaction failures propagate so event infrastructure can retry', async () => {
  const testCase = fixture({ ownerUid: 'owner', log: '[2025-07-05 08:00:00 | u | INFO | Speed=1 km/h', status: 'pending' });
  testCase.args.db.runTransaction = async () => { throw new Error('unavailable'); };
  await assert.rejects(processRawLog(testCase.args), /unavailable/); assert.equal(testCase.records.get('raw/doc1').status, 'pending');
});
