# 세모로고 네이티브 개발 프로젝트

독립 Capacitor 8 workspace. 루트 Next.js 의존성·빌드를 변경하지 않습니다. 출시 ID `com.vibers.semologo`, 앱 이름 `세모로고`, Apple Team `84SS43LYKR`는 실제 개발자 계정 확인 후 적용했습니다. 서명 빌드·업로드·심사 제출은 아직 완료하지 않았습니다.

## 구현 범위

- 앱에 번들되는 검색 UI와 기존 공개 `/api/catalog` 연결, 상세 바텀시트와 닫기 버튼.
- 기기 Preferences에 브랜드 목록 저장/제거. 서버 계정 즐겨찾기와는 별도입니다.
- PNG 원본을 File Transfer로 캐시에 받은 뒤 OS 공유 화면으로 Files/다른 앱에 저장·공유. 공유 종료 후 임시 파일 삭제.
- Native HTTP로 자사 이미지 헤더를 명시하고 PNG만 data URL로 표시. 이미지 요청 동시 4개, 캐시 64개, 최대 base64 12MB, 실패 시 깨진 이미지 아이콘 숨김.
- 전체 로고 구성은 시스템 브라우저 화면에서 열기. 로그인은 웹에서만 처리하며 네이티브 로그인 완료를 주장하지 않습니다.
- `appUrlOpen`의 브랜드 HTTPS URL만 처리하는 수신 로직. 실제 Universal Links/App Links 도메인 연결은 출시 ID·Team ID·서명 인증서 확정 후 설정해야 합니다.

## 실행

`npm ci`, `npm run check`, `npm run build`, `npx cap add ios`, `npx cap add android`, `python3 scripts/privacy-manifest.py`, `npm run sync` 순서로 실행합니다. Xcode는 `npm run ios`, Android Studio는 `npm run android`로 엽니다. iOS 생성은 Swift Package Manager 기본값을 사용합니다. 의존성 캐시는 HDD의 작업별 npm cache를 사용합니다.

`server.url`, `allowNavigation`, cleartext, mixed content는 사용하지 않습니다. Capacitor 공식 문서는 원격 URL 설정을 live reload용이며 production용이 아니라고 설명합니다. 로컬 번들 UI를 사용해 앱 기능을 구현합니다.

## 아직 필요한 작업

- 실제 소유 번들 ID와 App Store/Play 앱 레코드 확인, Firebase 네이티브 앱 등록 및 OAuth 콜백 계약.
- 네이티브 OAuth는 시스템 브라우저 + PKCE/state + 서버의 일회성 토큰 교환 방식으로 별도 구현해야 합니다. 웹 Firebase 토큰을 URL에 실어 전달하거나 WebView 쿠키를 로그인으로 간주하지 않습니다.
- 계정 기능을 앱에 추가할 경우 계정 삭제, iOS 로그인 대안, 실제 앱에 공개 제보가 포함되면 신고·차단 흐름 구현.
- 실기기 다운로드·공유·로그인·접근성·오프라인 검증, 앱 아이콘/스플래시, 스크린샷, 개인정보/연령등급 답변.
- iOS privacy manifest의 FileTimestamp C617.1/UserDefaults CA92.1을 실제 사용하는 플러그인 기준으로 앱 타깃에 포함.
- 서명 빌드와 TestFlight/Play 내부 테스트. 이 프로젝트 생성은 심사 제출 완료가 아닙니다.

## 공식 참고

- https://capacitorjs.com/docs/config
- https://capacitorjs.com/docs/getting-started/environment-setup
- https://capacitorjs.com/docs/apis/http
- https://capacitorjs.com/docs/apis/file-transfer
- https://capacitorjs.com/docs/apis/filesystem
- https://capacitorjs.com/docs/apis/preferences
- https://capacitorjs.com/docs/apis/share
- https://capacitorjs.com/docs/guides/deep-links

2026-10-10 공식 v8 문서를 확인했습니다. Node 22+/Xcode 26+/Android Studio 2025.2.1+ 요구사항과 실제 로컬 도구 버전을 비교해야 합니다.

## 2026-10-11 실행 기록

- iOS·Android 플랫폼 생성 완료. 실제 계정 확인 후 양 플랫폼 출시 ID·이름 및 iOS Team 적용.
- Node 22.23.1, Xcode 26.6, Android Studio 내장 JDK 확인.
- 안전성 테스트 2개 및 JS 문법 검사 통과.
- HDD에서 Vite 의존성 로딩이 지연되어 Bun으로 22모듈을 번들. JS 34.22KB, CSS 2.90KB 생성. 재현 명령: `node scripts/build-bun.mjs` (Bun 설치 필요).
- 1024px 기존 브랜드 원본으로 iOS·Android 아이콘 리소스 교체.
- iOS privacy manifest 앱 Resources 포함 및 plist 검사 통과.
- 플랫폼 동기화 완료. iOS 에셋 서비스와 Android AAPT2 실패로 양쪽 debug 빌드가 중단됐으며, 실행 가능한 IPA/APK와 실기기 동작은 아직 검증하지 않았습니다.
- App Store Connect 앱 레코드와 1.0 메타데이터 저장 완료. Play Console은 개발자 본인·기기·전화 확인이 필요합니다. 빌드 업로드와 심사 제출은 미완료입니다.

### 빌드 후속 진단

- Android: Gradle 8.14.3은 Java 25 실행을 지원하지 않아 설치된 JDK 21로 변경. Build-Tools 35와 SDK Platform 36 HDD 설치 완료. 97개 작업 실행 후 AAPT2 daemon startup 실패로 전체 빌드는 실패했습니다. AAPT2 직접 version 실행도 macOS dyld 시작에서 응답이 없어 별도 진단을 남겼습니다. APK는 생성되지 않았습니다.
- iOS: unsigned ARM64 컴파일·링크 실행 파일은 생성됐으나 actool/ibtool이 root 소유 SimDiskImageManager XPC 응답 대기로 전체 번들을 완성하지 못했습니다. 공유 시스템 서비스를 종료하지 않았습니다.
- 주간 청소의 오래된 simctl만 정상 종료했으며, 후속 삭제 재개 방지를 위해 해당 청소 부모 프로세스를 일시 정지했습니다. 시스템 서비스 복구는 소유자 확인이 필요합니다.
- 진단 원본은 `/Volumes/HDD-1TB/semologo-migration/task-tmp/native-build-resume-status-20261011.json`에 기록했습니다.
