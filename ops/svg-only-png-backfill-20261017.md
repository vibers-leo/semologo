# SVG 전용 로고의 투명 PNG 보완 — 2026-10-17

사용자 화면의 시애틀 인근 검색 결과를 실제 CDN 원본과 대조했다. 기존 SVG를 밝은·어두운 배경에서 시각 검토한 뒤 8건에 투명 PNG를 추가했다. 원본과 게시 PNG의 SHA-256, 파일별 처리 방법은 `data/collection/svg-only-transparent-png-20261016.json`에 고정했다. 스크립트 `scripts/publish-svg-only-transparent-png-20261016.py`는 원본 해시와 기존 PNG 부재를 검증한 다음 업로드·CDN 검증·CMS 갱신을 처리했다.

게시: `search-engine-land`, `seattle-supersonics`, `seattle-storm`, `seattle-thunderbirds`, `seaworld`, `seattleinsider`, `seato`, `seattle-seahawks-2`. 8건 모두 CMS의 `has_png`와 실제 PNG 경로가 반영되었고, 버킷의 불변 원본 및 `logo.png`·`logo-transparent.png` 16개 CDN 별칭을 다시 다운로드하여 기대 SHA-256과 비교했다. 대표 선택이나 로고 도입 연도는 변경하지 않았다.

보류: `seattle-supersonics-1`, `-2`, `-3`, `seat-4`, `seattle-metropolitans-1`, `seattle-metropolitans`. 이 여섯 SVG는 저해상도 JPEG를 감싼 래퍼라 PNG 변환으로 화질이 좋아지지 않는다. 특히 흰색 로고 형태와 배경이 겹친 파일은 자동 배경 제거가 로고를 훼손할 수 있어 재수집·교체 검토가 필요하다.

같은 시점 운영 DB에는 `has_svg=true`이고 `has_png=false`인 게시 행이 **123,561건** 남았다. 이 수치는 실제 SVG의 안전한 배경 제거 가능 건수가 아니다. 원본 MIME·내장 비트맵·정확한 캔버스 배경·화이트 로고 요소를 먼저 분류해야 한다. 이력과 검토 없이 나머지를 일괄 PNG로 게시하지 않는다.

200만 개 목표와 관련해 9,595,297개는 중복 제거한 **도메인 후보** 수다. win01·win02별 샤드 파일을 준비했지만 `vibers-bucket/.../semologo/seeds/`의 `PutObject AccessDenied`와 새 도메인 탐색 job 미설치 때문에 Windows에 전달하거나 실행한 상태는 아니다. 현행 Windows job은 사람이 검증한 공식 SVG URL 목록 수집만 담당한다. 도메인 후보 수, 확보 원본 수, 검수 뒤 게시된 고유 로고 수를 분리해 보고한다. 상세 근거는 `ops/mass-collection-2m-20261016.md`에 있다.

2026-10-17 갱신: 위 마지막 문단의 장애는 해결했다. 중앙 맥 자격증명으로 비공개 샤드 6개를 버킷에 게시했고 별도 Windows 도메인 탐색 job을 두 PC에서 실제 완료했다. 정기 공급 상태와 검증 결과는 `ops/mass-collection-2m-20261016.md`의 갱신 절을 따른다.
