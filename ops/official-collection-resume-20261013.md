# 공식 로고 보완 수집 재개

- LG화학: lgchem → lg-chem 통합, 국문 대표, 기존 2종+공식 3종=5종. 원본 AI 3개 보존. CDN 9객체 검증. e7dc640 배포 완료. 검색 결과 1건·5종 API·308 연결 확인. check-deploy 재검사 DEPLOY OK, restarts=0.
- CJ ONSTYLE·삼성E&A: 공식 원본 SVG/PNG 검수 오버레이 포함 같은 배포.
- 한국산업은행: 2026-10-14 공식 AI ZIP 4개(로고타입 국·영문, 가로·상하 조합 국·영문)에서 7개 투명 SVG/PNG 형태를 검수해 기존 `gongu-ci-1628`에 통합. 영문 가로형의 첫 추출이 잘려 원본에서 재추출. 원본 AI 묶음 ZIP과 기존 저해상도 PNG를 불변 경로에 보존하고 현재 CMS 검수 완료. 메인 SVG·변형 목록·상세 페이지 HTTP 200. `scripts/extract-kdb-official-forms-20261014.py`, `scripts/publish-kdb-official-20261014.py`로 재현 가능. 해당 브랜드는 현행 수집현황 명부에 연결되어 있지 않아 4형태 완료 수에는 영향 없음.
- 한국공공조직은행: 2026-10-14 공식 AI를 육안 검수해 기존 `gongu-ci-1395`에 통합. 세로형 잘림을 원본에서 다시 추출하고 심볼·글자형을 분리해 공식 8종 SVG/PNG와 원본 AI를 NCP 버킷에 게시. 기존 흰 배경 PNG는 불변 경로로 보존. 현재 CMS 버전 검수 완료, CDN 메인 SVG·변형 목록·AI 각각 HTTP 200. `scripts/extract-kptb-official-forms-20261014.py`, `scripts/publish-kptb-official-20261014.py`로 재현 가능. 기존 명부 연결은 없어 수집현황의 4형태 완료 수는 변하지 않음.
- 두 은행 검색 카드 반영: NCP Object Storage의 `_clients/brands.json`·`brands-slim.json`을 사전 해시·ETag 검증 후 두 객체만 수정해 게시. 변경 전 원본과 게시 후 해시는 `marketing/assets/catalog-bank-patch-20261014/`에 보관. `scripts/patch-bank-catalog-20261014.py`·`scripts/publish-bank-catalog-20261014.py`로 재현 가능. 세모로고 컨테이너 재시작 뒤 `check-deploy.sh`의 `DEPLOY OK`·HTTP 200 확인, 실제 `/api/catalog/` 검색에서 두 브랜드 모두 `has_svg: true`, `has_png: true` 검증. 두 브랜드 CDN 캐시만 퍼지하고 대표 PNG HTTP 200 확인.
- 쿠팡플레이·한국수출입은행: 공식 벡터 보완 수집 미완료. 수출입은행 두 콘텐츠의 동일성 대조 필요.
- SVG 전수 진단: 빌드 중 자체 작업만 정지 후 재개, 120056/174619 최근 확인. 진단은 자동 게시하지 않음.
- SVG 투명 파생본 게시: 2026-10-14 대량 게시 작업 진행 중. 초반 실패로 기록된 `zzgt`·`zzsd`·`zzn-1`·`zygo`·`zymetx`는 원본 SHA와 PNG 투명도를 재검증한 뒤 별도 재시도하여 DB 게시 상태 5/5 확인(`marketing/assets/svg-background-publish-20261014/retry-five.json`). 과거 진행 파일의 실패 기록은 이력으로 유지하며 대량 작업 종료 후 최종 성공/누락을 다시 집계해야 함.
- 같은 대량 작업의 적격 후보는 81,731건이며 2026-10-14 12시대 약 28,500건 진행. NCP Object Storage `SlowDown`이 1건 발생해 재실행용 `safe_publish`에 지수 대기 재시도를 추가하고 모의 오류 2회 후 성공을 검증. 현재 실행 중인 프로세스는 시작 당시 코드를 계속 쓰므로 완료 후 누락 건을 재시도하고 `complete.json`으로 최종 판정해야 함.
- 충청남도: 기존 공식 AI 기반 가로조합 SVG에서 국문 글자 경로 9개를 분리하고 2400px 투명 PNG를 제작·육안 검수. 기존 `south-chungcheong`의 27종 구성과 원본은 유지하고 `ko-wordmark` 1종을 합쳐 28종으로 게시. CDN 공개 목록·PNG HTTP 200 확인. 수집현황 명부 재집계에서 4형태 완성 6→7/720, 글자형 부족 688→687. 근거: `marketing/assets/south-chungcheong-wordmark-20261014/` 및 두 제작·게시 스크립트.

공개된 정상 로고는 이용자 자료로, 내부 누락·보류 목록은 품질 보완 근거로 유지한다.

## 2026-10-14 Community 금광 재개

- 사용자 제공 글로벌 1,408개 컴포넌트에서 기존 콘텐츠와 실제 그림을 나란히 비교했다. 단순 중복은 제외하고 Discord, .NET, EBANX, Elastic, Elm, Elo, Ethereum, Firebase, Flickr의 구별되는 SVG 변형 9종을 기존 브랜드에 추가했다. 브랜드 신규 생성이나 공식 최신 CI 주장은 하지 않는다.
- 벡터 원본 해시·자체 포함 여부·투명 렌더·2000px PNG·육안 검수 후 27개 불변 객체를 CDN에서 바이트까지 확인했다. 운영 DB와 공개 `variants.json` 각각 9/9 일치. 대표 이미지는 유지했다. 근거: `marketing/assets/figma-global-next-20261014/`.
- 글로벌 묶음의 검수 게시 브랜드는 8→17개. 나머지 1,408 컴포넌트는 브랜드 식별·기존 도안 비교가 필요한 후보이며 완료 수에 포함하지 않는다. 별도 SVG 배경 제거 게시 배치는 동시에 진행 중으로 중복 실행하지 않았다.
