# 세모로고 win01·02 반복 수집 3차

2026-10-15. 먼저 앞선 27개 원본에서 Rapid7, Scholastic, FranklinCovey, Plug Power, Strategic Education, NETGEAR의 기업 공식 사이트 SVG 6개를 기존 콘텐츠의 구성에 반영했다. 기존 보유 벡터는 두 번째 구성으로 남겼다. 공식 사이트 원본의 SHA-256과 가로 로고 형태를 재확인했고 투명 PNG 6개를 생성했다. 버킷 원본 12개와 각 브랜드의 `variants.json` 읽기 검증, CMS 현재 버전 구성 6/6, 공개 이미지 HTTP 200을 확인했다. 이 반영은 신규 브랜드 수를 늘리지 않는다. 스크립트는 `scripts/publish-worker-logo-expansion-reviewed-20261015.py`, 게시 증거는 `marketing/assets/worker-logo-expansion-20261015/reviewed-published.json`이다.

3차 출처는 `data/collection/semologo-worker-sources-cycle-20261015b.json`에 고정했다. 기존 49개 URL과 중복된 4개를 제외한 30개 제안 중 19개가 HTTP 200, SVG 원본, 20KB 이하 조건을 통과했다. win01은 국내 기관 CI의 다른 형태 5개, win02는 미국 기업 사이트 14개다. 14개는 카탈로그 명칭의 정확한 일치가 없어 **신규 후보**로만 분류한다. 이름이 겹치지 않는다고 신규 브랜드가 확정되는 것은 아니다. 11개는 모두 현행 20KB 한도를 넘어 이번 작업에서 보류했다.

NCP fleet 서버는 기존 49개 명부만 가진 이미지를 바탕으로 명부 파일 하나를 덧입힌 `vibers-fleet:20261015-semologo-cycle-r22`를 사용한다. 총 68개 고정 출처가 등록됐고 서버 명부 SHA-256은 `ee0191384ec798031144c26448b32b0bd187541809ea560acac9f3b3954f10a6`다. 기존 공유 handler·인증·설정은 유지했고, 이전 컨테이너는 `vibers-fleet-before-semologo-cycle-r22`로 보존했다. Windows handoff는 직전 배포 ZIP을 기초로 명부와 버전만 바꿨다. ZIP SHA-256은 `a274cc0c522d7bb14be19c494833796418725387612028a44394ed2bba2051c9`이며 비공개 `vibers-bucket/automation/v1/handoffs/`와 중앙 `current.json`에 올렸다.

Windows supervisor는 win01에서 `20261015-semologo-cycle-r22`를 설치했다. 같은 시간 다른 프로젝트의 공유 패키지가 `20261015-keyen-pathfix`로 갱신됐으나 그 ZIP에도 세모로고 68개 명부의 SHA-256이 그대로 있었다. win02의 진단은 이 후속 버전을 확인했다. 각 PC의 새 출처 시험 수집이 성공한 뒤 19개 고정 source ID를 큐에 제출했고, 19/19가 성공했다. Mac에서 비공개 버킷 manifest·결과·원본의 SHA-256을 모두 재검증했다. `marketing/assets/worker-logo-cycle-20261015b/manifest.json`과 밝은·어두운 배경 contact sheet가 증거다.

안전 검사는 18개 벡터를 렌더링했고 강화군시설관리공단 1개는 SVG 내부 포함 콘텐츠 때문에 보류했다. 새 콘텐츠 후보 중 Beta Bionics, Life360, QCR Holdings, ReposiTrak 네 곳은 회사 공식 페이지의 현재 SVG와 원본 해시, 화면, 라이브 CMS 중복을 확인해 공개했다. 스크립트는 `scripts/publish-worker-logo-cycle-new-20261015b.py`이고 버킷 객체 16개, CMS 현재 구성 4개, 페이지 및 이미지 HTTP 200을 확인했다. 수집 시작 때 정적 카탈로그에는 없어도 라이브 CMS에는 이미 등록된 기업이 여럿 있어 별도 신규 글을 만들지 않았다. 심볼만 있는 파일과 밝거나 어두운 배경에서만 보이는 로고는 후속 구성 수집 대상으로 남겼다.

20만 개까지 확장하려면 현재 20KB SVG/65KB JSON 결과 제한을 별도 바이너리 원본 계약으로 확장해야 한다. 특히 이번 국내 후보 11개는 20KB 제한 하나 때문에 보류됐다. 새 계약은 최대 크기, MIME/SVG 안전 검사, 비공개 원본 객체 경로, SHA-256 읽기 검증, 공개 승인 단계까지 포함하고 다른 프로젝트의 결과 저장 계약과 분리한다.
