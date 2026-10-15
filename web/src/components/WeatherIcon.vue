<script setup>
import { computed } from "vue";
import { weatherKind } from "../services/weather.js";
const props = defineProps({
  condition: Number,
  icon: String,
  timestamp: Number,
  offset: Number,
});
const kind = computed(() =>
  weatherKind(props.condition, props.icon, props.timestamp, props.offset),
);
</script>
<template>
  <svg
    class="weather-icon"
    :class="`weather-icon--${kind}`"
    viewBox="0 0 64 64"
    fill="none"
    stroke="currentColor"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <g
      v-if="kind === 'sun' || kind === 'cloud-sun'"
      :transform="
        kind === 'cloud-sun' ? 'translate(0 -6) scale(.85)' : undefined
      "
    >
      <circle cx="32" cy="32" r="13" fill="currentColor" fill-opacity=".16" />
      <path
        d="M32 5v6M32 53v6M5 32h6M53 32h6M13 13l4 4M47 47l4 4M13 51l4-4M47 17l4-4"
      />
    </g>
    <path
      v-if="kind === 'moon' || kind === 'cloud-night'"
      d="M43 11a23 23 0 1 0 10 32A23 23 0 0 1 43 11Z"
      fill="currentColor"
      fill-opacity=".13"
    />
    <path
      v-if="
        ['cloud', 'cloud-sun', 'cloud-night', 'rain', 'storm', 'snow'].includes(
          kind,
        )
      "
      class="weather-cloud"
      d="M17 43a10 10 0 0 1-1-20 16 16 0 0 1 30-1 11 11 0 0 1 1 22H17Z"
      fill="var(--surface)"
    />
    <path
      v-if="kind === 'rain'"
      class="weather-water"
      d="m20 50-3 7m16-7-3 7m16-7-3 7"
    />
    <path v-if="kind === 'storm'" d="m34 41-9 12h9l-5 9" />
    <path
      v-if="kind === 'snow'"
      class="weather-water"
      d="M20 49v10m-4-7 8 4m0-4-8 4M43 49v10m-4-7 8 4m0-4-8 4"
    />
    <path
      v-if="kind === 'mist'"
      class="weather-cloud"
      d="M12 20h40M7 32h50M13 44h38"
    />
  </svg>
</template>
