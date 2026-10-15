import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import {
  getFunctions,
  connectFunctionsEmulator,
  httpsCallable,
} from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
let connection;
export async function getFirebase() {
  if (!connection)
    connection = (async () => {
      const response = await fetch('/api/app-config');
      if (!response.ok) throw new Error('서비스 설정을 불러오지 못했습니다.');
      const config = await response.json();
      const app = initializeApp(config.firebaseConfig, 'drive-log');
      const auth = getAuth(app),
        db = getFirestore(app),
        functions = getFunctions(app, 'asia-northeast3'),
        storage = getStorage(app);
      if (config.useEmulators) {
        connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
          disableWarnings: true,
        });
        connectFirestoreEmulator(db, '127.0.0.1', 8080);
        connectFunctionsEmulator(functions, '127.0.0.1', 5001);
        connectStorageEmulator(storage, '127.0.0.1', 9199);
      }
      return {
        app,
        auth,
        db,
        functions,
        storage,
        local: config.useEmulators,
        call: async (name, data) =>
          (await httpsCallable(functions, name, { timeout: 60000 })(data)).data,
      };
    })();
  try {
    return await connection;
  } catch (error) {
    connection = null;
    throw error;
  }
}
export function friendlyError(error) {
  const messages = {
    'auth/invalid-credential': '이메일 또는 비밀번호를 확인해 주세요.',
    'auth/wrong-password': '현재 비밀번호를 확인해 주세요.',
    'auth/email-already-in-use': '이미 가입된 이메일입니다.',
    'auth/weak-password': '비밀번호는 6자 이상으로 입력해 주세요.',
    'auth/invalid-email': '올바른 이메일 주소를 입력해 주세요.',
    'auth/too-many-requests': '요청이 많습니다. 잠시 후 다시 시도해 주세요.',
    'auth/popup-closed-by-user': 'Google 로그인이 취소되었습니다.',
    'auth/popup-blocked': '팝업을 허용한 뒤 다시 시도해 주세요.',
    'auth/operation-not-allowed':
      'Firebase에서 해당 로그인 방식을 활성화해 주세요.',
    'auth/network-request-failed':
      '인증 서버에 연결할 수 없습니다. 네트워크 또는 로컬 서버 실행 상태를 확인해 주세요.',
    'permission-denied': '이 데이터에 접근할 권한이 없습니다.',
    'storage/unauthorized': '이미지를 저장할 권한이 없습니다.',
    'auth/requires-recent-login': '보안을 위해 다시 로그인한 뒤 변경해 주세요.',
  };
  return (
    messages[error?.code] ||
    error?.message ||
    '요청을 처리하지 못했습니다. 다시 시도해 주세요.'
  );
}
