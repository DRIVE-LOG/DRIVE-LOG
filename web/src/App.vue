<script setup>
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useSession } from "./stores/session.js";
import { useLogs } from "./stores/logs.js";
import AppIcon from "./components/AppIcon.vue";
import WeatherIcon from "./components/WeatherIcon.vue";
import { useWeather } from "./stores/weather.js";
const weather = useWeather();
const session = useSession(),
  logs = useLogs(),
  route = useRoute(),
  router = useRouter();
const time = ref(""),
  now = () => {
    time.value = new Date().toLocaleTimeString("ko-KR", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };
let timer;
const main = ref(null);
watch(
  () => route.path,
  async () => {
    await nextTick();
    main.value?.scrollTo({ top: 0 });
  },
);
onMounted(() => {
  now();
  timer = setInterval(now, 30000);
  session.init();
  logs.init();
  weather.start();
});
onUnmounted(() => {
  clearInterval(timer);
  weather.stop();
});
const nav = [
  { path: "/", label: "홈", icon: "home" },
  { path: "/logs", label: "로그 관리", icon: "logs" },
  { path: "/analytics", label: "주행 분석", icon: "chart" },
  { path: "/chat", label: "AI 챗봇", icon: "chat" },
  { path: "/profiles", label: "사용자 전환", icon: "user" },
  { path: "/settings", label: "설정", icon: "settings" },
];
const background = computed(() =>
  session.profile?.backgroundURL
    ? {
        backgroundImage: `linear-gradient(#02050766,#02050788),url("${session.profile.backgroundURL}")`,
      }
    : {},
);
</script>
<template>
  <div class="environment" :style="background">
    <div class="tablet">
      <header class="app-header">
        <RouterLink to="/" class="brand">DRIVE <span>/</span> LOG</RouterLink
        ><span class="greeting"
          >안녕하세요! <b>{{ session.profile?.nickname || "SSAFY" }}</b
          >님</span
        >
        <div class="header-status">
          <span
            class="connection"
            :class="{ connected: logs.status === '실시간 연결됨' }"
            >{{ session.local ? "LOCAL" : "CLOUD" }}</span
          ><RouterLink
            v-if="weather.current"
            to="/weather"
            class="header-weather"
            :aria-label="`${weather.city} 날씨 ${Math.round(weather.current.main.temp)}도 ${weather.current.weather[0].description}`"
            ><WeatherIcon
              :condition="weather.current.weather[0].id"
              :icon="weather.current.weather[0].icon"
            /><strong>{{ Math.round(weather.current.main.temp) }}°</strong
            ><small>{{
              weather.current.weather[0].description
            }}</small></RouterLink
          ><time>{{ time }}</time
          ><button
            class="avatar-button"
            aria-label="사용자 전환"
            @click="router.push('/profiles')"
          >
            <img
              v-if="session.profile?.photoURL"
              :src="session.profile.photoURL"
              alt="내 프로필"
            /><AppIcon v-else name="user" />
          </button>
        </div>
      </header>
      <div class="app-layout">
        <nav class="sidebar" aria-label="주 메뉴">
          <RouterLink
            v-for="item in nav"
            :key="item.path"
            :to="item.path"
            :class="{ active: route.path === item.path }"
            ><AppIcon :name="item.icon" /><span>{{
              item.label
            }}</span></RouterLink
          ><span class="sidebar-foot">차량 데이터 스튜디오</span>
        </nav>
        <main ref="main" class="app-main" id="main-content">
          <div v-if="session.error" class="notice error" role="alert">
            {{ session.error }}
            <button @click="session.init(true)">다시 연결</button>
          </div>
          <div v-if="!session.ready" class="empty-state" role="status">
            사용자 정보를 불러오고 있습니다.
          </div>
          <RouterView v-else />
        </main>
      </div>
      <footer class="app-footer">
        <span :class="{ 'error-text': logs.error }"
          >{{ logs.status }}
          <span v-if="session.local">· 로컬 에뮬레이터</span></span
        ><RouterLink to="/" aria-label="HOME" class="home-link"
          ><AppIcon name="home" />HOME</RouterLink
        ><span>SEOUL · KST</span>
      </footer>
    </div>
  </div>
</template>
