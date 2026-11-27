# ------------------------------------------------------------
# DRIVE / LOG 웹 이미지 (F903, F909)
#  1단계 build : npm run build 로 Vue 정적 파일(dist) 생성
#  2단계 web   : Nginx 가 dist 를 서빙하고 /api 요청은 api 컨테이너로 전달
# ------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS web
LABEL org.opencontainers.image.title="drive-log-web"

COPY deploy/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

# API 서버 주소 (docker compose 서비스명 기준)
ENV API_UPSTREAM=api:4173

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/nginx-health || exit 1
