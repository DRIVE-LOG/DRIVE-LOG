import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
export default defineConfig({ root: 'web', plugins: [vue()], publicDir: false, build: { outDir: '../build/web', emptyOutDir: true }, resolve: { alias: { '@': fileURLToPath(new URL('./web/src', import.meta.url)) } }, server: { host: '127.0.0.1', proxy: { '/api': 'http://127.0.0.1:4173', '/assets': 'http://127.0.0.1:4173' } } });
