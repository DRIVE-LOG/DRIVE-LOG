<script setup>
import { ref } from 'vue';
import {
  inspectUpload,
  identifyRecords,
  MAX_BYTES,
} from '../../../functions/lib/upload.js';
import { useLogs } from '../stores/logs.js';
import ModalDialog from './ModalDialog.vue';
import { friendlyError } from '../services/firebase.js';
const emit = defineEmits(['close']);
const logs = useLogs(),
  preview = ref(null),
  records = ref([]),
  busy = ref(false),
  error = ref(''),
  progress = ref(null),
  filename = ref('');
let selection = 0;
async function select(file) {
  if (busy.value || !file) return;
  const version = ++selection;
  error.value = '';
  preview.value = null;
  records.value = [];
  progress.value = null;
  try {
    if (file.size > MAX_BYTES) throw new Error('파일은 5 MB 이하여야 합니다.');
    if (!/\.(txt|log)$/i.test(file.name))
      throw new Error('TXT 또는 LOG 파일을 선택해 주세요.');
    const inspected = inspectUpload(await file.text());
    const identified = await identifyRecords(
      inspected.records.map((row) => ({
        ...row,
        fileName: file.name.slice(0, 255),
      })),
    );
    if (version !== selection) return;
    records.value = identified;
    preview.value = inspected;
    filename.value = file.name;
  } catch (cause) {
    if (version === selection) error.value = friendlyError(cause);
  }
}
async function upload() {
  busy.value = true;
  error.value = '';
  try {
    const result = await logs.upload(records.value, (value) => {
      progress.value = value;
    });
    if (result.failures.length) {
      records.value = result.failures.map((item) => item.record);
      error.value = `${result.failures.length}행 저장에 실패했습니다. 실패한 행만 다시 시도할 수 있습니다.`;
    } else emit('close');
  } catch (cause) {
    error.value = friendlyError(cause);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <ModalDialog title="로그 업로드" :busy="busy" @close="emit('close')"
    ><p class="muted">
      원문을 저장한 뒤 자동으로 정제합니다. 형식 오류 행도 원문으로 보존됩니다.
    </p>
    <label
      class="dropzone"
      @dragover.prevent
      @drop.prevent="select($event.dataTransfer.files[0])"
      ><strong>로그 파일을 놓거나 선택하세요</strong
      ><span>TXT, LOG · 최대 5 MB · 10,000행</span
      ><input
        type="file"
        accept=".txt,.log,text/plain"
        :disabled="busy"
        aria-label="로그 파일"
        @change="select($event.target.files[0])"
    /></label>
    <div v-if="preview" class="upload-preview">
      <strong>{{ filename }}</strong>
      <p>
        전체 {{ preview.total }}행 · 정상 {{ preview.valid }}행 · 형식 오류
        {{ preview.invalid }}행 · 측정값 확인 {{ preview.quality }}행
      </p>
      <pre>{{ records[0]?.raw }}</pre>
    </div>
    <div v-if="progress" role="status">
      <progress :value="progress.completed" :max="progress.total"></progress>
      <p>
        {{ progress.completed }} / {{ progress.total }}행 저장 · 성공
        {{ progress.succeeded }} · 실패 {{ progress.failed }}
      </p>
    </div>
    <p v-if="error" class="error-text" role="alert">{{ error }}</p>
    <div class="actions">
      <button
        class="primary"
        :disabled="busy || !records.length"
        @click="upload"
      >
        {{
          busy
            ? '저장 중…'
            : progress?.failed
              ? '실패 행 재시도'
              : '업로드 시작'
        }}
      </button>
    </div></ModalDialog
  >
</template>
