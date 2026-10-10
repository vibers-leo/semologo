# 베트남 은행·월렛 Community 초기 배치

2026-10-10 제공 SVG 파일 스냅샷입니다. 64개 은행·결제망 행과 20개 월렛·결제서비스 행을 읽었으며 82개 이름을 식별하고 2개 심볼만 있는 행은 보류했습니다. 이는 베트남 공식 현재 기관 전수 명부가 아닙니다. 해외 본점 은행, 결제망, 과거 브랜드가 섞여 있으므로 전체 VN origin을 지정하지 않았습니다.

이름 명확한 베트남 14개 은행 로고를 실제 벡터로 추출해 투명 PNG 긴 변 2000px로 만들고 검수했습니다. ACB·MB는 기존 무명 ID와의 중복 확인이 끝나지 않아 게시 배치에서 보류했습니다. 초기 release는 12개 브랜드 SVG 12개/PNG 12개입니다. 기존 5개 BIDV/MSB/TPBank/VIB/Vietcombank에는 변형만 추가하고 대표·기존 변형·공식 출처를 보존합니다. 신규 7개 ABBANK/Agribank/BAOVIET Bank/CAKE/Eximbank/HDBank/LPBank는 공식 웹페이지로 기관명 신원을 확인했으나 에셋 출처는 커뮤니티로 표시합니다. CAKE는 독립 은행 법인으로 주장하지 않고 by VPBank 서비스 브랜드로 취급합니다. 모든 로고의 최신 CI 시기는 확인되지 않았습니다.

release.json, uploads.json이 루트 통합용입니다. cms-before.json은 기존 현재 version 스냅샷, review-proof.json은 검수·기관 신원 출처, reviewed-contact.jpg는 14개 추출본(ACB/MB 2개 보류 포함), community-roster.json은 파일 수록 행 명부입니다. 홈페이지 VIB는 직접 조회 403이므로 기존 canonical CMS 신원을 보존했습니다. 신규 자료를 공식 배포 AI/ZIP으로 표시하지 않습니다. CMS/업로드 변경은 하지 않았습니다.
