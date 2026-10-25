# 로고 이야기 CMS · Codex 인계

관리 화면: `/admin/stories/`. 기존 Google 관리자 인증을 사용한다. API·DB가 원본이며 재배포 없이 글이 반영된다. 공개 글만 `/blog/`, 상세 페이지, 사이트맵에 노출된다. 초안·보관 상태는 공개되지 않는다. 기존 5편을 이관하고 원본 코드 데이터는 비상시가 아닌 DB 미설정 개발 환경의 fallback으로 보존한다. 운영 DB 오류를 빈 글 목록으로 숨기지 않는다.

## 다른 Codex 세션의 글 작성

프로젝트 루트에서 실행한다. SSH alias `vibers`의 기존 권한으로 운영 컨테이너에 접속한다. 비밀 키를 JSON·글·로그에 넣지 않는다.

```sh
node scripts/story-cms.mjs list
node scripts/story-cms.mjs get nike-swoosh-story > story.json
node scripts/story-cms.mjs put story.json
node scripts/story-cms.mjs history nike-swoosh-story
```

신규 글은 `revision: 0`, 수정은 `get`에서 받은 revision을 그대로 보낸다. 동시 수정이 있으면 저장을 거절한다. revision은 본문 전체를 저장하는 수정 이력이다. 복원은 과거 payload에 현재 revision을 붙여 다시 저장한다. 삭제 대신 archived로 보관한다. 한글 제목은 자유롭게 쓰되 slug는 영문·숫자·하이픈을 사용하며 공개 후 바꾸지 않는다. collection-status는 예약 주소다.

필수 JSON 필드:

```json
{
  "slug": "semowiki-episode-07",
  "title": "영상 제목",
  "description": "글 소개",
  "date": "2026-10-25",
  "category": "세모위키",
  "tags": ["로고 이야기"],
  "author": "세모로고 편집팀",
  "readingMinutes": 2,
  "status": "draft",
  "revision": 0,
  "sections": [{"heading": "소제목", "paragraphs": ["본문 첫 문단", "다음 문단"]}]
}
```

선택 필드: `sources:[{label,url}]`, `videoScript:string[]`, `coverImage:https주소`, `video:{url,poster?,playbackUrl?,featured:boolean}`. 영상은 YouTube watch/Shorts/youtu.be 또는 HTTPS MP4를 지원한다. 인스타·쓰레드 게시물은 sources로 연결할 수 있다. 원본 영상·게시 영수증은 기존 제작 폴더에 두고 CMS에는 공개 URL과 글만 넣는다. 기존 제작 자료는 `/Users/juuuno/Downloads/edit/semologo-day*/`, 6편은 `semologo-day06/v6/publication-receipt.json`에 게시 주소가 있다. 7편까지의 글 작성·공개는 담당 세션에서 실제 게시 영수증과 내용을 대조해서 진행한다.

신규 글은 초안으로 시작한다. `status:published`로 저장하면 공개된다. `video.featured:true`는 홈 왼쪽 영역 노출을 뜻한다. 최대 최신 7편. 화면 너비1024px 이상에서 기존 catalog-promo-rail(왼쪽12% 여백)에 9:16 세로 썸네일을 표시한다. 추가 여백을 만들거나 검색 카드를 이동시키지 않는다. 2026-10-25 사용자 변경: 왼쪽 영역은 썸네일 클릭 단계 없이 플레이어를 즉시 표시하며 무음 자동재생한다. 사각 프레임 아래 ↓ 다음 / ↑ 이전 버튼으로 순환한다. 상세 글의 영상은 기존처럼 클릭 후 열린다. 닫으면 이번 방문 동안 숨긴다. 게시되지 않은 글의 영상은 노출되지 않는다.

## API / 로컬

- 관리자 `GET /api/admin/stories/`, `?slug=...` 단건 조회.
- 관리자 `PUT /api/admin/stories/`: 위 JSON, `Authorization: Bearer <현재 관리자 Firebase ID token>`.
- 공개 `GET /api/stories/`: 홈 노출할 공개 영상 글의 최소 필드만 반환.
- 로컬DB는 `DB_VIBERS_MAIN_URL`을 로컬 환경에 넣고 `node scripts/story-cms.mjs --local init|list|get|put|history`.
- 최초 이관: `node scripts/story-cms.mjs init`. 멱등 실행이며 기존 CMS 수정은 덮어쓰지 않는다.
- HTML·임의 iframe 삽입은 허용하지 않는다. React 텍스트 렌더와 허용된 영상 주소만 사용한다.

관리화면 본문은 `## 소제목`과 빈 줄로 구분한 문단으로 작성한다. JSON 도구는 구조화된 sections를 직접 사용한다. 로고 수집·대표 이미지 CMS와 별도 테이블이므로 서로 수정하지 않는다.

모듈 후보: 프로젝트 고유 글·영상 CMS. 기존 인증은 재사용했고 다중 법인 JWT 모듈을 새로 도입하지 않았다.

왼쪽 플레이어 최소 UI: `video.playbackUrl`에 공개 MP4 원본을 연결하면 제목·공유·추천 없이 재생/일시정지·시간 조절·음소거/음량만 표시한다. 기존 소셜 게시 원본을 재사용하며 YouTube 원본 주소는 video.url에 유지한다. 접기 « / 펼치기 » 탭으로 언제든 복구하며 접힌 동안 플레이어를 제거해 소리·다운로드를 중단한다. 구형 X 숨김 상태는 복구하고 새 접힘 상태만 sessionStorage에 저장한다. 양쪽 rail은 배너 아래16px 간격, sticky top128px.

2026-10-25 최종 변경: 유튜브 채널 시청을 우선해 왼쪽 영역은 video.url의 YouTube 임베드를 사용한다. MP4 playbackUrl은 보존하지만 이 영역에서는 사용하지 않는다. autoplay=0, controls=1로 기본 재생 버튼을 직접 누르게 한다. 조회수 합산은 보장하지 않으며 YouTube 공식 기준을 따른다(https://developers.google.com/youtube/iframe_api_reference#Playback_controls). UI를 가리는 자체 조작부는 사용하지 않는다. 접기 탭은 플레이어 밖에 둔다. YouTube 최소200×200 viewport를 충족하도록 테두리를 제외한 플레이어 폭200px 이상, 화면1366px 이상에서 노출한다. 이전 MP4/무음자동재생 안내보다 이 변경이 우선한다.

2026-10-26 노출 정책: 로고월(/logo-walls 및 하위·영문 경로)은 탭까지 완전 제외. 홈은 기본 접힘, 나머지 일반 페이지는 기본 펼침. 관리자·인증 화면 제외. SiteLayout의 PageStoryRail 한 곳에서 관리한다. 구형 접힘 설정은 적용하지 않으며 v2의 홈/일반 콘텐츠 설정을 분리해 명시적으로 선택한 상태만 방문 중 유지한다. 접힘 중에는 YouTube iframe을 생성하지 않는다.

일반 본문 페이지에는 영상이 글을 가리지 않도록 충분한 여백이 있는1600px 이상에서 노출한다. 홈의 펼치기 탭은 기존 카탈로그 여백에 맞춰1366px 이상에서 지원한다. 모바일·좁은 화면에서는 플레이어를 생성하지 않는다.
