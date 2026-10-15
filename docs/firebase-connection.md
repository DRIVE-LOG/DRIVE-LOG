# Firebase 연결 검증 · 2026-10-15

기존 DRIVE LOG PJT2 프로젝트의 웹 설정과 Firebase CLI 로그인을 Chrome에서 복구했습니다. 새 프로젝트를 만들지 않았으며 서비스 계정 개인 키를 생성하지 않았습니다.

- 프로젝트: drive-log-pjt2-260911-7a90f
- Functions: asia-northeast3, Node.js 22
- Storage: drive-log-pjt2-260911-7a90f.firebasestorage.app, US-EAST1
- 로그인 제공업체: 익명, 이메일/비밀번호, Google 활성화
- Firestore: 계정 소유 로그 조회, 서버 전용 사용자/역할/대화 쓰기, 공개 프로필의 이메일 제외
- Storage: 회원 본인 경로·5 MB 이하·JPG/PNG/WebP만 업로드
- 배포 함수: processRawLogs, ensureProfile, checkEmail, saveProfile, promoteUser, chat, webApi
- Hosting 공개 배포는 수행하지 않았습니다.

실제 클라우드 합성 계정으로 가입, 중복 이메일 확인, raw 문서 생성→자동 파싱→onSnapshot 반영, Storage 이미지 업로드, 프로필 변경, 일반 회원 승격 거부, 프로젝트 소유자 CLI를 통한 초기 관리자 지정, GMS 미설정 실패·사용자 메시지 보존, webApi 설정 응답을 확인했습니다. 검증이 끝난 임시 계정과 그 계정의 생성 데이터는 모두 삭제했습니다. 기존 사용자 데이터는 변경하지 않았습니다.

GMS_ENABLED=false 상태로 배포했습니다. 키 없는 AI 요청에는 명시적인 오류를 반환합니다. 실제 Google 로그인은 2026-10-15 10:06 KST에 완료되었고 10:08 KST에 서버에서 확인했습니다. Chrome에서 새로고침 후 프로필 세션 유지, 회원 설정·챗봇 접근, 관리자 탭 숨김을 확인했습니다. 서버에서도 google.com 제공업체, 활성 계정, user 권한, users/public_profiles 저장, 공개 프로필에 이메일이 없음을 확인했습니다.

배포 CLI는 모든 함수의 Successful create/update operation 후 Artifact Registry 정리 정책이 없다는 후속 경고로 종료 코드 1을 반환했습니다. 함수 생성 자체는 성공했으며 배포된 함수의 실제 호출까지 검증했습니다. 기존 컨테이너 이미지 정리 정책은 변경하지 않았습니다.

인증 토큰, Firebase 로컬 웹 설정, functions/.env.프로젝트ID, .secret.local은 Git 및 제출 ZIP에 포함하지 않습니다. 설정과 재현 명령은 README를 참고하세요.

추가 점검에서 지도·날씨 빈 좌표가 0으로 변환되는 오류를 수정하고 webApi를 재배포했습니다. 키 복구 전에는 실제 배포 함수와 로컬 서버 2개에서 총 12개 오류 경로를 확인했습니다. 정상 좌표에 키가 없으면 503 API_KEY_MISSING, 빈 좌표면 400 INVALID_COORDINATES가 반환됩니다.

2026-10-15 Kakao 앱 Infortainment System과 OpenWeather Car Information의 기존 활성 키를 복구했습니다. 로컬 infotainment/.env에 연결하고, 서버 키 KAKAO_MOBILITY_REST_API_KEY·OPENWEATHER_API_KEY를 Secret Manager에 등록했습니다. webApi에는 EXTERNAL_APIS_ENABLED=true와 공개 JavaScript 키를 적용해 재배포했습니다. 실제 로컬 서버 2개와 배포 함수에서 경로 및 현재 날씨·예보 40개, 공개 설정, 빈 좌표 거부를 검사해 15/15 통과했습니다. 응답에는 서버 키가 없으며, Chrome 지도·검색·길안내·날씨 화면도 확인했습니다. 실제 장치 위치 대신 서울 시청과 강남역의 공개 좌표를 사용했습니다. GMS_ENABLED=false는 유지하며 GMS 실생성 응답만 키 부족으로 미검증입니다.
