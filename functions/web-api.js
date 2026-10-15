import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { createApiApp } from './lib/http-app.js';
const externalEnabled = process.env.EXTERNAL_APIS_ENABLED === 'true';
const secrets = externalEnabled
  ? ['KAKAO_MOBILITY_REST_API_KEY', 'OPENWEATHER_API_KEY'].map((name) =>
      defineSecret(name),
    )
  : [];
const app = createApiApp();
app.get('/api/app-config', (_request, response) => {
  try {
    const {
      apiKey,
      authDomain,
      projectId,
      appId,
      storageBucket,
      messagingSenderId,
    } = JSON.parse(process.env.WEB_FIREBASE_CONFIG || '{}');
    if (!apiKey || !projectId) throw new Error('Missing configuration');
    response
      .set('Cache-Control', 'no-store')
      .json({
        useEmulators: false,
        firebaseConfig: {
          apiKey,
          authDomain,
          projectId,
          appId,
          storageBucket,
          messagingSenderId,
        },
      });
  } catch {
    response.status(503).json({ error: 'Firebase 웹 설정이 필요합니다.' });
  }
});
export const webApi = onRequest(
  { region: 'asia-northeast3', maxInstances: 5, secrets },
  app,
);
