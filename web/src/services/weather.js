export function weatherTime(timestamp, offset = 0, options = {}) {
  return new Intl.DateTimeFormat("ko-KR", {
    ...options,
    timeZone: "UTC",
  }).format(new Date((timestamp + offset) * 1000));
}
export function weatherDateKey(timestamp, offset = 0) {
  return new Date((timestamp + offset) * 1000).toISOString().slice(0, 10);
}
export function cityName(name) {
  return (
    {
      Seoul: "서울",
      Incheon: "인천",
      Busan: "부산",
      Daegu: "대구",
      Daejeon: "대전",
      Gwangju: "광주",
      Ulsan: "울산",
    }[name] ||
    name ||
    "현재 위치"
  );
}
export function weatherKind(condition, icon = "", timestamp = 0, offset = 0) {
  if (condition < 300) return "storm";
  if (condition < 600) return "rain";
  if (condition < 700) return "snow";
  if (condition < 800) return "mist";
  const hour = new Date((timestamp + offset) * 1000).getUTCHours();
  const night = icon ? icon.endsWith("n") : hour >= 19 || hour < 6;
  if (condition === 800) return night ? "moon" : "sun";
  return condition < 803 ? (night ? "cloud-night" : "cloud-sun") : "cloud";
}
export function dailyOutlooks(current, entries, offset = 0) {
  if (!current?.main || !Number.isFinite(current.dt)) return [];
  const rows = [0, 1]
    .map((day) => {
      const date = weatherDateKey(current.dt + day * 86400, offset);
      const values = entries
        .filter((item) => weatherDateKey(item.dt, offset) === date)
        .map((item) => item.main?.temp);
      if (!day)
        values.push(
          current.main.temp,
          current.main.temp_min,
          current.main.temp_max,
        );
      const temperatures = values.filter(
        (value) => typeof value === "number" && Number.isFinite(value),
      );
      return temperatures.length
        ? {
            label: day ? "내일" : "오늘",
            minimum: Math.min(...temperatures),
            maximum: Math.max(...temperatures),
          }
        : null;
    })
    .filter(Boolean);
  const minimum = Math.min(...rows.map((row) => row.minimum));
  const range = Math.max(
    1,
    Math.max(...rows.map((row) => row.maximum)) - minimum,
  );
  return rows.map((row) => ({
    ...row,
    start: 8 + ((row.minimum - minimum) / range) * 74,
    width: Math.max(12, ((row.maximum - row.minimum) / range) * 74),
  }));
}
export function drivingInsight(entries) {
  return Math.max(
    0,
    ...entries.slice(0, 8).map((item) => Number(item.pop) || 0),
  ) >= 0.5
    ? "강수 가능성이 높습니다. 감속 운전과 충분한 안전거리를 유지하세요."
    : "강수 가능성이 낮아 쾌적한 주행이 예상됩니다.";
}
