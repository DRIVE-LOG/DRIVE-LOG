<script setup>
import { ref, watch, onUnmounted } from 'vue';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useSession } from '../stores/session.js';
import { getFirebase, friendlyError } from '../services/firebase.js';
const session = useSession(),
  users = ref([]),
  error = ref(''),
  busy = ref('');
let stop,
  generation = 0;
watch(
  () => session.admin,
  async (allowed) => {
    const version = ++generation;
    stop?.();
    users.value = [];
    error.value = '';
    if (!allowed) return;
    const { db } = await getFirebase();
    if (version !== generation) return;
    stop = onSnapshot(
      query(collection(db, 'users'), orderBy('nickname')),
      (snap) => {
        if (version !== generation) return;
        users.value = snap.docs.map((doc) => ({ ...doc.data(), uid: doc.id }));
      },
      (cause) => {
        if (version !== generation) return;
        error.value = friendlyError(cause);
      },
    );
  },
  { immediate: true },
);
onUnmounted(() => {
  generation++;
  stop?.();
});
async function promote(uid) {
  busy.value = uid;
  error.value = '';
  try {
    await (await getFirebase()).call('promoteUser', { uid });
  } catch (cause) {
    error.value = friendlyError(cause);
  } finally {
    busy.value = '';
  }
}
</script>
<template>
  <section v-if="session.admin" class="panel admin-panel">
    <h2>회원 관리</h2>
    <p class="muted">
      관리자만 볼 수 있는 메뉴입니다. 등록된 회원에게 관리 권한을 부여할 수
      있습니다.
    </p>
    <p v-if="error" class="error-text" role="alert">{{ error }}</p>
    <div class="table-scroll">
      <table>
        <caption class="sr-only">
          전체 회원 목록
        </caption>
        <thead>
          <tr>
            <th>닉네임</th>
            <th>이메일</th>
            <th>권한</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.uid">
            <td>{{ user.nickname }}</td>
            <td>{{ user.email }}</td>
            <td>{{ user.role === 'admin' ? '관리자' : '일반 사용자' }}</td>
            <td>
              <button
                v-if="user.role !== 'admin'"
                :disabled="!!busy"
                @click="promote(user.uid)"
              >
                {{ busy === user.uid ? '변경 중…' : '관리자로 승격' }}</button
              ><span v-else>관리자</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
