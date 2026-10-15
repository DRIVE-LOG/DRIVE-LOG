// Explicit opt-in: creates an isolated synthetic account and removes only its own test data.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { resolveWebConfig } from './web-config.mjs';
import { credential, cleanSmoke } from './cloud-access.mjs';
if (!process.argv.includes('--run'))
  throw new Error('실제 Firebase 검증을 실행하려면 --run을 지정하세요.');
const { firebaseConfig } = await resolveWebConfig({});
const cli = createRequire(import.meta.url)('firebase-tools/lib/auth.js'),
  account = cli.getGlobalDefaultAccount();
if (!account) throw new Error('firebase login이 필요합니다.');
const require = createRequire(
  new URL('../functions/package.json', import.meta.url),
);
const {
  initializeApp: initializeAdmin,
  deleteApp: deleteAdmin,
} = require('firebase-admin/app');
const { getAuth: adminAuth } = require('firebase-admin/auth');
const admin = initializeAdmin(
  {
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
    credential,
  },
  'smoke-admin',
);
const app = initializeApp(firebaseConfig, 'cloud-smoke'),
  db = getFirestore(app),
  auth = getAuth(app),
  fn = getFunctions(app, 'asia-northeast3');
const call = async (name, data = {}) =>
  (await httpsCallable(fn, name)(data)).data;
const runId = `smoke-${randomUUID()}`,
  results = [];
let uid, stop, imagePath;
try {
  const user = await createUserWithEmailAndPassword(
    auth,
    `${runId}@example.test`,
    randomUUID() + 'Aa1!',
  );
  uid = user.user.uid;
  await call('ensureProfile', { nickname: '자동 검증 임시 계정' });
  assert.equal((await getDoc(doc(db, 'users', uid))).data().role, 'user');
  results.push('email signup + ensureProfile');
  assert.equal(
    (await call('checkEmail', { email: user.user.email })).available,
    false,
  );
  results.push('duplicate email');
  const parsed = new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('cloud trigger timeout')),
      90000,
    );
    stop = onSnapshot(
      doc(db, 'raw_telematics_logs', runId),
      (snapshot) => {
        if (snapshot.data()?.status === 'processed') {
          clearTimeout(timer);
          resolve();
        } else if (snapshot.data()?.status === 'rejected') {
          clearTimeout(timer);
          reject(new Error('cloud parse rejected'));
        }
      },
      reject,
    );
  });
  await setDoc(doc(db, 'raw_telematics_logs', runId), {
    ownerUid: uid,
    fileName: 'synthetic-cloud-smoke.log',
    lineNumber: 1,
    status: 'pending',
    uploadedAt: serverTimestamp(),
    log: '[2026-10-15 09:00:00 | smoke-driver | WARNING | Speed=136 km/h Accel=-4 m/s² EngTemp=112 °C FuelEff=13 km/L]',
  });
  await parsed;
  assert.equal(
    (await getDoc(doc(db, 'telematics_logs', runId))).data().Speed,
    136,
  );
  results.push(
    'raw upload + deployed trigger + realtime listener + parsed log',
  );
  imagePath = `users/${uid}/smoke.png`;
  const reference = ref(getStorage(app), imagePath);
  await uploadBytes(
    reference,
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG1EAAAAASUVORK5CYII=',
      'base64',
    ),
    { contentType: 'image/png' },
  );
  const photoURL = await getDownloadURL(reference);
  await call('saveProfile', { nickname: '검증 수정', photoURL });
  assert.equal(
    (await getDoc(doc(db, 'public_profiles', uid))).data().photoURL,
    photoURL,
  );
  results.push('Storage image upload + persistent profile');
  await assert.rejects(call('promoteUser', { uid }), {
    code: 'functions/permission-denied',
  });
  results.push('non-admin promotion denied');
  await promisify(execFile)(process.execPath, [
    'scripts/grant-admin.mjs',
    '--email',
    user.user.email,
    '--project',
    firebaseConfig.projectId,
  ]);
  assert.equal((await getDoc(doc(db, 'users', uid))).data().role, 'admin');
  results.push('owner CLI administrator bootstrap');
  await assert.rejects(
    call('chat', { message: '주행 검증', requestId: runId }),
    { code: 'functions/unavailable' },
  );
  assert.equal(
    (await getDoc(doc(db, 'users', uid, 'chat_requests', runId))).data().status,
    'failed',
  );
  results.push('missing GMS key reported + user message persisted');
  const webConfig = await fetch(
    `https://asia-northeast3-${firebaseConfig.projectId}.cloudfunctions.net/webApi/api/app-config`,
  );
  assert.equal(webConfig.status, 200);
  assert.equal(
    (await webConfig.json()).firebaseConfig.projectId,
    firebaseConfig.projectId,
  );
  results.push('deployed web API configuration');
  console.log(
    JSON.stringify(
      { status: 'PASS', project: firebaseConfig.projectId, checks: results },
      null,
      2,
    ),
  );
} finally {
  stop?.();
  if (uid) {
    await cleanSmoke(
      firebaseConfig.projectId,
      firebaseConfig.storageBucket,
      uid,
      runId,
    );
    await adminAuth(admin).deleteUser(uid);
    console.log('Synthetic test account and owned data removed.');
  }
  await deleteApp(app);
  await deleteAdmin(admin);
}
