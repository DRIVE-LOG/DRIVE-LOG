# PJT09 리눅스 서버 배포 가이드

PJT05에서 구현한 DRIVE / LOG(Vue 3 SPA + Firebase + Chart.js)를 기능 변경 없이 Docker 컨테이너로 만들고, Docker Hub를 거쳐 AWS EC2(Ubuntu)에 배포합니다.

## 1. 배포 구조

```text
                 ┌─────────────────────── EC2 (Ubuntu, Docker) ───────────────────────┐
 브라우저 ──80──▶ │ web  : nginx:1.27-alpine  /usr/share/nginx/html = Vue dist          │
                 │        /api/*, /legacy/* ──proxy──▶ api:4173                       │
                 │ api  : node:22-alpine  Express (scripts/serve.mjs)                 │──▶ Firebase(Auth·Firestore·Storage)
                 │        /api/app-config, /api/weather, /api/directions ...          │──▶ Kakao · OpenWeather
                 │ dozzle (선택, 9999) : 컨테이너 로그 뷰어                              │
                 └────────────────────────────────────────────────────────────────────┘
```

- 브라우저에 필요한 Firebase 웹 설정은 빌드 결과물에 넣지 않고 `api` 컨테이너가 `/api/app-config`로 내려줍니다. 같은 이미지를 키만 바꿔 여러 환경에 배포할 수 있습니다.
- Kakao Mobility, OpenWeather REST 키는 서버(`api`)에서만 사용합니다. 외부에는 Nginx(80)만 열립니다.
- Firestore 데이터(`telematics_logs` 등)는 PJT05와 같은 Firebase 프로젝트를 그대로 사용합니다.

## 2. 이번 PJT에서 바꾼 프로젝트 구조

| 변경 | 이유 |
| --- | --- |
| 이전 화면 원본 `dist/` → `legacy/` 로 이동 | 명세의 "`npm run build` → `dist` 생성"에 맞추기 위해 `dist`를 빌드 산출물 전용으로 비움 |
| Vite `outDir` `build/web` → `dist` | `npm run build` 결과가 `dist/index.html` + `dist/assets/*` 로 생성됨 |
| `scripts/build.mjs` 가 화면 자산·파비콘을 `dist`에 함께 복사 | Nginx가 `dist`만으로 화면을 서빙할 수 있도록 |
| `scripts/serve.mjs` 에 `DRIVE_LOG_HOST` 추가 | 컨테이너에서 `0.0.0.0`으로 대기해야 Nginx가 접근 가능 |
| `scripts/web-config.mjs` 가 `FIREBASE_*` 환경 변수 지원 | 설정 파일을 이미지에 넣지 않고 `.env`로 주입 |
| `check.mjs`, `firebase-smoke.mjs`, `package-submission.mjs`, `firebase.json`, `.gitignore` 경로 수정 | 위 경로 변경 반영 (`legacy/config.local.js`, Hosting public = `dist`) |

추가 파일

| 파일 | 역할 | 요구사항 |
| --- | --- | --- |
| `Dockerfile` | Node 22로 빌드 → Nginx 이미지에 `dist` 배치 | F903, F909 |
| `Dockerfile.api` | Express API 서버 이미지 | F903 |
| `deploy/nginx/default.conf.template` | 정적 서빙, SPA fallback, `/api` 프록시, 헬스체크 | F909 |
| `docker-compose.yml` | 로컬 빌드·실행 | F903 |
| `deploy/docker-compose.prod.yml` | EC2용 (Docker Hub 이미지만 사용) | F907 |
| `deploy/.env.example` | 이미지 태그·Firebase·API 키 템플릿 | F906 |
| `deploy/push.ps1` | 이미지 빌드 + 버전 태그 + push | F904 |
| `deploy/ec2-setup.sh` | Docker Engine·Compose 설치, ufw 설정 | F906 |
| `deploy/deploy.sh` | pull → 실행 → 접속 확인, 태그 지정 롤백 | F907, F908 |
| `deploy/monitor.sh` | 상태·헬스·자원·로그 요약 | F910 |
| `.github/workflows/deploy.yml` | 테스트 → 이미지 build/push → (승인 후) EC2 배포 | F910 |

## 3. 요구사항 대응

| 번호 | 요구사항 | 구현 | 상태 |
| --- | --- | --- | --- |
| F901 | Vue 프로젝트 준비 | PJT05 DRIVE / LOG 사용, `npm run dev` 동작 | 로컬 확인 |
| F902 | 프로젝트 빌드 | `npm run build` → `dist/index.html`, `dist/assets/*` | 로컬 확인 |
| F903 | Docker 이미지 생성 | 멀티 스테이지 `Dockerfile`(Nginx), `Dockerfile.api`(Node) | 로컬 확인 |
| F904 | Docker Hub 연동 | `deploy/push.ps1` (버전 태그 + latest) | 본인 Docker Hub 계정으로 실행 필요 |
| F905 | EC2 서버 생성 | 아래 4-5 절차 (보안 그룹 22, 80) | AWS 콘솔에서 직접 수행 |
| F906 | EC2 환경 준비 | `deploy/ec2-setup.sh` | EC2에서 실행 |
| F907 | 컨테이너 배포 | `deploy/deploy.sh`, `80:80` 매핑, `restart: unless-stopped` | 로컬에서 같은 compose로 확인 |
| F908 | 서비스 접속 확인 | `http://<EC2 Public IP>/` | EC2 배포 후 캡처 |
| F909 | Nginx 적용 | `dist`를 `/usr/share/nginx/html`에 배치, 80 포트 | 로컬 확인 |
| F910 | CI/CD·모니터링 | GitHub Actions, HEALTHCHECK, `monitor.sh`, Dozzle | 워크플로 작성, Secrets 등록 필요 |

