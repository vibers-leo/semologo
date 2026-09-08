# 2026-09-08 로고 수집 작업

- `fashion-reference-wanted.json`: 사용자 참고 이미지 4장에서 중복 제거한 패션 브랜드 50개.
- 원본 수집 후보 14개는 공유 저장소 `_clients/collect-wanted.json`에 추가했다(837 → 851).
- 기존 이름 매칭 36개는 동일 브랜드·형태 확인이 필요하다. 이름 매칭만으로 원본 확보 완료로 처리하지 않는다.
- 공유 상세 큐: `/Volumes/Untitled/brand-logos/_sources/collection-queues/fashion-reference-20260908.json`.
- 첨부 래스터 이미지는 식별 참고용이며 자르기·트레이싱·서비스 등록에 사용하지 않았다.

## 완료한 파일 수집 및 분리

산출물은 로컬 `artifacts/logo-collection-20260908/`에 보관한다. 검수 통과분은 아래 서비스 반영 기록에 따라 카탈로그와 CDN에 연결했다.

- SuperTinyIcons 원본 ZIP에서 SVG 479개 확인, 스크립트를 포함한 calendar.svg 제외 → 478개 보관. MIT LICENSE 동봉.
- 기존 카탈로그 이름 매칭 398개, 미매칭 80개. 일반 아이콘·표준·변형 포함이므로 신규 브랜드 수가 아니다.
- 478개 전부 SVG 파싱, 벡터 도형 존재, 래스터 미포함 및 PNG 렌더 확인.
- 사용자 의류 AI: PDF 호환 1페이지, 래스터 0개, 원본 도형 1,388개. SVG 내보내기의 1,395개 경로를 62개 영역에 빠짐없이 배정.
- 각 영역 SVG / 벡터 PDF / 투명 PNG, 전체 미리보기와 다운로드 HTML 및 ZIP 제공.
- 정체 미확인 전갈 마크는 `unidentified-scorpion`으로 보관한다. 오래된 로고를 현재 공식 CI로 간주하지 않는다.

재실행:

```sh
python3 scripts/prepare-logo-collection.py --source-ai '<원본 AI>' --upstream '<SuperTinyIcons 체크아웃>' --output '<새 출력 폴더>'
```

환경: PyMuPDF, lxml, Pillow. 원본 AI를 수정하지 않고 벡터 경로를 선택한다. `scripts/apparel-logo-regions.json`은 이 AI 파일 전용 분리 영역이다.

## 서비스 반영 (2026-09-08)

후속 검수에서 507개 파일 승인: 신규 브랜드 63개, 기존 브랜드 421개에 연결.
SuperTinyIcons 449개, 의류 모음 58개. 원본 SVG와 PNG를 CDN에 업로드하고 2,175개 객체를 바이트 비교했다.
미리보기의 PyMuPDF 그라데이션 오류를 발견해 서비스 PNG는 safesvg/CairoSVG로 다시 생성했다.
동명이인 연결(UPI 통신사/결제, Rockstar 음료/게임, X 토큰/소셜 등)을 명시적으로 수정했다.
일반 아이콘, 폰트 의존, 불확실한 브랜드, 단색 출력은 보류한다. 참고 이미지 50브랜드 큐는 이 작업과 별개다.
`published-review-20260908.json`에 승인·보류 상세 기록. 기존 브랜드 대표 자산은 교체하지 않았다.

## Lobe Icons / SVGL (2026-09-08)

- Lobe Icons 322항목, SVGL 668브랜드의 고정 커밋 원본을 로컬 `artifacts/ai-svg-collection/`에 보관. MIT 저작권 고지를 각 SVG metadata에 유지.
- 검수 승인: Lobe 382종 + SVGL 138종 = 520종. 신규 77브랜드, 기존 278브랜드 보강.
- SVG 파싱·외부 참조/래스터/스크립트/폰트 의존 차단, PNG 렌더, 6개 전체 검수 시트 확인. 같은 픽셀 또는 이미 보유한 SVGL 형태는 제외.
- 구형 Adobe 모음, 리브랜딩 확인 필요 항목, 동명 다른 회사, 너무 작은 viewBox 출력은 보류. 수집일을 로고 변경일로 취급하지 않는다.
- 기존 대표 로고는 유지하며 검수된 다운로드 변형을 추가. 신규 대표는 검수된 워드마크/심볼에서 선택.
- 재실행: collect-ai-svg.py → review-ai-svg.py → 원본 사이트/시각 검수 → publish-ai-svg.py → upload-ai-svg.py. 상세 승인·보류는 published-ai-svg-review.json.
- 공식 사이트 응답 확인은 서비스 존재 확인이며 로고 최신성의 전수 보증은 아니다. 고정 upstream 버전과 확인 범위를 함께 기록한다.

## HTML 캐시 장애 재발 방지 (2026-09-08)

Cloudflare에서 HTML을 1시간 강제 캐시해 이전 배포의 제거된 JS chunk를 요청하며 검색이 작동하지 않았다. semologo.com/www.semologo.com의 `/_next/static/` 외 요청은 캐시 bypass로 바꾸고 해당 존 캐시를 초기화했다. 수정 후 HTTP 200, CF DYNAMIC, 검색 및 상세 정상 확인.
