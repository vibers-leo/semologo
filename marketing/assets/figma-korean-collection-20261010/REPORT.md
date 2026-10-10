# Figma Community 국내 로고 모음 초기 검수 배치

2026-10-10 사용자 제공 ZIP을 안전하게 풀고 확인했습니다. ZIP 51개 파일을 51개 브랜드로 계산하지 않았습니다. 대형 SVG는 이름 없는 평탄화 구조이고 76개 내장 래스터가 섞여 있으므로 이름과 영역이 명확한 브랜드만 골랐습니다.

15개 기존 콘텐츠에 추가할 SVG 15개와 투명 PNG 15개를 준비했습니다. PNG는 긴 변 2000px이며 모든 SVG는 실제 사용 dependency까지 조사해 image 요소가 없는 벡터입니다. JobKorea는 래스터여서 제외했습니다. 쿠팡 하단 g 잘림과 현대 잡선은 재추출 후 확인했습니다. 배스킨라빈스는 구형 로고로 표시합니다. 다른 로고도 최신 CI 시기는 검증되지 않았습니다.

선정: 쿠팡, 쿠팡이츠, 롯데, 사람인, KBS, SBS, MBC, tvN, JTBC, 기아, 현대자동차, 제네시스, 배스킨라빈스, 현대카드, IBK기업은행.

공식 배포 자료로 표시하지 않습니다. 원래 커뮤니티 URL은 제공되지 않았고 사용자 ZIP 경로와 SHA-256을 provenance.json에 기록했습니다. 기존 CMS 대표·원본 링크·공식 출처를 변경하지 않으며 기존 current version variants와 primary를 보존한 추가 manifest입니다. release.patches는 variants_n만 포함합니다. uploads.json은 immutable SVG/PNG 30개입니다. CMS 원본은 cms-before.json, 시각 검수는 reviewed-contact.jpg와 review-proof.json입니다.

이 배치는 전체 모음집 전수 검수 완료가 아닙니다. CMS/업로드/배포는 루트 에이전트가 통합합니다.
