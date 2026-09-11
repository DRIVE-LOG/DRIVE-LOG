export const LEVELS = ['INFO', 'WARNING', 'ERROR', 'CRITICAL', 'DEBUG'];
export const NUMERIC_FIELDS = {
  Speed: { unit: 'km/h', nonnegative: true },
  Accel: { unit: 'm/s²' },
  Dist: { unit: 'km', nonnegative: true },
  EngTemp: { unit: '°C' },
  FuelEff: { unit: 'km/L', nonnegative: true },
  GForce: { unit: 'G', nonnegative: true },
};

// Source timestamps have no offset. The assignment's vehicle logs are interpreted as KST.
export function parseKstTimestamp(text) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(text);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, fraction = '0'] = match;
  const values = [year, month, day, hour, minute, second].map(Number);
  if (+year < 1000 || +month < 1 || +month > 12 || +day < 1 || +hour > 23 || +minute > 59 || +second > 59) return null;
  const utc = new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute, +second, Number(fraction.padEnd(3, '0'))));
  if (utc.getUTCFullYear() !== values[0] || utc.getUTCMonth() !== values[1] - 1 || utc.getUTCDate() !== values[2]) return null;
  return new Date(utc.getTime() - 9 * 60 * 60 * 1000).toISOString();
}

export function parseLog(line) {
  if (typeof line !== 'string' || !line.trim()) return { log: null, error: '빈 로그입니다.' };
  if (line.length > 10000) return { log: null, error: '한 행은 10,000자를 넘을 수 없습니다.' };
  const raw = line.trim().replace(/^\uFEFF/, '');
  const header = /^\[([^|]+)\|([^|]+)\|([^|]+)\|\s*(.*?)\]?$/.exec(raw);
  if (!header) return { log: null, error: '시간 | 사용자 | 등급 | 메시지 형식이 아닙니다.' };
  const [, time, user, level, message] = header.map(value => value.trim());
  const timestamp = parseKstTimestamp(time);
  if (!timestamp) return { log: null, error: '유효한 기록 시각이 아닙니다. YYYY-MM-DD HH:mm:ss 형식이 필요합니다.' };
  if (!user || user.length > 128) return { log: null, error: '사용자 ID가 없거나 너무 깁니다.' };
  const log_level = level.toUpperCase() === 'WARN' ? 'WARNING' : level.toUpperCase();
  if (!LEVELS.includes(log_level)) return { log: null, error: `지원하지 않는 로그 등급: ${level}` };
  if (!message) return { log: null, error: '로그 메시지가 비어 있습니다.' };
  const log = { timestamp, user, log_level, message, raw: line, missingFields: [], invalidFields: [] };
  const fields = new Map();
  for (const match of message.matchAll(/(?:^|\s)([A-Za-z][\w]*)=([\s\S]*?)(?=\s+[A-Za-z][\w]*=|$)/g)) {
    const key = match[1];
    if (fields.has(key)) log.invalidFields.push(`${key}: 중복 필드`);
    fields.set(key, match[2].trim());
  }
  for (const [key, { unit, nonnegative }] of Object.entries(NUMERIC_FIELDS)) {
    if (!fields.has(key)) continue;
    const value = fields.get(key);
    const normalized = value.replace('m/s2', 'm/s²');
    if (!normalized || normalized === unit) { log[key] = null; log.missingFields.push(key); continue; }
    const number = /^(-?\d+(?:\.\d+)?)\s*(.*)$/.exec(normalized);
    if (!number || (number[2] && number[2] !== unit) || !Number.isFinite(Number(number[1])) || (nonnegative && Number(number[1]) < 0)) {
      log[key] = null; log.invalidFields.push(`${key}: 유효하지 않은 값 (${value})`); continue;
    }
    log[key] = Number(number[1]);
  }
  for (const key of ['Brake', 'Event', 'Impact']) {
    if (!fields.has(key)) continue;
    const value = fields.get(key);
    if (!value) { log[key] = null; log.missingFields.push(key); }
    else if (key === 'Brake' && !['ON', 'OFF'].includes(value.toUpperCase())) { log[key] = null; log.invalidFields.push(`${key}: ON/OFF 값이 아닙니다.`); }
    else log[key] = key === 'Brake' ? value.toUpperCase() : value;
  }
  if (fields.has('Location')) {
    const value = fields.get('Location');
    const coordinate = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/.exec(value);
    if (!value || value === ',') { log.Location = null; log.missingFields.push('Location'); }
    else if (!coordinate || Math.abs(+coordinate[1]) > 90 || Math.abs(+coordinate[2]) > 180) { log.Location = null; log.invalidFields.push('Location: 올바른 위도·경도가 아닙니다.'); }
    else log.Location = { latitude: +coordinate[1], longitude: +coordinate[2] };
  }
  log.hasQualityIssue = log.missingFields.length > 0 || log.invalidFields.length > 0;
  return { log, error: null };
}
