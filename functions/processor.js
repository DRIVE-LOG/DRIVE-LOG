import { parseLog } from './lib/parser.js';

// Dependency injection keeps parsing, rejection and transaction semantics testable without credentials.
export async function processRawLog({ db, snapshot, docId, Timestamp, serverTimestamp }) {
  if (!snapshot) return { skipped: true };
  const raw = snapshot.data();
  const result = parseLog(raw.log);
  const output = db.collection('telematics_logs').doc(docId);
  await db.runTransaction(async transaction => {
    const current = await transaction.get(snapshot.ref);
    if (!current.exists || ['processed', 'rejected'].includes(current.data().status)) return;
    if (!result.log || !raw.ownerUid) {
      transaction.update(snapshot.ref, { status: 'rejected', parseError: result.error || 'ownerUid가 없습니다.', processedAt: serverTimestamp() });
      return;
    }
    const { timestamp, ...parsed } = result.log;
    transaction.set(output, {
      ...parsed, timestamp: Timestamp.fromDate(new Date(timestamp)), ownerUid: raw.ownerUid,
      sourceId: docId, fileName: raw.fileName || '', lineNumber: raw.lineNumber || 0, processedAt: serverTimestamp(),
    });
    transaction.update(snapshot.ref, { status: 'processed', processedAt: serverTimestamp() });
  });
  return { valid: Boolean(result.log) };
}
