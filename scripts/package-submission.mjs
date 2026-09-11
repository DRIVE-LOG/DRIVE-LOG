import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { zipSync, unzipSync } from 'fflate';

const root = fileURLToPath(new URL('../', import.meta.url));
const name = '임베디드_웹_관통PJT2_서울_20반_장문수_최현준';
const topFiles = ['.gitignore','.gitattributes','.firebaserc.example','README.md','package.json','package-lock.json','firebase.json','firestore.rules','firestore.indexes.json'];
const files = [...topFiles];
const excludedDirectories = new Set(['node_modules','.git','output','data','log_upload']);
const isPrivate = name => name === '.firebaserc' || name === 'config.local.js' || (name.startsWith('.env') && name !== '.env.example') || /service[-_]?account|\.(?:pem|key)$/i.test(name);
async function walk(relative) {
  for (const item of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const child = `${relative}/${item.name}`;
    if (isPrivate(item.name) || item.isSymbolicLink()) continue;
    if (item.isDirectory()) {
      if (!excludedDirectories.has(item.name) && !['dist/lib','dist/vendor'].includes(child)) await walk(child);
    } else if (item.isFile() && !/\.(?:zip|pdf|log)$/i.test(item.name)) files.push(child);
  }
}
for (const directory of ['dist','infotainment','functions','scripts','tests','docs','submission/screenshots']) await walk(directory);
files.push('submission/RESULTS.md');
files.push('submission/FILES.md');
const inventory = [
  '# 제출 ZIP 파일 목록',
  '',
  `제출 파일: \`${name}.zip\``,
  '',
  `압축 최상위 폴더는 \`${name}/\`이며, 아래 ${files.length}개 파일과 자동 생성되는 \`MANIFEST.sha256\` 1개를 포함합니다. 이 목록은 \`npm run package:submission\`으로 실제 포함 경로에서 생성합니다.`,
  '',
  '## 포함 파일',
  '',
  ...files.slice().sort().map(file => `- \`${file}\``),
  '- `MANIFEST.sha256` (압축 내부에만 생성)',
  '',
  '## 제외 항목',
  '',
  '- 기본 제공 명세서·PDF·원본 ZIP·예제 묶음·원본 로그 데이터',
  '- 실제 Firebase 웹 설정(config.local.js), 프로젝트 선택(.firebaserc), .env 및 인증 토큰·개인 키',
  '- Firebase 데이터베이스 내보내기 파일',
  '- node_modules, .git, 임시 output, 디버그 로그',
  '- 빌드 시 생성되는 dist/lib와 dist/vendor (npm start 시 재생성)',
  '- 제출 ZIP 자체 (재귀 압축 방지)',
  '',
  '실행에 필요한 Firebase 설정은 예시 파일을 복사해 별도로 입력합니다. 실행 방법과 두 저장소 주소는 루트 README.md를 참고하세요.',
  '',
].join('\n');
await mkdir(path.join(root, 'submission'), { recursive: true });
await writeFile(path.join(root, 'submission/FILES.md'), inventory);
const entries = {}, manifest = [];
for (const relative of files.sort()) {
  let bytes = await readFile(path.join(root, relative));
  // The archive cannot contain itself; keep the repository download link as a filename inside it.
  if (relative === 'README.md') bytes = Buffer.from(bytes.toString('utf8').replace(`[${name}.zip](submission/${name}.zip)`, `\`${name}.zip\``));
  if (/\.(?:js|mjs|json|html|md|css)$/.test(relative)) {
    const text = bytes.toString('utf8');
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AIza[0-9A-Za-z_-]{30,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/.test(text)) throw new Error(`Credential-like content in ${relative}`);
  }
  entries[`${name}/${relative}`] = bytes;
  manifest.push(`${createHash('sha256').update(bytes).digest('hex')}  ${relative}`);
}
entries[`${name}/MANIFEST.sha256`] = Buffer.from(manifest.join('\n')+'\n');
const zip = zipSync(entries, { level: 6 });
const verified = unzipSync(zip);
if (Object.keys(verified).length !== Object.keys(entries).length) throw new Error('ZIP entry count mismatch');
for (const [entry, bytes] of Object.entries(entries)) if (!Buffer.from(verified[entry]).equals(bytes)) throw new Error(`ZIP content mismatch: ${entry}`);
await mkdir(path.join(root, 'submission'), { recursive: true });
await writeFile(path.join(root, 'submission', `${name}.zip`), zip);
console.log(`Verified ${Object.keys(entries).length} entries, ${(zip.byteLength / 1024 / 1024).toFixed(2)} MB: submission/${name}.zip`);
