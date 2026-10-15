<script setup>
import { ref, nextTick, onMounted } from "vue";
import { storeToRefs } from 'pinia';
import { useWeather } from "../stores/weather.js";
import { weatherTime } from "../services/weather.js";
import WeatherIcon from "../components/WeatherIcon.vue";
import AppIcon from "../components/AppIcon.vue";
const weather = useWeather(),
  cards = ref(null),
  dragging = ref(false);
const { orientation } = storeToRefs(weather);
const time = (dt, options) => weatherTime(dt, weather.offset, options);
let drag;
function finishDrag() {
  const active = drag;
  drag = null;
  dragging.value = false;
  if (active && cards.value?.hasPointerCapture(active.id))
    cards.value.releasePointerCapture(active.id);
}
function startDrag(event) {
  if (event.pointerType !== "mouse" || event.button !== 0) return;
  const horizontal = orientation.value === "horizontal";
  drag = {
    id: event.pointerId,
    horizontal,
    start: horizontal ? event.clientX : event.clientY,
    scroll: horizontal ? cards.value.scrollLeft : cards.value.scrollTop,
  };
  cards.value.setPointerCapture(event.pointerId);
  dragging.value = true;
}
function moveDrag(event) {
  if (!drag || drag.id !== event.pointerId) return;
  const distance =
    (drag.horizontal ? event.clientX : event.clientY) - drag.start;
  if (Math.abs(distance) > 3) event.preventDefault();
  cards.value[drag.horizontal ? "scrollLeft" : "scrollTop"] =
    drag.scroll - distance;
}
function keyboardScroll(event) {
  const horizontal = orientation.value === "horizontal";
  const keys = horizontal
    ? ["ArrowLeft", "ArrowRight"]
    : ["ArrowUp", "ArrowDown"];
  if (!keys.includes(event.key)) return;
  event.preventDefault();
  cards.value.scrollBy({
    [horizontal ? "left" : "top"]: keys.indexOf(event.key) ? 250 : -250,
  });
}
async function toggleOrientation() {
  finishDrag();
  orientation.value =
    orientation.value === "horizontal" ? "vertical" : "horizontal";
  await nextTick();
  cards.value?.scrollTo({ top: 0, left: 0 });
}
onMounted(() => weather.load());
</script>
<template>
  <section class="weather-view" aria-label="날씨">
    <div class="weather-toolbar">
      <p>{{ weather.actual ? "현재 위치 기준" : "서울 시청 · 기본 위치" }}</p>
      <div class="actions">
        <button
          :disabled="weather.busy || weather.locating"
          @click="weather.locate"
        >
          {{ weather.locating ? "위치 확인 중…" : "현재 위치 날씨" }}</button
        ><button :disabled="weather.busy" @click="weather.load(true)">
          {{ weather.busy ? "불러오는 중…" : "새로고침" }}
        </button>
      </div>
    </div>
    <p v-if="weather.error" class="notice error" role="alert">
      {{ weather.error }}
      <span v-if="weather.data">마지막으로 받은 날씨를 표시하고 있습니다.</span>
    </p>
    <div v-if="weather.data" class="weather-layout" :aria-busy="weather.busy">
      <section class="weather-hero" aria-labelledby="weather-title">
        <div class="weather-hero-copy">
          <h1 id="weather-title">{{ weather.city }}의 오늘</h1>
          <p>
            {{
              time(weather.current.dt, {
                month: "long",
                day: "numeric",
                weekday: "long",
              })
            }}
          </p>
        </div>
        <div class="current-weather-visual">
          <WeatherIcon
            :condition="weather.current.weather[0].id"
            :icon="weather.current.weather[0].icon"
            :timestamp="weather.current.dt"
            :offset="weather.offset"
          />
          <div class="current-temperature">
            <strong>{{ Math.round(weather.current.main.temp) }}</strong
            ><sup>°</sup
            ><span
              ><b>{{ weather.current.weather[0].description }}</b
              ><small
                >체감온도
                {{ Math.round(weather.current.main.feels_like) }}°</small
              ></span
            >
          </div>
        </div>
        <dl class="weather-details">
          <div>
            <AppIcon name="droplet" />
            <dt>습도</dt>
            <dd>{{ weather.current.main.humidity }}%</dd>
          </div>
          <div>
            <AppIcon name="wind" />
            <dt>바람</dt>
            <dd>
              {{ weather.current.wind.speed.toFixed(1) }} <small>m/s</small>
            </dd>
          </div>
          <div>
            <AppIcon name="pressure" />
            <dt>기압</dt>
            <dd>{{ weather.current.main.pressure }} <small>hPa</small></dd>
          </div>
          <div>
            <AppIcon name="eye" />
            <dt>가시거리</dt>
            <dd>
              {{
                Number.isFinite(weather.current.visibility)
                  ? (weather.current.visibility / 1000).toFixed(1)
                  : "—"
              }}
              <small>km</small>
            </dd>
          </div>
        </dl>
        <div class="driving-tip">
          <AppIcon name="navigation" />
          <div>
            <h2>드라이빙 인사이트</h2>
            <p>{{ weather.insight }}</p>
          </div>
        </div>
      </section>
      <section class="forecast-section" aria-labelledby="forecast-title">
        <div class="forecast-heading">
          <div>
            <h2 id="forecast-title">시간대별 예보</h2>
            <p>3시간 간격 · 앞으로 72시간</p>
          </div>
          <button
            :aria-pressed="orientation === 'vertical'"
            @click="toggleOrientation"
          >
            <AppIcon
              :name="orientation === 'horizontal' ? 'vertical' : 'horizontal'"
            />{{ orientation === "horizontal" ? "세로 보기" : "가로 보기" }}
          </button>
        </div>
        <div
          ref="cards"
          class="forecast-cards"
          :class="{ 'is-dragging': dragging }"
          :data-orientation="orientation"
          role="region"
          aria-label="3시간 간격 시간대별 예보 24개"
          tabindex="0"
          @pointerdown="startDrag"
          @pointermove="moveDrag"
          @pointerup="finishDrag"
          @pointercancel="finishDrag"
          @lostpointercapture="finishDrag"
          @dragstart.prevent
          @keydown="keyboardScroll"
        >
          <article
            v-for="item in weather.entries.slice(0, 24)"
            :key="item.dt"
            class="forecast-card"
            :aria-label="`${time(item.dt, { month: 'short', day: 'numeric', hour: 'numeric' })} ${item.weather[0].description}`"
          >
            <time :datetime="new Date(item.dt * 1000).toISOString()">{{
              time(item.dt, {
                weekday: "short",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })
            }}</time
            ><WeatherIcon
              :condition="item.weather[0].id"
              :icon="item.weather[0].icon"
              :timestamp="item.dt"
              :offset="weather.offset"
            /><strong>{{ Math.round(item.main.temp) }}°</strong>
            <dl>
              <div>
                <dt>습도</dt>
                <dd>{{ item.main.humidity }}%</dd>
              </div>
              <div>
                <dt>바람</dt>
                <dd>{{ item.wind.speed.toFixed(1) }} <small>m/s</small></dd>
              </div>
              <div>
                <dt>강수</dt>
                <dd>{{ Math.round((item.pop || 0) * 100) }}%</dd>
              </div>
            </dl>
          </article>
        </div>
        <p class="forecast-hint">
          {{ orientation === "horizontal" ? "좌우" : "위아래" }}로 드래그하거나
          방향키로 예보를 확인하세요.
        </p>
        <div class="daily-outlooks" aria-label="오늘과 내일 기온 범위">
          <div
            v-for="day in weather.outlooks"
            :key="day.label"
            class="daily-outlook"
          >
            <span>{{ day.label }}</span>
            <div class="temperature-track" aria-hidden="true">
              <i :style="{ left: `${day.start}%`, width: `${day.width}%` }"></i>
            </div>
            <span aria-label="최저 기온">{{ Math.round(day.minimum) }}°</span
            ><strong aria-label="최고 기온"
              >{{ Math.round(day.maximum) }}°</strong
            >
          </div>
        </div>
        <p class="weather-updated">
          최근 확인
          {{
            new Date(weather.data.fetchedAt).toLocaleTimeString("ko-KR", {
              hour: "2-digit",
              minute: "2-digit",
            })
          }}
          · OpenWeather
        </p>
      </section>
    </div>
    <div v-else class="empty-state" role="status">
      {{
        weather.busy
          ? "최신 날씨와 예보를 불러오는 중입니다."
          : "날씨를 불러오지 못했습니다. 새로고침으로 다시 시도해 주세요."
      }}
    </div>
  </section>
</template>
