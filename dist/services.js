import { uploadWithConcurrency, uploadDocumentId } from './lib/upload.js';
import axios from './vendor/axios.js';

let config;
try {
  const response = await axios.head('./config.local.js', { validateStatus: () => true, timeout: 10000 });
  config = response.status === 200 ? await import('./config.local.js') : await import('./config.js');
} catch { config = await import('./config.js'); }
export const hasFirebaseConfig = Boolean(config.firebaseConfig?.apiKey && config.firebaseConfig?.projectId && config.firebaseConfig?.appId);

export async function createFirebaseService(onChange, onStatus) {
  if (!hasFirebaseConfig) throw new Error('서비스 연결 설정을 확인해 주세요.');
  const version = '11.7.3';
  const [appSdk, authSdk, dbSdk] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-firestore.js`),
  ]);
  const app = appSdk.getApps().find(app => app.name === 'drive-log') || appSdk.initializeApp(config.firebaseConfig, 'drive-log');
  const auth = authSdk.getAuth(app);
  const db = dbSdk.getFirestore(app);
  if (config.useEmulators && !globalThis.__driveLogEmulatorsConnected) {
    authSdk.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    dbSdk.connectFirestoreEmulator(db, '127.0.0.1', 8080);
    globalThis.__driveLogEmulatorsConnected = true;
  }
  await auth.authStateReady();
  const user = auth.currentUser || (await authSdk.signInAnonymously(auth)).user;
  let logs = [], counts = { rejected: 0, pending: 0 }, active = true;
  const emit = () => { if (active) onChange(logs, counts); };
  const streamErrors = { logs: null, raw: null };
  function reportStream(stream, error = null) {
    if (!active) return;
    streamErrors[stream] = error;
    const failure = streamErrors.logs || streamErrors.raw;
    onStatus(failure ? friendlyError(failure) : '실시간 연결됨', Boolean(failure));
  }
  const unsubscribeLogs = dbSdk.onSnapshot(
    dbSdk.query(dbSdk.collection(db, 'telematics_logs'), dbSdk.where('ownerUid', '==', user.uid), dbSdk.orderBy('timestamp', 'desc')),
    snapshot => {
      logs = snapshot.docs.map(doc => { const data = doc.data(); return { ...data, id: doc.id, timestamp: data.timestamp.toDate().toISOString() }; });
      emit(); reportStream('logs');
    }, error => reportStream('logs', error),
  );
  const unsubscribeRaw = dbSdk.onSnapshot(
    dbSdk.query(dbSdk.collection(db, 'raw_telematics_logs'), dbSdk.where('ownerUid', '==', user.uid)),
    snapshot => { counts = { rejected: 0, pending: 0 }; for (const doc of snapshot.docs) { const status = doc.data().status; if (status === 'rejected') counts.rejected++; else if (status !== 'processed') counts.pending++; } emit(); reportStream('raw'); },
    error => reportStream('raw', error),
  );
  return {
    mode: 'firebase', persistent: true,
    async upload(records, onProgress) {
      const snapshot = await dbSdk.getDocsFromServer(dbSdk.query(dbSdk.collection(db, 'raw_telematics_logs'), dbSdk.where('ownerUid', '==', user.uid)));
      const existingRecords = snapshot.docs.map(doc => ({ id: doc.id, raw: doc.data().log }));
      return uploadWithConcurrency(records, async record => {
        const reference = dbSdk.doc(db, 'raw_telematics_logs', uploadDocumentId(record, user.uid, existingRecords));
        // A transaction lets retry safely acknowledge an already-created record after a lost response.
        await dbSdk.runTransaction(db, async transaction => {
          const existing = await transaction.get(reference);
          if (existing.exists()) return;
          transaction.set(reference, { log: record.raw, ownerUid: user.uid, fileName: record.fileName, lineNumber: record.lineNumber, uploadedAt: dbSdk.serverTimestamp(), status: 'pending' });
        });
      }, onProgress);
    },
    close() { active = false; unsubscribeLogs(); unsubscribeRaw(); },
  };
}
export function friendlyError(error) {
  const code = error?.code || '';
  if (code.includes('permission-denied')) return '로그에 접근할 수 없습니다. 다시 연결해 주세요.';
  if (code.includes('operation-not-allowed')) return '로그인 서비스를 사용할 수 없습니다. 관리자에게 문의해 주세요.';
  if (code.includes('failed-precondition')) return '조회 서비스가 준비되지 않았습니다. 잠시 후 다시 연결해 주세요.';
  if (code.includes('network')) return '네트워크 연결을 확인해 주세요.';
  return '데이터 연결 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
}
