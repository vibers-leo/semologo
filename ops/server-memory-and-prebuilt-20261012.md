# 운영 서버 메모리·이전 버전 정리·로컬 빌드 — 2026-10-12

사용자 승인: 빌더 자동 종료, 실제 압력 기반 배포 기준, 운영/빌드 분리 검토, 내부 연결 확인 후 미르이엔지·케이지니 이전 컨테이너 중지·삭제.

## 이전 버전 정리 완료

실제 운영 연결은 미르이엔지 `mireng-acceptance-20261008-r6`(4319), 케이지니 `kgini-web-20261005`(kgini.com)다. 별도 kgini.vibers.co.kr의 `kgini`는 유지.

다음 7컨테이너는 활성 NPM 설정·컨테이너 참조·호스트 설정·접속 상태·쓰기 변경분을 확인한 후 중지하고 삭제했다.

- mireng
- mireng-production-20261008-r5
- mireng-acceptance-20261008-r4
- mireng-acceptance-20261008-r3
- mireng-design-candidate
- kgini-web-20261004c
- kgini-web-20261004b

최신 케이지니의 KGINI_CONTAINER_NAME에는 이전 이름이 남았지만 실행 코드에서 참조하지 않으며 URL/DNS 연결이 아니다. 업로드 bind mount·DB·볼륨은 삭제하지 않았다. 쓰기 변경은 Next 캐시 및 업로드 mount뿐이었다.

중지 전후 mireng.co.kr, kgini.com 모두 HTTP200. 복구 설정은 서버 `/root/ops/container-retirement-20261012/`(0700), 각 inspect 파일은0600. 원래 이미지와 `vibers-retired/<컨테이너>:20261012` 태그 유지. 설정 스냅샷에는 환경변수가 포함돼 있으므로 공개·Git 커밋 금지.

주의: 미르이엔지의 기존 기본 compose는 삭제한 예전 컨테이너 이름 mireng를 가리킨다. 현재 운영은 r6/4319다. 향후 미르이엔지 배포 시 기존 기본 compose를 현재 운영 구성이라고 오인하지 말 것.

## 배포 기준 개선 및 서버 적용

기존 고정 기준: swap 사용량6GiB 이상이면 가용7GiB 필요. 실제 압력이 낮고 과거 swap이 남은 경우에도 장시간 막혔다.

새 기준은 아래를 모두 3회 연속 만족해야 한다.

- BuildKit memory=4GiB, memory+swap=4GiB 설정 확인. 추가 swap 사용 불허.
- 가용 RAM >= 빌더 상한4GiB + 운영 여유1GiB =5GiB.
- memory PSI some avg10 <1%, full avg10 <0.1%.
- 실제 swap 입출력 <=128pages/sec.

총 swap 사용량만으로 차단하지 않는다. 메모리 압력·실제 I/O·빌더 상한은 계속 검사한다. 최대120회 대기하며 app/global flock 직렬화 유지.

성공·실패·일반 종료 시 EXIT trap이 글로벌 lock을 보유한 채 `docker buildx stop vibers-guarded`를 실행한다. 중지된 VM이나 다른 서비스는 건드리지 않는다. 적용 전 스크립트는 `/root/ops/deploy-policy-20261012/`에 보관.

테스트: 리소스 경계값·압력·swap I/O·입력 검증 PASS, 실제 wrapper 격리 테스트에서 성공/실패 모두 빌더 종료 및 종료 코드 보존 PASS, bash syntax PASS. 기존 기준을 읽고 대기 중이던 spms3/faneasy 요청은 실행 중 빌드가 아님을 확인한 뒤 요청을 보존해 새 wrapper로 재대기시켰다.

## 별도 상시 빌드 서버 없이 로컬에서 빌드

맥 ARM/macOS에서 만든 실행 파일을 서버 Linux/x86에 그대로 복사하지 않는다. Linux Docker 환경에서 `linux/amd64` 컨테이너 이미지를 빌드하면 운영 서버에서 동일하게 실행 가능하다.

`scripts/build-semologo-linux-image.py --context <실행중인 로컬 Docker context>` 준비. 기능:

- 커밋된 HEAD만 git archive해 별도 HDD 임시 폴더에서 빌드, 작업 트리의 다른 변경 미포함.
- 기존 서버의 허용된 NEXT_PUBLIC 빌드 설정만 읽으며 DB 등 비공개 설정은 가져오지 않음.
- Docker 기본 context 변경 안 함. VM을 자동 시작하지 않음.
- linux/amd64 이미지 생성·플랫폼 확인, 커밋 라벨 포함.
- 1F HDD task-tmp/prebuilt-images에 tar와 SHA-256 영수증 저장.

이후 전달 흐름은 tar 체크섬 검증 → 운영 서버 docker load → 이미지 플랫폼/커밋 확인 → 기존 이미지 rollback 태그 보존 → compose 교체 → health 검증이다. 실행 전 app/global 배포 lock으로 서버 빌드와 중복 실행을 막아야 한다. 현재 업로드/교체 자동화는 아직 활성화하지 않았다.

현재 로컬 Docker VM은 정지 상태. 외장 SSD 여유 약2.5GiB, 내장 약9.4GiB, 1F HDD 약370GiB. 새 빌드 VM/캐시는 HDD에 구성하는 것이 적절하다. 이 회차에는 로컬 이미지 전체 빌드를 실행하지 않았으며 준비 스크립트 문법/CLI 검사만 완료했다.
