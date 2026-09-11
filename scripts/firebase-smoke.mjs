// Explicit live integration check: creates two anonymous test accounts and 11 raw test records.
// Tokens remain in memory. This command is deliberately separate from npm test.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { firebaseConfig } from '../dist/config.local.js';

const project = firebaseConfig.projectId;
const database = `projects/${project}/databases/(default)`;
const documents = `https://firestore.googleapis.com/v1/${database}/documents`;
async function request(url, token, method = 'GET', body) {
  const response = await fetch(url, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  return { status: response.status, data };
}
async function signup() {
  const result = await request(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`, null, 'POST', { returnSecureToken: true });
  assert.equal(result.status, 200, `Anonymous sign-in: ${result.data.error?.message}`);
  return { uid: result.data.localId, token: result.data.idToken };
}
const owner = await signup();
const other = await signup();
console.log('Anonymous authentication: PASS');
const lines = Array.from({ length: 10 }, (_, index) => `[2025-07-05 08:00:${String(index).padStart(2, '0')} | integration_test | INFO | Speed=${index === 0 ? '' : index + 1} km/h Accel=-2.7 m/s² Location=37.5,127.1`);
const batchId = `verification-${Date.now()}`;
const records = [...lines, 'invalid header for pipeline verification'].map((raw, index) => ({ raw, id: `${owner.uid}_${batchId}-${index + 1}` }));
const writes = records.map((record, index) => ({
  update: { name: `${database}/documents/raw_telematics_logs/${record.id}`, fields: {
    log: { stringValue: record.raw }, ownerUid: { stringValue: owner.uid }, fileName: { stringValue: 'firebase-integration-check.txt' }, lineNumber: { integerValue: String(index + 1) }, status: { stringValue: 'pending' },
  } }, updateTransforms: [{ fieldPath: 'uploadedAt', setToServerValue: 'REQUEST_TIME' }], currentDocument: { exists: false },
}));
const commit = await request(`${documents}:commit`, owner.token, 'POST', { writes });
assert.equal(commit.status, 200, `Raw upload: ${commit.data.error?.message}`);
console.log('11 raw records saved under owner-scoped rules: PASS');
let rawResults = [];
for (let attempt = 0; attempt < 36; attempt++) {
  rawResults = await Promise.all(records.map(record => request(`${documents}/raw_telematics_logs/${record.id}`, owner.token)));
  if (rawResults.every(result => ['processed', 'rejected'].includes(result.data.fields?.status?.stringValue))) break;
  if (attempt % 6 === 0) console.log(`Waiting for Functions: ${rawResults.filter(result => result.data.fields?.status?.stringValue !== 'pending').length}/11 finished`);
  await new Promise(resolve => setTimeout(resolve, 5000));
}
assert.equal(rawResults.filter(result => result.data.fields?.status?.stringValue === 'processed').length, 10, '10 valid rows must be processed');
assert.equal(rawResults.at(-1).data.fields?.status?.stringValue, 'rejected');
assert.ok(rawResults.at(-1).data.fields?.parseError?.stringValue);
const query = await request(`${documents}:runQuery`, owner.token, 'POST', { structuredQuery: {
  from: [{ collectionId: 'telematics_logs' }], where: { fieldFilter: { field: { fieldPath: 'ownerUid' }, op: 'EQUAL', value: { stringValue: owner.uid } } }, orderBy: [{ field: { fieldPath: 'timestamp' }, direction: 'DESCENDING' }],
} });
assert.equal(query.status, 200, `Indexed query: ${query.data.error?.message}`);
const parsed = query.data.filter(result => result.document).map(result => result.document);
assert.equal(parsed.length, 10);
const first = parsed.find(doc => doc.name.endsWith('/' + records[0].id)).fields;
assert.equal(first.Accel.doubleValue, -2.7); assert.equal(first.Speed.nullValue, null);
const collision = parsed.find(doc => doc.name.endsWith('/' + records[3].id)).fields;
assert.equal(collision.Location.mapValue.fields.longitude.doubleValue, 127.1);
console.log('Functions processing, rejection, signed values, coordinates and indexed query: PASS');
const target = `${documents}/telematics_logs/${records[0].id}`;
assert.equal((await request(target, other.token)).status, 403, 'Other user must not read parsed logs');
assert.equal((await request(`${documents}/raw_telematics_logs/${records[0].id}`, other.token)).status, 403, 'Other user must not read raw logs');
assert.equal((await request(target, null)).status, 403, 'Unauthenticated read must fail');
assert.equal((await request(target, owner.token, 'PATCH', { fields: { ownerUid: { stringValue: owner.uid } } })).status, 403, 'Client writes to processed records must fail');
console.log('Cross-user isolation, unauthenticated denial and parsed-write protection: PASS');
const result = { projectId: project, checkedAt: new Date().toISOString(), rawRecords: 11, processedRecords: 10, rejectedRecords: 1, anonymousAuth: 'passed', ownerIsolation: 'passed', anonymousReadDenied: 'passed', directParsedWriteDenied: 'passed', indexedQuery: 'passed', ownerUid: owner.uid, recordIds: records.map(record => record.id) };
await mkdir(new URL('../output/', import.meta.url), { recursive: true });
await writeFile(new URL('../output/firebase-smoke-result.json', import.meta.url), JSON.stringify(result, null, 2));
console.log('Firebase live integration: PASS');
