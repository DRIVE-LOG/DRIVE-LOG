import { spawn } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const settings = existsSync(path.join(root, 'runtime.local.json'))
  ? JSON.parse(
      readFileSync(path.join(root, 'runtime.local.json'), 'utf8').replace(
        /^\uFEFF/,
        '',
      ),
    )
  : {};
const env = { ...process.env, DRIVE_LOG_EMULATORS: '1' };
if (settings.javaHome) {
  env.JAVA_HOME = settings.javaHome;
  env.PATH = path.join(settings.javaHome, 'bin') + path.delimiter + env.PATH;
}
mkdirSync(path.join(root, 'work'), { recursive: true });
const args = [
  path.join(root, 'node_modules/firebase-tools/lib/bin/firebase.js'),
  'emulators:start',
  '--project',
  'demo-drive-log',
  '--only',
  'auth,firestore,functions,storage',
  '--export-on-exit',
  'work/emulator-data',
];
if (
  existsSync(
    path.join(root, 'work/emulator-data/firebase-export-metadata.json'),
  )
)
  args.push('--import', 'work/emulator-data');
const emulator = spawn(process.execPath, args, {
  cwd: root,
  env,
  stdio: 'inherit',
  windowsHide: true,
});
const server = spawn(process.execPath, ['scripts/serve.mjs'], {
  cwd: root,
  env,
  stdio: 'inherit',
  windowsHide: true,
});
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  server.kill('SIGTERM');
  emulator.kill('SIGINT');
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
emulator.on('exit', (code) => {
  server.kill('SIGTERM');
  process.exitCode = code || 0;
});
server.on('exit', (code) => {
  if (!stopping && code) stop();
});
