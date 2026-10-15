import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInAnonymously,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import {
  getFunctions,
  connectFunctionsEmulator,
  httpsCallable,
} from 'firebase/functions';
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import {
  getStorage,
  connectStorageEmulator,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { createRequire } from 'node:module';
const require = createRequire(
  new URL('../../functions/package.json', import.meta.url),
);
const {
  initializeApp: adminApp,
  deleteApp: deleteAdmin,
} = require('firebase-admin/app');
const {
  getFirestore: adminDb,
  Timestamp,
  FieldValue,
} = require('firebase-admin/firestore');
const { getAuth: adminAuth } = require('firebase-admin/auth');
const { createHandlers } = await import('../../functions/api.js');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const projectId = 'demo-drive-log',
  stamp = Date.now(),
  apps = [];
const admin = adminApp({ projectId }, `test-${stamp}`),
  db = adminDb(admin),
  auth = adminAuth(admin);
let env, a, b, guest;
async function client(name, anonymous = false) {
  const app = initializeApp(
    {
      projectId,
      apiKey: 'demo-drive-log',
      storageBucket: `${projectId}.appspot.com`,
    },
    `${name}-${stamp}`,
  );
  apps.push(app);
  const au = getAuth(app);
  connectAuthEmulator(au, 'http://127.0.0.1:9099', { disableWarnings: true });
  const fs = getFirestore(app);
  connectFirestoreEmulator(fs, '127.0.0.1', 8080);
  const fn = getFunctions(app, 'asia-northeast3');
  connectFunctionsEmulator(fn, '127.0.0.1', 5001);
  const storage = getStorage(app);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  const email = `${name}-${stamp}@example.test`;
  const { user } = anonymous
    ? await signInAnonymously(au)
    : await createUserWithEmailAndPassword(au, email, 'Test-only-123!');
  return {
    user,
    email,
    auth: au,
    db: fs,
    storage,
    call: async (name, data = {}) => (await httpsCallable(fn, name)(data)).data,
  };
}
const request = (account, data = {}) => ({
  auth: {
    uid: account.user.uid,
    token: { firebase: { sign_in_provider: 'password' } },
  },
  data,
});
before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: await readFile('firestore.rules', 'utf8'),
    },
    storage: {
      host: '127.0.0.1',
      port: 9199,
      rules: await readFile('storage.rules', 'utf8'),
    },
  });
  [a, b, guest] = await Promise.all([
    client('member-a'),
    client('member-b'),
    client('guest', true),
  ]);
  await a.call('ensureProfile', { nickname: '검증회원 A' });
  await b.call('ensureProfile', { nickname: '검증회원 B' });
});
after(async () => {
  await env?.cleanup();
  await Promise.all(apps.map(deleteApp));
  await deleteAdmin(admin);
});
test('F407/414 profile creation, safe public directory and duplicate email', async () => {
  assert.equal(
    (await getDoc(doc(a.db, 'users', a.user.uid))).data().role,
    'user',
  );
  const publicProfile = (
    await getDoc(doc(guest.db, 'public_profiles', a.user.uid))
  ).data();
  assert.equal(publicProfile.nickname, '검증회원 A');
  assert.equal(publicProfile.email, undefined);
  assert.equal(
    (await guest.call('checkEmail', { email: a.email.toUpperCase() }))
      .available,
    false,
  );
  assert.equal(
    (await guest.call('checkEmail', { email: `unused-${stamp}@example.test` }))
      .available,
    true,
  );
});
test('F415 Google provider credential creates a member profile in the emulator', async () => {
  const google = await client('google', true);
  const encode = (data) =>
    Buffer.from(JSON.stringify(data)).toString('base64url');
  const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
    sub: `google-${stamp}`,
    email: `google-${stamp}@example.test`,
    email_verified: true,
    name: 'Google 검증 회원',
    iss: 'https://accounts.google.com',
    aud: projectId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.`;
  // Auth emulator accepts this synthetic token; this does not test real Google consent.
  const { user } = await signInWithCredential(
    google.auth,
    GoogleAuthProvider.credential(token),
  );
  assert.equal(user.providerData[0].providerId, 'google.com');
  assert.equal(user.isAnonymous, false);
  await google.call('ensureProfile');
  const profile = (await getDoc(doc(google.db, 'users', user.uid))).data();
  assert.equal(profile.role, 'user');
  assert.equal(profile.nickname, 'Google 검증 회원');
});
test('F402/403/408 rules block guests, impersonation and role escalation', async () => {
  await assert.rejects(
    guest.call('chat', { message: 'x', requestId: 'guest-12345' }),
    { code: 'functions/permission-denied' },
  );
  await assert.rejects(guest.call('saveProfile', { nickname: '탈취' }), {
    code: 'functions/permission-denied',
  });
  await assertFails(getDoc(doc(b.db, 'users', a.user.uid)));
  await assertFails(
    setDoc(doc(a.db, 'users', a.user.uid), { role: 'admin' }, { merge: true }),
  );
  await assertFails(
    setDoc(doc(a.db, 'users', a.user.uid, 'messages', 'fake'), {
      role: 'assistant',
      content: 'fake',
    }),
  );
  await assert.rejects(a.call('promoteUser', { uid: b.user.uid }), {
    code: 'functions/permission-denied',
  });
});
test('F409/413 real Storage upload and persistent profile change', async () => {
  await assertSucceeds(
    uploadBytes(
      ref(a.storage, `users/${a.user.uid}/test.png`),
      new Uint8Array([137, 80, 78, 71]),
      { contentType: 'image/png' },
    ),
  );
  await assertFails(
    uploadBytes(
      ref(b.storage, `users/${a.user.uid}/cross.png`),
      new Uint8Array([1]),
      { contentType: 'image/png' },
    ),
  );
  await assertFails(
    uploadBytes(
      ref(guest.storage, `users/${guest.user.uid}/guest.png`),
      new Uint8Array([1]),
      { contentType: 'image/png' },
    ),
  );
  await assertFails(
    uploadBytes(
      ref(a.storage, `users/${a.user.uid}/script.svg`),
      new Uint8Array([1]),
      { contentType: 'image/svg+xml' },
    ),
  );
  await a.call('saveProfile', { nickname: '변경된 회원', backgroundURL: '' });
  assert.equal(
    (await getDoc(doc(a.db, 'public_profiles', a.user.uid))).data().nickname,
    '변경된 회원',
  );
  await assert.rejects(
    a.call('saveProfile', {
      nickname: '변경된 회원',
      photoURL: `https://evil.test/users/${a.user.uid}/x`,
    }),
    { code: 'functions/invalid-argument' },
  );
  await assert.rejects(
    a.call('saveProfile', {
      nickname: '변경된 회원',
      photoURL: 'https://firebasestorage.googleapis.com/v0/b/test/o/%invalid',
    }),
    { code: 'functions/invalid-argument' },
  );
});
test('F201/202/203/204 trigger parses uploaded row and isolates owner', async () => {
  const id = `trigger-${stamp}`;
  await setDoc(doc(a.db, 'raw_telematics_logs', id), {
    ownerUid: a.user.uid,
    log: '[2026-10-15 09:00:00 | driver-a | WARNING | Speed=140 km/h EngTemp=115 °C Accel=-4 m/s² FuelEff=12 km/L]',
    fileName: 'test.log',
    lineNumber: 1,
    uploadedAt: serverTimestamp(),
    status: 'pending',
  });
  let parsed;
  for (let i = 0; i < 40; i++) {
    const ready = await db.doc(`telematics_logs/${id}`).get();
    if (ready.exists) {
      parsed = await getDoc(doc(a.db, 'telematics_logs', id));
      break;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(parsed?.exists(), 'Firestore create trigger produced parsed log');
  assert.equal(parsed.data().Speed, 140);
  assert.equal(parsed.data().ownerUid, a.user.uid);
  await assertFails(getDoc(doc(b.db, 'telematics_logs', id)));
  await assertFails(getDocs(collection(a.db, 'telematics_logs')));
  const own = await getDocs(
    query(
      collection(a.db, 'telematics_logs'),
      where('ownerUid', '==', a.user.uid),
    ),
  );
  assert.ok(own.docs.some((d) => d.id === id));
});
test('F410/411/412 server verifies admin and promotion persists', async () => {
  await db.doc(`users/${a.user.uid}`).update({ role: 'admin' });
  assert.ok((await getDocs(collection(a.db, 'users'))).size >= 2);
  await a.call('promoteUser', { uid: b.user.uid });
  assert.equal(
    (await db.doc(`users/${b.user.uid}`).get()).data().role,
    'admin',
  );
  await b.call('ensureProfile', { nickname: '재로그인' });
  assert.equal(
    (await db.doc(`users/${b.user.uid}`).get()).data().role,
    'admin',
  );
});
test('F409 password change requires current credentials and persists', async () => {
  await assert.rejects(
    reauthenticateWithCredential(
      b.user,
      EmailAuthProvider.credential(b.email, 'wrong'),
    ),
  );
  await reauthenticateWithCredential(
    b.user,
    EmailAuthProvider.credential(b.email, 'Test-only-123!'),
  );
  await updatePassword(b.user, 'Changed-test-123!');
  await assert.rejects(
    signInWithEmailAndPassword(b.auth, b.email, 'Test-only-123!'),
  );
  assert.equal(
    (await signInWithEmailAndPassword(b.auth, b.email, 'Changed-test-123!'))
      .user.uid,
    b.user.uid,
  );
});
test('F305/306/309/314 chat persistence, own-log context, retries and idempotency (GMS adapter stub)', async () => {
  await db.doc(`telematics_logs/foreign-${stamp}`).set({
    ownerUid: b.user.uid,
    timestamp: Timestamp.now(),
    user: 'foreign',
    Speed: 999,
  });
  let calls = 0;
  const handler = createHandlers({
    db,
    auth,
    Timestamp,
    serverTimestamp: () => FieldValue.serverTimestamp(),
    complete: async ({ messages }) => {
      calls++;
      const context = JSON.parse(messages[0].content.split('분석 데이터: ')[1]);
      assert.equal(context.total, 1);
      assert.equal(context.metrics.Speed.max, 140);
      return '테스트 어댑터 응답: 과속 1건';
    },
  });
  const input = request(a, {
    message: '주행 분석',
    requestId: `chat-${stamp}`,
  });
  assert.match((await handler.chat(input)).answer, /과속/);
  await handler.chat(input);
  assert.equal(calls, 1);
  const messages = await getDocs(
    collection(a.db, 'users', a.user.uid, 'messages'),
  );
  assert.equal(messages.size, 2);
  assert.deepEqual(messages.docs.map((d) => d.data().role).sort(), [
    'assistant',
    'user',
  ]);
  await assertFails(getDocs(collection(b.db, 'users', a.user.uid, 'messages')));
  await assert.rejects(
    handler.chat(request(a, { ...input.data, driverId: 'other' })),
    { code: 'invalid-argument' },
  );
  const failing = createHandlers({
    db,
    auth,
    Timestamp,
    serverTimestamp: () => FieldValue.serverTimestamp(),
    complete: async () => {
      throw new Error('GMS unavailable');
    },
  });
  const retry = request(a, {
    message: '다시 질문',
    requestId: `retry-${stamp}`,
  });
  await assert.rejects(failing.chat(retry), { code: 'unavailable' });
  assert.equal(
    (
      await db
        .doc(`users/${a.user.uid}/chat_requests/${retry.data.requestId}`)
        .get()
    ).data().status,
    'failed',
  );
  assert.equal(
    (await db.doc(`users/${a.user.uid}/private/chatLock`).get()).exists,
    false,
  );
  await handler.chat(retry);
  assert.equal(
    (await getDocs(collection(a.db, 'users', a.user.uid, 'messages'))).size,
    4,
  );
});
