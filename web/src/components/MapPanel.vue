<script setup>
import { ref, onMounted, onUnmounted, watch, defineAsyncComponent } from "vue";
import { load3DStyle, routeFeature } from "../services/map-style.js";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
const KakaoMap = defineAsyncComponent(() => import("./KakaoMap.vue"));
const props = defineProps({
  position: {
    type: Object,
    default: () => ({ latitude: 37.5665, longitude: 126.978 }),
  },
  route: Array,
});
const emit = defineEmits(["select"]);
const element = ref(null),
  error = ref(""),
  ready = ref(false),
  flat = ref(false),
  fallback = ref(false),
  pitch = ref(55),
  bearing = ref(-20);
let map,
  library,
  marker,
  resize,
  alive = true;
const request = new AbortController();
const animation = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 400;
function syncRoute(fit = true) {
  if (!ready.value || !map) return;
  const geojson = routeFeature(props.route);
  map.getSource("drive-route").setData(geojson);
  if (!fit || !geojson.features.length) return;
  const points = geojson.features[0].geometry.coordinates;
  const bounds = new library.LngLatBounds(points[0], points[0]);
  points.forEach((point) => bounds.extend(point));
  map.fitBounds(bounds, {
    padding: 65,
    maxZoom: 16.5,
    pitch: flat.value ? 0 : 55,
    bearing: map.getBearing(),
    duration: animation(),
  });
}
function toggleDimension() {
  flat.value = !flat.value;
  map?.easeTo({ pitch: flat.value ? 0 : 55, duration: animation() });
}
function rotate(amount) {
  map?.easeTo({
    bearing: map.getBearing() + amount,
    pitch: flat.value ? 0 : 55,
    duration: animation(),
  });
}
function resetNorth() {
  map?.easeTo({
    bearing: 0,
    pitch: flat.value ? 0 : 55,
    duration: animation(),
  });
}
function dispose() {
  resize?.disconnect();
  marker?.remove();
  map?.remove();
  map = null;
  ready.value = false;
}
function useFallback() {
  request.abort();
  dispose();
  fallback.value = true;
}
onMounted(async () => {
  const timeout = setTimeout(() => request.abort(), 15000);
  try {
    const [module, style] = await Promise.all([
      import("maplibre-gl"),
      load3DStyle(request.signal),
    ]);
    if (!alive) return;
    library = module;
    library.setWorkerUrl(workerUrl);
    map = new library.Map({
      container: element.value,
      style,
      center: [props.position.longitude, props.position.latitude],
      zoom: 16,
      pitch: 55,
      bearing: -20,
      maxPitch: 65,
      canvasContextAttributes: { antialias: true },
      attributionControl: { compact: true },
      locale: {
        "AttributionControl.ToggleAttribution": "지도 출처 보기",
        "Map.Title": "3D 지도",
      },
    });
    marker = new library.Marker({ color: "#098b72" })
      .setLngLat([props.position.longitude, props.position.latitude])
      .addTo(map);
    map.addControl(
      new library.ScaleControl({ maxWidth: 90, unit: "metric" }),
      "bottom-left",
    );
    map.on("load", () => {
      if (!alive) return;
      map.addSource("drive-route", { type: "geojson", data: routeFeature() });
      const firstLabel = map
        .getStyle()
        .layers.find(
          (layer) => layer.type === "symbol" && layer.layout?.["text-field"],
        )?.id;
      map.addLayer(
        {
          id: "drive-route-outline",
          type: "line",
          source: "drive-route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#ffffff",
            "line-width": 9,
            "line-opacity": 0.9,
          },
        },
        firstLabel,
      );
      map.addLayer(
        {
          id: "drive-route-line",
          type: "line",
          source: "drive-route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#07866b", "line-width": 5 },
        },
        firstLabel,
      );
      ready.value = true;
      error.value = "";
      syncRoute();
    });
    map.on("error", () => {
      if (!ready.value && alive)
        error.value =
          "3D 지도를 불러오지 못했습니다. 네트워크 연결을 확인하거나 2D 지도를 이용해 주세요.";
    });
    map.on("webglcontextlost", () => {
      error.value =
        "3D 그래픽 연결이 중단되었습니다. 2D 지도로 전환할 수 있습니다.";
    });
    map.on("webglcontextrestored", () => {
      error.value = "";
    });
    map.on("moveend", () => {
      pitch.value = Math.round(map.getPitch());
      bearing.value = Math.round(map.getBearing());
      flat.value = map.getPitch() < 5;
    });
    map.on("click", (event) => {
      marker.setLngLat(event.lngLat);
      emit("select", {
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
      });
    });
    resize = new ResizeObserver(() => map?.resize());
    resize.observe(element.value);
  } catch (cause) {
    if (alive)
      error.value =
        "3D 지도를 시작하지 못했습니다. 2D 지도를 이용하거나 브라우저의 그래픽 가속을 확인해 주세요.";
  } finally {
    clearTimeout(timeout);
  }
});
watch(
  () => props.position,
  (position) => {
    if (!map) return;
    marker.setLngLat([position.longitude, position.latitude]);
    if (!props.route?.length)
      map.easeTo({
        center: [position.longitude, position.latitude],
        duration: animation(),
      });
  },
);
watch(
  () => props.route,
  () => syncRoute(),
);
onUnmounted(() => {
  alive = false;
  request.abort();
  dispose();
});
</script>
<template>
  <KakaoMap
    v-if="fallback"
    :position="position"
    :route="route"
    @select="emit('select', $event)"
  />
  <div
    v-else
    class="map-panel map-panel-3d"
    :data-map-ready="ready"
    :data-map-mode="flat ? '2d' : '3d'"
  >
    <div
      ref="element"
      class="map-host"
      aria-label="건물 높이를 표시하는 3D 지도"
    ></div>
    <div v-if="error" class="map-unavailable" role="alert">
      <h2>지도 연결 확인</h2>
      <p>{{ error }}</p>
      <button @click="useFallback">카카오 2D 지도 사용</button>
    </div>
    <p v-else-if="!ready" class="map-loading" role="status">
      3D 지도를 불러오는 중입니다.
    </p>
    <template v-else>
      <div class="map-view-tools" role="group" aria-label="지도 시점 조작">
        <button
          @click="toggleDimension"
          :aria-pressed="!flat"
          aria-label="3D 지도 켜기 또는 끄기"
        >
          {{ flat ? "3D" : "2D" }} 보기</button
        ><button @click="rotate(-45)" aria-label="지도 왼쪽으로 회전">↶</button
        ><button @click="rotate(45)" aria-label="지도 오른쪽으로 회전">↷</button
        ><button @click="resetNorth" aria-label="지도를 북쪽으로 정렬">
          N ↑
        </button>
      </div>
      <div class="map-controls">
        <button
          aria-label="지도 확대"
          @click="map?.zoomIn({ duration: animation() })"
        >
          +</button
        ><button
          aria-label="지도 축소"
          @click="map?.zoomOut({ duration: animation() })"
        >
          −
        </button>
      </div>
      <div class="map-perspective" aria-live="polite">
        {{ flat ? "2D" : "3D" }} · 기울기 {{ pitch }}° · 방향 {{ bearing }}°
      </div>
      <small class="map-caption"
        >드래그로 이동 · 오른쪽 드래그로 회전 · 클릭으로 위치 선택</small
      >
    </template>
  </div>
</template>
