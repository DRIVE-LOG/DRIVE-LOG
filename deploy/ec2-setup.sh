#!/usr/bin/env bash
# F906: EC2(Ubuntu 22.04/24.04) 서버에 Docker 실행 환경 구성
# 사용법: bash ec2-setup.sh
set -euo pipefail

echo "==> 패키지 업데이트"
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg ufw

echo "==> Docker 공식 저장소 등록"
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

echo "==> Docker Engine + Compose 플러그인 설치"
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker

echo "==> sudo 없이 docker 사용 (재접속 후 적용)"
sudo usermod -aG docker "$USER"

echo "==> 방화벽: SSH(22), HTTP(80) 허용"
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw --force enable

# t2.micro/t3.micro(메모리 1GB)에서 이미지 pull·실행 중 메모리 부족 방지
if ! sudo swapon --show | grep -q /swapfile; then
  echo "==> 스왑 1GB 생성"
  sudo fallocate -l 1G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile > /dev/null
  sudo swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab > /dev/null
fi

echo "==> 설치 확인"
sudo docker --version
sudo docker compose version
sudo docker run --rm hello-world > /dev/null && echo "Docker 정상 동작"
echo "==> Docker Hub 접근 확인"
curl -fsS -o /dev/null -w "registry-1.docker.io HTTP %{http_code}\n" https://registry-1.docker.io/v2/ || true

echo "완료. 'exit' 후 다시 SSH 접속하면 sudo 없이 docker 명령을 쓸 수 있습니다."
