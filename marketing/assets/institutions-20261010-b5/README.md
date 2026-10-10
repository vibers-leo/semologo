# 공식 조합형 추가 수집 — 2026-10-10 b5

대상 2기관, 새 조합 12종, SVG 12개 + 투명 PNG 12개. 공유 src/DB/CDN 수정 없음. publisher compatible release.json 및 uploads.json.

- 양천문화재단 gongu-ci-0246: 공식 CI 페이지 https://yfac.kr/main/contents.do?idx=2489 및 공식 Ci_Download.zip. ZIP CRC 정상, 로컬 원본과 live 다운로드 SHA-256 동일. AI 5페이지에서 심볼, 세로 A/B 각 국문·국영문, 가로 국문·국영문, 로고타입 국문·국영문 9종. official primary 제안 vertical-B-ko-en-vertical.
- 한국개발연구원 kdi: 공식 https://www.kdi.re.kr/introduce/pmCi 의 logo_CI_ai.zip. CRC 및 live hash 동일. signature1.ai의 완전한 국문/영문/국영문 가로조합 3종. 개별 logo.ai/logotype.ai는 원본 자체 artboard에 잘림이 있어 사용하지 않음. 기존 심볼 variant는 부모에서 merge 보존 필요. 기관 하위부서/슬로건 매뉴얼은 제외.

PyMuPDF의 실제 순수 벡터 SVG 출력 사용, image 요소 없음. 양천 AI의 특정 전체 페이지 white rectangle 2종 path 값만 정확히 제거(로고 내부 white 삭제 안함). 공식 조합을 재배열하지 않음. PDF manual caption/치수선 ROI 제외, alpha bounds에서 투명 여백8px 확보. contact.jpg의 12종 육안 검수 완료. 사용자에게 보이는 연도는 추정하지 않음; 갱신은 기존 기관 조합 추가이므로 publication timestamp를 임의 갱신하지 않음.

부모 반영 시 기존 manifests에 key별 병합하고, 양천 대표는 실제 세로 B로 변경할지 기존 admin presentation을 확인. patches는 최소 파일 필드만 포함하여 숨김/수동지정/게시상태 보존.
