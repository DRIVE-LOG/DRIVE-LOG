<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useSession } from '../stores/session.js';
import { useChat } from '../stores/chat.js';
import { useLogs } from '../stores/logs.js';
import { useRouter } from 'vue-router';
import { createSpeechInput } from '../services/speech.js';
import ModalDialog from '../components/ModalDialog.vue';
import AppIcon from '../components/AppIcon.vue';
const session = useSession(),
  chat = useChat(),
  logs = useLogs(),
  router = useRouter(),
  list = ref(null),
  listening = ref(false),
  speechError = ref(''),
  supported = ref(false);
let speech,
  prefix = '';
onMounted(() => {
  chat.init();
  speech = createSpeechInput({
    onText: (text) => {
      chat.draft = (prefix + text).slice(0, 4000);
    },
    onState: (state) => {
      listening.value = state;
    },
    onError: (text) => {
      speechError.value = text;
    },
  });
  supported.value = !!speech;
});
onUnmounted(() => {
  speech?.dispose();
  globalThis.speechSynthesis?.cancel();
});
watch(
  () => [chat.messages.length, chat.busy, chat.loading],
  async () => {
    await nextTick();
    list.value?.scrollTo({ top: list.value.scrollHeight, behavior: 'instant' });
  },
);
watch(
  () => chat.voice,
  (value) => {
    if (!value) globalThis.speechSynthesis?.cancel();
  },
);
function microphone() {
  speechError.value = '';
  if (listening.value) speech.stop();
  else {
    prefix = chat.draft ? `${chat.draft} ` : '';
    try {
      speech.start();
    } catch {
      speechError.value = '마이크를 시작하지 못했습니다. 다시 시도해 주세요.';
    }
  }
}
function submit(event) {
  if (event?.isComposing || event?.shiftKey) return;
  event?.preventDefault();
  speech?.stop();
  chat.send();
}
</script>
<template>
  <section v-if="session.member" class="chat-view">
    <div class="page-heading">
      <div>
        <h1>AI 주행 도우미</h1>
        <p>내 주행 기록에 근거한 운전 습관과 차량 관리 이야기.</p>
      </div>
      <label class="inline-check"
        ><input v-model="chat.voice" type="checkbox" />응답 음성 읽기</label
      >
    </div>
    <div class="chat-context">
      <label
        >분석할 사용자<select v-model="chat.driverId" :disabled="chat.busy">
          <option value="">전체 사용자</option>
          <option v-for="user in logs.users" :key="user">{{ user }}</option>
        </select></label
      ><span class="muted">내 계정의 최근 최대 5,000개 기록을 분석합니다.</span>
    </div>
    <div
      ref="list"
      class="messages"
      role="log"
      aria-live="polite"
      aria-label="대화 기록"
    >
      <div v-if="chat.loading" class="empty-state">
        대화 기록을 불러오는 중입니다.
      </div>
      <div v-else-if="!chat.messages.length" class="chat-welcome">
        <AppIcon name="chat" />
        <h2>오늘의 주행은 어땠나요?</h2>
        <p>
          급가속·엔진 온도·연비에 대해 물어보세요.<br />로그가 없다면 먼저 로그
          관리에서 파일을 업로드해 주세요.
        </p>
        <div class="suggestions">
          <button @click="chat.draft = '내 주행 습관을 분석해 주세요.'">
            내 주행 습관 분석</button
          ><button @click="chat.draft = '엔진 온도와 연비를 확인해 주세요.'">
            차량 상태 확인
          </button>
        </div>
      </div>
      <article
        v-for="message in chat.messages"
        :key="message.id"
        class="chat-message"
        :class="message.role"
      >
        <span class="message-avatar"
          ><AppIcon :name="message.role === 'user' ? 'user' : 'chat'"
        /></span>
        <div>
          <div class="bubble">{{ message.content }}</div>
          <small
            >{{
              message.role === 'user' ? session.profile.nickname : 'AI 도우미'
            }}
            ·
            {{
              new Date(message.timestamp).toLocaleTimeString('ko-KR', {
                timeZone: 'Asia/Seoul',
                hour: '2-digit',
                minute: '2-digit',
              })
            }}</small
          >
        </div>
      </article>
      <div v-if="chat.busy" class="reply-loading" role="status">
        주행 기록을 분석하고 있습니다<span class="loading-dots">…</span>
      </div>
    </div>
    <div v-if="chat.error" class="notice error" role="alert">
      {{ chat.error }}
      <button
        v-if="chat.retry"
        :disabled="chat.busy"
        @click="chat.send(chat.retry)"
      >
        다시 전송
      </button>
    </div>
    <p v-if="speechError" class="error-text" role="alert">{{ speechError }}</p>
    <p v-if="listening" class="listening" role="status">
      음성을 듣고 있습니다. 마이크를 다시 누르면 인식을 마칩니다.
    </p>
    <form class="chat-compose" @submit.prevent="submit">
      <button
        type="button"
        class="icon-button"
        :class="{ recording: listening }"
        :disabled="!supported || chat.busy"
        :aria-pressed="listening"
        :aria-label="listening ? '음성 입력 중지' : '음성 입력'"
        @click="microphone"
      >
        <AppIcon name="mic" /></button
      ><label class="sr-only" for="chat-message">메시지</label
      ><textarea
        id="chat-message"
        v-model="chat.draft"
        rows="2"
        maxlength="4000"
        placeholder="주행 기록에 대해 질문해 보세요"
        :disabled="chat.busy"
        @keydown.enter="submit"
      ></textarea
      ><button class="primary" :disabled="chat.busy || !chat.draft.trim()">
        전송<AppIcon name="arrow" />
      </button>
    </form>
    <small v-if="!supported" class="muted"
      >이 브라우저는 음성 인식을 지원하지 않습니다. Chrome에서 사용하거나
      텍스트를 입력해 주세요.</small
    >
  </section>
  <ModalDialog v-else title="챗봇 이용 안내" @close="router.push('/')"
    ><p>기본 계정으로는 챗봇을 이용할 수 없습니다.</p>
    <p>
      일반 계정으로 로그인하면 내 기록을 분석하고 대화를 저장할 수 있습니다.
    </p>
    <div class="actions">
      <RouterLink class="button-link primary" to="/profiles"
        >로그인하기</RouterLink
      ><button @click="router.push('/')">홈으로</button>
    </div></ModalDialog
  >
</template>
