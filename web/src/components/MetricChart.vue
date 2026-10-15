<script setup>
import { computed } from 'vue';
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { chartSeries } from '../../../functions/lib/analytics.js';
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
);
const props = defineProps({
  rows: Array,
  metric: String,
  label: String,
  unit: String,
  color: String,
});
const series = computed(() => chartSeries(props.rows, props.metric));
const data = computed(() => ({
  labels: series.value.points.map((point) =>
    new Date(point.timestamp).toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
  ),
  datasets: [
    {
      label: `${props.label} (${props.unit})`,
      data: series.value.points.map((point) => point.value),
      borderColor: props.color,
      backgroundColor: props.color,
      borderWidth: 2,
      pointRadius: series.value.points.length > 50 ? 0 : 2,
      tension: 0.15,
      spanGaps: false,
    },
  ],
}));
const options = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  interaction: { intersect: false, mode: 'index' },
  plugins: { legend: { display: false } },
  scales: {
    x: {
      ticks: { color: '#aebdc3', maxTicksLimit: 5, maxRotation: 0 },
      grid: { display: false },
    },
    y: { ticks: { color: '#aebdc3' }, grid: { color: '#24343e' } },
  },
};
</script>
<template>
  <article class="chart-panel">
    <div class="chart-heading">
      <h2>{{ label }}</h2>
      <span>{{ unit }}</span>
    </div>
    <div class="chart-canvas">
      <Line
        v-if="rows.length"
        :data="data"
        :options="options"
        role="img"
        :aria-label="`${label} 시간별 추이 차트. 아래 데이터 표에서 개별 수치를 확인할 수 있습니다.`"
      />
      <div v-else class="empty-chart">조회된 측정값이 없습니다.</div>
    </div>
    <small>{{
      series.aggregated
        ? '최대 300개 구간 평균으로 표시 · 통계는 전체 기록 기준'
        : '기록 시각 순 · KST'
    }}</small>
  </article>
</template>
