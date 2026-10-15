# Windows 로고 시간별 수집 — 2026-10-16

세모로고의 공식 SVG 수집은 일회성 배치만 실행되고 정기 예약은 없었다. 2026-10-16 07:21 KST NCP `vibers`에 `semologo-hourly.timer`를 설치해 매시 42분마다 중앙 큐 제출과 상태 보고를 실행하도록 했다. 운영 스크립트 원본은 `macminim4/ops/worker-fleet/deployment/semologo-hourly.{mjs,sh,service,timer}`이다.

시간별 실행은 현재 고정 출처 목록에서 미시도 항목을 우선해 PC당 최대 2건, 총 4건을 큐에 넣는다. 완료·진행 중인 출처는 중복 등록하지 않고 실패는 출처당 한 번만 재시도한다. PC가 이미 다른 작업을 실행 중이면 건너뛴다. 실행 결과는 `/root/projects/vibers-fleet/semologo-hourly.jsonl`에 기록하며 최근 한 시간의 성공·실패·manifest 경로, 보류 출처, 남은 출처와 다음 조치를 포함한다. 수집 원본은 기존 비공개 버킷·해시 검증 계약을 따른다.

실측: 07:21 실행에서 누락됐던 `us-index-navi`를 win-01에 제출했고 job `5918e602-96a4-4799-b0ed-11b49d1266e8`이 성공해 비공개 manifest가 생성됐다. 조회 API의 기본 반환 건수 제한 때문에 50건 미시도처럼 보였으나 중앙 DB에서 기존 107개 고정 출처가 모두 한 번 이상 시도된 것으로 확인했다. 재시도 3건은 이미 두 차례 실패하여 자동 반복 대상에서 제외했다.

그대로 예약하면 출처가 소진되므로, 기존 미국 기업 공식 사이트 후보에서 4개의 SVG를 새로 preflight해 111개 고정 출처의 r26 handoff를 배포했다. `prepare-worker-logo-hourly-seed-20261016.py`가 기존 r25 ZIP의 manifest 해시를 검증한 뒤 새 출처와 버전을 추가한다. 서버 이미지는 공유 fleet의 당시 최신 `20261016-semosub-hourly-r1` 이미지 위에 출처 목록만 덧입혔다. Windows 공유 handoff SHA-256은 `ab2133b5dabbd3382a7d848c7f7b9a367222d42790f0b95820940faea46fd89f`다. 두 PC에서 r26 진단에 성공했다. win-01에 먼저 배정한 UMB Financial과 BrightSpring Health Services는 비공개 manifest 생성까지 성공했다.

정기 수집은 **원본 확보와 검토 대기열**까지만 수행한다. 기업 동일성, SVG 안전성, 시각 품질, 기존 콘텐츠와의 중복 확인 후 CMS 게시해야 한다. 현재 자동 출처 발굴·공개 게시까지 연결된 것은 아니므로, 고정 출처를 소진하면 보고서의 `nextAction`에 출처 목록 확장이 표시된다. 20만개 목표를 이루려면 공식 출처 발굴과 검수·게시 파이프라인을 계속 확장해야 한다.

추가로 `prepare-worker-logo-hourly-backlog-20261016.py`가 기존 국내 공식 CI 탐색 원장에서 28개 후보를 재검증해 27개 유효 SVG를 확보했다. r26 ZIP의 manifest를 확인하고 roster 138개짜리 r27 ZIP을 만들었다. 공유 서버에는 당시 r26 이미지 위에 roster만 덧입혀 반영했고, Windows handoff 해시는 `4c54c5eb26e9963b6b560c8ed20820e64bb9476f3ae9c292a4508752d7304bef`다. 기존 r26와 다른 ZIP 파일은 roster·version·manifest 세 개뿐이다. 국내 후보 한 건은 preflight 실패로 제외했다.
