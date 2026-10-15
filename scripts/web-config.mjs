import { access } from 'node:fs/promises';
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
  const file = new URL('../dist/config.local.js', import.meta.url);
  try {
    await access(file);
  } catch {
    throw new Error(
      'dist/config.local.js에 Firebase 설정을 입력하거나 npm run start:local로 실행하세요.',
    );
  }
  const { firebaseConfig, useEmulators = false } = await import(file.href);
  if (!firebaseConfig?.projectId || !firebaseConfig?.apiKey)
    throw new Error('Firebase 설정이 비어 있습니다.');
  return { firebaseConfig, useEmulators };
}
