<script setup>
import { onMounted, ref } from 'vue';
import AppIcon from './AppIcon.vue';
defineProps({ title: String, busy: Boolean });
const emit = defineEmits(['close']);
const dialog = ref(null);
onMounted(() => dialog.value.showModal());
</script>
<template>
  <dialog
    ref="dialog"
    class="modal"
    aria-labelledby="modal-title"
    @cancel.prevent="!busy && emit('close')"
  >
    <div class="modal-heading">
      <h2 id="modal-title">{{ title }}</h2>
      <button
        class="icon-button"
        :disabled="busy"
        aria-label="닫기"
        @click="emit('close')"
      >
        <AppIcon name="close" />
      </button>
    </div>
    <slot />
  </dialog>
</template>
