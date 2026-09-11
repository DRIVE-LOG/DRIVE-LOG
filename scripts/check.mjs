import { readFile, readdir, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
let checked = 0;
async function checkDirectory(directory) {
  for (const item of await readdir(path.join(root, directory), { withFileTypes: true })) {
    if (item.name === 'node_modules') continue;
    const name = path.join(directory, item.name);
    if (item.isDirectory()) await checkDirectory(name);
    else if (/\.(m?js)$/.test(name)) { const result = spawnSync(process.execPath, ['--check', path.join(root, name)], { encoding: 'utf8' }); if (result.status !== 0) throw new Error(`${name}: ${result.stderr}`); checked++; }
  }
}
for (const dir of ['dist', 'functions', 'scripts', 'tests']) await checkDirectory(dir);
for (const file of ['package.json', 'functions/package.json', 'firebase.json', 'firestore.indexes.json']) JSON.parse(await readFile(path.join(root, file), 'utf8'));
const html = await readFile(path.join(root, 'dist/index.html'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
if (new Set(ids).size !== ids.length) throw new Error('Duplicate HTML IDs');
for (const match of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)) await access(path.join(root, 'dist', match[1]));
const app = await readFile(path.join(root, 'dist/app.js'), 'utf8');
for (const match of app.matchAll(/\$\('([^']+)'\)/g)) if (!ids.includes(match[1])) throw new Error(`Missing HTML ID: ${match[1]}`);
for (const file of ['parser.js','query.js','upload.js']) {
  const source = await readFile(path.join(root, 'functions/lib', file), 'utf8'), built = await readFile(path.join(root, 'dist/lib', file), 'utf8');
  if (source !== built) throw new Error(`Shared module is stale: ${file}`);
}
console.log(`Check passed: ${checked} JavaScript modules, JSON configs, HTML IDs, asset paths and shared modules.`);
