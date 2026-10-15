import { ref, computed, reactive, watch } from 'vue';
import { defineStore } from 'pinia';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocsFromServer,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirebase, friendlyError } from '../services/firebase.js';
import { useSession } from './session.js';
import { filterLogs, sortLogs } from '../../../functions/lib/query.js';
import {
  analyzeLogs,
  normalizeLog,
  DEFAULT_THRESHOLDS,
} from '../../../functions/lib/analytics.js';
import {
  uploadWithConcurrency,
  uploadDocumentId,
} from '../../../functions/lib/upload.js';
export const useLogs = defineStore('logs', () => {
  const session = useSession(),
    rows = ref([]),
    counts = ref({ pending: 0, rejected: 0 }),
    status = ref('연결 대기'),
    error = ref('');
  const filters = reactive({
    search: '',
    start: '',
    end: '',
    level: '',
    user: '',
  });
  const sort = ref({ key: null, direction: 'default' }),
    thresholds = reactive({ ...DEFAULT_THRESHOLDS });
  const filtered = computed(() => filterLogs(rows.value, filters));
  const sorted = computed(() => sortLogs(filtered.value, sort.value));
  const analysis = computed(() => analyzeLogs(filtered.value, thresholds));
  const users = computed(() =>
    [...new Set(rows.value.map((row) => row.user))].sort(),
  );
  let started = false,
    generation = 0,
    stopLogs,
    stopRaw;
  const reset = () =>
    Object.assign(filters, {
      search: '',
      start: '',
      end: '',
      level: '',
      user: '',
    });
  function init() {
    if (started) return;
    started = true;
    watch(() => session.user?.uid, subscribe, { immediate: true });
  }
  async function subscribe() {
    const version = ++generation,
      uid = session.user?.uid;
    stopLogs?.();
    stopRaw?.();
    rows.value = [];
    counts.value = { pending: 0, rejected: 0 };
    error.value = '';
    reset();
    if (!uid) {
      status.value = '로그인 대기';
      return;
    }
    status.value = '데이터 연결 중';
    try {
      const { db } = await getFirebase();
      if (version !== generation) return;
      const loaded = { logs: false, raw: false },
        failures = { logs: '', raw: '' };
      function report(key, cause) {
        if (version !== generation) return;
        loaded[key] = !cause;
        failures[key] = cause ? friendlyError(cause) : '';
        error.value = failures.logs || failures.raw;
        status.value = error.value
          ? '연결 오류'
          : Object.values(loaded).every(Boolean)
            ? '실시간 연결됨'
            : '데이터 연결 중';
      }
      stopLogs = onSnapshot(
        query(
          collection(db, 'telematics_logs'),
          where('ownerUid', '==', uid),
          orderBy('timestamp', 'desc'),
        ),
        (snapshot) => {
          if (version !== generation) return;
          rows.value = snapshot.docs
            .map((doc) => normalizeLog({ ...doc.data(), id: doc.id }))
            .filter((row) => row.timestamp);
          report('logs');
        },
        (cause) => report('logs', cause),
      );
      stopRaw = onSnapshot(
        query(
          collection(db, 'raw_telematics_logs'),
          where('ownerUid', '==', uid),
        ),
        (snapshot) => {
          if (version !== generation) return;
          counts.value = { pending: 0, rejected: 0 };
          for (const row of snapshot.docs) {
            const state = row.data().status;
            if (state === 'rejected') counts.value.rejected++;
            else if (state !== 'processed') counts.value.pending++;
          }
          report('raw');
        },
        (cause) => report('raw', cause),
      );
    } catch (cause) {
      if (version === generation) {
        error.value = friendlyError(cause);
        status.value = '연결 오류';
      }
    }
  }
  async function upload(records, onProgress) {
    const uid = session.user?.uid;
    if (!uid) throw new Error('연결 후 업로드해 주세요.');
    const { db, auth } = await getFirebase();
    const existing = await getDocsFromServer(
      query(
        collection(db, 'raw_telematics_logs'),
        where('ownerUid', '==', uid),
      ),
    );
    const previous = existing.docs.map((doc) => ({
      id: doc.id,
      raw: doc.data().log,
    }));
    return uploadWithConcurrency(
      records,
      (record) => {
        if (auth.currentUser?.uid !== uid)
          throw new Error('사용자가 변경되어 업로드를 중단했습니다.');
        const reference = doc(
          db,
          'raw_telematics_logs',
          uploadDocumentId(record, uid, previous),
        );
        return runTransaction(db, async (transaction) => {
          if ((await transaction.get(reference)).exists()) return;
          transaction.set(reference, {
            log: record.raw,
            ownerUid: uid,
            fileName: record.fileName,
            lineNumber: record.lineNumber,
            uploadedAt: serverTimestamp(),
            status: 'pending',
          });
        });
      },
      onProgress,
    );
  }
  return {
    rows,
    counts,
    status,
    error,
    filters,
    sort,
    thresholds,
    filtered,
    sorted,
    analysis,
    users,
    init,
    reset,
    subscribe,
    upload,
  };
});
