// This script is deliberately hard-wired to local demo emulators.
import { createRequire } from 'node:module';
const require = createRequire(
  new URL('../functions/package.json', import.meta.url),
);
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const app = initializeApp({ projectId: 'demo-drive-log' }),
  auth = getAuth(app),
  db = getFirestore(app);
try {
  for (const [uid, nickname, role] of [
    ['demo-member', '체험 운전자', 'user'],
    ['demo-admin', '체험 관리자', 'admin'],
  ]) {
    try {
      await auth.getUser(uid);
    } catch (e) {
      if (e.code !== 'auth/user-not-found') throw e;
      await auth.createUser({
        uid,
        email: `${uid}@example.test`,
        password: 'Drive-log-demo-123!',
        displayName: nickname,
      });
    }
    const profile = db.doc(`users/${uid}`);
    if (!(await profile.get()).exists) {
      await profile.set({
        uid,
        nickname,
        role,
        email: `${uid}@example.test`,
        photoURL: '',
        backgroundURL: '',
        createdAt: FieldValue.serverTimestamp(),
      });
      await db
        .doc(`public_profiles/${uid}`)
        .set({ uid, nickname, photoURL: '' });
    }
    for (let i = 0; i < 48; i++) {
      const ref = db.doc(`raw_telematics_logs/${uid}-sample-${i}`);
      if ((await ref.get()).exists) continue;
      const level = ['INFO', 'WARNING', 'ERROR', 'CRITICAL', 'DEBUG'][i % 5],
        day = 14 + (i % 2);
      await ref.set({
        ownerUid: uid,
        fileName: 'synthetic-demo.log',
        lineNumber: i + 1,
        uploadedAt: FieldValue.serverTimestamp(),
        status: 'pending',
        log: `[2026-10-${day} 09:00:${String(i).padStart(2, '0')} | driver-${i % 3} | ${level} | Speed=${50 + i * 2} km/h EngTemp=${90 + (i % 30)} °C Accel=${(i % 9) - 4} m/s² FuelEff=${12 + (i % 5)} km/L Dist=${i} km Event=합성데이터]`,
      });
    }
  }
  console.log(
    '로컬 체험 계정 준비 완료: demo-member@example.test / demo-admin@example.test',
  );
  console.log(
    '두 계정의 초기 비밀번호: Drive-log-demo-123! (에뮬레이터에서만 사용)',
  );
} finally {
  await deleteApp(app);
}
