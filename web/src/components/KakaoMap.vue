<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import { loadMapSdk } from "../services/maps.js";
const props = defineProps({
  position: {
    type: Object,
    default: () => ({ latitude: 37.5665, longitude: 126.978 }),
  },
  route: Array,
});
const emit = defineEmits(["select"]);
const element = ref(null),
  error = ref("");
let map,
  maps,
  marker,
  line,
  resize,
  alive = true;
onMounted(async () => {
  try {
    maps = await loadMapSdk();
    if (!alive) return;
    map = new maps.Map(element.value, {
      center: new maps.LatLng(
        props.position.latitude,
        props.position.longitude,
      ),
      level: 5,
    });
    marker = new maps.Marker({ map, position: map.getCenter() });
    drawRoute(props.route);
    maps.event.addListener(map, "rightclick", (event) => {
      marker.setPosition(event.latLng);
      emit("select", {
        latitude: event.latLng.getLat(),
        longitude: event.latLng.getLng(),
      });
    });
    resize = new ResizeObserver(() => map.relayout());
    resize.observe(element.value);
  } catch (cause) {
    if (alive) error.value = cause.message;
  }
});
watch(
  () => props.position,
  (position) => {
    if (map) {
      const point = new maps.LatLng(position.latitude, position.longitude);
      map.setCenter(point);
      marker.setPosition(point);
    }
  },
);
function drawRoute(points) {
  if (!map) return;
  line?.setMap(null);
  if (!points?.length) return;
  const path = points.map(
    (point) => new maps.LatLng(point.latitude, point.longitude),
  );
  line = new maps.Polyline({
    map,
    path,
    strokeWeight: 5,
    strokeColor: "#169d79",
    strokeOpacity: 0.9,
  });
  const bounds = new maps.LatLngBounds();
  path.forEach((point) => bounds.extend(point));
  map.setBounds(bounds);
}
watch(() => props.route, drawRoute);
onUnmounted(() => {
  alive = false;
  resize?.disconnect();
  line?.setMap(null);
  marker?.setMap(null);
});
</script>
<template>
  <div class="map-panel">
    <div ref="element" class="map-host"></div>
    <div v-if="error" class="map-unavailable">
      <h2>지도 연결 준비</h2>
      <p>{{ error }}</p>
      <p>주행 로그·분석·계정 기능은 계속 사용할 수 있습니다.</p>
    </div>
    <div v-else class="map-controls">
      <button aria-label="지도 확대" @click="map?.setLevel(map.getLevel() - 1)">
        +</button
      ><button
        aria-label="지도 축소"
        @click="map?.setLevel(map.getLevel() + 1)"
      >
        −
      </button>
    </div>
    <small class="map-caption">{{
      error ? "외부 지도 서비스" : "Kakao 지도 · 오른쪽 클릭으로 위치 선택"
    }}</small>
  </div>
</template>