## 4. 단계별 진행

### 4-1. 로컬 실행 (F901)

```powershell
npm ci
npm run dev          # http://127.0.0.1:4173
```

Firebase 설정은 `legacy/config.js`를 `legacy/config.local.js`로 복사해 입력하거나, `FIREBASE_*` 환경 변수로 지정합니다.

### 4-2. 빌드 (F902)

```powershell
npm run build
Get-ChildItem dist, dist\assets
```

### 4-3. Docker 이미지 생성과 로컬 실행 (F903, F909)

```powershell
Copy-Item deploy\.env.example deploy\.env     # 값 입력
docker compose --env-file deploy/.env up -d --build
docker compose --env-file deploy/.env ps
```

브라우저에서 `http://localhost` 로 접속합니다.

### 4-4. Docker Hub push (F904)

```powershell
docker login
.\deploy\push.ps1 -User <DockerHubID> -Tag v1.0.0
```

- `<ID>/drive-log-web:v1.0.0`, `<ID>/drive-log-api:v1.0.0` 와 각각 `latest` 태그가 올라갑니다.
- 저장소를 Public으로 두면 EC2에서 로그인 없이 pull 할 수 있습니다. Private이면 EC2에서 `docker login` 후 pull 합니다.
- 다음 버전은 `-Tag v1.0.1` 처럼 올리고, 문제가 생기면 EC2에서 `bash deploy.sh v1.0.0` 으로 되돌립니다.

### 4-5. EC2 인스턴스 생성 (F905)

AWS 콘솔 → EC2 → 인스턴스 시작

| 항목 | 값 |
| --- | --- |
| AMI | Ubuntu Server 24.04 LTS (x86_64) |
| 인스턴스 유형 | t3.small 권장 (t2.micro/t3.micro도 실행 가능하나 메모리 여유가 적음) |
| 키 페어 | 새로 생성 → `.pem` 저장 (Git에 넣지 않음) |
| 스토리지 | 16 GiB gp3 |
| 보안 그룹 인바운드 | SSH 22 (내 IP), HTTP 80 (0.0.0.0/0), 모니터링 9999 (내 IP, 선택) |

퍼블릭 IP가 바뀌지 않게 하려면 탄력적 IP를 할당해 인스턴스에 연결합니다.

```powershell
ssh -i drive-log.pem ubuntu@<EC2-Public-IP>
```

Windows에서 `.pem` 권한 오류가 나면 파일 속성 → 보안에서 본인 계정만 읽기 권한을 남깁니다.

### 4-6. EC2 환경 준비 (F906)

로컬에서 배포 파일을 서버로 복사합니다.

```powershell
ssh -i drive-log.pem ubuntu@<EC2-Public-IP> "mkdir -p ~/drive-log"
scp -i drive-log.pem deploy/docker-compose.prod.yml deploy/.env.example deploy/ec2-setup.sh deploy/deploy.sh deploy/monitor.sh ubuntu@<EC2-Public-IP>:~/drive-log/
```

EC2에서

```bash
cd ~/drive-log
bash ec2-setup.sh
exit                              # 재접속해야 docker 그룹 적용
cp .env.example .env && nano .env # DOCKERHUB_USER, IMAGE_TAG, FIREBASE_*, API 키 입력
```

### 4-7. 컨테이너 배포 (F907)

```bash
cd ~/drive-log
bash deploy.sh          # .env 의 IMAGE_TAG
bash deploy.sh v1.0.1   # 특정 태그
docker ps
```

### 4-8. 접속 확인 (F908)

- 브라우저: `http://<EC2-Public-IP>/`
- 확인 항목: 홈 화면, 로그인, 로그 관리(실시간 목록·필터·정렬), 주행 분석 차트, 날씨, 내비게이션
- Firebase Authentication → 설정 → 승인된 도메인에 EC2 Public IP(또는 도메인)를 추가해야 Google 로그인이 동작합니다.
- Kakao Developers 앱의 Web 플랫폼 도메인에 `http://<EC2-Public-IP>` 를 추가해야 카카오 지도 키가 동작합니다.

## 5. CI/CD 및 모니터링 (F910)

### GitHub Actions

`.github/workflows/deploy.yml`

1. `test` : `npm ci` → `npm run build` → `npm run check` → `npm test`
2. `docker` : web/api 이미지를 병렬 빌드해 Docker Hub에 push (`sha-<커밋7자리>` + `latest`, `v*` 태그 push 시 해당 버전)
3. `deploy` : `production` Environment 승인 후 SSH로 EC2의 `deploy.sh <태그>` 실행

