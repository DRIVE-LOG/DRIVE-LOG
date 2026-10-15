import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { getLocation } from "../services/maps.js";
import {
  cityName,
  dailyOutlooks,
  drivingInsight,
} from "../services/weather.js";
export const useWeather = defineStore("weather", () => {
  const data = ref(null),
    error = ref(""),
    busy = ref(false),
    locating = ref(false),
    orientation = ref('horizontal');
  const position = ref({ latitude: 37.5665, longitude: 126.978 }),
    actual = ref(false);
  const current = computed(() => data.value?.current),
    entries = computed(() => data.value?.forecast?.list || []);
  const offset = computed(
    () => data.value?.forecast?.city?.timezone ?? current.value?.timezone ?? 0,
  );
  const city = computed(() =>
    cityName(current.value?.name || data.value?.forecast?.city?.name),
  );
  const outlooks = computed(() =>
    dailyOutlooks(current.value, entries.value, offset.value),
  );
  const insight = computed(() => drivingInsight(entries.value));
  let sequence = 0,
    controller,
    timer;
  async function load(force = false) {
    if (
      !force &&
      (busy.value || (data.value && Date.now() - data.value.fetchedAt < 600000))
    )
      return;
    const id = ++sequence;
    controller?.abort();
    const request = new AbortController();
    controller = request;
    const timeout = setTimeout(() => request.abort(), 12000);
    busy.value = true;
    error.value = "";
    try {
      const response = await fetch(
        `/api/weather/forecast?lat=${position.value.latitude}&lon=${position.value.longitude}`,
        { signal: request.signal },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error?.message || "날씨를 조회하지 못했습니다.");
      if (
        !Number.isFinite(result.current?.main?.temp) ||
        !result.current?.weather?.length ||
        !result.forecast?.list?.length
      )
        throw new Error("날씨 응답이 불완전합니다. 다시 불러와 주세요.");
      if (id === sequence) data.value = result;
    } catch (cause) {
      if (id === sequence)
        error.value =
          cause.name === "AbortError"
            ? "날씨 연결이 지연되고 있습니다. 다시 불러와 주세요."
            : cause.message;
    } finally {
      clearTimeout(timeout);
      if (id === sequence) busy.value = false;
    }
  }
  async function locate() {
    locating.value = true;
    try {
      position.value = await getLocation();
      actual.value = true;
      await load(true);
    } catch (cause) {
      error.value = cause.message;
    } finally {
      locating.value = false;
    }
  }
  const refreshVisible = () => {
    if (document.visibilityState === "visible") load();
  };
  function start() {
    load();
    if (timer) return;
    timer = setInterval(refreshVisible, 60000);
    document.addEventListener("visibilitychange", refreshVisible);
  }
  function stop() {
    clearInterval(timer);
    timer = null;
    document.removeEventListener("visibilitychange", refreshVisible);
    ++sequence;
    controller?.abort();
    busy.value = false;
  }
  return {
    orientation,
    data,
    current,
    entries,
    offset,
    city,
    outlooks,
    insight,
    error,
    busy,
    locating,
    actual,
    load,
    locate,
    start,
    stop,
  };
});
