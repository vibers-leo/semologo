# 윈 수집 결과 자동 검수·게시

운영 위치: 맥 LaunchAgent `com.vibers.semologo.fleet-auto-publish`, 5분 간격. 코드와 다운로드 원본, 커서, 배치 영수증은 1F HDD의 `semologo-migration/task-tmp/logo-wall-ux-worktree`에 있다. HDD가 마운트되지 않았으면 실행하지 않는다. 중복 실행은 파일 잠금으로 막는다.

`scripts/run-auto-fleet-pipeline.py`는 윈 수집기의 성공 작업을 `(created_at,id)` 순서로 읽고, 결과 아티팩트 해시를 확인한 뒤 공식 사이트에서 후보 파일을 다시 다운로드한다. 홈페이지와 같은 도메인의 HTTPS SVG 중 경로·파일명, SVG 안전성, 투명성, 크기, OCR과 도메인·이름 일치를 통과한 것만 자동 게시한다. 그 외 후보와 다운로드 실패는 배치 `receipt.json`의 `held`에 사유를 남긴다. 자동 검수는 로고 4종을 인증하지 않으며 구성은 `unknown`, 검수 상태는 `auto-screened`다.

기존 브랜드는 대표 이미지를 바꾸지 않고 immutable 원본 SVG·파생 PNG를 variant로 추가한다. 신규 브랜드는 SVG·PNG·메타데이터·구성 목록을 버킷에 올려 읽기 검증한 뒤 CMS에 등록한다. 밝은 글자만 있는 로고는 어두운 카드 배경으로 표시한다. 게시 예외가 하나라도 나면 커서를 전진시키지 않아 다음 주기에 재시도한다. 이미 게시된 해시는 다시 추가하지 않는다.

맥의 중앙 비밀 파일에서 게시용 NCP 키를 읽는다. 서버 키는 버킷 쓰기가 IP 제한으로 거부되므로 서버 예약 게시를 켜지 않는다. 버킷 키·DB 문자열을 코드나 영수증에 기록하지 않는다.

점검:
```sh
launchctl print gui/$(id -u)/com.vibers.semologo.fleet-auto-publish
tail -5 /tmp/semologo-fleet-auto-publish.log
/opt/homebrew/bin/python3 -m unittest discover -s tests -p test_fleet_auto_pipeline.py
```
