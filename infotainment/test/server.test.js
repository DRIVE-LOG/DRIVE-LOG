import assert from 'node:assert/strict';
import { once } from 'node:events';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  createApp,
  environmentFilePath,
  resolveStartupConfig,
} from '../server.js';

async function withServer(run, options) {
  const server = createApp(options).listen(0);
  await once(server, 'listening');

  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('health endpoint reports that the server is available', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  });
});

test('loads .env beside server.js regardless of the launch directory', () => {
  const testDirectory = path.dirname(fileURLToPath(import.meta.url));

  assert.equal(
    environmentFilePath,
    path.resolve(testDirectory, '..', '.env'),
  );
});

test('startup config accepts supported ports and requires all API keys', () => {
  const configuredEnvironment = {
    PORT: ' 5502 ',
    KAKAO_MAP_JAVASCRIPT_KEY: ' public-browser-key ',
    KAKAO_MOBILITY_REST_API_KEY: ' private-mobility-key ',
    OPENWEATHER_API_KEY: ' private-weather-key ',
  };

  assert.deepEqual(resolveStartupConfig(configuredEnvironment), { port: 5502 });
  assert.throws(
    () =>
      resolveStartupConfig({
        ...configuredEnvironment,
        PORT: '3000',
      }),
    /5500, 5501, 5502/,
  );
  assert.throws(
    () =>
      resolveStartupConfig({
        ...configuredEnvironment,
        OPENWEATHER_API_KEY: '   ',
      }),
    /OPENWEATHER_API_KEY/,
  );
});

test('runtime config exposes only the public Kakao browser key', async () => {
  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/runtime-config`);
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.deepEqual(body, {
        kakaoMapJavascriptKey: 'public-browser-key',
      });
      assert.doesNotMatch(JSON.stringify(body), /private-/);
    },
    {
      environment: {
        KAKAO_MAP_JAVASCRIPT_KEY: ' public-browser-key ',
        KAKAO_MOBILITY_REST_API_KEY: 'private-mobility-key',
        OPENWEATHER_API_KEY: 'private-weather-key',
      },
    },
  );
});

test('directions endpoint requires valid coordinates and a server key', async () => {
  await withServer(
    async (baseUrl) => {
      const invalidResponse = await fetch(
        `${baseUrl}/api/directions?origin=invalid&destination=127,37`,
      );
      assert.equal(invalidResponse.status, 400);
      assert.equal(
        (await invalidResponse.json()).error.code,
        'INVALID_COORDINATES',
      );

      const missingKeyResponse = await fetch(
        `${baseUrl}/api/directions?origin=126.97,37.56&destination=127.06,37.51`,
      );
      assert.equal(missingKeyResponse.status, 503);
      assert.equal(
        (await missingKeyResponse.json()).error.code,
        'API_KEY_MISSING',
      );
    },
    { environment: { KAKAO_MOBILITY_REST_API_KEY: '   ' } },
  );
});

test('directions endpoint protects the REST key while proxying the route', async () => {
  let capturedRequest;
  const routeFixture = {
    trans_id: 'route-test',
    routes: [
      {
        result_code: 0,
        summary: { distance: 3200, duration: 720 },
        sections: [],
      },
    ],
  };
  const httpClient = {
    async get(url, config) {
      capturedRequest = { url, config };
      return { data: routeFixture };
    },
  };

  await withServer(
    async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/directions?origin=126.97,37.56&destination=127.06,37.51`,
      );
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.deepEqual(body, routeFixture);
      assert.doesNotMatch(JSON.stringify(body), /server-rest-key/);
    },
    {
      environment: {
        KAKAO_MOBILITY_REST_API_KEY: 'server-rest-key',
      },
      httpClient,
    },
  );

  assert.equal(
    capturedRequest.url,
    'https://apis-navi.kakaomobility.com/v1/directions',
  );
  assert.equal(
    capturedRequest.config.headers.Authorization,
    'KakaoAK server-rest-key',
  );
  assert.deepEqual(capturedRequest.config.params, {
    origin: '126.97,37.56',
    destination: '127.06,37.51',
    priority: 'RECOMMEND',
    summary: false,
    alternatives: false,
    road_details: false,
  });
});

