<script setup>
import { ref, onMounted } from 'vue';
import MapPanel from '../components/MapPanel.vue';
import ModalDialog from '../components/ModalDialog.vue';
import { loadMapSdk, getLocation } from '../services/maps.js';
const search = ref(''),
  results = ref([]),
  error = ref(''),
  busy = ref(false),
  selected = ref(null),
  route = ref([]),
  summary = ref(null),
  origin = ref({ latitude: 37.5665, longitude: 126.978 }),
  position = ref({ ...origin.value }),
  actualLocation = ref(false),
  history = ref([]);
onMounted(() => {
  try {
    history.value = JSON.parse(
      localStorage.getItem('drive-log-place-history') || '[]',
    ).slice(0, 10);
  } catch {
    history.value = [];
  }
});
let sequence = 0;
async function find() {
  if (!search.value.trim()) return;
  const id = ++sequence;
  busy.value = true;
  error.value = '';
  try {
    const maps = await loadMapSdk();
    new maps.services.Places().keywordSearch(search.value, (data, status) => {
      if (id !== sequence) return;
      results.value = status === maps.services.Status.OK ? data : [];
      busy.value = false;
      if (!results.value.length)
        error.value = '검색 결과가 없습니다. 다른 장소를 입력해 주세요.';
    });
  } catch (cause) {
    if (id === sequence) {
      error.value = cause.message;
      busy.value = false;
    }
  }
}
async function locate() {
  try {
    origin.value = await getLocation();
    position.value = { ...origin.value };
    actualLocation.value = true;
    error.value = '';
  } catch (cause) {
    error.value = cause.message;
  }
}
async function start() {
  busy.value = true;
  error.value = '';
  try {
    const place = selected.value;
    const response = await fetch(
      `/api/directions?origin=${origin.value.longitude},${origin.value.latitude}&destination=${place.x},${place.y}`,
    );
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error?.message || '경로를 조회하지 못했습니다.');
    const result = data.routes?.[0];
    if (!result?.summary || result.result_code)
      throw new Error(result?.result_msg || '이 경로는 안내할 수 없습니다.');
    route.value = result.sections.flatMap((section) =>
      section.roads.flatMap((road) => {
        const points = [];
        for (let i = 0; i < road.vertexes.length; i += 2)
          points.push({
            longitude: road.vertexes[i],
            latitude: road.vertexes[i + 1],
          });
        return points;
      }),
    );
    summary.value = {
      ...result.summary,
      name: place.place_name,
      guides: result.sections.flatMap((section) => section.guides || []),
    };
    position.value = { latitude: +place.y, longitude: +place.x };
    history.value = [
      place,
      ...history.value.filter((item) => item.id !== place.id),
    ].slice(0, 10);
    localStorage.setItem(
      'drive-log-place-history',
      JSON.stringify(history.value),
    );
    selected.value = null;
  } catch (cause) {
    error.value = cause.message;
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section>
    <div class="page-heading">
      <div>
        <h1>어디로 갈까요?</h1>
        <p>목적지를 검색하고 주행 경로를 확인하세요.</p>
      </div>
      <button @click="locate">현재 위치 사용</button>
    </div>
    <p class="muted">
      출발지: {{ actualLocation ? '현재 위치' : '서울 시청 · 기본 위치' }} ({{
        origin.latitude.toFixed(4)
      }}, {{ origin.longitude.toFixed(4) }})
    </p>
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <div class="navigation-layout">
      <aside class="panel">
        <form class="search-form" @submit.prevent="find">
          <label
            >장소 또는 주소<input
              v-model="search"
              type="search"
              placeholder="목적지를 입력하세요"
              required /></label
          ><button class="primary" :disabled="busy">검색</button>
        </form>
        <h2>{{ results.length ? '검색 결과' : '최근 검색' }}</h2>
        <button
          v-for="place in results.length ? results : history"
          :key="place.id"
          class="place-button"
          @click="selected = place"
        >
          <strong>{{ place.place_name }}</strong
          ><small>{{
            place.road_address_name || place.address_name
          }}</small></button
        ><button
          v-if="history.length"
          @click="
            history = [];
            localStorage.removeItem('drive-log-place-history');
          "
        >
          최근 검색 전체 삭제
        </button>
      </aside>
      <div>
        <MapPanel
          :position="position"
          :route="route"
          @select="position = $event"
        />
        <div v-if="summary" class="route-summary panel">
          <h2>{{ summary.name }}까지</h2>
          <p>
            {{ (summary.distance / 1000).toFixed(1) }} km · 약
            {{ Math.ceil(summary.duration / 60) }}분
          </p>
          <p>
            도착 예정
            {{
              new Date(Date.now() + summary.duration * 1000).toLocaleTimeString(
                'ko-KR',
                { hour: '2-digit', minute: '2-digit' },
              )
            }}
          </p>
          <ol>
            <li
              v-for="(guide, index) in summary.guides.slice(0, 8)"
              :key="index"
            >
              {{ guide.guidance }}
            </li>
          </ol>
          <button
            @click="
              summary = null;
              route = [];
            "
          >
            길안내 종료
          </button>
        </div>
      </div>
    </div>
    <ModalDialog
      v-if="selected"
      title="목적지로 설정"
      :busy="busy"
      @close="selected = null"
      ><h3>{{ selected.place_name }}</h3>
      <p>{{ selected.road_address_name || selected.address_name }}</p>
      <p>
        출발지는
        {{ actualLocation ? '현재 위치' : '서울 시청 기본 위치' }}입니다.
      </p>
      <p v-if="error" class="error-text" role="alert">{{ error }}</p>
      <button class="primary" :disabled="busy" @click="start">
        {{ busy ? '경로 조회 중…' : '길안내 시작' }}
      </button></ModalDialog
    >
  </section>
</template>
