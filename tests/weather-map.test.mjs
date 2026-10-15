import test from "node:test";
import assert from "node:assert/strict";
import {
  dailyOutlooks,
  weatherDateKey,
  weatherKind,
  drivingInsight,
} from "../web/src/services/weather.js";
import { routeFeature } from "../web/src/services/map-style.js";

test("daily weather ranges follow destination timezone across UTC midnight and retain negative temperatures", () => {
  const dt = Date.parse("2026-10-14T16:00:00Z") / 1000;
  const rows = dailyOutlooks(
    { dt, main: { temp: -2, temp_min: -4, temp_max: 0 } },
    [
      { dt: dt + 3600, main: { temp: 2 } },
      { dt: dt + 86400, main: { temp: -6 } },
      { dt: dt + 90000, main: { temp: null } },
    ],
    32400,
  );
  assert.equal(weatherDateKey(dt, 32400), "2026-10-15");
  assert.deepEqual(
    rows.map(({ label, minimum, maximum }) => ({ label, minimum, maximum })),
    [
      { label: "오늘", minimum: -4, maximum: 2 },
      { label: "내일", minimum: -6, maximum: -6 },
    ],
  );
  assert(rows.every((row) => row.width > 0 && row.start + row.width <= 100));
});
test("no forecast does not invent tomorrow or produce invalid equal-temperature ranges", () => {
  const rows = dailyOutlooks({ dt: 1800000000, main: { temp: 0 } }, [], 0);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].minimum, 0);
  assert(Number.isFinite(rows[0].width));
  assert.deepEqual(dailyOutlooks(null, []), []);
});
test("weather condition icons distinguish night, precipitation and visibility conditions", () => {
  assert.equal(weatherKind(800, "01n"), "moon");
  assert.equal(weatherKind(800, "01d"), "sun");
  assert.equal(weatherKind(801, "02n"), "cloud-night");
  assert.equal(weatherKind(500, "10d"), "rain");
  assert.equal(weatherKind(601), "snow");
  assert.equal(weatherKind(211), "storm");
  assert.equal(weatherKind(741), "mist");
});
test("driving insight uses upcoming 24-hour precipitation only", () => {
  assert.match(drivingInsight([{ pop: 0.5 }]), /감속/);
  assert.match(
    drivingInsight([
      ...Array.from({ length: 8 }, () => ({ pop: 0 })),
      { pop: 1 },
    ]),
    /낮아/,
  );
});
test("route conversion preserves longitude/latitude ordering and clears absent paths", () => {
  assert.deepEqual(routeFeature([]).features, []);
  assert.deepEqual(
    routeFeature([{ longitude: 127, latitude: 37 }]).features,
    [],
  );
  const result = routeFeature([
    { longitude: 126.978, latitude: 37.5665 },
    { longitude: NaN, latitude: 37 },
    { longitude: 127.0276, latitude: 37.4979 },
  ]);
  assert.deepEqual(result.features[0].geometry.coordinates, [
    [126.978, 37.5665],
    [127.0276, 37.4979],
  ]);
});
