// Shared by the Vue dashboard and the server-side AI context builder.
export const DEFAULT_THRESHOLDS = Object.freeze({
  Speed: 120,
  EngTemp: 110,
  Accel: 3,
  GForce: 2.5,
});
export const METRICS = Object.freeze({
  Speed: ['속도', 'km/h'],
  EngTemp: ['엔진 온도', '°C'],
  Accel: ['가속도', 'm/s²'],
  FuelEff: ['연비', 'km/L'],
});
export function normalizeLog(row) {
  const rawTime = row.timestamp;
  const date = rawTime?.toDate ? rawTime.toDate() : new Date(rawTime ?? NaN);
  const result = {
    ...row,
    timestamp: Number.isFinite(date.getTime()) ? date.toISOString() : null,
    log_level: row.log_level === 'WARN' ? 'WARNING' : row.log_level,
  };
  for (const key of [...Object.keys(METRICS), 'Dist', 'GForce']) {
    const value = row[key];
    result[key] =
      typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
  return result;
}
export function analyzeLogs(rows, thresholds = DEFAULT_THRESHOLDS) {
  const logs = rows.map(normalizeLog).filter((row) => row.timestamp);
  const metrics = {};
  for (const key of Object.keys(METRICS)) {
    const values = logs
      .map((row) => row[key])
      .filter((value) => value !== null);
    metrics[key] = {
      count: values.length,
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      mean: values.length
        ? values.reduce((a, b) => a + b, 0) / values.length
        : null,
    };
  }
  const anomalies = [];
  for (const row of logs) {
    for (const key of Object.keys(DEFAULT_THRESHOLDS)) {
      const limit = Number(thresholds[key]);
      const value = row[key];
      if (
        Number.isFinite(limit) &&
        limit > 0 &&
        value !== null &&
        (key === 'Accel' ? Math.abs(value) : value) > limit
      ) {
        anomalies.push({
          id: row.id,
          user: row.user,
          timestamp: row.timestamp,
          metric: key,
          value,
          threshold: limit,
          label:
            key === 'Accel' && value < 0
              ? '급감속'
              : {
                  Speed: '과속',
                  EngTemp: '엔진 과열',
                  Accel: '급가속',
                  GForce: '충격',
                }[key],
        });
      }
    }
  }
  return {
    total: logs.length,
    users: [...new Set(logs.map((row) => row.user))].sort(),
    metrics,
    anomalies,
    quality: logs.filter((row) => row.hasQualityIssue).length,
    levels: logs.reduce((result, row) => {
      result[row.log_level] = (result[row.log_level] || 0) + 1;
      return result;
    }, {}),
  };
}
export function chartSeries(rows, metric, maxPoints = 300) {
  const sorted = rows
    .map(normalizeLog)
    .filter((row) => row.timestamp)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  // Bucket means bound canvas work; statistics and anomaly detection always use every row.
  const size = Math.max(1, Math.ceil(sorted.length / maxPoints));
  const result = [];
  for (let i = 0; i < sorted.length; i += size) {
    const bucket = sorted.slice(i, i + size),
      values = bucket
        .map((row) => row[metric])
        .filter((value) => value !== null);
    result.push({
      timestamp: bucket[0].timestamp,
      value: values.length
        ? values.reduce((a, b) => a + b, 0) / values.length
        : null,
      count: bucket.length,
    });
  }
  return { points: result, aggregated: size > 1 };
}
