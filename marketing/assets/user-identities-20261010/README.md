# 사용자 제공 공식 아이덴티티 검수 — 2026-10-10

- 충청남도 27종: 국문/영문/한문 조합 16종, 심볼 1종, 엠블럼 9종, 캐릭터 기본형 1종.
- 2027 논산세계딸기산업엑스포 13종: 심볼, 로고타입, 슬로건, 조직위원회 로고, 다국어 시그니처. 가이드북 PDF 제공.
- 당진시 4종: 심볼, 당찬 당진 로고타입, 시그니처, 캐릭터.
- 당진항 2종: 국영문 좌우조합과 별도 심볼. 당진시와 다른 CMS 콘텐츠로 게시.

모든 46종은 실제 벡터 SVG와 긴 변 2000px 투명 PNG다. 네 콘텐츠의 심볼 아이콘은 1024×1024이며 벡터 렌더에서 생성했다. 원본 AI ZIP 제공. 충청남도 중복 BS2-01 (1).ai는 원본과 바이트가 같아 제외했다.

충청남도 AI8 PostScript는 Ghostscript pdfwrite에서 596×842 페이지와 `0 842 translate` 좌표 보정이 필요했다. PDF를 MuPDF로 path SVG 변환한 뒤 Inkscape query-all 경계를 이용했다. 실제 로고 영역만 선택하고 가이드의 cyan fill과 stroke, 설명 문구를 제거했다. 엠블럼의 테두리와 의도한 흰색은 보존했다.

논산은 ZIP의 EI/AI 개별 13개 파일을 사용했다. 당진시는 pdftocairo SVG로 변환하여 원래 그라데이션을 유지했다. 각 SVG 경계를 Inkscape로 측정해 문서 여백을 제거했다. 당진항 심볼은 텍스트와 분리하되 gradient/clip 정의를 유지했다. 래스터가 내장된 SVG는 검증에서 거부한다.

`prepare-user-identities-20261010.py`는 로컬 전처리 SVG 및 bounds.csv를 입력으로 사용한다. 원본과 전처리 중간물은 같은 디스크의 marketing/assets 각 출처 폴더에 보관한다. release.json과 uploads.json은 SHA256 고정 오브젝트를 기록한다. 표준 publish-reviewed-asset-release.py로 게시하고 CDN manifest도 갱신·퍼지했다. 신규 2개 CMS 항목은 draft로 생성, 업로드 검증 후 published로 바꾸었다.

전체 101개 CDN 오브젝트의 SHA256이 로컬과 일치한다. 신규 두 콘텐츠 페이지 HTTP 200 확인. 실제 브라우저 화면 검증은 관리 정책 제한 때문에 수행하지 못했다.
