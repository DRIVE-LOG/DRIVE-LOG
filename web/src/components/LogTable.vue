<script setup>
import { ref, computed, watch } from 'vue';
import { useLogs } from '../stores/logs.js';
import { useSession } from '../stores/session.js';
import { nextSort, SORT_COLUMNS } from '../../../functions/lib/query.js';
import { NUMERIC_FIELDS } from '../../../functions/lib/parser.js';
import ModalDialog from './ModalDialog.vue';
const logs = useLogs(),
  page = ref(1),
  pageSize = ref(20),
  detailRows = ref([]),
  detailIndex = ref(-1);
watch(
  () => useSession().user?.uid,
  () => {
    detailRows.value = [];
    detailIndex.value = -1;
    page.value = 1;
  },
);
const pages = computed(() =>
  Math.max(1, Math.ceil(logs.sorted.length / pageSize.value)),
);
const visible = computed(() =>
  logs.sorted.slice(
    (page.value - 1) * pageSize.value,
    page.value * pageSize.value,
  ),
);
const detail = computed(() => detailRows.value[detailIndex.value]);
const time = (value) =>
  new Date(value).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour12: false,
  });
watch(
  [() => ({ ...logs.filters }), () => logs.sort, pageSize],
  () => {
    page.value = 1;
  },
  { deep: true },
);
watch(pages, (value) => {
  page.value = Math.min(page.value, value);
});
function inspect(id) {
  detailRows.value = [...logs.sorted];
  detailIndex.value = detailRows.value.findIndex((row) => row.id === id);
}
function move(direction) {
  detailIndex.value = Math.max(
    0,
    Math.min(detailRows.value.length - 1, detailIndex.value + direction),
  );
}
</script>
<template>
  <div class="result-bar">
    <span
      ><strong>{{ logs.sorted.length.toLocaleString() }}</strong
      >개의 기록</span
    ><span>{{
      logs.sort.key
        ? `${SORT_COLUMNS[logs.sort.key]} · ${logs.sort.direction === 'asc' ? '오름차순' : '내림차순'}`
        : '기본 · 최신순'
    }}</span>
  </div>
  <div class="table-scroll">
    <table>
      <caption class="sr-only">
        차량 로그 목록
      </caption>
      <thead>
        <tr>
          <th
            v-for="(label, key) in SORT_COLUMNS"
            :key="key"
            :aria-sort="
              logs.sort.key === key
                ? logs.sort.direction === 'asc'
                  ? 'ascending'
                  : 'descending'
                : 'none'
            "
          >
            <button @click="logs.sort = nextSort(logs.sort, key)">
              {{ label }}
              <span aria-hidden="true">{{
                logs.sort.key === key
                  ? logs.sort.direction === 'asc'
                    ? '↑'
                    : '↓'
                  : '↕'
              }}</span>
            </button>
          </th>
          <th>상세</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="log in visible" :key="log.id" @click="inspect(log.id)">
          <td class="numeric">{{ time(log.timestamp) }}</td>
          <td>
            <span class="level" :class="log.log_level">{{
              log.log_level
            }}</span>
          </td>
          <td>{{ log.user }}</td>
          <td class="message-cell" :title="log.message">{{ log.message }}</td>
          <td class="numeric">{{ log.Speed ?? '—' }}</td>
          <td class="numeric">{{ log.EngTemp ?? '—' }}</td>
          <td>
            <button
              class="text-button"
              :aria-label="`${log.user} ${time(log.timestamp)} 상세`"
              @click.stop="inspect(log.id)"
            >
              보기
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <div v-if="!logs.sorted.length" class="empty-state">
    <h3>표시할 로그가 없습니다</h3>
    <p>로그를 업로드하거나 조회 조건을 변경해 주세요.</p>
  </div>
  <div class="pagination">
    <label
      >페이지당
      <select v-model.number="pageSize">
        <option :value="20">20개</option>
        <option :value="50">50개</option>
        <option :value="100">100개</option>
      </select></label
    >
    <div>
      <button :disabled="page === 1" @click="page--" aria-label="이전 페이지">
        이전</button
      ><span>{{ page }} / {{ pages }}</span
      ><button
        :disabled="page >= pages"
        @click="page++"
        aria-label="다음 페이지"
      >
        다음
      </button>
    </div>
  </div>
  <ModalDialog
    v-if="detail"
    title="로그 상세"
    @close="detailIndex = -1"
    @keydown.left="move(-1)"
    @keydown.right="move(1)"
    ><div class="detail-meta">
      <span class="level" :class="detail.log_level">{{ detail.log_level }}</span
      ><strong>{{ detail.user }}</strong
      ><time>{{ time(detail.timestamp) }} KST</time>
    </div>
    <dl class="detail-metrics">
      <template v-for="(field, key) in NUMERIC_FIELDS" :key="key"
        ><dt>{{ key }}</dt>
        <dd>
          {{ detail[key] ?? '미측정' }}
          {{ detail[key] != null ? field.unit : '' }}
        </dd></template
      >
    </dl>
    <p>{{ detail.message }}</p>
    <p v-if="detail.Location">
      위치: {{ detail.Location.latitude }}, {{ detail.Location.longitude }}
    </p>
    <p v-if="detail.hasQualityIssue" class="notice warning">
      누락: {{ detail.missingFields?.join(', ') || '없음' }}<br />확인:
      {{ detail.invalidFields?.join(', ') || '없음' }}
    </p>
    <details>
      <summary>원문 보기</summary>
      <pre>{{ detail.raw }}</pre>
    </details>
    <div class="detail-navigation">
      <button :disabled="detailIndex === 0" @click="move(-1)">이전 로그</button
      ><span>{{ detailIndex + 1 }} / {{ detailRows.length }}</span
      ><button
        :disabled="detailIndex === detailRows.length - 1"
        @click="move(1)"
      >
        다음 로그
      </button>
    </div></ModalDialog
  >
</template>
