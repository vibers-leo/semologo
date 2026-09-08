# 2026-09-08 로고 수집 작업

- `fashion-reference-wanted.json`: 사용자 참고 이미지 4장에서 중복 제거한 패션 브랜드 50개.
- 원본 수집 후보 14개는 공유 저장소 `_clients/collect-wanted.json`에 추가했다(837 → 851).
- 기존 이름 매칭 36개는 동일 브랜드·형태 확인이 필요하다. 이름 매칭만으로 원본 확보 완료로 처리하지 않는다.
- 공유 상세 큐: `/Volumes/Untitled/brand-logos/_sources/collection-queues/fashion-reference-20260908.json`.
- 첨부 래스터 이미지는 식별 참고용이며 자르기·트레이싱·서비스 등록에 사용하지 않았다.

## 완료한 파일 수집 및 분리

산출물은 로컬 `artifacts/logo-collection-20260908/`에 보관한다. 공개 서비스 카탈로그에 아직 반영하지 않았다.

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
