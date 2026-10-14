# 공식 로고 보완 수집 재개

- LG화학: lgchem → lg-chem 통합, 국문 대표, 기존 2종+공식 3종=5종. 원본 AI 3개 보존. CDN 9객체 검증. e7dc640 배포 완료. 검색 결과 1건·5종 API·308 연결 확인. check-deploy 재검사 DEPLOY OK, restarts=0.
- CJ ONSTYLE·삼성E&A: 공식 원본 SVG/PNG 검수 오버레이 포함 같은 배포.
- 한국산업은행: 공식 AI ZIP 4개 다운로드/ZIP 무결성 확인, 7개 멤버. marketing/assets/official-next-20261013/kdb-downloaded.json. 아직 새 버전 게시 아님.
- 한국공공조직은행: 2026-10-14 공식 AI를 육안 검수해 기존 `gongu-ci-1395`에 통합. 세로형 잘림을 원본에서 다시 추출하고 심볼·글자형을 분리해 공식 8종 SVG/PNG와 원본 AI를 NCP 버킷에 게시. 기존 흰 배경 PNG는 불변 경로로 보존. 현재 CMS 버전 검수 완료, CDN 메인 SVG·변형 목록·AI 각각 HTTP 200. `scripts/extract-kptb-official-forms-20261014.py`, `scripts/publish-kptb-official-20261014.py`로 재현 가능. 기존 명부 연결은 없어 수집현황의 4형태 완료 수는 변하지 않음.
- 쿠팡플레이·한국수출입은행: 공식 벡터 보완 수집 미완료. 수출입은행 두 콘텐츠의 동일성 대조 필요.
- SVG 전수 진단: 빌드 중 자체 작업만 정지 후 재개, 120056/174619 최근 확인. 진단은 자동 게시하지 않음.

공개된 정상 로고는 이용자 자료로, 내부 누락·보류 목록은 품질 보완 근거로 유지한다.
