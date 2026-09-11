import { parseLog } from './parser.js';
export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_LINES = 10000;
// Stable across overlapping files; identical repeated rows within a file remain separate.
export async function identifyRecords(records) {
  const occurrences = new Map(), hashes = new Map();
  for (const { raw } of records) {
    if (!hashes.has(raw)) hashes.set(raw, crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)).then(digest => [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')));
  }
  return Promise.all(records.map(async record => {
    const occurrence = (occurrences.get(record.raw) || 0) + 1;
    occurrences.set(record.raw, occurrence);
    return { ...record, occurrence, id: `line-${await hashes.get(record.raw)}-${occurrence}` };
  }));
}

// Reuse older file-based IDs without deleting or rewriting their source metadata.
export function uploadDocumentId(record, ownerUid, existingRecords) {
  const legacy = existingRecords.filter(row => row.raw === record.raw && !row.id.startsWith(`${ownerUid}_line-`)).sort((a, b) => a.id.localeCompare(b.id));
  return legacy[record.occurrence - 1]?.id || `${ownerUid}_${record.id}`;
}
export function inspectUpload(text) {
  if (typeof text !== 'string') throw new Error('텍스트 파일이 필요합니다.');
  if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('파일은 5 MB 이하여야 합니다.');
  if (text.includes('\0')) throw new Error('텍스트 파일만 업로드할 수 있습니다.');
  const rows = text.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/).map((raw, index) => ({ raw, lineNumber: index + 1 })).filter(row => row.raw.trim());
  if (!rows.length) throw new Error('파일에 로그가 없습니다.');
  if (rows.length > MAX_LINES) throw new Error('파일은 10,000행 이하여야 합니다.');
  if (rows.some(row => row.raw.length > 10000)) throw new Error('한 행은 10,000자를 넘을 수 없습니다.');
  const records = rows.map(row => ({ ...row, ...parseLog(row.raw) }));
  return { records, total: records.length, valid: records.filter(row => row.log).length, invalid: records.filter(row => !row.log).length, quality: records.filter(row => row.log?.hasQualityIssue).length };
}
// At most eight writes in flight. Keep stable record IDs across retries.
export async function uploadWithConcurrency(records, write, onProgress = () => {}, concurrency = 8) {
  const failures = [];
  let next = 0, succeeded = 0, completed = 0;
  async function worker() {
    while (next < records.length) {
      const record = records[next++];
      try { await write(record); succeeded++; } catch (error) { failures.push({ record, message: error?.message || String(error) }); }
      completed++;
      onProgress({ completed, total: records.length, succeeded, failed: failures.length });
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), records.length) }, worker));
  return { succeeded, failures };
}
