# DRIVE / LOG · PJT2–5

차량 로그 업로드부터 실시간 분석, 사용자 관리, AI 주행 대화까지 연결한 Vue 3 인포테인먼트 프로젝트입니다. 기존 차량 배경과 태블릿 UI를 유지하고 8개 화면을 Vue SFC, Vue Router, Pinia로 분리했습니다.

## 실행

Node.js 22 이상과 Java 21 이상이 필요합니다. 실제 배포 함수는 Node.js 22를 사용합니다.

```powershell
npm ci
npm --prefix functions ci
npm run start:local
```

로컬 앱은 http://localhost:4173, Firebase Emulator UI는 http://localhost:4000 에서 열립니다. 이 모드는 실제 Firebase 데이터를 사용하지 않습니다. 별도 터미널에서 체험 계정을 준비할 수 있습니다.

```powershell
npm run seed:local
```

| 계정 | 초기 비밀번호 | 용도 |
| --- | --- | --- |
| demo-member@example.test | Drive-log-demo-123! | 일반 회원 |
| demo-admin@example.test | Drive-log-demo-123! | 관리자 |

체험 계정과 주행 기록은 합성 데이터이며 에뮬레이터에만 생성됩니다. `seed:local`은 기존 데이터를 지우지 않습니다. 기본 SSAFY 계정은 비밀번호 없이 익명 인증으로 진입합니다.

Java가 PATH에 없다면 저장소의 비공개 `runtime.local.json`에 `{"javaHome":"JDK 또는 JRE 21 경로"}`를 설정하세요. `start:local`은 종료할 때 `work/emulator-data`에 데이터를 내보내고 다음 시작 시 읽습니다. 강제 종료 전에는 `npx firebase emulators:export work/emulator-data --project demo-drive-log --force`로 보관할 수 있습니다.

## 실제 Firebase로 실행

`dist/config.js`를 `dist/config.local.js`로 복사하고 본인의 Firebase 웹 앱 설정을 입력한 다음 `npm start`를 실행합니다. 현재 작업 PC에서는 기존 프로젝트 `drive-log-pjt2-260911-7a90f`의 설정을 복구했습니다. 실제 설정 파일과 CLI 로그인 토큰은 Git 및 제출 ZIP에서 제외합니다.

Firebase Authentication에서 익명, 이메일/비밀번호, Google 로그인을 활성화하고 `localhost` 또는 배포 도메인을 허용해야 합니다. 현재 프로젝트에는 이 세 제공업체를 활성화했습니다. Firestore 인덱스·규칙, Storage 규칙, 서버 함수를 배포했습니다. Storage 기본 버킷은 `US-EAST1`입니다.

```powershell
npx firebase login
npx firebase use --add
npx firebase deploy --only functions,firestore,storage
```

최초 관리자는 먼저 앱에서 가입한 뒤 프로젝트 소유자가 다음 명령으로 지정합니다. 이후에는 관리자 전용 회원 관리 탭에서 승격합니다. 비밀번호나 서비스 계정 파일을 소스에 넣지 않습니다.

```powershell
npm run admin:grant -- --email 관리자이메일 --project Firebase프로젝트ID
```

## GMS AI 설정

AI 요청은 Firebase callable 함수에서 SSAFY GMS 프록시로 전달됩니다. 키는 브라우저에 노출하지 않습니다. **현재 GMS 키가 소실되어 실제 생성 응답은 검증하지 못했습니다.** 연결되지 않은 경우 오류를 표시하고 사용자 메시지는 보존하며 같은 요청 ID로 재시도할 수 있습니다.

- `functions/.env.example`를 로컬용 `functions/.env.local` 또는 운영용 `functions/.env.프로젝트ID`로 복사합니다.
- GMS 포털의 실제 주소와 허용 모델을 확인해 `GMS_BASE_URL`, `GMS_MODEL`을 지정하고 `GMS_ENABLED=true`로 변경합니다. 예시 모델과 주소는 계정의 허용 목록을 확인해야 합니다.
- 에뮬레이터 키: Git에서 제외된 `functions/.secret.local`에 `GMS_API_KEY=발급받은키`를 저장하고 에뮬레이터를 재시작합니다.
- 운영 키: `npx firebase functions:secrets:set GMS_API_KEY`로 저장한 뒤 `npx firebase deploy --only functions:chat`을 실행합니다.

