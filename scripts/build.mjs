import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(path.join(root, 'dist/lib'), { recursive: true });
await mkdir(path.join(root, 'dist/vendor'), { recursive: true });
await copyFile(path.join(root, 'node_modules/axios/dist/esm/axios.js'), path.join(root, 'dist/vendor/axios.js'));
for (const file of ['parser.js', 'query.js', 'upload.js']) {
  const source = path.join(root, 'functions/lib', file);
  await copyFile(source, path.join(root, 'dist/lib', file));
}
console.log('Build complete: dist/');
