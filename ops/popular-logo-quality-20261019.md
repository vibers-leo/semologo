# 인기 로고 10회 열람 보완

2026-10-19 기준 자체 `semologo.logo_hits`의 `view` 누적 10회 이상은 6개다. 이는 GA4 순위나 사람 수가 아니라 상세 카드 열람 카운터이며, 이 집합의 검토 순서는 `/api/popularity`와 같은 가중 점수를 따른다. 검색어 입력만 한 경우에는 특정 로고를 본 것으로 간주하지 않는다.

`scripts/audit-popular-logo-threshold.py`가 공개 파일 응답, 현재 구성, 공식 출처, 검수 상태를 검사한다. 검토 근거와 남은 원본 수집 과제는 `ops/evidence/popular-logo-review-ledger-20261019.json`에 기록했다. 이번 6개는 모두 한 번씩 검사했으며, 공식 벡터가 없는 자리에 임의 생성 로고를 채우지 않았다.

- 오늘의집: 공식 회사 홈페이지의 가로형 SVG를 대표로 게시. 기존 작은 대표 이미지 해결.
- 이디야커피: 공식 2025 회사소개서의 가로형 CI를 대표 구성으로 지정. 기존 워드마크의 출처 검증은 남음.
- 현대자동차·이마트: 공식 CI 페이지를 연결하고 현재 이미지와 시각적으로 대조. 기존 파일의 배포 원본은 아직 확인되지 않아 검수 대기 상태 유지.
- 위키리크스: 공식 사이트 원본과 과거 벡터를 구분한 기존 상태 및 파일 정상 응답 확인.
- 미추홀구: 사용자 제공 AI 원본 기반 현행 SVG·PNG와 구성 정상 응답 확인.

Mac LaunchAgent `co.vibers.semologo-popular-audit`가 매일 04:10에 실행된다. 운영 파일과 `latest.json`·`audit-history.jsonl`은 `/Volumes/HDD-1TB/semologo-migration/automation/popular-logo-quality/`에 둔다. 새로 10회를 넘긴 항목은 `unreviewed_count`에 나타난다. 자동 점검은 수집·게시를 대신하지 않으며, 시각·출처 판단 후 리뷰 장부에 기록해야 한다.
