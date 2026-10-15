import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { processRawLog } from './processor.js';
import { onCall } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { defineSecret } from 'firebase-functions/params';
import { createHandlers } from './api.js';
export { webApi } from './web-api.js';

initializeApp();
const db = getFirestore();
// Secret access is attached only after the lost key has been reissued and enabled.
const gmsEnabled = process.env.GMS_ENABLED === 'true';
const gmsKey = gmsEnabled ? defineSecret('GMS_API_KEY') : null;
const handlers = createHandlers({
  db,
  auth: getAuth(),
  Timestamp,
  serverTimestamp: () => FieldValue.serverTimestamp(),
  gms: () => ({
    apiKey: gmsEnabled ? gmsKey.value() : '',
    baseUrl: process.env.GMS_BASE_URL,
    model: process.env.GMS_MODEL,
  }),
});
const options = { region: 'asia-northeast3', maxInstances: 5 };
export const ensureProfile = onCall(options, handlers.ensureProfile);
export const checkEmail = onCall(options, handlers.checkEmail);
export const saveProfile = onCall(options, handlers.saveProfile);
export const promoteUser = onCall(options, handlers.promoteUser);
export const chat = onCall(
  { ...options, secrets: gmsEnabled ? [gmsKey] : [], timeoutSeconds: 60 },
  handlers.chat,
);
export const processRawLogs = onDocumentCreated(
  {
    document: 'raw_telematics_logs/{docId}',
    region: 'asia-northeast3',
    retry: false,
    maxInstances: 10,
  },
  (event) =>
    processRawLog({
      db,
      snapshot: event.data,
      docId: event.params.docId,
      Timestamp,
      serverTimestamp: () => FieldValue.serverTimestamp(),
    }),
);
