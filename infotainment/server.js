import axios from 'axios';
import {createApiApp} from '../functions/lib/http-app.js';
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

export function createApp({
  httpClient = axios,
  environment = process.env,
  serveStatic = true,
} = {}) {
  const app = createApiApp({httpClient,environment});

  app.use(
    '/vendor/axios',
    express.static(path.join(currentDirectory, '..', 'node_modules', 'axios', 'dist')),
  );
  if (serveStatic) app.use(express.static(path.join(currentDirectory, 'public')));

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
