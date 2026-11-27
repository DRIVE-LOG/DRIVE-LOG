import { mkdir, copyFile, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const at = (...parts) => path.join(root, ...parts);

// 1) 이전 화면(legacy/)이 사용하는 공유 모듈과 axios 복사
await mkdir(at('legacy/lib'), { recursive: true });
await mkdir(at('legacy/vendor'), { recursive: true });
await copyFile(
  at('node_modules/axios/dist/esm/axios.js'),
  at('legacy/vendor/axios.js'),
);
for (const file of ['parser.js', 'query.js', 'upload.js'])
  await copyFile(at('functions/lib', file), at('legacy/lib', file));

// 2) Vue SPA 빌드 -> dist/
await build({ configFile: at('vite.config.js') });

// 3) 화면에서 쓰는 정적 자산을 dist/ 에 함께 배치 (Nginx 단독 서빙 가능하도록)
await cp(at('infotainment/public/assets'), at('dist/assets'), {
  recursive: true,
});
await copyFile(at('legacy/favicon.svg'), at('dist/favicon.svg'));

console.log('Build complete: dist/');
