# 광고·제휴 문의

공개 접수 `/advertise/`, 관리자 `/admin/inquiries/`. 메일 프로그램을 열지 않고 이름·회사(선택)·이메일·유형·본문·개인정보 동의를 받는다. DB 저장이 먼저이며 SMTP 실패가 접수를 취소하지 않는다. UUID로 재시도를 중복 접수하지 않는다. 1시간 IP 해시별5건 제한과 honeypot을 사용하고 원문 IP는 저장하지 않는다.

관리자는 Google ID token으로 보호된 API에서 문의와 유입 경로를 조회하고 검토중·답변완료·종료 및 내부 메모를 저장한다. 메일 실패는 수신처별로 기록하며 성공한 수신처는 재전송하지 않는다. 관리자 재시도와 별도5분 worker가 실패 건을 재처리한다. 7일이 지난 실패 건은 관리자에서 확인한다. SMTP 접수와 받은편지함 도착은 구분한다.

발신: `SEMOLOGO_INQUIRY_FROM`. 수신: 쉼표로 구분한 `SEMOLOGO_INQUIRY_TO`(운영은 vibers@vibers.co.kr 및 기존 Postal Gmail vibers.leo@gmail.com). SMTP `POSTAL_SMTP_HOST/PORT/USER/PASSWORD`는 `.secrets/보안.env` 원본을 운영 .env에 안전하게 전달한다. 키를 문서·로그·커밋에 넣지 않는다. STARTTLS와 인증서 검증은 필수다. Reply-To는 문의자 주소이며 임의 수신처에 알림을 발송하지 않는다.

`semologo@semologo.com`은 기존 Postal verified domain의 수신 route를 Endpoint로 수정하고 Gmail 기본+vibers 추가 전달을 연결한다. `.co.kr`은 2026-10-25 DNS NXDOMAIN이므로 기존 실제 도메인 `.com`을 사용했다. 기존 route 설정 백업은 NCP `/root/ops/semologo-cms-20261025/postal-route-before.json`에 있다.

발송 실테스트는 하지 않는다. 검증은 pure validation, fake SMTP transport(양쪽 전달·일부실패 후 재시도), DB 트랜잭션 rollback, 인증 없는 관리자403, probe가 저장·발송을 하지 않는 코드 점검으로 한다. 실 문의가 들어오면 상태와 Postal 기록으로 실제 도착을 점검한다.

worker: `node scripts/inquiry-mail-worker.mjs`(Mac→SSH), 서버에서는 `node scripts/inquiry-mail-worker.mjs --emit | docker exec -i semologo node`. 동일한 `deliverInquiry` 함수를 재사용한다. stale sending은5분 후 복구하며 retry worker는10분 간격, 최대5건씩 처리한다. timer 주기는5분이다. 만료된 문의는 worker에서 삭제하고 접수일부터1년 보관한다.

최초 유입의 UTM·referrer·landing_path·page_url은 브라우저에서 보존해 DB에 저장하고 어드민에서 조회·검색한다. URL의 일반 query는 서버에서 제거한다. GA4 generate_lead에는 접수 ID와 문의유형만 보내고 이름·메일·본문은 보내지 않는다.
