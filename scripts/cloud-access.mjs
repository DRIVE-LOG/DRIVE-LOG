import { createRequire } from 'node:module';
const cli = createRequire(import.meta.url)('firebase-tools/lib/auth.js');
const account = cli.getGlobalDefaultAccount();
async function accessToken() {
  if (!account) throw new Error('먼저 npx firebase login을 실행해 주세요.');
  return (
    await cli.getAccessToken(account.tokens.refresh_token, [
      'https://www.googleapis.com/auth/cloud-platform',
    ])
  ).access_token;
}
export const credential = {
  getAccessToken: async () => ({
    access_token: await accessToken(),
    expires_in: 3600,
  }),
};
export async function cloudRequest(
  url,
  { method = 'GET', body, allowMissing = false } = {},
) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (allowMissing && response.status === 404) return null;
  if (!response.ok)
    throw new Error(
      `Cloud request failed: ${response.status} ${new URL(url).pathname}`,
    );
  return response.status === 204 ? null : response.json();
}
export async function cleanSmoke(project, bucket, uid, runId) {
  if (!/^smoke-[a-f0-9-]+$/.test(runId) || !uid)
    throw new Error('Invalid smoke test identity');
  const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/`;
  for (const path of [
    `users/${uid}/messages/${runId}-user`,
    `users/${uid}/messages/${runId}-assistant`,
    `users/${uid}/chat_requests/${runId}`,
    `users/${uid}/private/chatLock`,
    `users/${uid}`,
    `public_profiles/${uid}`,
    `raw_telematics_logs/${runId}`,
    `telematics_logs/${runId}`,
  ])
    await cloudRequest(base + path, { method: 'DELETE', allowMissing: true });
  await cloudRequest(
    `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(`users/${uid}/smoke.png`)}`,
    { method: 'DELETE', allowMissing: true },
  );
}
