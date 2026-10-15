<script setup>
defineProps({ name: String });
const paths = {
  home: "M3 10 12 3l9 7v11h-6v-7H9v7H3Z",
  logs: "M5 3h14v18H5ZM8 7h8M8 11h8M8 15h5",
  chart: "M4 3v17h17M8 16v-5M13 16V6M18 16V9",
  chat: "M4 4h16v12H9l-5 4ZM8 8h8M8 12h5",
  user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 6 0 0 1 16 0v2",
  settings:
    "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2",
  navigation: "m21 3-7 18-4-7-7-4Z",
  weather:
    "M12 3v2M12 19v2M3 12h2M19 12h2M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  upload: "M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6",
  mic: "M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8",
  close: "m6 6 12 12M6 18 18 6",
  droplet: "M12 3c-2 4-7 8-7 12a7 7 0 0 0 14 0c0-4-5-8-7-12ZM8 15c0 2 2 4 4 4",
  wind: "M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h5a3 3 0 1 1-3 3",
  pressure: "M4 18a9 9 0 1 1 16 0M12 12l4-4M8 18h8",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  vertical: "M12 3v18M7 8l5-5 5 5M7 16l5 5 5-5",
  horizontal: "M3 12h18M8 7l-5 5 5 5M16 7l5 5-5 5",
  arrow: "M5 12h14m-6-6 6 6-6 6",
};
</script>
<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name] || paths.logs" />
  </svg>
</template>
