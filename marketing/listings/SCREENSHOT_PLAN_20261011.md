# 스크린샷 제작 구성

2026-10-11. 실제 설치 앱 화면 촬영 후 아래 구성으로 조립합니다. 웹 캡처·디자인 시안으로 설치 화면을 대체하지 않습니다.

| 순서 / 입력 파일명 | 제목 | 촬영 화면 |
|---|---|---|
| 01-search.png | 필요한 로고를, 빠르게 | 검색 결과가 로딩 완료된 홈. 검색어와 카드가 모두 보이게 |
| 02-detail.png | 로고 하나부터 자세히 | 상세 바텀시트, 선명한 PNG, × 버튼과 기능 버튼 |
| 03-saved.png | 자주 쓰는 로고는 가까이 | 직접 저장한 로고 4개 이상. 사용자 개인 정보 없는 상태 |
| 04-share.png | PNG로 저장하고 공유해요 | PNG 저장·공유 직전 앱 상세 화면. OS 공유 UI는 실기기 검수 증빙에 별도 촬영 |

문구는 앱에서 실제 제공하는 기능만 사용합니다. 웹의 로고월·회원 계정 동기화·모든 브랜드 공식 제휴·전체 오프라인 사용은 홍보하지 않습니다.

## 준비 규격

- iPhone: 1290×2796. Apple 6.9-inch 그룹 허용 규격 중 하나. 슬롯 명칭은 실제 Console 확인.
- iPad: 2064×2752. iPad 지원 빌드이면 별도 실제 iPad 캡처가 필요.
- Android phone: 1080×1920, 4장 구성.
- Google Play 피처: 1024×500, RGB PNG.
- Google Play 아이콘: 512×512, RGBA PNG.

Apple: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
Google: https://support.google.com/googleplay/android-developer/answer/9866151?hl=en

## 제작

프로젝트 루트에서 `python3 marketing/listings/scripts/make-submission-art.py`를 실행하면 브랜드 그래픽과 아이콘을 만듭니다. Pillow가 설치된 기존 Python 환경을 사용합니다.

실제 캡처 4장을 동일한 파일명으로 별도 폴더에 두고 다음처럼 실행합니다:

```sh
python3 marketing/listings/scripts/make-submission-art.py --captures /절대경로/실제아이폰캡처 --device iphone
python3 marketing/listings/scripts/make-submission-art.py --captures /절대경로/실제아이패드캡처 --device ipad
python3 marketing/listings/scripts/make-submission-art.py --captures /절대경로/실제안드로이드캡처 --device android
```

원본 비율을 유지해 프레임 안에 넣으며 자르지 않습니다. 다른 기기 비율·작은 캡처·누락된 파일은 거절합니다. 촬영은 전역 로컬 캡처 절차를 따르고 에뮬레이터를 자동 기동하지 않습니다. 결과 폴더의 render-manifest JSON은 원본 SHA와 결과 크기를 기록하며 실제 설치 검증을 대신하지 않습니다.
