#!/usr/bin/env bash
# F907·F908: EC2 에서 Docker Hub 이미지 pull → 컨테이너 실행 → 접속 확인
# 사용법: (~/drive-log 에 docker-compose.prod.yml, .env 를 둔 상태에서)
#   bash deploy.sh            # .env 의 IMAGE_TAG 사용
#   bash deploy.sh v1.0.1     # 태그 지정 (롤백에도 사용)
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo ".env 가 없습니다. .env.example 을 복사해 값을 채우세요." >&2
  exit 1
fi
if [ -n "${1:-}" ]; then
  export IMAGE_TAG="$1"
fi

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env"

echo "==> 이미지 pull"
$COMPOSE pull api web

echo "==> 컨테이너 실행"
$COMPOSE up -d --remove-orphans api web

echo "==> 상태 확인"
for i in $(seq 1 20); do
  if curl -fsS http://localhost/api/health > /dev/null 2>&1; then
    break
  fi
  sleep 3
done
$COMPOSE ps

PUBLIC_IP=$(curl -fsS -m 3 http://checkip.amazonaws.com 2>/dev/null || echo "<EC2-Public-IP>")
if curl -fsS http://localhost/ > /dev/null && curl -fsS http://localhost/api/health > /dev/null; then
  echo "배포 성공: http://${PUBLIC_IP}/"
else
  echo "응답 확인 실패. 'bash monitor.sh' 로 로그를 확인하세요." >&2
  exit 1
fi

docker image prune -f > /dev/null
