# 세모로고 신규 후보 우선 수집

2026-10-16 KST. win02 기업 사이트 20건 중 19건을 수집·해시 검증했으나 라이브 182,604개 콘텐츠와 다시 대조하니 새 글을 만들 수 있는 동일 기업은 거의 없었다. `us-index-rapp`는 티커 RAPP의 Rapport Therapeutics가 아니라 `rapp.com`의 마케팅 회사 RAPP 로고였으므로 신원 불일치로 보류했다. 발견 명부의 기업명과 도메인 일치만으로 회사 신원이 확정되지 않는 사례다. HRTG 후보의 `hrtg.com`도 상장사 Heritage Insurance Holdings가 아니라 HRTG Partners의 사이트로 확인해 제외했다. 제품 로고와 기존 심볼 단독 파일도 새 대표 로고 후보에서 제외한다.

다음 배치는 후보 명부를 만들기 전에 라이브 CMS의 이름·ID와 대조했다. 기관 웹사이트에서 회사 이름을 확인하고 시각 미리보기를 밝은·어두운 배경에서 검사한 8개를 `data/collection/semologo-worker-sources-cycle-20261015e.json`에 고정했다: AtriCure, Alto Neuroscience, Covista, ACCO Brands, Evommune, Worthington Enterprises, Diebold Nixdorf, Alkermes. 이 8개는 현재 제공되는 흰색 계열 로고이므로 어두운 배경 미리보기·대표 배경을 사용해야 한다. 수집 완료와 실제 신규 공개는 별도 상태다.

fleet 서버는 당시 실행 중인 `vibers-fleet:20261016-semologo-cycle-r24` 위에 명부 하나만 덧입힌 `vibers-fleet:20261016-semologo-cycle-r25`로 107개 고정 출처를 등록했다. 롤백 컨테이너를 보존했고 `check-deploy.sh`는 running, restarts 0, HTTP 200, DEPLOY OK를 반환했다. Windows 공유 ZIP 역시 현행 패키지에서 명부·버전만 변경했다. ZIP SHA-256은 `6d2f8082e0b9eb1ba8050439e771d4d3117fab55bf6522e07f24d16efd568432`이며 비공개 버킷 업로드 후 읽기 검증, 중앙 handoff 게시를 완료했다. 각 PC에서 r25 진단이 성공한 뒤에만 작업을 제출한다.

win02에서 7건을 수집하고 실패한 Diebold Nixdorf 1건은 win01에서 재시도했다. 8건 모두 원본 해시·SVG 안전성·시각 미리보기를 확인한 뒤 새 콘텐츠로 공개했다. 상세 페이지, CDN 파일, CMS 현재 매니페스트가 각각 HTTP 200을 반환했다. 공개 수는 182,604개에서 182,612개로 증가했다. 20만개까지 남은 17,388개는 계속 신원 확인과 중복 제거를 거쳐야 하며, 이번 8건만으로 목표에 도달한 것은 아니다.
