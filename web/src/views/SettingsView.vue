<script setup>
import { ref, watch } from 'vue';
import { useSession } from '../stores/session.js';
import { friendlyError } from '../services/firebase.js';
import AdminPanel from '../components/AdminPanel.vue';
const tab = ref('profile');
const session = useSession(),
  nickname = ref(''),
  currentPassword = ref(''),
  newPassword = ref(''),
  confirm = ref(''),
  busy = ref(false),
  error = ref(''),
  success = ref('');
watch(
  () => session.profile?.nickname,
  (value) => {
    nickname.value = value || 'SSAFY';
  },
  { immediate: true },
);
async function perform(fn, message) {
  error.value = '';
  success.value = '';
  busy.value = true;
  try {
    await fn();
    success.value = message;
  } catch (cause) {
    error.value = friendlyError(cause);
  } finally {
    busy.value = false;
  }
}
async function image(event, kind) {
  const file = event.target.files[0];
  if (!file) return;
  await perform(async () => {
    const url = await session.uploadImage(file, kind);
    await session.saveProfile({
      nickname: nickname.value,
      [kind === 'profile' ? 'photoURL' : 'backgroundURL']: url,
    });
  }, '이미지를 변경했습니다.');
  event.target.value = '';
}
async function password() {
  await perform(async () => {
    if (newPassword.value !== confirm.value)
      throw new Error('두 비밀번호가 일치하지 않습니다.');
    await session.changePassword(currentPassword.value, newPassword.value);
    currentPassword.value = '';
    newPassword.value = '';
    confirm.value = '';
  }, '비밀번호를 변경했습니다.');
}
</script>
<template>
  <section>
    <div class="page-heading">
      <div>
        <h1>설정</h1>
        <p>나에게 맞는 프로필과 주행 환경을 설정하세요.</p>
      </div>
      <RouterLink to="/logs" class="button-link">로그 관리로 이동</RouterLink>
    </div>
    <p v-if="!session.member" class="notice">
      기본 계정은 닉네임·비밀번호·배경화면을 변경할 수 없습니다. 일반 계정으로
      로그인해 주세요.
    </p>
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <p v-if="success" class="notice success" role="status">{{ success }}</p>
    <div
      v-if="session.admin"
      class="settings-tabs"
      role="tablist"
      aria-label="설정 메뉴"
    >
      <button
        role="tab"
        id="profile-tab"
        aria-controls="profile-panel"
        :aria-selected="tab === 'profile'"
        @click="tab = 'profile'"
        @keydown.right="tab = 'admin'"
      >
        내 설정</button
      ><button
        role="tab"
        id="admin-tab"
        aria-controls="admin-panel"
        :aria-selected="tab === 'admin'"
        @click="tab = 'admin'"
        @keydown.left="tab = 'profile'"
      >
        회원 관리
      </button>
    </div>
    <div
      v-if="tab === 'profile' || !session.admin"
      id="profile-panel"
      class="settings-grid"
    >
      <section class="panel">
        <h2>프로필</h2>
        <form
          @submit.prevent="
            perform(
              () => session.saveProfile({ nickname }),
              '닉네임을 변경했습니다.',
            )
          "
        >
          <fieldset :disabled="!session.member || busy">
            <label
              >닉네임<input
                v-model="nickname"
                maxlength="30"
                required
                autocomplete="nickname" /></label
            ><button class="primary">닉네임 저장</button
            ><label
              >프로필 사진<input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                @change="image($event, 'profile')"
            /></label>
            <p class="muted">JPG, PNG, WebP · 최대 5 MB</p>
            <label
              >배경화면<input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                @change="image($event, 'background')" /></label
            ><button
              type="button"
              @click="
                perform(
                  () => session.saveProfile({ nickname, backgroundURL: '' }),
                  '기본 배경으로 변경했습니다.',
                )
              "
            >
              기본 배경으로 복원
            </button>
          </fieldset>
        </form>
      </section>
      <section class="panel">
        <h2>비밀번호 변경</h2>
        <form @submit.prevent="password">
          <fieldset :disabled="!session.member || busy">
            <label
              v-if="
                session.user?.providerData?.some(
                  (item) => item.providerId === 'password',
                )
              "
              >현재 비밀번호<input
                v-model="currentPassword"
                type="password"
                autocomplete="current-password"
                required
            /></label>
            <p v-else class="muted">
              Google 계정은 Google 재인증 후 비밀번호를 설정합니다.
            </p>
            <label
              >새 비밀번호<input
                v-model="newPassword"
                type="password"
                autocomplete="new-password"
                minlength="6"
                required /></label
            ><label
              >새 비밀번호 확인<input
                v-model="confirm"
                type="password"
                autocomplete="new-password"
                minlength="6"
                required /></label
            ><button class="primary">비밀번호 변경</button>
          </fieldset>
        </form>
      </section>
    </div>
    <AdminPanel
      v-if="session.admin && tab === 'admin'"
      id="admin-panel"
      role="tabpanel"
      aria-labelledby="admin-tab"
    />
  </section>
</template>
