import { HttpsError } from 'firebase-functions/v2/https';
import {
  isMember,
  isAdmin,
  normalizeEmail,
  validateNickname,
  validateChat,
} from './lib/policies.js';
import { buildMessages, requestGms } from './lib/ai.js';

export function createHandlers({
  db,
  auth,
  Timestamp,
  serverTimestamp,
  gms = () => ({}),
  complete = requestGms,
}) {
  const uidOf = (request) => {
    if (!request.auth?.uid)
      throw new HttpsError('unauthenticated', '로그인 후 이용해 주세요.');
    return request.auth.uid;
  };
  async function member(request, admin = false) {
    const uid = uidOf(request);
    if (request.auth.token.firebase?.sign_in_provider === 'anonymous')
      throw new HttpsError(
        'permission-denied',
        '기본 계정으로는 이 기능을 이용할 수 없습니다.',
      );
    const profile = (await db.doc(`users/${uid}`).get()).data();
    if (!isMember(profile) || (admin && !isAdmin(profile)))
      throw new HttpsError(
        'permission-denied',
        '이 기능을 사용할 권한이 없습니다.',
      );
    return { uid, profile };
  }
  function validate(fn, value) {
    try {
      return fn(value);
    } catch (error) {
      throw new HttpsError('invalid-argument', error.message);
    }
  }
  return {
    async ensureProfile(request) {
      const uid = uidOf(request);
      if (request.auth.token.firebase?.sign_in_provider === 'anonymous')
        return {
          uid,
          nickname: 'SSAFY',
          role: 'default',
          photoURL: '',
          backgroundURL: '',
        };
      const account = await auth.getUser(uid);
      const email = validate(normalizeEmail, account.email);
      const nickname = validate(
        validateNickname,
        request.data?.nickname ?? account.displayName ?? email.split('@')[0],
      );
      return db.runTransaction(async (tx) => {
        const ref = db.doc(`users/${uid}`),
          existing = await tx.get(ref);
        const profile = existing.exists
          ? existing.data()
          : {
              uid,
              nickname,
              email,
              role: 'user',
              photoURL: '',
              backgroundURL: '',
              createdAt: serverTimestamp(),
            };
        // Updating one's nickname never changes the stored role.
        if (request.data?.nickname) profile.nickname = nickname;
        profile.email = email;
        tx.set(ref, profile);
        tx.set(db.doc(`public_profiles/${uid}`), {
          uid,
          nickname: profile.nickname,
          photoURL: profile.photoURL,
        });
        return { uid, role: profile.role };
      });
    },
    async checkEmail(request) {
      uidOf(request);
      const email = validate(normalizeEmail, request.data?.email);
      const found = await db
        .collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();
      if (!found.empty) return { available: false };
      try {
        await auth.getUserByEmail(email);
        return { available: false };
      } catch (error) {
        if (error.code === 'auth/user-not-found') return { available: true };
        throw new HttpsError(
          'unavailable',
          '이메일 확인을 다시 시도해 주세요.',
        );
      }
    },
    async saveProfile(request) {
      const { uid } = await member(request);
      const nickname = validate(validateNickname, request.data?.nickname);
      const fields = { nickname };
      for (const key of ['photoURL', 'backgroundURL']) {
        const value = request.data?.[key];
        if (value === undefined) continue;
        // URLs must point at this user's Storage folder, never arbitrary schemes or other users.
        if (value !== '') {
          let url, objectPath;
          try {
            url = new URL(value);
            objectPath = decodeURIComponent(url.pathname.split('/o/')[1] || '');
          } catch {
            throw new HttpsError(
              'invalid-argument',
              '이미지 주소가 올바르지 않습니다.',
            );
          }
          const local =
            process.env.FUNCTIONS_EMULATOR === 'true' &&
            url.hostname === '127.0.0.1' &&
            url.port === '9199';
          if (
            (!local &&
              (url.protocol !== 'https:' ||
                url.hostname !== 'firebasestorage.googleapis.com')) ||
            !objectPath.startsWith(`users/${uid}/`)
          )
            throw new HttpsError(
              'invalid-argument',
              '본인이 업로드한 이미지만 사용할 수 있습니다.',
            );
        }
        fields[key] = value;
      }
      await db.runTransaction(async (tx) => {
        const ref = db.doc(`users/${uid}`),
          current = await tx.get(ref);
        if (!isMember(current.data()))
          throw new HttpsError(
            'permission-denied',
            '권한을 다시 확인해 주세요.',
          );
        tx.update(ref, { ...fields, updatedAt: serverTimestamp() });
        tx.set(db.doc(`public_profiles/${uid}`), {
          uid,
          nickname,
          photoURL: fields.photoURL ?? current.data().photoURL ?? '',
        });
      });
      return { saved: true };
    },
    async promoteUser(request) {
      const { uid } = await member(request, true);
      const targetUid = request.data?.uid;
      if (
        typeof targetUid !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,128}$/.test(targetUid)
      )
        throw new HttpsError('invalid-argument', '대상 회원을 선택해 주세요.');
      await db.runTransaction(async (tx) => {
        const actor = await tx.get(db.doc(`users/${uid}`));
        const target = await tx.get(db.doc(`users/${targetUid}`));
        if (!isAdmin(actor.data()))
          throw new HttpsError(
            'permission-denied',
            '관리자 권한이 필요합니다.',
          );
        if (!target.exists || !isMember(target.data()))
          throw new HttpsError('not-found', '등록된 회원이 아닙니다.');
        tx.update(target.ref, {
          role: 'admin',
          promotedBy: uid,
          updatedAt: serverTimestamp(),
        });
      });
      return { promoted: true };
    },
    async chat(request) {
      const { uid } = await member(request);
      const { message, requestId, driverId } = validate(
        validateChat,
        request.data,
      );
      const root = db.collection(`users/${uid}/messages`),
        operation = db.doc(`users/${uid}/chat_requests/${requestId}`),
        lock = db.doc(`users/${uid}/private/chatLock`);
      const cached = await db.runTransaction(async (tx) => {
        const previous = await tx.get(operation),
          currentLock = await tx.get(lock);
        if (
          previous.exists &&
          (previous.data().message !== message ||
            previous.data().driverId !== driverId)
        )
          throw new HttpsError(
            'invalid-argument',
            '같은 요청 ID로 메시지나 분석 대상을 변경할 수 없습니다.',
          );
        if (previous.data()?.status === 'complete')
          return previous.data().answer;
        if (currentLock.data()?.until?.toMillis() > Date.now())
          throw new HttpsError(
            'resource-exhausted',
            '이전 응답을 기다린 뒤 다시 전송해 주세요.',
          );
        tx.set(lock, {
          requestId,
          until: Timestamp.fromMillis(Date.now() + 60000),
        });
        tx.set(operation, {
          message,
          driverId,
          status: 'pending',
          updatedAt: serverTimestamp(),
        });
        if (!previous.exists)
          tx.set(root.doc(`${requestId}-user`), {
            role: 'user',
            content: message,
            requestId,
            createdAt: serverTimestamp(),
          });
        return null;
      });
      if (cached) return { answer: cached, requestId };
      try {
        const [logs, history] = await Promise.all([
          db
            .collection('telematics_logs')
            .where('ownerUid', '==', uid)
            .orderBy('timestamp', 'desc')
            .limit(5000)
            .get(),
          root.orderBy('createdAt', 'desc').limit(42).get(),
        ]);
        const rows = logs.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
        const messages = history.docs
          .map((doc) => doc.data())
          .filter((row) => row.requestId !== requestId)
          .reverse();
        const answer = await complete({
          ...gms(),
          messages: buildMessages(rows, messages, message, driverId),
        });
        const batch = db.batch();
        batch.set(root.doc(`${requestId}-assistant`), {
          role: 'assistant',
          content: answer,
          requestId,
          createdAt: serverTimestamp(),
        });
        batch.update(operation, {
          status: 'complete',
          answer,
          updatedAt: serverTimestamp(),
        });
        batch.delete(lock);
        await batch.commit();
        return { answer, requestId };
      } catch (error) {
        const batch = db.batch();
        batch.update(operation, {
          status: 'failed',
          updatedAt: serverTimestamp(),
        });
        batch.delete(lock);
        await batch.commit();
        throw new HttpsError(
          'unavailable',
          error.message?.includes('GMS') || error.message?.includes('AI')
            ? error.message
            : 'AI 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.',
        );
      }
    },
  };
}
