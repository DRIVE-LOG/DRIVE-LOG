#!/usr/bin/env bash
# F910: 컨테이너 상태 모니터링
# 사용법: bash monitor.sh          # 상태·자원·최근 로그 요약
#         bash monitor.sh follow   # 실시간 로그
set -uo pipefail
cd "$(dirname "$0")"
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env"

if [ "${1:-}" = "follow" ]; then
  exec $COMPOSE logs -f --tail=50 api web
fi

echo "===== 컨테이너 상태 ====="
$COMPOSE ps

echo
echo "===== 헬스체크 ====="
for c in $($COMPOSE ps -q api web); do
  name=$(docker inspect -f '{{.Name}}' "$c" | sed 's#^/##')
  health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}n/a{{end}}' "$c")
  restarts=$(docker inspect -f '{{.RestartCount}}' "$c")
  echo "$name : health=$health restarts=$restarts"
done
printf "HTTP / : %s\n" "$(curl -s -o /dev/null -w '%{http_code}' http://localhost/)"
printf "HTTP /api/health : %s\n" "$(curl -s -o /dev/null -w '%{http_code}' http://localhost/api/health)"

echo
echo "===== 자원 사용량 ====="
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

echo
echo "===== 최근 로그 (각 20줄) ====="
$COMPOSE logs --tail=20 api web
