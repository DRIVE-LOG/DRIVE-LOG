import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  onAuthStateChanged,
  signInAnonymously,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  reauthenticateWithPopup,
} from 'firebase/auth';
import {
  onSnapshot,
  doc,
  collection,
  query,
  orderBy,
} from 'firebase/firestore';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { getFirebase, friendlyError } from '../services/firebase.js';
import { validateImage } from '../../../functions/lib/policies.js';
export const useSession = defineStore('session', () => {
  const user = ref(null),
    profile = ref(null),
    profiles = ref([]),
    ready = ref(false),
    error = ref(''),
    local = ref(false);
  const member = computed(() =>
    ['user', 'admin'].includes(profile.value?.role),
  );
  const admin = computed(() => profile.value?.role === 'admin');
  let started,
    unsubscribeAuth,
    unsubscribeProfile,
    unsubscribeDirectory,
    epoch = 0;
  async function init(retry = false) {
    if (retry) {
      unsubscribeAuth?.();
      unsubscribeProfile?.();
      unsubscribeDirectory?.();
      started = null;
    }
    if (started) return started;
    started = (async () => {
      try {
        const api = await getFirebase();
        local.value = api.local;
        unsubscribeAuth = onAuthStateChanged(api.auth, async (account) => {
          const version = ++epoch;
          unsubscribeProfile?.();
          unsubscribeDirectory?.();
          profile.value = null;
          profiles.value = [];
          user.value = account;
          ready.value = false;
          if (!account) {
            ready.value = true;
            return;
          }
          try {
            if (account.isAnonymous)
              profile.value = {
                uid: account.uid,
                nickname: 'SSAFY',
                role: 'default',
                photoURL: '',
                backgroundURL: '',
              };
            else {
              await api.call('ensureProfile', {});
              if (version !== epoch) return;
              unsubscribeProfile = onSnapshot(
                doc(api.db, 'users', account.uid),
                (snapshot) => {
                  if (version === epoch) {
                    profile.value = snapshot.data();
                    ready.value = true;
                  }
                },
                (cause) => {
                  if (version === epoch) {
                    fail(cause);
                    ready.value = true;
                  }
                },
              );
            }
            if (version !== epoch) return;
            unsubscribeDirectory = onSnapshot(
              query(collection(api.db, 'public_profiles'), orderBy('nickname')),
              (snapshot) => {
                if (version === epoch)
                  profiles.value = snapshot.docs.map((doc) => ({
                    ...doc.data(),
                    uid: doc.id,
                  }));
              },
              fail,
            );
            if (account.isAnonymous) ready.value = true;
            error.value = '';
          } catch (cause) {
            if (version === epoch) {
              fail(cause);
              ready.value = true;
            }
          }
        });
        await api.auth.authStateReady();
        if (!api.auth.currentUser) await signInAnonymously(api.auth);
      } catch (cause) {
        fail(cause);
        ready.value = true;
        started = null;
      }
    })();
    return started;
  }
  function fail(cause) {
    error.value = friendlyError(cause);
  }
  async function login(email, password, expectedUid) {
    const { auth } = await getFirebase();
    const result = await signInWithEmailAndPassword(
      auth,
      email.trim(),
      password,
    );
    if (expectedUid && result.user.uid !== expectedUid) {
      await signOut(auth);
      await signInAnonymously(auth);
      throw new Error('선택한 프로필의 이메일로 로그인해 주세요.');
    }
  }
  async function register(email, password, nickname) {
    const api = await getFirebase();
    await createUserWithEmailAndPassword(api.auth, email.trim(), password);
    await api.call('ensureProfile', { nickname });
  }
  async function google() {
    const api = await getFirebase();
    await signInWithPopup(api.auth, new GoogleAuthProvider());
    await api.call('ensureProfile', {});
  }
  async function guest() {
    const { auth } = await getFirebase();
    await signOut(auth);
    await signInAnonymously(auth);
  }
  async function saveProfile(fields) {
    return (await getFirebase()).call('saveProfile', fields);
  }
  async function uploadImage(file, kind) {
    validateImage(file);
    if (!member.value) throw new Error('일반 계정으로 로그인해 주세요.');
    const api = await getFirebase(),
      reference = storageRef(
        api.storage,
        `users/${user.value.uid}/${kind}-${crypto.randomUUID()}`,
      );
    await uploadBytes(reference, file, { contentType: file.type });
    return getDownloadURL(reference);
  }
  async function changePassword(current, next) {
    const { auth } = await getFirebase();
    if (!member.value) throw new Error('일반 계정으로 로그인해 주세요.');
    if (
      auth.currentUser.providerData.some(
        (item) => item.providerId === 'password',
      )
    )
      await reauthenticateWithCredential(
        auth.currentUser,
        EmailAuthProvider.credential(auth.currentUser.email, current),
      );
    else
      await reauthenticateWithPopup(auth.currentUser, new GoogleAuthProvider());
    await updatePassword(auth.currentUser, next);
  }
  return {
    user,
    profile,
    profiles,
    ready,
    error,
    local,
    member,
    admin,
    init,
    login,
    register,
    google,
    guest,
    saveProfile,
    uploadImage,
    changePassword,
  };
});
