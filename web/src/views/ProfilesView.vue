<script setup>
import { ref, watch, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useSession } from '../stores/session.js';
import { getFirebase, friendlyError } from '../services/firebase.js';
import AppIcon from '../components/AppIcon.vue';
const session = useSession(),
  router = useRouter(),
  mode = ref('select'),
  selected = ref(null),
  email = ref(''),
  password = ref(''),
  confirm = ref(''),
  nickname = ref(''),
  busy = ref(false),
  error = ref(''),
  emailState = ref(''),
  emailMessage = ref('');
let timer,
  checkId = 0;
function choose(profile) {
  selected.value = profile;
  mode.value = 'login';
  error.value = '';
  password.value = '';
}
watch([email, mode], () => {
  clearTimeout(timer);
  const id = ++checkId;
  emailState.value = '';
  emailMessage.value = '';
  if (
    mode.value !== 'signup' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())
  )
    return;
  emailState.value = 'checking';
  emailMessage.value = '이메일 확인 중…';
  timer = setTimeout(async () => {
    try {
      const result = await (
        await getFirebase()
      ).call('checkEmail', { email: email.value });
      if (id !== checkId) return;
      emailState.value = result.available ? 'available' : 'duplicate';
      emailMessage.value = result.available
        ? '사용 가능한 이메일입니다.'
        : '이미 가입된 이메일입니다.';
    } catch {
      if (id === checkId) {
        emailState.value = 'error';
        emailMessage.value =
          '이메일을 확인하지 못했습니다. 잠시 후 다시 입력해 주세요.';
      }
    }
  }, 350);
});
onUnmounted(() => {
  clearTimeout(timer);
  checkId++;
});
async function submit() {
  error.value = '';
  busy.value = true;
  try {
    if (mode.value === 'signup') {
      if (password.value !== confirm.value)
        throw new Error('두 비밀번호가 일치하지 않습니다.');
      if (emailState.value !== 'available')
        throw new Error('이메일 중복 확인을 완료해 주세요.');
      await session.register(email.value, password.value, nickname.value);
    } else
      await session.login(email.value, password.value, selected.value?.uid);
    await router.push('/');
  } catch (cause) {
    error.value = friendlyError(cause);
  } finally {
    busy.value = false;
  }
}
async function action(fn) {
  error.value = '';
  busy.value = true;
  try {
    await fn();
    router.push('/');
  } catch (cause) {
    error.value = friendlyError(cause);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section class="profiles-view">
    <div class="page-heading">
      <div>
        <h1>
          {{
            mode === 'select'
              ? '누가 운전하시나요?'
              : mode === 'signup'
                ? '새 프로필 만들기'
                : `${selected?.nickname || '회원'} 로그인`
          }}
        </h1>
        <p>내 계정으로 주행 기록과 대화를 안전하게 이어가세요.</p>
      </div>
      <button
        v-if="mode !== 'select'"
        @click="
          mode = 'select';
          error = '';
        "
      >
        프로필 목록
      </button>
    </div>
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <div v-if="mode === 'select'">
      <div class="profile-grid">
        <button
          class="profile-card"
          :disabled="busy"
          @click="action(session.guest)"
        >
          <span class="profile-image"><AppIcon name="home" /></span
          ><strong>SSAFY</strong><small>기본 계정 · 바로 시작</small></button
        ><button
          v-for="profile in session.profiles"
          :key="profile.uid"
          class="profile-card"
          @click="choose(profile)"
        >
          <span class="profile-image"
            ><img
              v-if="profile.photoURL"
              :src="profile.photoURL"
              :alt="`${profile.nickname} 프로필`" /><AppIcon
              v-else
              name="user" /></span
          ><strong>{{ profile.nickname }}</strong
          ><small>로그인하여 시작</small></button
        ><button
          class="profile-card add-profile"
          @click="
            mode = 'signup';
            selected = null;
          "
        >
          <span class="profile-image">+</span><strong>프로필 추가</strong
          ><small>새 계정 만들기</small>
        </button>
      </div>
      <div class="actions">
        <button
          @click="
            selected = null;
            mode = 'login';
          "
        >
          이메일로 로그인</button
        ><button :disabled="busy" @click="action(session.google)">
          Google 계정으로 로그인</button
        ><button
          v-if="session.member"
          :disabled="busy"
          @click="action(session.guest)"
        >
          로그아웃
        </button>
      </div>
      <p class="muted">기본 계정은 챗봇과 개인 설정을 사용할 수 없습니다.</p>
    </div>
    <form v-else class="auth-form panel" @submit.prevent="submit">
      <label v-if="mode === 'signup'"
        >닉네임<input
          v-model="nickname"
          autocomplete="nickname"
          maxlength="30"
          required /></label
      ><label
        >이메일<input
          v-model="email"
          type="email"
          autocomplete="username"
          required
          maxlength="254"
          :aria-invalid="emailState === 'duplicate'"
          aria-describedby="email-feedback"
      /></label>
      <p
        id="email-feedback"
        v-if="mode === 'signup'"
        :class="[
          'field-feedback',
          emailState === 'available' ? 'success-text' : 'muted',
        ]"
        role="status"
      >
        {{ emailMessage }}
      </p>
      <label
        >비밀번호<input
          v-model="password"
          type="password"
          :autocomplete="
            mode === 'signup' ? 'new-password' : 'current-password'
          "
          minlength="6"
          required /></label
      ><label v-if="mode === 'signup'"
        >비밀번호 확인<input
          v-model="confirm"
          type="password"
          autocomplete="new-password"
          minlength="6"
          required /></label
      ><button
        class="primary"
        :disabled="busy || (mode === 'signup' && emailState !== 'available')"
      >
        {{
          busy ? '처리 중…' : mode === 'signup' ? '가입하고 시작하기' : '로그인'
        }}
      </button>
    </form>
  </section>
</template>
