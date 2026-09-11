export function kstDay(timestamp) { return new Date(new Date(timestamp).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10); }
const severity = { DEBUG: 0, INFO: 1, WARNING: 2, ERROR: 3, CRITICAL: 4 };
export const SORT_COLUMNS = { timestamp: '기록 시각', log_level: '등급', user: '사용자', message: '메시지', Speed: '속도', EngTemp: '엔진' };
export function nextSort(current, key) {
  if (!Object.hasOwn(SORT_COLUMNS, key)) return { key: null, direction: 'default' };
  const direction = current.key !== key || current.direction === 'default' ? 'asc' : current.direction === 'asc' ? 'desc' : 'default';
  return { key: direction === 'default' ? null : key, direction };
}
function latestFirst(a, b) { return new Date(b.timestamp) - new Date(a.timestamp) || String(a.id).localeCompare(String(b.id)); }
export function sortLogs(logs, { key = null, direction = 'default' } = {}) {
  if (!Object.hasOwn(SORT_COLUMNS, key) || !['asc', 'desc'].includes(direction)) return [...logs].sort(latestFirst);
  const value = log => key === 'log_level' ? severity[log.log_level] : key === 'timestamp' ? new Date(log.timestamp).getTime() : log[key];
  return [...logs].sort((a, b) => {
    const left = value(a), right = value(b), leftMissing = left == null || Number.isNaN(left), rightMissing = right == null || Number.isNaN(right);
    if (leftMissing || rightMissing) return leftMissing === rightMissing ? latestFirst(a, b) : leftMissing ? 1 : -1;
    const compared = typeof left === 'number' ? left - right : String(left).localeCompare(String(right), 'ko', { numeric: true });
    return compared * (direction === 'asc' ? 1 : -1) || latestFirst(a, b);
  });
}
export function filterLogs(logs, { search = '', start = '', end = '', level = '', user = '' } = {}) {
  if (start && end && start > end) return [];
  const keyword = search.trim().toLocaleLowerCase();
  return logs.filter(log => {
    if (level && log.log_level !== level) return false;
    if (user && log.user !== user) return false;
    const day = kstDay(log.timestamp);
    if ((start && day < start) || (end && day > end)) return false;
    return !keyword || `${log.user} ${log.log_level} ${log.message}`.toLocaleLowerCase().includes(keyword);
  }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp) || String(a.id).localeCompare(String(b.id)));
}
export function summarize(logs) {
  return { total: logs.length, users: new Set(logs.map(log => log.user)).size, warning: logs.filter(log => log.log_level === 'WARNING').length, critical: logs.filter(log => ['ERROR', 'CRITICAL'].includes(log.log_level)).length, quality: logs.filter(log => log.hasQualityIssue).length };
}
