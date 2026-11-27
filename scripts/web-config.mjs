import { access } from 'node:fs/promises';

// Docker/EC2 배포 시에는 환경 변수로 Firebase 웹 설정을 전달합니다.
const envKeys = {
  apiKey: 'FIREBASE_API_KEY',
  authDomain: 'FIREBASE_AUTH_DOMAIN',
  projectId: 'FIREBASE_PROJECT_ID',
  storageBucket: 'FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'FIREBASE_MESSAGING_SENDER_ID',
  appId: 'FIREBASE_APP_ID',
};

export function firebaseConfigFromEnv(environment = process.env) {
  const config = {};
  for (const [field, name] of Object.entries(envKeys)) {
    const value = environment[name]?.trim();
    if (value) config[field] = value;
  }
  return config.apiKey && config.projectId ? config : null;
}

export async function resolveWebConfig(environment = process.env) {
  if (environment.DRIVE_LOG_EMULATORS === '1')
    return {
      useEmulators: true,
      firebaseConfig: {
        apiKey: 'demo-drive-log',
        authDomain: 'demo-drive-log.firebaseapp.com',
        projectId: 'demo-drive-log',
        appId: '1:123:web:demo',
        storageBucket: 'demo-drive-log.appspot.com',
      },
    };
  const fromEnv = firebaseConfigFromEnv(environment);
  if (fromEnv) return { firebaseConfig: fromEnv, useEmulators: false };

  const file = new URL('../legacy/config.local.js', import.meta.url);
  try {
    await access(file);
  } catch {
    throw new Error(
      'FIREBASE_* 환경 변수 또는 legacy/config.local.js에 Firebase 설정을 입력하거나 npm run start:local로 실행하세요.',
    );
  }
  const { firebaseConfig, useEmulators = false } = await import(file.href);
  if (!firebaseConfig?.projectId || !firebaseConfig?.apiKey)
    throw new Error('Firebase 설정이 비어 있습니다.');
  return { firebaseConfig, useEmulators };
}
