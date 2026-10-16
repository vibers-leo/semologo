# 최근 이슈 → 로고 후보 정기 발굴

`scripts/collect-trending-logo-leads.py`는 매일 뉴스 RSS 6개 질의를 확인해 로고·CI·마스코트 관련 기사와 사전 관심 주제를 수집한다. 결과는 `queue.json`·`status.json`·`seen.json`에 기록한다. 같은 보도를 반복 수집해도 새 후보로 다시 세지 않고, 일반 보도는 제목의 기업명 추정 접두어로 묶는다. 접두어는 동일성 검증 결과가 아니다.

2026-10-16 첫 실행: 기사 98개, 검토 후보 6개. 부산국제영화제 2026, 부캉이, 시큐아이 새 CI, 호반건설 BI, CJ더마켓 마스코트, 애드페스트 로고. RSS 헤드라인은 발견 단서다. 실제 공식 발표·원본 파일·연도·브랜드 동일성·기존 카탈로그 중복을 다시 확인해야 한다.

첫 후보의 원본 확인: [BIFF 공식 프레스 자료실](https://press.biff.kr/kor/addon/10000001/page.asp?page_num=5739)은 스탠다드 로고와 날짜형 로고를 각각 ZIP으로 제공한다. 2026-10-16에 두 ZIP을 내려받아 원본 해시와 목록을 기록했다. 스탠다드에는 PNG 2개, 날짜형에는 PNG 3개가 있으며 **SVG는 없다**. 원본은 Git 제외 경로 `marketing/assets/trend-watch-local/biff-2026/`에 보관했다. 따라서 상시 BIFF 대표를 바꾸거나 SVG 확보로 집계하지 않는다. 날짜형 PNG는 연도별 아카이브 후보로 검수할 수 있다.

운영 예약은 NCP `vibers`의 `semologo-trend-watch.timer`이며 **매일 09:15 KST** 실행한다. 코드와 관심 주제 원본은 이 저장소에 있고 서버 `/root/projects/semologo/trend-watch/`에 배포한다. 다음 명령으로 결과의 신선도를 확인한다.

```sh
ssh vibers 'systemctl status semologo-trend-watch.timer --no-pager'
ssh vibers 'python3 /root/projects/semologo/trend-watch/collect-trending-logo-leads.py --output-dir /root/projects/semologo/trend-watch/data --status'
```

후보 처리 단계:

1. 뉴스에서 이슈 발견. 근거 기사 제목·발행일·매체·링크 저장.
2. 주최자·브랜드의 공식 발표와 배포 원본 확인. 기사 이미지·썸네일을 로고 원본으로 사용하지 않는다.
3. 계절 행사형은 기존 상시 브랜드의 **연도별 아카이브 변형**으로 수집한다. 상시 대표를 자동 교체하지 않는다.
4. 공식 로고가 없는 인물·동물·밈은 `editorial_concept`로 분류한다. 별도 오리지널 창작물을 제작한다면 공식 표기·공식 다운로드로 혼동시키지 않고 제작 주체와 날짜를 표시한다.
5. 검수 통과한 공식 SVG/PNG만 기존 Windows/NCP 수집·CMS 게시 경로로 넘긴다. 뉴스 발견만으로 공개 건수나 4종 완성률을 올리지 않는다.

이 예약은 **이슈 발견과 검토 대기열 생성**까지 자동화한다. 공식 로고 자동 게시나 생성형 로고 자동 제작은 수행하지 않는다. 이 구분이 있어야 속보를 따라가면서도 로고의 출처와 신뢰도를 유지할 수 있다.
