import axios from 'axios';
import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);
export const environmentFilePath = path.join(currentDirectory, '.env');

dotenv.config({ path: environmentFilePath, quiet: true });

const defaultPort = 5501;
const supportedPorts = new Set([5500, 5501, 5502]);
const requiredEnvironmentVariables = [
  'KAKAO_MAP_JAVASCRIPT_KEY',
  'KAKAO_MOBILITY_REST_API_KEY',
  'OPENWEATHER_API_KEY',
];
const localHost = '127.0.0.1';
const kakaoDirectionsUrl =
  'https://apis-navi.kakaomobility.com/v1/directions';
const openWeatherCurrentUrl =
  'https://api.openweathermap.org/data/2.5/weather';
const openWeatherForecastUrl =
  'https://api.openweathermap.org/data/2.5/forecast';

function getEnvironmentValue(environment, name) {
  const value = environment[name];

  return typeof value === 'string' ? value.trim() : '';
}

export function resolveStartupConfig(environment = process.env) {
  const portValue =
    getEnvironmentValue(environment, 'PORT') || String(defaultPort);
  const port = Number(portValue);

  if (!Number.isInteger(port) || !supportedPorts.has(port)) {
    throw new Error('PORT는 5500, 5501, 5502 중 하나여야 합니다.');
  }

  const missingVariables = requiredEnvironmentVariables.filter(
    (name) => !getEnvironmentValue(environment, name),
  );

  if (missingVariables.length > 0) {
    throw new Error(
      `.env에 다음 항목을 입력해 주세요: ${missingVariables.join(', ')}`,
    );
  }

  return { port };
}

function normalizeCoordinatePair(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const parts = value.split(',');

  if (parts.length !== 2) {
    return null;
  }

  const longitude = Number(parts[0]);
  const latitude = Number(parts[1]);

  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  ) {
    return null;
  }

  return `${longitude},${latitude}`;
}

function normalizeCoordinate(value, minimum, maximum) {
  if (typeof value !== 'string') {
    return null;
  }

  const coordinate = Number(value);

  if (
    !Number.isFinite(coordinate) ||
    coordinate < minimum ||
    coordinate > maximum
  ) {
    return null;
  }

  return coordinate;
}

export function createApp({
  httpClient = axios,
  environment = process.env,
} = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.get('/api/runtime-config', (_request, response) => {
    response.json({
      kakaoMapJavascriptKey: getEnvironmentValue(
        environment,
        'KAKAO_MAP_JAVASCRIPT_KEY',
      ),
    });
  });

  app.get('/api/directions', async (request, response) => {
    const origin = normalizeCoordinatePair(request.query.origin);
    const destination = normalizeCoordinatePair(request.query.destination);

    if (!origin || !destination) {
      response.status(400).json({
        error: {
          code: 'INVALID_COORDINATES',
          message: '출발지와 목적지 좌표를 확인해 주세요.',
        },
      });
      return;
    }

    const apiKey = getEnvironmentValue(
      environment,
      'KAKAO_MOBILITY_REST_API_KEY',
    );

    if (!apiKey) {
      response.status(503).json({
        error: {
          code: 'API_KEY_MISSING',
          message: 'Kakao Mobility API 키가 설정되지 않았습니다.',
        },
      });
      return;
    }

    try {
      const upstreamResponse = await httpClient.get(kakaoDirectionsUrl, {
        headers: {
          Accept: 'application/json',
          Authorization: `KakaoAK ${apiKey}`,
        },
        params: {
          origin,
          destination,
          priority: 'RECOMMEND',
          summary: false,
          alternatives: false,
          road_details: false,
        },
        timeout: 8_000,
      });

      response.json(upstreamResponse.data);
    } catch {
      response.status(502).json({
        error: {
          code: 'DIRECTIONS_UPSTREAM_ERROR',
          message: '경로 정보를 불러오지 못했습니다.',
        },
      });
    }
  });

  app.get('/api/weather/forecast', async (request, response) => {
    const latitude = normalizeCoordinate(request.query.lat, -90, 90);
    const longitude = normalizeCoordinate(request.query.lon, -180, 180);

    if (latitude === null || longitude === null) {
      response.status(400).json({
        error: {
          code: 'INVALID_COORDINATES',
          message: '날씨를 조회할 좌표를 확인해 주세요.',
        },
      });
      return;
    }

    const apiKey = getEnvironmentValue(environment, 'OPENWEATHER_API_KEY');

    if (!apiKey) {
      response.status(503).json({
        error: {
          code: 'API_KEY_MISSING',
          message: 'OpenWeather API 키가 설정되지 않았습니다.',
        },
      });
      return;
    }

    try {
      const requestConfig = {
        params: {
          lat: latitude,
          lon: longitude,
          appid: apiKey,
          units: 'metric',
          lang: 'kr',
        },
        timeout: 8_000,
      };
      const [currentResponse, forecastResponse] = await Promise.all([
        httpClient.get(openWeatherCurrentUrl, requestConfig),
        httpClient.get(openWeatherForecastUrl, requestConfig),
      ]);

      response.json({
        current: currentResponse.data,
        forecast: forecastResponse.data,
        fetchedAt: Date.now(),
      });
    } catch {
      response.status(502).json({
        error: {
          code: 'WEATHER_UPSTREAM_ERROR',
          message: '날씨 정보를 불러오지 못했습니다.',
        },
      });
    }
  });

  app.use(
    '/vendor/axios',
    express.static(path.join(currentDirectory, '..', 'node_modules', 'axios', 'dist')),
  );
  app.use(express.static(path.join(currentDirectory, 'public')));

  return app;
}

export function startServer(port = resolveStartupConfig().port) {
  const app = createApp();
  const server = app.listen(port, localHost);

  server.once('listening', () => {
    console.log(`Infotainment server running at http://localhost:${port}`);
  });

  server.once('error', (error) => {
    const message =
      error.code === 'EADDRINUSE'
        ? `PORT ${port}가 이미 사용 중입니다. 기존 서버를 종료하거나 .env에서 5500~5502 중 다른 포트를 선택해 주세요.`
        : `서버를 시작하지 못했습니다: ${error.message}`;

    console.error(message);

    if (isDirectRun) {
      process.exitCode = 1;
    }
  });

  return server;
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFilePath);

if (isDirectRun) {
  try {
    startServer();
  } catch (error) {
    console.error(`환경 설정 오류: ${error.message}`);
    process.exitCode = 1;
  }
}
