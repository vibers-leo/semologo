# 📢 이 사이트에 게재 중인 광고 — semologo

> **이 파일은 자동 생성됩니다.** 원천: ai-recipe 광고 서버(Firestore)
> 갱신: ai-recipe에서 `node scripts/sync-ad-status.mjs` · 마지막 동기화: 2026-08-13

**지면**: semologo.com 홈 상단 (`app=semologo`)

| 광고주 캠페인 | 캠페인 ID | 랜딩 | 노출 | 클릭 | CTR |
|---|---|---|---|---|---|
| D.US 홈페이지 — semologo 게재 | `dus-launch` | https://d-us.co.kr | 123 | 16 | 13.01% |
| 모노페이지 — semologo 게재 | `monopage-launch` | https://monopage.kr | 45 | 1 | 2.22% |

---

## 이 지면은 어떻게 동작하나

이 프로젝트에는 **iframe 한 줄(`VibersAdSlot`)만** 있습니다. 어떤 광고가 나올지, 소재 교체,
노출·클릭 집계는 전부 광고 서버가 처리하므로 **캠페인이 바뀌어도 이 프로젝트 코드는 그대로**입니다.

- 광고를 추가·교체하려면 → ai-recipe에서 캠페인의 `targeting.apps`에 `semologo` 추가
- 광고가 없으면 슬롯은 조용히 빔 (frame이 204 반환)
- **성과 대시보드**: https://ai.vibers.co.kr/ads/stats
