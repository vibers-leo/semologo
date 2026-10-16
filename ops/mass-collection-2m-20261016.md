# 세모로고 200만 공개 로고 수집 경로 — 2026-10-16

운영 검색 API의 고유 공개 로고는 181,854건이다. 200만 개까지 1,818,146개의 **순증 공개 로고**가 필요하다. 수집 대상 도메인, 파일 수, 동일 브랜드의 색상·배치 변형은 이 공개 건수에 합산하지 않는다. 4종 완성률도 별도 품질 지표로 유지한다.

## 규모가 달라진 지점

기존 Windows `semologo-logo-collect`는 사람이 고른 공식 SVG URL 한 건을 받아 원본 해시와 비공개 버킷 manifest를 남긴다. 493개 출처의 품질 보강에는 맞지만 200만 건의 주 수집기로 삼을 수는 없다. 현재 5분마다 PC당 16건이라는 이론 상한조차 시간당 384건이며, 중복·실패·검수 보류를 빼면 실제 공개 순증은 훨씬 적다.

새 공급원은 날짜와 해시를 고정한 [Tranco 100만 도메인](https://tranco-list.eu/), [Majestic Million](https://majestic.com/reports/majestic-million?majesticMillionType=0), [Common Crawl 도메인 웹 그래프](https://commoncrawl.github.io/cc-webgraph-statistics/)다. 원본은 외장 HDD의 `semologo-migration/bulk-seeds/`에 보관하고, `scripts/build-mass-domain-seeds.py`가 중복을 제거한다. 2026-10-16 스냅샷은 Tranco·Majestic 합계 159만여 고유 도메인이고 Common Crawl 상위 부분을 합쳐 300만 개 이상 후보가 되었다. 자세한 실제 수치와 원본 SHA-256은 `data/collection/mass-domain-seeds-20261016.json`에 기록한다. Majestic의 목록 라이선스는 [CC BY 3.0](https://majestic.com/reports/majestic-million?majesticMillionType=0)이다. Tranco 목록은 여러 순위 공급원을 결합하므로 원본 파일을 서비스에 재배포하지 않는다.

실측 후보는 **3,050,920개**다. Common Crawl 상위 190만 행을 검사했고 그중 앞선 두 명부에 없던 도메인은 **1,455,623개**다. `scripts/export-mass-domain-shards.py`로 이 신규 도메인 중 100만 개를 win-01·win-02용 50만 개씩 나눠 외장 HDD에 보관했다. 샤드 생성은 Windows 큐 제출이나 로고 게시가 아니다.

Tranco 순위 약 1만 위 구간의 유효 도메인 100개 초기 표본은 24곳에서 원본 SVG/PNG/WebP 파일을 확보했고, 42곳은 접속·리디렉션 실패, 12곳은 첫 사이트 로고 신호 없음, 20곳은 파비콘만 발견, 2곳은 자산 형식이 맞지 않았다. **24%는 원본 발견률이지 게시 가능률이 아니다.** 표본에 관련 없는 사이트와 성인·도박성 페이지가 섞여 있었으므로 자산의 브랜드 동일성·품질·서비스 적합성 검토 없이 대량 공개하면 안 된다. 표본 결과는 `bulk-seeds/pilot-tranco-10000-10099.jsonl`, 원본 바이트는 `bulk-seeds/pilot-assets/`에 남겼다. 첫 표본 이후 탐색기에 `robots.txt` 확인을 추가했으므로 이 표본의 수율을 이후 회차에 그대로 적용하지 않는다.

Common Crawl 전용 도메인의 별도 초기 100건에서도 원본 파일은 28건이었다. 이 역시 게시 승인을 뜻하지 않으며, `bulk-seeds/pilot-commoncrawl-0-99.jsonl`에서 실패·파비콘 전용·자산 무효를 분리한다.

`robots.txt` 확인을 추가한 뒤 다른 Common Crawl 전용 도메인 20건을 재표본 조사해 원본 4건을 확보했다. 표본이 작아 수율 추정에는 쓰지 않고, 새 게이트의 실제 실행·원본 해시 확인 증거로만 남긴다.

## 공개까지의 단계

1. **도메인 후보:** 정규화·중복 제거·출처/순위 기록. 아직 로고가 아니다.
2. **사이트 탐색:** 공식 홈페이지의 Organization/Brand 구조화 데이터와 명시적 로고 이미지, 아이콘 신호를 찾는다. 첫 파일은 `scripts/discover-domain-logo-candidates.py`가 HTTPS와 응답 크기를 제한해 수집한다. 파비콘만 찾은 건은 로고 콘텐츠로 승격하지 않는다.
3. **원본 검증:** 원본 바이트·SHA-256·MIME/서명·실제 렌더·배경 가시성, 사이트 명칭/브랜드 동일성, 라이선스/출처를 확인한다. 심볼과 워드마크를 같은 브랜드의 변형으로 묶고, 여러 도메인의 동일 브랜드도 하나로 합친다.
4. **게시:** CMS 반영 후 PNG/SVG CDN GET·디코딩·검색/상세 표시가 통과한 고유 브랜드만 공개 건수에 추가한다. 4종 완성 여부는 별도 기록한다.

Windows 두 대의 현행 job 종류는 고정 SVG 출처 ID만 허용한다. 도메인 후보 수백만 건을 현재 493개 허용 목록에 끼워 넣으면 메모리·배포·중복 관리가 무너진다. 다음 구현 단위는 해시로 고정한 **도메인 샤드**를 기존 검증된 Windows 배포 패키지에 포함하고 win-01/win-02가 각자 작은 묶음으로 읽어, 발견 메타데이터와 원본을 비공개 버킷에 기록하는 별도 job 계약이다. 기존 공식 SVG job과 CMS 게시 권한은 분리한다. 샤드별 성공률·중복률·원본 검증률·공개 순증/시간을 보고해야 200만 목표의 실제 처리량을 계산할 수 있다. 새 job은 `vibers-worker-fleet` 기준대로 비활성 등록→두 PC capability·왕복 확인→예약 순서로 활성화한다.

샤드의 `vibers-bucket/.../semologo/seeds/` 직접 업로드를 시도했으나 현재 fleet 자격증명에서 `PutObject AccessDenied`였다. 서버 임시 복사본은 제거했다. 권한을 확장하거나 기존 실행 결과 경로에 섞어 넣지 않는다. 따라서 **현재 샤드는 로컬 준비 상태이며 Windows 실행·버킷 보관 상태가 아니다.**

현재 300만 건은 수집 작업의 **후보 풀**이지 300만 로고 수집 완료가 아니다. 표본 수율이 확인되면 Common Crawl의 더 넓은 도메인 구간을 스트리밍하여 후보 풀을 늘리고, 낮은 품질/불명확한 사이트에 무작정 요청을 보내지 않도록 우선순위를 조정한다.
