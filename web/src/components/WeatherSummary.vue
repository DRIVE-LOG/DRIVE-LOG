<script setup>
import { useWeather } from "../stores/weather.js";
import { weatherTime } from "../services/weather.js";
import WeatherIcon from "./WeatherIcon.vue";
const weather = useWeather();
</script>
<template>
  <RouterLink
    to="/weather"
    class="home-weather-card"
    aria-label="날씨 카드 · 상세 예보 보기"
  >
    <template v-if="weather.current">
      <div class="home-weather-heading">
        <h2>{{ weather.city }} 날씨</h2>
        <WeatherIcon
          :condition="weather.current.weather[0].id"
          :icon="weather.current.weather[0].icon"
        />
      </div>
      <div class="home-weather-temperature">
        <strong>{{ Math.round(weather.current.main.temp) }}°</strong
        ><span
          ><b>{{ weather.current.weather[0].description }}</b
          ><small
            >체감 {{ Math.round(weather.current.main.feels_like) }}°</small
          ></span
        >
      </div>
      <div class="home-mini-forecast" aria-label="간단 날씨 예보">
        <span v-for="item in weather.entries.slice(0, 3)" :key="item.dt"
          ><time>{{
            weatherTime(item.dt, weather.offset, {
              hour: "2-digit",
              hour12: false,
            })
          }}</time
          ><b>{{ Math.round(item.main.temp) }}°</b></span
        >
      </div>
      <small v-if="weather.error" class="error-text"
        >최근 정보 · 새로고침 필요</small
      >
    </template>
    <template v-else
      ><h2>오늘의 날씨</h2>
      <p>
        {{
          weather.busy
            ? "날씨를 불러오는 중입니다."
            : "날씨 연결을 확인해 주세요."
        }}
      </p>
      <small>상세 예보 보기 →</small></template
    >
  </RouterLink>
</template>
