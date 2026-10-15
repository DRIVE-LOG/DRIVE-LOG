# 요구사항 구현·검증표 (PJT2–5)

검토 기준: 사용자 제공 `16-C-1-02/03/04/05.pdf` 4개 명세서와 PJT02–05 강의자료 4개. 번호가 있는 요구사항은 총 44개이며 심화 기능을 포함합니다. PJT5 표의 F505(날짜), F506(사용자)와 본문 F505(사용자), F506(기본 계정)의 번호 불일치는 날짜·사용자 필터·기본 계정 진입을 모두 구현하는 방식으로 처리했습니다.

`구현`은 코드 존재 및 연결 여부이며 실제 외부 서비스 검증 범위와 구분합니다. Google OAuth는 실제 Chrome 세션과 서버 프로필까지 확인했습니다. 실제 음성 입출력은 사용자가 정상 동작을 확인했습니다. Kakao/OpenWeather 키를 복구하여 지도·검색·경로·날씨·예보 실응답을 확인했습니다. GMS 실생성 응답은 API 키가 없어 검증하지 못했습니다.

| 번호 | 요구 기능 | 구현 위치 | 검증 근거·범위 |
| --- | --- | --- | --- |
| F201 | 파일 행별 원문 업로드 | UploadDialog, stores/logs, lib/upload | Chrome 67행 저장, 실제 Firebase 합성 행 저장 |
| F202 | 문서 생성 시 자동 파싱 | functions/index, processor | 에뮬레이터 및 배포된 트리거 작동 |
| F203 | 정제 로그 저장 | processor, lib/parser | 실제 Firebase Speed=136 및 소유자 확인, 원문 보존 |
| F204 | 최신순 실시간 UI | stores/logs, LogTable | onSnapshot, Chrome 66행 즉시 반영 |
| F205 | 날짜·등급·키워드 복합 필터 | LogFilters, lib/query | KST 포함 경계 단위 테스트, Chrome 복합 결과 2행 |
| F206 | 로그 등급별 색상 | style.css, LogTable | INFO/WARNING/ERROR/CRITICAL/DEBUG 배지 확인 |
| F207 | 사용자 ID별 필터 | LogFilters, stores/logs | driver-0 필터 및 소유 계정 분리 |
| F301 | 홈 AI 앱 버튼 | HomeView | 홈 우측 하단 AI 카드, 공통 메뉴 진입 |
| F302 | 태블릿 내부 채팅 전환 | App, Router, ChatView | 공통 배경·헤더·HOME 유지 |
| F303 | 역할별 말풍선·아이콘 | ChatView | 사용자·AI CSS/마크업, 에뮬레이터 대화 저장 |
| F304 | 사용자 메시지 즉시 표시 | stores/chat | Chrome 전송 직후 말풍선, 서버 확정과 중복 방지 |
| F305 | GMS 비동기 응답·로딩 | api.chat, lib/ai | 요청 규약·응답·오류 어댑터 테스트 통과. 실제 GMS 키 없음 |
| F306 | 주행 기록 근거 피드백 | lib/ai, lib/analytics | 타 계정 로그 제외 및 선택 운전자 분석 테스트. 실생성 품질 미검증 |
| F307 | 시간순 대화·시간 표시 | stores/chat, ChatView | Firestore createdAt 정렬·KST 표시·과거 기록 복원 |
| F308 | 새 메시지 자동 스크롤 | ChatView watch/nextTick | 메시지 변경 시 대화 영역 하단 이동 로직 및 화면 확인 |
| F309 | 세션 내 대화 유지 | Pinia stores/chat | 화면 이동·새로고침 후 메시지 유지 |
| F310 | 하단 고정 입력·전송 | ChatView, style.css | 분리된 스크롤 영역, Enter/Shift+Enter/IME 분기 |
| F311 | 음성→텍스트 | services/speech | 한국어 음성 이벤트·전사 테스트 통과, 실제 문장 인식은 사용자 정상 확인 |
| F312 | 녹음 상태 표시 | ChatView, services/speech | 시작·종료·오류 상태 테스트, 녹음 CSS·reduced-motion |
| F313 | AI 응답 음성 읽기 | services/speech, stores/chat | 한국어 TTS 호출·중첩 취소 테스트 통과, 실제 출력은 사용자 정상 확인. GMS 실응답 연계는 키 필요 |
| F314 | Firestore 대화 이력 복원 | api.chat, stores/chat | 사용자/AI 두 메시지·재시도 중복 방지·타 계정 접근 거부 |
| F401 | 닉네임 환영 인사 | App, HomeView | SSAFY/브라우저 회원/변경 닉네임 반영 확인 |
| F402 | 기본 계정 챗봇 차단 | ChatView, api.member | Chrome 제한 모달 및 서버 permission-denied |
| F403 | 기본 계정 개인 설정 제한 | SettingsView, api.member | 필드 비활성 및 서버 요청 차단 |
| F404 | 사용자 전환 화면 | ProfilesView | 공개 프로필 목록·기본/일반 계정 선택 |
| F405 | 선택 회원 Firebase 로그인 | session.login, ProfilesView | 실제 이메일 로그인; 선택 UID와 다른 인증 시 세션 차단 |
| F406 | 기본 계정 무암호 진입 | session.guest | Firebase Anonymous Authentication 유효 세션 |
| F407 | 회원가입 후 자동 로그인 | ProfilesView, session.register | Chrome 가입→홈, 실제 Firebase 계정·프로필 생성 |
| F408 | 일반 회원 챗봇 권한 | ChatView, api.member, rules | 서버의 회원 등급 확인, 게스트 요청 차단 |
| F409 | 닉네임·비밀번호·배경 변경 | SettingsView, session, saveProfile | 닉네임·이미지 UI/실서버 저장, 비밀번호 재인증·새 비밀번호 로그인 테스트 |
| F410 | 관리자 전용 숨김 탭 | SettingsView, AdminPanel | 관리자 회원 관리 탭 노출, 일반 회원 탭 0개 |
| F411 | 전체 회원 조회 | AdminPanel, firestore.rules | 관리자 목록 조회 허용·일반 사용자 타인 정보 거부 |
| F412 | 관리자로 승격 | api.promoteUser | 서버 권한 재확인, 승격·재로그인 후 역할 유지 테스트 |
| F413 | 프로필 사진 Storage 업로드 | session.uploadImage, storage.rules | Chrome 및 실제 Storage 업로드, 타인·게스트·SVG 차단 |
| F414 | Firestore 이메일 중복 확인 | checkEmail, ProfilesView | 입력 debounce·Firestore 조회·Auth 보완, 실제 중복 거부 |
| F415 | Google OAuth | session.google, ProfilesView | Chrome 실제 로그인·새로고침 후 세션 유지·회원 설정/대화 접근, 서버 google.com 제공업체·user 권한·프로필 저장 확인 |
| F501 | Firestore 로그 조회 | stores/logs | 실제 DB 및 에뮬레이터 소유자 조건 조회 |
| F502 | 변경 사항 실시간 반영 | stores/logs, MetricChart | 새로고침 없는 목록·통계·차트 반응형 연결 |
| F503 | Chart.js 주요 지표 | MetricChart, AnalyticsView | 속도·엔진 온도·가속도·연비 canvas 4개, 통계·결측 테스트 |
| F504 | 차트 등급 필터 | LogFilters, AnalyticsView | 공통 filtered 상태로 네 차트와 표 갱신, WARN 정규화 |
| F505 | 날짜 범위 필터 | lib/query, LogFilters | 시작·종료일 KST 포함 경계 및 역전 범위 안내 |
| F506 | 운전자 선택·기본 계정 진입 | LogFilters, ProfilesView | 사용자별 필터와 무암호 세션 모두 구현 |
| F507 | 이상치 감지 | lib/analytics, AnalyticsView | 과속·과열·급가감속·충격, 경계/음수/누락값 테스트, 기준 조정 |
| F508 | Vue 컴포넌트 마이그레이션 | web/src | 기존 앱을 포함한 8개 화면 SFC, Router, Pinia, 데스크톱·390px 확인 |

