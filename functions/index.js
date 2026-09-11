import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { processRawLog } from './processor.js';

initializeApp();
const db = getFirestore();
export const processRawLogs = onDocumentCreated(
  { document: 'raw_telematics_logs/{docId}', region: 'asia-northeast3', retry: false, maxInstances: 10 },
  event => processRawLog({ db, snapshot: event.data, docId: event.params.docId, Timestamp, serverTimestamp: () => FieldValue.serverTimestamp() }),
);
