<script setup>
import { useLogs } from '../stores/logs.js';
const logs = useLogs();
</script>
<template>
  <form class="filters" role="search" @submit.prevent>
    <label
      >키워드 검색<input
        v-model="logs.filters.search"
        type="search"
        placeholder="메시지, 이벤트, 사용자" /></label
    ><label
      >시작일 · KST<input v-model="logs.filters.start" type="date" /></label
    ><label>종료일 · KST<input v-model="logs.filters.end" type="date" /></label
    ><label
      >로그 등급<select v-model="logs.filters.level">
        <option value="">전체 등급</option>
        <option>INFO</option>
        <option>WARNING</option>
        <option>ERROR</option>
        <option>CRITICAL</option>
        <option>DEBUG</option>
      </select></label
    ><label
      >사용자<select v-model="logs.filters.user">
        <option value="">전체 사용자</option>
        <option v-for="user in logs.users" :key="user">{{ user }}</option>
      </select></label
    ><button type="button" class="text-button" @click="logs.reset">
      초기화
    </button>
  </form>
  <p
    v-if="
      logs.filters.start &&
      logs.filters.end &&
      logs.filters.start > logs.filters.end
    "
    class="error-text"
    role="alert"
  >
    종료일은 시작일 이후로 선택해 주세요.
  </p>
  <p v-if="logs.error" class="notice error" role="alert">
    {{ logs.error }} <button @click="logs.subscribe">다시 연결</button>
  </p>
</template>