저장소 Settings → Secrets and variables → Actions

| Secret | 값 |
| --- | --- |
| `DOCKERHUB_USERNAME` | Docker Hub ID |
| `DOCKERHUB_TOKEN` | Docker Hub → Account settings → Personal access tokens (Read & Write) |
| `EC2_HOST` | EC2 Public IP (없으면 배포 단계는 건너뛰고 수동 배포 안내만 출력) |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | `.pem` 파일 내용 전체 |

Settings → Environments → `production` 에 Required reviewers를 지정하면 이미지 push까지는 자동, 서버 반영은 승인 후 진행되는 반자동 배포가 됩니다. 자동 배포를 위해서는 보안 그룹 SSH(22)를 GitHub Actions에서 접근할 수 있어야 합니다.

### 모니터링

- 두 이미지 모두 `HEALTHCHECK`가 있어 `docker ps`에 `healthy`/`unhealthy`가 표시됩니다.
- `restart: unless-stopped` 로 컨테이너가 죽거나 서버가 재부팅되면 자동으로 다시 시작합니다.
- 로그는 json-file 드라이버로 10MB × 3개까지만 보관합니다.

```bash
bash monitor.sh          # 상태, 헬스, HTTP 응답, CPU/메모리, 최근 로그
bash monitor.sh follow   # 실시간 로그
docker logs -f drive-log-web-1
```

브라우저 로그 뷰어(Dozzle)

```bash
docker compose -f docker-compose.prod.yml --env-file .env --profile monitoring up -d dozzle
# http://<EC2-Public-IP>:9999  (보안 그룹 9999는 내 IP만 허용)
```

## 6. 로컬 검증 결과 (2026-11-27)

| 항목 | 결과 |
| --- | --- |
| `npm run build` | `dist/index.html`, `dist/assets/*` 생성 |
| `npm run check` | 50개 모듈·JSON·HTML 검사 통과 |
| `npm test` | 46개 통과 |
| `docker compose build` | `drive-log-web` 80.2MB, `drive-log-api` 576MB |
| `docker-compose.prod.yml` 실행 | web·api 모두 `healthy` |
| Nginx 경유 응답 | `/` 200, `/api/health` 200, `/api/runtime-config` 200, `/legacy/logs/` 200, `/favicon.svg` 200 |
| `/api/app-config` | 503 — 이 PC에 Firebase 설정이 없어서 발생. `.env`에 `FIREBASE_*` 입력 시 해결 |

캡처: `submission/screenshots/pjt9/01_local_docker_nginx.jpg`, 컨테이너 상태: `submission/screenshots/pjt9/02_docker_ps.txt`

## 7. EC2 배포 결과 (2026-11-27)

| 항목 | 결과 |
| --- | --- |
| Docker Hub | `heavenring/drive-log-web`, `heavenring/drive-log-api` (`v1.0.0`, `latest`) push |
| EC2 | t3.micro, Ubuntu, 서울 리전, 보안 그룹 인바운드 SSH 22 · HTTP 80 |
| 서버 환경 | Docker 29.10.1, Compose v5.8.0, ufw 22/80 허용, 스왑 1GB |
| 컨테이너 | web·api 모두 `healthy`, 재시작 0회, 메모리 web 3.7MiB / api 20.6MiB |
| 외부 접속 | `http://13.125.237.8/` 200, `/api/health` 200, `/api/app-config` 200 |
| Firebase | `.env`로 웹 설정 주입, Authentication 승인된 도메인에 `13.125.237.8` 추가, 화면 하단 "실시간 연결됨" 표시 |
| 미설정 | 날씨·지도 API 키 미입력으로 `/api/weather/forecast` 503 (선택 기능) |

캡처: `03_ec2_home.jpg`, `04_ec2_logs.jpg`, `05_ec2_analytics.jpg`, 모니터링 출력: `06_ec2_monitor.txt` (모두 `submission/screenshots/pjt9/`)

## 8. 문제 해결

| 증상 | 확인 |
| --- | --- |
| 화면 상단 "서비스 설정을 불러오지 못했습니다" | `.env`의 `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID` 확인 후 `docker compose ... up -d` 재실행 |
| 브라우저에서 접속 안 됨 | 보안 그룹 80 인바운드, `sudo ufw status`, `docker ps`의 `0.0.0.0:80->80` 확인 |
| web 컨테이너가 시작 안 됨 | api가 healthy가 될 때까지 대기함. `docker logs drive-log-api-1` 확인 |
| 지도·날씨 미표시 | `KAKAO_*`, `OPENWEATHER_API_KEY` 값과 Kakao 플랫폼 도메인 등록 확인 |
| 새로고침 시 404 | Nginx `try_files ... /index.html` 설정이 이미지에 반영되었는지 확인 |
| t2.micro에서 느림/중단 | 이미지는 로컬·CI에서 빌드하고 EC2에서는 pull만 수행 (서버에서 빌드하지 않음) |
