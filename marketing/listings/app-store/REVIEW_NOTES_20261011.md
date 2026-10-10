# 심사 메모 — 복사 입력용

2026-10-11 코드 기준 초안. 설치 검수 후 제출 빌드와 일치하는지 확인합니다.

## 한국어

세모로고는 브랜드 로고를 검색하고 기기에 저장하거나 다른 앱으로 공유하는 도구입니다. 기본 기능에는 회원가입이나 로그인이 필요하지 않으며 심사용 계정도 필요하지 않습니다.

확인 경로:
1. 앱을 실행하고 브랜드 검색창에서 “삼성”을 검색합니다.
2. 결과 카드를 눌러 상세 화면을 엽니다. × 버튼으로 닫을 수 있습니다.
3. “내 기기에 저장”을 누르고 상세 화면을 닫습니다. “내 기기에 저장한 로고” 탭에서 저장 결과를 확인합니다.
4. 상세 화면의 “PNG 저장·공유”를 누르면 PNG를 임시 캐시에 내려받은 뒤 OS 공유 화면이 열립니다. 사용 가능한 저장·공유 대상은 기기에 설치된 앱에 따라 달라집니다. 공유 흐름 종료 후 임시 파일을 삭제합니다.
5. “브랜드 링크 공유”는 해당 브랜드의 웹 페이지 링크를 OS 공유 화면으로 전달합니다.
6. “전체 로고 구성 보기”는 외부 브라우저 화면으로 연결됩니다. SVG·원본 파일 제공은 해당 웹 페이지에서 확인할 수 있습니다.

앱의 UI와 실행 코드는 앱 번들에 포함됩니다. 카탈로그와 로고 이미지를 HTTPS로 조회합니다. 저장 목록은 Capacitor Preferences를 통해 기기에 보관하고, PNG 파일 공유는 FileTransfer·Filesystem·Share 플러그인을 사용합니다. 외부 사이트 이동은 Browser 플러그인을 사용합니다. 네이티브 저장 목록은 웹 계정과 동기화되지 않습니다.

현재 네이티브 화면에는 로그인, 결제, 광고 SDK, 분석 SDK, 채팅 또는 사용자 게시물 작성 기능이 없습니다. 검색어와 접속 정보가 서버 접속 로그에 남을 수 있으므로 개인정보 답변에는 서버 처리를 함께 반영합니다.

로고의 상표권과 이용 조건은 각 권리자에게 있습니다. 본 앱이 각 브랜드의 공식 앱이거나 제휴 앱임을 주장하지 않습니다. 콘텐츠 사용 권한 관련 질문은 운영자의 확인 후 답변합니다.

## English

SemoLogo is a utility for finding brand logos, saving a local list, and sharing PNG files or brand-page links. No account or login is required for the native features; no review credentials are needed.

Review steps: Search for “삼성”, open a result, save it to the local list, and verify it in the saved tab. Use “PNG 저장·공유” to download a temporary PNG and open the operating system share sheet. Available save/share destinations depend on installed apps. The temporary file is deleted when this flow finishes. “브랜드 링크 공유” shares a brand-page URL. “전체 로고 구성 보기” opens the corresponding website in a browser for additional formats and source files.

The UI and application code are bundled locally. Catalog and image requests use HTTPS. Native features use Capacitor Preferences, FileTransfer, Filesystem, Share, and Browser. Saved items remain on the device and do not sync with website accounts. The native app currently has no login, payment, advertising SDK, analytics SDK, chat, or user-post creation feature. Backend access logs may retain search requests and connection metadata, as described in the privacy materials.

Brand trademarks and usage terms belong to their respective owners. The app does not claim to be an official or affiliated app of the displayed brands.

## 運用メモ / 내부 확인

- 제출 전 실제 설치·파일 공유 확인 결과를 별도 테스트 기록에 남깁니다.
- 심사 연락처는 소유자가 확정합니다. 본 문서에 개인 연락처·비밀번호를 보관하지 않습니다.
- 4.2 심사 통과를 보장하는 문구가 아닙니다. 네이티브 기능의 실제 동작을 근거로 설명합니다.
