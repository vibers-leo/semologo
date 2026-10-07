# 세모로고 방문 행동 분석

2026-10-07 구현. yahwa의 세션 연결과 유입 표시 구조를 참고하되 세모로고는 기존 NCP PostgreSQL을 사용한다. Firebase는 기존 관리자 로그인 토큰 검증에만 사용한다.

- `/admin` → 운영 허브 `/admin/logos` → `/admin/traffic`. 기존 공용 FanEasy 어드민 링크는 유지한다.
- 클라이언트의 일별 탭 세션 ID를 기존 방문 집계와 공유한다. 사람 수·회원 수가 아니라 익명 방문 세션이다.
- 첫 행동의 UTM 5종, 랜딩 경로, referrer 호스트를 보존한다. 페이지 query/token, 원본 IP, 회원 UID·이름·이메일은 저장하지 않는다.
- 페이지 방문, 700ms 검색 안정화, 검색 결과 없음, 로고 열람, 다운로드 선택을 수집한다. 다운로드 완료 보장 또는 CDN 전송량 지표가 아니다.
- 서버는 이벤트·필드 허용 목록, 8KB 요청 제한, 세션 일 500건과 단기 요청 제한을 적용한다.
- 관리자 조회는 Firebase accounts lookup으로 토큰과 검증된 관리자 이메일을 확인한다. 무인증 조회 금지, private no-store 응답.
- 1/7/30/90일 전체 집계, 인기 검색/다운로드 각20개, 조건에 맞는 최근100세션 및 세션별 최근100행동을 표시한다.
- `scripts/traffic-schema.sql`을 기존 semologo DB에 적용한다. 이전 테이블은 변경하지 않는다.
- `scripts/prune-traffic.cjs`를 매일 실행하여 90일 이전 이벤트와 오래된 세션을 삭제한다.
- 새 기능 배포 이후 기록만 제공한다. 광고 차단·storage 비활성화·직접 CDN 방문은 집계에서 빠질 수 있다.

검증: `node scripts/tests/traffic-validation.cjs`, TypeScript 빌드, 무인증 관리자 API403, 수집 API origin/유효성/DB 저장 확인 및 테스트 기록 삭제.
