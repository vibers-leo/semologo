# 뉴스 기반 로고 수집과 Windows 작업 인계

`semologo-trend-watch.timer`는 매일 09:15 KST에 최근 뉴스를 살펴보고 `queue.json`을 갱신한다. 기사 제목은 수집 단서일 뿐 로고 원본이 아니다. 같은 서비스의 `ExecStartPost`가 `prepare-trend-worker-handoff.py`를 실행해 `worker-handoff.json`을 만든다.

운영자는 공식 배포 페이지에서 SVG를 찾아 브랜드·행사 동일성, 실제 화면, 파일 해시를 확인한 뒤 `trend-worker-approved-sources.json`에 `trendId`, `id`(`trend-` 접두어), `nameKo`, `sourcePage`, `assetUrl`, `expectedSha256`, `reviewStatus: approved_official_svg`, `reviewedBy`, `reviewedAt`을 기록한다. 기사의 이미지, 공식 출처를 확인할 수 없는 파일, 임의 제작 로고는 승인하지 않는다. 승인된 원본은 동일한 고정 출처 목록으로 중앙 검증 서버와 win-01·win-02 패키지에 배포한 뒤 기존 `semologo-hourly`가 작업을 배정한다. 수집 완료는 공개 등록 승인이 아니다.

2026-10-16 점검 시 뉴스 후보 6건 모두 공식 원본 확인 대기였다. 기존 Windows 출처 318개는 전부 시도되어 신규 작업이 없었다. 미국 상장사 후보 82건을 검사한 결과 SVG 35건이 열렸으나, 화면상 33건은 다른 회사·하위 제품·캠페인 로고라 배제했다. 두 공식 사이트 SVG만 내부 수집 대상으로 승인해 중앙 서버와 두 Windows 패키지에 같은 320개 목록을 반영했다. win-01과 win-02가 각각 한 건을 수집했고, 결과 manifest와 원본 SHA-256이 일치했으며 `sourceChanged=false`, `reviewStatus=PENDING`을 확인했다. 이 결과는 `data/collection/goldmine-r35-manual-review.json`에 기록한다. 공개 목록 증가는 별도 편집 검토와 CMS 반영 후에만 센다. 20만 개를 향한 확대는 출처 개수보다 브랜드 동일성 검증이 현재 병목이다.
