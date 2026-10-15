import { ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { getFirebase, friendlyError } from '../services/firebase.js';
import { useSession } from './session.js';
import { speak } from '../services/speech.js';
export const useChat = defineStore('chat', () => {
  const session = useSession(),
    messages = ref([]),
    draft = ref(''),
    busy = ref(false),
    error = ref(''),
    retry = ref(null),
    voice = ref(true),
    driverId = ref(''),
    loading = ref(true);
  let initialized = false,
    stop,
    version = 0;
  function init() {
    if (initialized) return;
    initialized = true;
    watch(
      () => [session.user?.uid, session.member],
      async ([uid, allowed]) => {
        const epoch = ++version;
        stop?.();
        messages.value = [];
        draft.value = '';
        busy.value = false;
        error.value = '';
        retry.value = null;
        driverId.value = '';
        loading.value = true;
        globalThis.speechSynthesis?.cancel();
        if (!uid || !allowed) {
          loading.value = false;
          return;
        }
        const { db } = await getFirebase();
        if (epoch !== version) return;
        stop = onSnapshot(
          query(collection(db, 'users', uid, 'messages'), orderBy('createdAt')),
          (snapshot) => {
            if (epoch !== version) return;
            const stored = snapshot.docs.map((doc) => ({
              ...doc.data(),
              id: doc.id,
              timestamp:
                doc.data().createdAt?.toDate().toISOString() ||
                new Date().toISOString(),
            }));
            const pending = messages.value.filter(
              (row) =>
                row.optimistic &&
                !stored.some(
                  (item) =>
                    item.requestId === row.requestId && item.role === row.role,
                ),
            );
            messages.value = [...stored, ...pending];
            loading.value = false;
          },
          (cause) => {
            if (epoch === version) {
              error.value = friendlyError(cause);
              loading.value = false;
            }
          },
        );
      },
      { immediate: true },
    );
  }
  async function send(previous) {
    if (busy.value || !session.member) return;
    const message = previous?.message || draft.value.trim();
    if (!message) return;
    const requestId = previous?.requestId || crypto.randomUUID(),
      selected = previous?.driverId ?? driverId.value,
      uid = session.user.uid,
      epoch = version;
    busy.value = true;
    error.value = '';
    retry.value = null;
    draft.value = '';
    if (!previous)
      messages.value.push({
        id: `${requestId}-user`,
        role: 'user',
        content: message,
        requestId,
        timestamp: new Date().toISOString(),
        optimistic: true,
      });
    try {
      const result = await (
        await getFirebase()
      ).call('chat', { message, requestId, driverId: selected });
      if (epoch !== version || uid !== session.user?.uid) return;
      if (voice.value) speak(result.answer);
    } catch (cause) {
      if (epoch !== version) return;
      error.value = friendlyError(cause);
      retry.value = { message, requestId, driverId: selected };
    } finally {
      if (epoch === version) busy.value = false;
    }
  }
  return {
    messages,
    draft,
    busy,
    error,
    retry,
    voice,
    driverId,
    loading,
    init,
    send,
  };
});
