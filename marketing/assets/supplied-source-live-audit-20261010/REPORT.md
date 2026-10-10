# 제공 원본 → 추출 → 실제 서비스 대조

읽기 전용 확인. 소스/DB/프론트 수정 없음. 동일 시점에 root 수정이 병행되므로 아래는 감사 요청 후 origin을 조회한 상태이다.

## 실제 서빙

10개 사용자 원본 그룹의 12개 대표 콘텐츠(당진항·배민라이더스 별도 포함)는 모두 origin 상세페이지 HTTP 200이며 신규 reviewed 경로를 포함한다. reviewed manifest의 PNG 163개 + SVG 120개 = 283개 파일이 서버에서 CDN HEAD 200이었다. IS동서의 별도 PNG 2개까지 확인하면 총 285/285개 정상이다. 로컬 네트워크의 일괄 403은 CDN 자산 부재로 판정하지 않았고 실제 서버 네트워크에서 재검증했다.

|콘텐츠|변형|PNG|SVG|
|---|---:|---:|---:|
|평택시|8|8|8|
|연수구|15|15|15|
|한국전력|6|6|6|
|충청북도|37|37|27|
|청주복지재단|10|10|10|
|성주군|34|34|3|
|충청남도|27|27|27|
|논산딸기엑스포|13|13|13|
|당진시|4|4|4|
|당진항|2|2|2|
|배민|5|5|3|
|배민라이더스|2|2|2|

청주복지재단의 현재 origin API에는 `gongu-ci-1495`, `has_svg=true`, 대표 `sources/lockup-reviewed-20261010/696131becdce4029.png/.svg`, `variants_n=10`이 있다. 상세페이지도 같은 신규 경로를 포함한다. 추출 누락이 아닌 이전 콘텐츠/표시 우선순위 문제가 핵심이다.

## 원인과 제안

- JSON별 `patches`를 ID 단위로 얕게 덮어쓰면 청주의 마지막 `{variants_n:10}`이 앞선 대표 경로 등 18개 필드를 버린다. 한국전력도 앞선 `official_source_page` 1개 필드가 사라진다. `patch-precedence.json`에 구체적 필드 기록. ID별 필드 순서 병합이 적절하다. JSON에는 undefined가 없으므로 명시 null/false/빈배열은 그대로 보존해야 한다. 중첩 presentation/aliases/variant 배열은 기본적으로 후행 값 전체를 우선한다.
- `official-ci-next-02` 구형 청주 콘텐츠와 `gongu-ci-1495`는 root 확인에 따라 후자로 통합 제안. 기존 동일기관 통합 11쌍은 유지. `proposed-duplicates.json` 참고.
- KEPCO 명칭만 있는 `kepco`, `kepco-1/2/3`, `yeonsu-slogan`은 이미지 신원 확인 전 자동 통합하지 않는다. 교육청·공사·재단·KEPCO 계열사는 합치지 않는다.
- 원본 추출 산출물과 PNG/SVG 서빙은 확인했지만 원본 다운로드 노출은 별개다. 현재 API에서 원본 다운로드 필드가 없는 콘텐츠는 평택·연수·한국전력·충북·성주·배민·배민라이더스 7개다. 추출본 AI/PDF를 실제 내려받는 링크 추가 여부를 별도로 검토해야 한다. 청주는 공식 signature.zip 링크만 노출되어 symbol.zip 등 전체 원본 묶음과 동일하지 않다.

검증 원자료: `cms-readonly.json`, `origin-pages-and-catalog.jsonl`, `api-serving-summary.json`, `cdn-from-server.json`, `original-download-status.json`. 이 감사에서 CMS mutation이나 배포는 하지 않았다.

## 후속 보완 완료

사용자 Downloads 원본 21개를 8개 콘텐츠에 ZIP으로 게시했다(동일 배민 PDF를 두 콘텐츠에 각각 제공). 청주는 symbol.zip과 signature.zip 모두 포함한다. ZIP 내부 원본 SHA256과 CDN 응답 전체 SHA256을 8/8 확인했다. source_zip 경로는 `sources/supplied-originals-20261010/<hash>.zip`이며 공식 외부 signature.zip 주소도 보존했다. root가 로컬 source_zip을 우선 노출하도록 UI를 변경했다.

metadata UPDATE 트리거가 새 current 버전을 만드는 동작을 확인해 publisher가 UPDATE 전에 이전 current manifest를 읽고 새 current에 보존하도록 수정했다. 게시 전 8개 버전은 is_current 전환 외 그대로 보존되었고, 새 8개 current manifest는 기존 모든 필드·variants·파일과 원본 ZIP을 갖는다. 상세 증명은 `../supplied-originals-20261010/manifest-restoration-proof.json`, CDN 증명은 `cdn-and-versions-verified.json`에 있다. root에서 청주 중복 redirect와 ID별 패치 필드 병합도 처리했다.
