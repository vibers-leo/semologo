# SemoLogo CMS 수집 정책

새로 수집하는 로고는 정적 카탈로그 코드에 직접 추가하지 않고 `logo_posts` 초안으로 접수한다.

1. 공식 원본 URL·라이선스·브랜드명을 확인한다.
2. SVG/PNG를 Object Storage 또는 `public/submissions`에 보존한다.
3. `LogoPost` 레코드를 `status: draft`로 생성한다.
4. `/admin/posts`에서 크롭·배경·출처·연관 로고를 검수한다.
5. 검수가 끝난 항목만 `status: published`로 바꾼다.
6. 프론트는 published 게시물만 기존 카탈로그에 병합한다.

기존 `brands-slim.json` 18만 개는 PostgreSQL 전용 저장소가 준비될 때까지 읽기 전용 원본으로 유지한다. 신규 수집분을 이 JSON에 직접 병합하지 않는다.
