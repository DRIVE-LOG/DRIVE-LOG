import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

// npm run build 결과물(배포용 정적 파일)은 프로젝트 루트의 dist/ 에 생성됩니다.
export default defineConfig({
  root: 'web',
  plugins: [vue()],
  publicDir: false,
  build: { outDir: '../dist', emptyOutDir: true },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./web/src', import.meta.url)) },
  },
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://127.0.0.1:4173',
      '/assets': 'http://127.0.0.1:4173',
    },
  },
});
