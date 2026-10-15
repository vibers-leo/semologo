# 이디야커피 공식 CI 보완 (2026-10-15)

- 공식 근거: [이디야커피 2025 회사소개서](https://www.ediya.com/images/main/kor_brochure_2025.pdf), PDF 6쪽(인쇄면 10–11쪽)의 `CI Philosophy`. PDF SHA-256 `f44febc810a621f69f2082a6e5b5f56fc4150d206b85574814d94c8b9bc93027`.
- 공식 CI에서 원형 문장과 가로조합형을 정확한 영역으로 분리해 투명 PNG로 렌더했다. 각각 1200×1180, 2400×306px. PDF에서 추출한 가공 자산이므로 독립 배포된 SVG로 표시하지 않는다.
- 공개 파일: `_clients/ediya-coffee/sources/ediya-2025-ci-symbol.png` (SHA-256 `33e3417518bb62feaf8dac44a45c545b4203a07b04a211202dd78c402fb6c1fe`), `_clients/ediya-coffee/sources/ediya-2025-ci-horizontal.png` (SHA-256 `9a0669e7224b7710131c4f2ee43d9e912c7925e2ee469ca2983eea4ab1e19276`). 업로드 후 버킷 원본과 공개 CDN의 바이트가 일치함을 확인했다.
- 기존 워드마크 SVG·PNG와 대표 지정은 유지했다. 공개 `logo-variants` API에서 `wordmark`, `horizontal`, `symbol` 3종을 확인했다. 공식 자료에서 세로 조합은 확인되지 않아 수집 대기로 남겼다.
- 이번 대상은 검색량이 높은 인기 브랜드의 형태 누락 점검 사례다. 수집 큐에서도 인기 브랜드를 명부 소속 여부와 별도로 우선 검토해야 한다.
