<script setup>
import { ref } from 'vue';
import { useLogs } from '../stores/logs.js';
import LogFilters from '../components/LogFilters.vue';
import LogTable from '../components/LogTable.vue';
import UploadDialog from '../components/UploadDialog.vue';
import AppIcon from '../components/AppIcon.vue';
const logs = useLogs(),
  upload = ref(false);
</script>
<template>
  <section>
    <div class="page-heading">
      <div>
        <h1>로그 관리</h1>
        <p>주행의 모든 기록을 한곳에서 확인하세요.</p>
      </div>
      <button class="primary" @click="upload = true">
        <AppIcon name="upload" />로그 업로드
      </button>
    </div>
    <div class="summary-strip">
      <div>
        <span>조회된 로그</span
        ><strong>{{ logs.analysis.total.toLocaleString() }}</strong>
      </div>
      <div>
        <span>주의 · WARNING</span
        ><strong class="warning-text">{{
          logs.analysis.levels.WARNING || 0
        }}</strong>
      </div>
      <div>
        <span>위험 · ERROR / CRITICAL</span
        ><strong class="error-text">{{
          (logs.analysis.levels.ERROR || 0) +
          (logs.analysis.levels.CRITICAL || 0)
        }}</strong>
      </div>
      <div>
        <span>측정값 확인 필요</span
        ><strong>{{ logs.analysis.quality }}</strong>
      </div>
    </div>
    <div class="panel"><LogFilters /><LogTable /></div>
    <p class="muted processing-status" role="status">
      자동 정제 대기 {{ logs.counts.pending }}행 · 형식 오류로 제외
      {{ logs.counts.rejected }}행
    </p>
    <UploadDialog v-if="upload" @close="upload = false" />
  </section>
</template>