`GMS_ENABLED=false`가 기본값입니다. 테스트용 AI 응답은 테스트 파일의 주입된 어댑터에만 존재하며 제품 화면에서 가짜 응답을 생성하지 않습니다. 분석 범위는 현재 로그인 계정 소유의 최신 최대 5,000개 로그이고, 운전자 필터·누락값·임계치·대화 문맥을 함께 전달합니다.

## 지도·날씨 및 음성

기존 내비게이션과 날씨 화면도 Vue로 옮겼습니다. 장소 검색, 최근 목적지, 경로·거리·예상 시간·안내, 현재 위치, 현재 날씨와 예보를 구현했습니다. 외부 API 키가 없으면 연결 안내를 표시합니다. 2026-10-15 기존 Kakao/OpenWeather 키를 복구했고, Chrome 지도 표시·강남역 검색·서울 시청 출발 경로·현재 날씨·예보 40개·보기 전환을 실응답으로 검증했습니다. 로컬 서버 2개와 배포 함수의 정상 응답·빈 좌표 거부·서버 키 비노출 검사 15개가 통과했습니다.

이후 요청에 따라 홈·내비게이션 지도는 MapLibre GL JS와 OpenFreeMap의 실제 건물 높이를 사용하는 3D 지도로 바꿨습니다. 55° 기울기, 회전, 북쪽 정렬, 확대·축소, 2D/3D 전환을 지원합니다. 장소 검색과 경로 계산에는 기존 Kakao 키를 사용하며 경로선을 3D 지도에 표시합니다. 3D 그래픽을 사용할 수 없으면 카카오 2D 지도로 전환할 수 있습니다. 건물 형상·높이의 상세도는 OpenStreetMap 데이터가 제공하는 범위에 따릅니다. [지도 공급자 안내](https://openfreemap.org/quick_start/), [3D 건물 구현 방식](https://maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d/).

날씨 화면은 원본 `infotainment/public`의 두 패널 배치, 날씨 아이콘, 상세 지표 4종, 드라이빙 인사이트, 습도·바람을 포함한 예보 카드, 오늘·내일 기온 범위를 복구했습니다. API는 40개 예보를 받으며 화면에는 원본처럼 3시간 간격 24개(72시간)를 표시합니다. 마우스 드래그·터치 스크롤·방향키 이동, 가로/세로 목록 전환, 화면 이동 시 보기 설정 유지, 10분 경과 후 자동 갱신, 홈 카드와 상단 날씨 동기화를 지원합니다. 복구 범위와 검증 기록은 [화면 복구 기록](docs/ui-restoration.md)을 참고하세요.

로컬 서버에서는 `infotainment/.env.example`을 `infotainment/.env`로 복사해 Kakao JavaScript 키, Kakao Mobility REST 키, OpenWeather 키를 입력합니다. REST 키는 서버에서만 사용합니다. 현재 PC의 `.env`에는 복구한 키가 저장되어 있고 Firebase Secret Manager에도 서버 키 2개를 등록했습니다. Kakao 앱 `Infortainment System`의 기존 무료 쿼터를 사용하며, 기존 localhost:5500–5502 도메인을 유지하고 localhost와 127.0.0.1의 4173·4174 포트를 추가했습니다. 키 값은 Git과 제출 ZIP에서 제외합니다. 설정을 바꾼 후 서버를 재시작하세요.

음성 입력은 Chrome Web Speech API와 마이크 권한을 사용하며, 응답 읽기는 SpeechSynthesis를 사용합니다. 미지원·권한 거부·무음 상태를 처리합니다. 이벤트 테스트를 통과했으며 실제 문장 인식과 음성 출력은 사용자가 정상 동작을 확인했습니다. GMS의 실제 생성 응답을 음성으로 읽는 전체 흐름은 키 복원 후 추가 확인이 필요합니다.

## 구성

| 경로 | 책임 |
| --- | --- |
| `web/src/views/` | 홈, 로그, 분석, 대화, 사용자 전환, 설정, 내비게이션, 날씨 |
| `web/src/stores/` | 인증·프로필, 실시간 로그·필터, 대화 상태 |
| `web/src/components/` | 차트, 로그 표·상세, 업로드, 관리자, 공통 모달 |
| `functions/processor.js`, `functions/lib/parser.js` | 원문 생성 트리거, 검증·정제·중복 처리 |
| `functions/api.js` | 회원 프로필, 중복 확인, 관리자 승격, AI 대화 |
| `functions/lib/analytics.js`, `ai.js` | 누락값 보존, 통계·이상치, GMS 요청 |
| `functions/lib/http-app.js` | 지도·날씨 프록시; 로컬 Express와 Cloud Functions에서 공유 |
| `firestore.rules`, `storage.rules` | 계정별 기록 격리, 서버 전용 역할·대화 쓰기, 이미지 제한 |
| `dist/`, `infotainment/public/` | 이전 화면 원본과 재사용 자산 |

로그의 `user`는 운전자 ID이고 `ownerUid`는 로그인 계정입니다. 이 두 값은 별도로 관리합니다. 익명 계정도 자기 로그를 업로드할 수 있지만 챗봇·개인 설정은 사용할 수 없습니다. 관리자 권한은 Firestore의 서버 관리 프로필로 확인하며 클라이언트가 직접 변경할 수 없습니다.

## 빌드와 검증

```powershell
npm run build
npm run check
npm test
# 에뮬레이터 실행 중
npm run test:emulator
# 실제 프로젝트에 임시 검증 계정을 만들고 해당 데이터만 정리하는 명시적 검증
node scripts/cloud-smoke.mjs --run
```

2026-10-15 기준: 단위·HTTP 테스트 46개, Firebase 에뮬레이터 통합 시나리오 8개 통과. 실제 Firebase의 이메일 가입·중복 확인·로그 자동 정제·실시간 반영·이미지 저장·권한 차단·GMS 미설정 처리도 확인했습니다. Google 로그인은 Chrome 세션 유지, 회원 기능 접근, 서버의 google.com 제공업체·일반 회원 권한·프로필 저장까지 확인했습니다. 자세한 증거와 미검증 외부 조건은 [44개 요구사항 검증표](docs/requirements.md), [결과 보고서](submission/RESULTS.md)에 기록합니다.

선택적으로 Firebase Hosting을 사용할 수 있도록 `build/web` 자산과 `/api/** → webApi` 재작성 설정을 구성했습니다. `functions/.env.프로젝트ID`의 `WEB_FIREBASE_CONFIG`에는 웹 Firebase 설정 JSON을 넣습니다. 외부 API를 호스팅에서 사용할 경우 `EXTERNAL_APIS_ENABLED=true`와 공개 `KAKAO_MAP_JAVASCRIPT_KEY`를 지정하고, 두 REST 키는 Secret Manager에 같은 이름으로 저장하세요. `npm run build` 후 `npx firebase deploy --only functions:webApi,hosting`으로 공개 배포합니다. 이번 작업에서는 Hosting 공개 배포를 실행하지 않았습니다.

제출 ZIP은 `npm run package:submission`으로 생성합니다. 지역·반·팀원 표기는 기존 저장소의 서울 20반 장문수·최현준 정보를 유지했습니다. 문서 명세서의 PJT5 파일명 규칙을 적용했으며, 키·로컬 설정·원본 제공 자료·node_modules를 제외하고 모든 파일의 SHA-256을 검증합니다. Git 커밋·원격 푸시·GitLab 제출은 수행하지 않았습니다.
