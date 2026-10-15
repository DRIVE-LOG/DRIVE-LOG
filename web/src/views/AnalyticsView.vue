<script setup>
import { computed, ref } from 'vue';
import { useLogs } from '../stores/logs.js';
import LogFilters from '../components/LogFilters.vue';
import LogTable from '../components/LogTable.vue';
import MetricChart from '../components/MetricChart.vue';
const logs = useLogs(),
  showTable = ref(false),
  alertLimit = ref(20);
const format = (value) =>
  value == null
    ? '—'
    : value.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
const stats = computed(() => [
  { label: '최고 속도', value: logs.analysis.metrics.Speed.max, unit: 'km/h' },
  {
    label: '최고 엔진 온도',
    value: logs.analysis.metrics.EngTemp.max,
    unit: '°C',
  },
  {
    label: '평균 가속도',
    value: logs.analysis.metrics.Accel.mean,
    unit: 'm/s²',
  },
  {
    label: '평균 연비',
    value: logs.analysis.metrics.FuelEff.mean,
    unit: 'km/L',
  },
]);
const metrics = [
  { key: 'Speed', label: '속도', unit: 'km/h', color: '#6fffd5' },
  { key: 'EngTemp', label: '엔진 온도', unit: '°C', color: '#ffc76b' },
  { key: 'Accel', label: '가속도', unit: 'm/s²', color: '#80bcff' },
  { key: 'FuelEff', label: '연비', unit: 'km/L', color: '#c6b5ff' },
];
</script>
<template>
  <section>
    <div class="page-heading">
      <div>
        <h1>주행 분석</h1>
        <p>속도부터 연비까지, 기록으로 이해하는 주행 습관.</p>
      </div>
      <span class="live-tag">{{ logs.filtered.length }}개의 기록</span>
    </div>
    <LogFilters />
    <div class="summary-strip">
      <div v-for="stat in stats" :key="stat.label">
        <span>{{ stat.label }}</span
        ><strong
          >{{ format(stat.value) }} <small>{{ stat.unit }}</small></strong
        >
      </div>
    </div>
    <div class="charts-grid">
      <MetricChart
        v-for="metric in metrics"
        :key="metric.key"
        :rows="logs.filtered"
        :metric="metric.key"
        :label="metric.label"
        :unit="metric.unit"
        :color="metric.color"
      />
    </div>
    <section class="anomalies panel">
      <div class="panel-heading">
        <h2>이상치 감지</h2>
        <span
          class="level"
          :class="logs.analysis.anomalies.length ? 'WARNING' : 'INFO'"
          >{{ logs.analysis.anomalies.length }}건</span
        >
      </div>
      <p class="muted">
        분석용 임계치입니다. 차량별 제조사 기준에 맞게 조정해 주세요. 임계치를
        초과한 값만 표시합니다.
      </p>
      <div class="thresholds">
        <label v-for="(value, key) in logs.thresholds" :key="key"
          >{{
            {
              Speed: '속도 (km/h)',
              EngTemp: '엔진 온도 (°C)',
              Accel: '가감속 절댓값 (m/s²)',
              GForce: '충격 (G)',
            }[key]
          }}<input
            v-model.number="logs.thresholds[key]"
            type="number"
            min="0.1"
            step="0.1"
            required
        /></label>
      </div>
      <p
        v-if="
          Object.values(logs.thresholds).some(
            (v) => !Number.isFinite(v) || v <= 0,
          )
        "
        class="error-text"
        role="alert"
      >
        임계치는 0보다 큰 숫자를 입력해 주세요.
      </p>
      <ul
        v-if="logs.analysis.anomalies.length"
        class="alert-list"
        aria-live="polite"
      >
        <li
          v-for="(item, index) in logs.analysis.anomalies.slice(0, alertLimit)"
          :key="`${item.id}-${index}`"
        >
          <span class="warning-text">{{ item.label }}</span
          ><strong>{{ item.user }}</strong
          ><span>{{ item.value }} / 기준 {{ item.threshold }}</span
          ><time>{{
            new Date(item.timestamp).toLocaleString('ko-KR', {
              timeZone: 'Asia/Seoul',
            })
          }}</time>
        </li>
      </ul>
      <p v-else>현재 조건에서 임계치를 초과한 기록이 없습니다.</p>
      <button
        v-if="logs.analysis.anomalies.length > alertLimit"
        @click="alertLimit += 50"
      >
        경고 더 보기
      </button>
    </section>
    <button
      class="table-toggle"
      :aria-expanded="showTable"
      @click="showTable = !showTable"
    >
      {{ showTable ? '원본 수치 접기' : '원본 수치와 상세 로그 확인' }}
    </button>
    <div v-if="showTable" class="panel"><LogTable /></div>
  </section>
</template>