test('weather endpoint validates coordinates and requires a server key', async () => {
  await withServer(
    async (baseUrl) => {
      const invalidResponse = await fetch(
        `${baseUrl}/api/weather/forecast?lat=100&lon=127`,
      );
      assert.equal(invalidResponse.status, 400);
      assert.equal(
        (await invalidResponse.json()).error.code,
        'INVALID_COORDINATES',
      );

      const missingKeyResponse = await fetch(
        `${baseUrl}/api/weather/forecast?lat=37.56&lon=126.97`,
      );
      assert.equal(missingKeyResponse.status, 503);
      assert.equal(
        (await missingKeyResponse.json()).error.code,
        'API_KEY_MISSING',
      );
    },
    { environment: { OPENWEATHER_API_KEY: '   ' } },
  );
});

test('weather endpoint keeps the OpenWeather key on the server', async () => {
  const capturedRequests = [];
  const currentFixture = {
    dt: 1_785_380_400,
    name: 'Seoul',
    main: {
      temp: 24,
      feels_like: 25,
      humidity: 58,
      pressure: 1013,
    },
    weather: [{ id: 800, description: '맑음' }],
    wind: { speed: 2.1 },
    visibility: 10_000,
  };
  const forecastFixture = {
    city: { name: 'Seoul', timezone: 32_400 },
    list: [
      {
        dt: 1_785_380_400,
        main: { temp: 24, feels_like: 25, humidity: 58 },
        weather: [{ id: 800, description: '맑음' }],
        wind: { speed: 2.1 },
      },
    ],
  };
  const httpClient = {
    async get(url, config) {
      capturedRequests.push({ url, config });
      return {
        data: url.endsWith('/weather') ? currentFixture : forecastFixture,
      };
    },
  };

  await withServer(
    async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/weather/forecast?lat=37.56&lon=126.97`,
      );
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.deepEqual(body.current, currentFixture);
      assert.deepEqual(body.forecast, forecastFixture);
      assert.equal(typeof body.fetchedAt, 'number');
      assert.doesNotMatch(JSON.stringify(body), /weather-server-key/);
    },
    {
      environment: {
        OPENWEATHER_API_KEY: 'weather-server-key',
      },
      httpClient,
    },
  );

  assert.deepEqual(
    capturedRequests.map(({ url }) => url).sort(),
    [
      'https://api.openweathermap.org/data/2.5/forecast',
      'https://api.openweathermap.org/data/2.5/weather',
    ],
  );
  capturedRequests.forEach(({ config }) => {
    assert.deepEqual(config.params, {
      lat: 37.56,
      lon: 126.97,
      appid: 'weather-server-key',
      units: 'metric',
      lang: 'kr',
    });
  });
});

test('serves the dashboard, media assets, and local Axios bundle', async () => {
  await withServer(async (baseUrl) => {
    const [dashboardResponse, cockpitResponse, albumResponse, axiosResponse] =
      await Promise.all([
        fetch(baseUrl),
        fetch(`${baseUrl}/assets/vehicle-cockpit.png`),
        fetch(`${baseUrl}/assets/woodz-oo-li-cover.jpg`),
        fetch(`${baseUrl}/vendor/axios/axios.min.js`),
      ]);

    assert.equal(dashboardResponse.status, 200);
    const dashboardHtml = await dashboardResponse.text();
    assert.match(dashboardHtml, /AURELIA DRIVE/);
    assert.match(dashboardHtml, /NOW PLAYING/);
    assert.match(dashboardHtml, /Drowning/);
    assert.match(dashboardHtml, /WOODZ/);
    assert.match(dashboardHtml, /home-kakao-map/);
    assert.match(dashboardHtml, /home-map-selection-status/);
    assert.match(dashboardHtml, /navigation-kakao-map/);
    assert.match(dashboardHtml, /route-confirmation/);
    assert.match(dashboardHtml, /길안내를 시작할까요/);
    assert.match(dashboardHtml, /route-confirmation-eta-value/);
    assert.match(dashboardHtml, /도착 예정/);
    assert.doesNotMatch(dashboardHtml, /WELCOME BACK/);
    assert.doesNotMatch(dashboardHtml, />\s*READY\s*</);
    assert.doesNotMatch(dashboardHtml, /실시간 위치/);

    assert.equal(cockpitResponse.status, 200);
    assert.match(cockpitResponse.headers.get('content-type') ?? '', /image\/png/);
    assert.ok((await cockpitResponse.arrayBuffer()).byteLength > 100_000);

    assert.equal(albumResponse.status, 200);
    assert.match(albumResponse.headers.get('content-type') ?? '', /image\/jpeg/);
    assert.ok((await albumResponse.arrayBuffer()).byteLength > 20_000);

    assert.equal(axiosResponse.status, 200);
    assert.match(
      axiosResponse.headers.get('content-type') ?? '',
      /javascript/,
    );
  });
});
