<script setup>
import { computed, ref, onUnmounted } from "vue";
import { useSession } from "../stores/session.js";
import { useLogs } from "../stores/logs.js";
import { analyzeLogs } from "../../../functions/lib/analytics.js";
import MapPanel from "../components/MapPanel.vue";
import AppIcon from "../components/AppIcon.vue";
import WeatherSummary from "../components/WeatherSummary.vue";
const session = useSession(),
  logs = useLogs(),
  audio = ref(""),
  track = ref("");
const analysis = computed(() => analyzeLogs(logs.rows));
const apps = [
  {
    path: "/navigation",
    label: "내비게이션",
    description: "목적지 검색과 경로 안내",
    icon: "navigation",
  },
  {
    path: "/weather",
    label: "날씨",
    description: "현재 날씨와 시간별 예보",
    icon: "weather",
  },
  {
    path: "/logs",
    label: "로그 관리",
    description: "기록 업로드와 상세 조회",
    icon: "logs",
  },
  {
    path: "/analytics",
    label: "주행 분석",
    description: "차트와 이상치 감지",
    icon: "chart",
  },
  {
    path: "/settings",
    label: "설정",
    description: "프로필과 계정 관리",
    icon: "settings",
  },
  {
    path: "/chat",
    label: "AI 챗봇",
    description: "내 기록으로 나누는 대화",
    icon: "chat",
  },
];
function music(event) {
  if (audio.value) URL.revokeObjectURL(audio.value);
  const file = event.target.files[0];
  if (file) {
    audio.value = URL.createObjectURL(file);
    track.value = file.name;
  }
}
onUnmounted(() => {
  if (audio.value) URL.revokeObjectURL(audio.value);
});
</script>
<template>
  <section class="home-view">
    <div class="home-top">
      <div class="driver-panel">
        <div class="driver-profile">
          <img
            v-if="session.profile?.photoURL"
            :src="session.profile.photoURL"
            alt="내 프로필 사진"
          /><span v-else class="profile-image"><AppIcon name="user" /></span>
          <h1>{{ session.profile?.nickname || "SSAFY" }}님의 드라이브</h1>
          <p>
            {{
              session.member
                ? "나의 기록과 함께하는 드라이브"
                : "계정을 선택하고 나만의 주행을 시작하세요"
            }}
          </p>
          <RouterLink class="button-link" to="/profiles"
            >사용자 전환</RouterLink
          >
        </div>
        <div class="drive-summary">
          <h2>내 주행 기록</h2>
          <dl>
            <div>
              <dt>수집된 로그</dt>
              <dd>{{ logs.rows.length.toLocaleString() }}<small>건</small></dd>
            </div>
            <div>
              <dt>평균 연비</dt>
              <dd>
                {{ analysis.metrics.FuelEff.mean?.toFixed(1) ?? "—"
                }}<small>km/L</small>
              </dd>
            </div>
            <div>
              <dt>확인할 이상치</dt>
              <dd>{{ analysis.anomalies.length }}<small>건</small></dd>
            </div>
          </dl>
        </div>
        <WeatherSummary />
      </div>
      <div class="home-map">
        <MapPanel />
        <div class="map-home-label">서울 · 지도 시작 위치</div>
      </div>
    </div>
    <div class="app-grid">
      <RouterLink
        v-for="app in apps"
        :key="app.path"
        :to="app.path"
        class="app-tile"
        ><AppIcon :name="app.icon" /><span
          ><strong>{{ app.label }}</strong
          ><small>{{ app.description }}</small></span
        ><AppIcon name="arrow"
      /></RouterLink>
    </div>
    <details class="music-player">
      <summary>내 음악 재생</summary>
      <label
        >음악 파일 선택<input type="file" accept="audio/*" @change="music"
      /></label>
      <p v-if="track">{{ track }}</p>
      <audio v-if="audio" :src="audio" controls></audio>
    </details>
  </section>
</template>
