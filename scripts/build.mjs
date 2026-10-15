import { mkdir, copyFile, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'vite';
const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(path.join(root, 'dist/lib'), { recursive: true });
await mkdir(path.join(root, 'dist/vendor'), { recursive: true });
await copyFile(path.join(root, 'node_modules/axios/dist/esm/axios.js'), path.join(root, 'dist/vendor/axios.js'));
for (const file of ['parser.js', 'query.js', 'upload.js']) {
  const source = path.join(root, 'functions/lib', file);
  await copyFile(source, path.join(root, 'dist/lib', file));
}
console.log('Build complete: dist/');
await build({ configFile: path.join(root, 'vite.config.js') });
await cp(path.join(root,'infotainment/public/assets'),path.join(root,'build/web/assets'),{recursive:true});
await copyFile(path.join(root,'dist/favicon.svg'),path.join(root,'build/web/favicon.svg'));
