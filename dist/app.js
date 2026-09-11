import { LEVELS } from './lib/parser.js';
import { filterLogs, sortLogs, nextSort, SORT_COLUMNS, summarize, kstDay } from './lib/query.js';
import { inspectUpload, identifyRecords, MAX_BYTES } from './lib/upload.js';
import { createFirebaseService, friendlyError } from './services.js';
if (new URLSearchParams(location.search).get('embedded') === '1') document.documentElement.classList.add('embedded');
const $ = id => document.getElementById(id);
const number = value => value.toLocaleString('ko-KR');
const timeFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const clockFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false });
const state = { logs: [], filtered: [], page: 1, pageSize: 20, sort: { key: null, direction: 'default' }, detailLogs: [], detailIndex: 0, counts: { rejected: 0, pending: 0 }, service: null, busy: false, connecting: false, pending: [], generation: 0 };
let toastTimer, searchTimer, preparation = 0;
function node(tag, className, text) { const result = document.createElement(tag); if (className) result.className = className; if (text !== undefined) result.textContent = String(text); return result; }
function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => $('toast').hidden = true, 5000); }
function errorAt(id, message = '') { $(id).textContent = message; $(id).hidden = !message; }
function badge(level) { return node('span', `level-badge level-${LEVELS.includes(level) ? level : 'DEBUG'}`, level); }
function clock() { $('clock').textContent = clockFormat.format(new Date()); $('clock').dateTime = new Date().toISOString(); }
clock(); setInterval(clock, 1000);
function showDashboard() { if (location.hash !== '#logs') history.replaceState(null, '', '#logs'); $('main').scrollTo({ top: 0 }); }
$('logs-nav').onclick = showDashboard;
window.addEventListener('hashchange', showDashboard);
showDashboard();
document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => { if (!(state.busy && button.dataset.close === 'upload-dialog')) $(button.dataset.close).close(); });
$('upload-dialog').addEventListener('cancel', event => { if (state.busy) event.preventDefault(); });
function openUpload() {
  if (!state.service || state.connecting) { toast('데이터 연결이 준비될 때까지 기다려 주세요.'); return; }
  $('upload-dialog').showModal();
}
$('upload-button').onclick = openUpload;
function filters() { return { search: $('search-input').value, start: $('start-date').value, end: $('end-date').value, level: $('level-filter').value, user: $('user-filter').value }; }
function currentStatus() {
  if (state.connectionError) { $('sync-status').textContent = state.connectionError; return; }
  const { pending, rejected } = state.counts;
  let message = '실시간 연결됨';
  if (pending) message += ` · 정제 대기 ${number(pending)}건`;
  if (rejected) message += ` · 형식 오류 ${number(rejected)}건 (원문 보존)`;
  $('sync-status').textContent = message;
}
function refreshUsers() {
  const selected = $('user-filter').value;
  const users = [...new Set(state.logs.map(log => log.user))].sort();
  $('user-filter').replaceChildren(new Option('전체 사용자', ''), ...users.map(user => new Option(user, user)));
  if (users.includes(selected)) $('user-filter').value = selected;
}
function render() {
  const condition = filters();
  errorAt('filter-error', condition.start && condition.end && condition.start > condition.end ? '종료일은 시작일보다 빠를 수 없습니다.' : '');
  const matched = filterLogs(state.logs, condition);
  state.filtered = sortLogs(matched, state.sort);
  for (const button of document.querySelectorAll('[data-sort]')) {
    const direction = state.sort.key === button.dataset.sort ? state.sort.direction : 'default';
    button.dataset.direction = direction;
    button.closest('th').setAttribute('aria-sort', direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none');
    const next = direction === 'default' ? '오름차순' : direction === 'asc' ? '내림차순' : '기본';
    button.setAttribute('aria-label', `${SORT_COLUMNS[button.dataset.sort]} 정렬: ${direction === 'default' ? '기본' : direction === 'asc' ? '오름차순' : '내림차순'}, 클릭 시 ${next}`);
  }
  $('sort-summary').textContent = state.sort.direction === 'default' ? '기본 · 최신순' : `${SORT_COLUMNS[state.sort.key]} ${state.sort.direction === 'asc' ? '오름차순 ↑' : '내림차순 ↓'}`;
  const summary = summarize(state.filtered), pages = Math.max(1, Math.ceil(summary.total / state.pageSize));
  state.page = Math.min(Math.max(1, state.page), pages);
  for (const [id, key] of [['stat-total','total'],['stat-warning','warning'],['stat-critical','critical'],['stat-quality','quality']]) $(id).textContent = number(summary[key]);
  $('stat-users').textContent = `${summary.users}명의 사용자`; $('nav-count').textContent = number(state.logs.length); $('result-count').textContent = number(summary.total);
  $('result-range').textContent = summary.total ? `${kstDay(matched.at(-1).timestamp)} — ${kstDay(matched[0].timestamp)}` : '';
  const start = (state.page - 1) * state.pageSize, visible = state.filtered.slice(start, start + state.pageSize), fragment = document.createDocumentFragment();
  for (const log of visible) {
    const row = node('tr'), timeCell = node('td'), time = node('time', 'log-time'); time.dateTime = log.timestamp;
    time.append(node('strong', '', timeFormat.format(new Date(log.timestamp))), node('span', '', kstDay(log.timestamp))); timeCell.append(time); row.append(timeCell);
    const levelCell = node('td'); levelCell.append(badge(log.log_level)); row.append(levelCell, node('td', 'log-user', log.user));
    const messageCell = node('td');
    const title = log.Event === 'AirbagDeployed' ? '에어백 전개 감지' : log.Event === 'Collision' ? '차량 충돌 감지' : log.Event || (Object.hasOwn(log, 'Speed') ? '차량 주행 상태' : log.message);
    const messageTitle = node('span', 'message-title', title); messageTitle.title = log.message;
    if (log.hasQualityIssue) messageTitle.append(node('span', 'quality-mark', '확인 필요'));
    messageCell.append(messageTitle, node('span', 'message-meta', log.message)); row.append(messageCell);
    row.append(node('td', 'number-cell', log.Speed == null ? '—' : log.Speed.toFixed(1)), node('td', 'number-cell', log.EngTemp == null ? '—' : log.EngTemp.toFixed(1)));
    const action = node('td'), detail = node('button', 'row-detail', '›'); detail.setAttribute('aria-label', `${log.user}, ${kstDay(log.timestamp)} ${timeFormat.format(new Date(log.timestamp))} 로그 상세`); action.append(detail); row.append(action);
    row.className = 'log-row'; row.onclick = () => openDetail(log); fragment.append(row);
  }
  $('log-rows').replaceChildren(fragment); $('empty-state').hidden = summary.total > 0 || state.connecting;
  $('page-summary').textContent = summary.total ? `${number(start + 1)}–${number(start + visible.length)} / ${number(summary.total)}건` : '0건';
  $('page-number').textContent = `${state.page} / ${pages}`; $('previous-page').disabled = state.page <= 1; $('next-page').disabled = state.page >= pages;
}
$('filter-form').onsubmit = event => event.preventDefault();
$('search-input').oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.page = 1; render(); }, 150); };
for (const id of ['start-date', 'end-date', 'level-filter', 'user-filter']) $(id).onchange = () => { state.page = 1; render(); };
function resetFilters() { clearTimeout(searchTimer); $('filter-form').reset(); state.page = 1; render(); }
$('reset-filters').onclick = resetFilters;
$('page-size').onchange = () => { state.pageSize = Number($('page-size').value); state.page = 1; render(); };
$('previous-page').onclick = () => { state.page--; render(); }; $('next-page').onclick = () => { state.page++; render(); };
for (const button of document.querySelectorAll('[data-sort]')) button.onclick = () => { state.sort = nextSort(state.sort, button.dataset.sort); state.page = 1; render(); };
function openDetail(log) {
  // Keep the viewed sequence stable while live updates arrive in the dashboard.
  state.detailLogs = [...state.filtered]; state.detailIndex = state.detailLogs.findIndex(item => item.id === log.id);
  if (state.detailIndex < 0) return;
  renderDetail(); $('detail-dialog').showModal();
}
function moveDetail(offset) {
  const next = state.detailIndex + offset;
  if (next < 0 || next >= state.detailLogs.length) return;
  state.detailIndex = next; renderDetail();
}
$('detail-previous').onclick = () => moveDetail(-1);
$('detail-next').onclick = () => moveDetail(1);
$('detail-dialog').addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); moveDetail(event.key === 'ArrowLeft' ? -1 : 1); }
});
$('detail-dialog').addEventListener('close', () => { state.detailLogs = []; });
function renderDetail() {
  const log = state.detailLogs[state.detailIndex];
  const fragment = document.createDocumentFragment(), meta = node('div', 'detail-meta');
  meta.append(badge(log.log_level), node('span', '', log.user), node('span', '', `${kstDay(log.timestamp)} ${timeFormat.format(new Date(log.timestamp))} KST`)); fragment.append(meta);
  const grid = node('dl', 'detail-grid');
  const fields = [['Speed','속도','km/h'],['Accel','가속도','m/s²'],['Brake','브레이크',''],['Dist','누적 거리','km'],['EngTemp','엔진 온도','°C'],['FuelEff','연비','km/L'],['GForce','충격 가속도','G'],['Event','이벤트',''],['Impact','충돌 강도',''],['Location','위치 (위도, 경도)','']];
  for (const [key, label, unit] of fields) {
    if (!(key in log)) continue;
    const field = node('div', 'detail-field'), value = log[key];
    const display = value == null ? '값 없음' : key === 'Location' ? `${value.latitude}, ${value.longitude}` : `${value}${unit ? ` ${unit}` : ''}`;
    field.append(node('dt', '', label), node('dd', '', display)); grid.append(field);
  }
  fragment.append(grid);
  if (log.hasQualityIssue) {
    fragment.append(node('h3', 'detail-section-title', '데이터 확인 사항'));
    const list = node('ul', 'quality-list');
    for (const key of log.missingFields || []) list.append(node('li', '', `${key}: 원본 값이 누락되어 있습니다.`));
    for (const issue of log.invalidFields || []) list.append(node('li', '', issue)); fragment.append(list);
  }
  fragment.append(node('h3', 'detail-section-title', '원시 로그'), node('pre', 'raw-log', log.raw || log.message));
  if (log.fileName) fragment.append(node('p', 'connection-help', `업로드 파일: ${log.fileName}`));
  $('detail-content').replaceChildren(fragment); $('detail-content').scrollTop = 0;
  $('detail-position').textContent = `${number(state.detailIndex + 1)} / ${number(state.detailLogs.length)}`;
  $('detail-previous').disabled = state.detailIndex === 0;
  $('detail-next').disabled = state.detailIndex === state.detailLogs.length - 1;
}
function updateConnectionStatus(message, isError = false) {
  state.connectionError = isError ? message : '';
  $('retry-connection').hidden = !isError;
  $('live-label').replaceChildren(...(isError ? [document.createTextNode('연결 확인')] : [node('i'), document.createTextNode(' LIVE')]));
  currentStatus();
}
async function connect() {
  if (state.busy || state.connecting) return;
  state.connecting = true; state.connectionError = ''; const generation = ++state.generation; preparation++;
  state.service?.close(); state.service = null; state.logs = []; state.counts = { rejected: 0, pending: 0 }; state.pending = [];
  $('upload-preview').hidden = true; $('upload-progress-area').hidden = true; $('file-input').value = ''; $('confirm-upload').disabled = true;
  $('retry-connection').disabled = true; $('retry-connection').hidden = true;
  $('sync-status').textContent = '데이터를 불러오는 중입니다…'; $('live-label').textContent = '연결 중'; refreshUsers(); render();
  try {
    const onChange = (logs, counts) => { if (generation !== state.generation) return; state.logs = logs; state.counts = counts; refreshUsers(); render(); currentStatus(); };
    const onStatus = (message, isError = false) => { if (generation !== state.generation) return; updateConnectionStatus(message, isError); };
    state.service = await createFirebaseService(onChange, onStatus);
  } catch (error) { console.error('Data connection failed:', error); updateConnectionStatus(friendlyError(error), true); }
  finally { state.connecting = false; $('retry-connection').disabled = false; render(); }
}
$('retry-connection').onclick = connect;
async function prepareFile(file) {
  if (!file || state.busy) return;
  const token = ++preparation;
  errorAt('upload-error'); $('confirm-upload').disabled = true; $('upload-preview').hidden = true; $('upload-progress-area').hidden = true; state.pending = [];
  try {
    if (file.size > MAX_BYTES) throw new Error('파일은 5 MB 이하여야 합니다.');
    if (file.name.length > 255) throw new Error('파일 이름은 255자 이하여야 합니다.');
    const content = await file.text(), inspected = inspectUpload(content);
    const records = await identifyRecords(inspected.records);
    if (token !== preparation) return;
    state.pending = records.map(record => ({ ...record, fileName: file.name }));
    const fragment = document.createDocumentFragment();
    fragment.append(node('strong', '', file.name), node('div', '', `전체 ${number(inspected.total)}행 · 정제 가능 ${number(inspected.valid)}행 · 형식 오류 ${number(inspected.invalid)}행`), node('div', '', `정제 가능한 로그 중 데이터 확인 필요 ${number(inspected.quality)}행`));
    if (inspected.invalid) {
      const list = node('ul', 'quality-list'); for (const record of inspected.records.filter(row => row.error).slice(0, 3)) list.append(node('li', '', `${record.lineNumber}행: ${record.error}`));
      fragment.append(list, node('p', '', '형식 오류가 있는 행도 원문을 보존하며, 정제된 목록에는 표시하지 않습니다.'));
    }
    $('upload-preview').replaceChildren(fragment); $('upload-preview').hidden = false; $('confirm-upload').disabled = false; $('confirm-upload').textContent = '업로드 시작';
  } catch (error) { if (token === preparation) errorAt('upload-error', error.message); }
}
$('file-input').onchange = event => prepareFile(event.target.files[0]);
for (const eventName of ['dragenter', 'dragover']) $('dropzone').addEventListener(eventName, event => { event.preventDefault(); if (!state.busy) $('dropzone').classList.add('drag-over'); });
for (const eventName of ['dragleave', 'drop']) $('dropzone').addEventListener(eventName, event => { event.preventDefault(); $('dropzone').classList.remove('drag-over'); });
$('dropzone').addEventListener('drop', event => prepareFile(event.dataTransfer.files[0]));
function setBusy(busy) {
  state.busy = busy;
  for (const id of ['file-input','confirm-upload','retry-connection']) $(id).disabled = busy;
  document.querySelector('[data-close="upload-dialog"]').disabled = busy; $('confirm-upload').disabled = busy || !state.pending.length;
}
$('confirm-upload').onclick = async () => {
  if (state.busy || !state.pending.length || !state.service) return;
  setBusy(true); errorAt('upload-error'); $('upload-progress-area').hidden = false; $('upload-progress').value = 0;
  try {
    const result = await state.service.upload(state.pending, progress => {
      $('upload-progress').value = progress.completed / progress.total * 100;
      $('upload-progress-label').textContent = `${number(progress.completed)} / ${number(progress.total)}행 처리 · 저장 ${number(progress.succeeded)} · 실패 ${number(progress.failed)}`;
    });
    state.pending = result.failures.map(failure => failure.record);
    if (result.failures.length) { console.error('Upload failures:', result.failures); errorAt('upload-error', `${result.failures.length}행을 저장하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.`); $('confirm-upload').textContent = '실패한 행 재시도'; }
    else {
      $('upload-progress-label').textContent = '저장 완료. 처리가 끝난 로그부터 목록에 표시됩니다.';
      toast('로그를 저장했습니다. 처리 결과가 목록에 반영됩니다.'); $('confirm-upload').textContent = '저장 완료'; state.page = 1; render();
      $('upload-dialog').close(); $('file-input').value = ''; $('upload-preview').hidden = true; $('upload-progress-area').hidden = true;
    }
  } catch (error) { errorAt('upload-error', friendlyError(error)); $('confirm-upload').textContent = '업로드 재시도'; }
  finally { setBusy(false); }
};
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  try {
    Promise.resolve(document.modelContext.registerTool({
      name: 'filter_vehicle_logs', title: '차량 로그 필터 설정', description: '화면의 날짜, 등급, 사용자, 검색어 필터를 설정하고 조회 건수를 반환합니다.',
      inputSchema: { type: 'object', properties: { search: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' }, level: { type: 'string', enum: ['', ...LEVELS] }, user: { type: 'string' } }, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input) {
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('필터 객체가 필요합니다.');
        if (Object.keys(input).some(key => !['search','start','end','level','user'].includes(key)) || Object.values(input).some(value => typeof value !== 'string')) throw new Error('필터 입력이 올바르지 않습니다.');
        if (input.level && !LEVELS.includes(input.level)) throw new Error('올바른 로그 등급이 아닙니다.');
        for (const key of ['start','end']) if (input[key] && (!/^\d{4}-\d{2}-\d{2}$/.test(input[key]) || Number.isNaN(Date.parse(input[key])) || new Date(input[key]).toISOString().slice(0,10) !== input[key])) throw new Error('올바른 날짜가 아닙니다.');
        if (input.start && input.end && input.start > input.end) throw new Error('날짜 범위가 올바르지 않습니다.');
        if (input.user && !state.logs.some(log => log.user === input.user)) throw new Error('해당 사용자가 없습니다.');
        for (const [key,id] of Object.entries({ search:'search-input',start:'start-date',end:'end-date',level:'level-filter',user:'user-filter' })) $(id).value = input[key] || '';
        clearTimeout(searchTimer); state.page = 1; render(); return { count: state.filtered.length, filters: filters() };
      }
    }, { signal: lifecycle.signal })).catch(error => console.info('WebMCP unavailable:', error.message));
    window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
  } catch (error) { console.info('WebMCP unavailable:', error.message); }
}
window.addEventListener('pagehide', () => state.service?.close(), { once: true });
await connect();
