import { createRequire } from 'node:module';
import { cloudRequest } from './cloud-access.mjs';
const require = createRequire(
  new URL('../functions/package.json', import.meta.url),
);
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const args = process.argv.slice(2),
  option = (name) => args[args.indexOf(name) + 1];
const local = args.includes('--emulator');
const projectId = local
  ? 'demo-drive-log'
  : args.includes('--project')
    ? option('--project')
    : '';
if (!projectId || !args.includes('--email'))
  throw new Error(
    'Usage: node scripts/grant-admin.mjs --email EMAIL (--emulator | --project PROJECT_ID)',
  );
let credential;
if (local) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
} else {
  const cli = createRequire(import.meta.url)('firebase-tools/lib/auth.js');
  const account = cli.getGlobalDefaultAccount();
  if (!account) throw new Error('먼저 npx firebase login을 실행해 주세요.');
  credential = {
    getAccessToken: async () => {
      const token = await cli.getAccessToken(account.tokens.refresh_token, [
        'https://www.googleapis.com/auth/cloud-platform',
      ]);
      return { access_token: token.access_token, expires_in: 3600 };
    },
  };
}
const app = initializeApp({ projectId, ...(credential ? { credential } : {}) });
try {
  const account = await getAuth(app).getUserByEmail(option('--email'));
  if (!local) {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${account.uid}`;
    const profile = await cloudRequest(url);
    if (!['user', 'admin'].includes(profile.fields?.role?.stringValue))
      throw new Error('앱에서 먼저 일반 회원으로 가입해 주세요.');
    await cloudRequest(
      `${url}?updateMask.fieldPaths=role&updateMask.fieldPaths=updatedAt&currentDocument.updateTime=${encodeURIComponent(profile.updateTime)}`,
      {
        method: 'PATCH',
        body: {
          fields: {
            role: { stringValue: 'admin' },
            updatedAt: { timestampValue: new Date().toISOString() },
          },
        },
      },
    );
  } else {
    const reference = getFirestore(app).doc(`users/${account.uid}`);
    await getFirestore(app).runTransaction(async (tx) => {
      const profile = await tx.get(reference);
      if (!profile.exists || !['user', 'admin'].includes(profile.data().role))
        throw new Error('앱에서 먼저 일반 회원으로 가입해 주세요.');
      tx.update(reference, {
        role: 'admin',
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  }
  console.log(`관리자 설정 완료: ${projectId} / ${account.uid}`);
} finally {
  await deleteApp(app);
}