## 보완한 동작

- 결측 측정값은 0으로 바꾸지 않고 `null`/미측정으로 유지합니다.
- 중복 파일·겹치는 파일·부분 실패 재시도는 기존 문서를 재사용합니다.
- 차트는 최대 300개 평균 구간으로 표시하지만 통계와 이상치 판정은 전체 조회 로그를 사용합니다.
- 사용자 변경 시 구독, 이전 로그 상세, 대화, 필터를 정리합니다.
- 역할, 공개 프로필, 대화 응답은 서버에서만 작성합니다. 일반 회원은 자신의 비공개 정보와 로그만 읽을 수 있습니다.
- AI 중복 요청 ID, 동시 요청 잠금, 오류 후 재전송, GMS 키 미설정 처리를 추가했습니다.
- 원본 PJT1 지도·날씨도 Vue로 이전했습니다. Chrome에서 3D 건물 지도, 강남역 검색, 경로·거리·소요시간·안내, 현재 날씨와 가로·세로 예보 전환을 확인했습니다. API는 예보 40개를 반환하며 화면은 원본과 같은 24개를 표시합니다. 원본의 상세 지표·드라이빙 인사이트·오늘/내일 기온 범위·홈 위젯·예보 드래그 및 방향키 이동을 복구했습니다. 로컬 2개 서버와 배포 함수의 정상 응답·빈 좌표 거부·키 비노출 검사 15개가 통과했습니다. 키가 없을 때 측정값·지도 결과를 만들어 표시하지 않습니다.
- 지도·날씨 API의 빈 좌표·공백 입력을 0으로 처리하던 오류를 수정하고 실제 숫자 0과 구분하는 회귀 테스트를 추가했습니다.

## 남은 외부 조건

1. GMS API 키 재발급과 허용 모델 확인 후 실생성 응답 검증.

Google 로그인은 실제 브라우저·서버 관찰로 검증했으며, 음성 입출력은 사용자 실기 확인으로 기록합니다. 음성 검사 페이지의 이벤트 기록은 수집되지 않아 브라우저 이벤트를 직접 관찰한 결과로 표시하지 않습니다.

기능 코드는 모두 구현했지만 위 환경 의존 항목을 실제 서비스 검증 완료로 표시하지 않았습니다.
