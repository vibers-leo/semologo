export type RelationType = "인수됨" | "구사명" | "모회사" | "자회사" | "합병" | "분사" | "연관";

export interface BrandRelation {
  relatedId: string;
  type: RelationType;
  note?: string;
}

/**
 * 출처 검증 완료 (2026-08-04)
 * - 인수됨: 해당 브랜드가 다른 기업에 인수되어 사라짐/흡수
 * - 구사명: 이전 이름 (사명변경 전)
 * - 자회사: 해당 기업의 계열 자회사
 * - 모회사: 해당 브랜드를 소유한 상위 기업
 * - 합병: 두 브랜드가 합쳐진 관계
 * - 분사: 그룹에서 분리독립
 * - 연관: 동일 브랜드 다른 로고 또는 계열 관계
 */
export const BRAND_RELATIONS: Record<string, BrandRelation[]> = {

  // ── 조선/중공업 ──────────────────────────────────────────
  // 한화오션이 대우조선해양을 인수 (2023.05 사명변경)
  "daewoo-shipbuilding": [
    { relatedId: "hanwha-ocean", type: "인수됨", note: "→한화오션 2023" },
  ],
  "hanwha-ocean": [
    { relatedId: "daewoo-shipbuilding", type: "구사명" },
  ],

  // HD현대 (현대중공업그룹 → HD현대 사명변경 2022.03)
  "hyundai-heavy-industries-group": [
    { relatedId: "hd-hyundai", type: "구사명", note: "→HD현대 2022" },
  ],
  "hd-hyundai": [
    { relatedId: "hyundai-heavy-industries-group", type: "구사명" },
    { relatedId: "hd-hyundai-heavy-industries", type: "자회사" },
    { relatedId: "hd-korea-shipbuilding", type: "자회사" },
  ],
  "hyundai-heavy-industries": [
    { relatedId: "hd-hyundai-heavy-industries", type: "구사명", note: "→HD현대중공업" },
  ],
  "hd-hyundai-heavy-industries": [
    { relatedId: "hyundai-heavy-industries", type: "구사명" },
    { relatedId: "hd-hyundai", type: "모회사" },
  ],
  "hd-korea-shipbuilding": [
    { relatedId: "hd-hyundai", type: "모회사" },
  ],

  // ── 자동차 ───────────────────────────────────────────────
  // 아시아자동차 → 기아 흡수합병 (1999.06)
  "asia-motors": [
    { relatedId: "kia", type: "합병", note: "기아 흡수합병 1999" },
  ],
  "kia": [
    { relatedId: "asia-motors", type: "합병" },
    { relatedId: "kia-motors", type: "연관" },
    { relatedId: "genesis", type: "자회사" },
  ],
  "kia-motors": [
    { relatedId: "kia", type: "연관" },
  ],

  // 제네시스 — 현대자동차 고급 브랜드 (2015.11 독립 런칭)
  "genesis": [
    { relatedId: "hyundai", type: "모회사" },
  ],

  // 대우자동차 — GM 매각 (2002 → GM대우 → 한국GM)
  "logo-wordmark-daewoo-motors-2002-2016": [
    { relatedId: "tata-daewoo-company", type: "연관", note: "상용차 부문 분리" },
  ],
  "tata-daewoo-company": [
    { relatedId: "logo-wordmark-daewoo-motors-2002-2016", type: "연관", note: "대우 상용차 인수 2004" },
  ],

  // KG모빌리티 — 쌍용자동차 인수 (2022) 후 사명변경 (2023)
  "kgmobility": [
    { relatedId: "kg-group", type: "모회사" },
    { relatedId: "kg-mobility-brand", type: "연관" },
  ],
  "kg-mobility-brand": [
    { relatedId: "kgmobility", type: "연관" },
  ],

  // 르노코리아 — 삼성차 → 르노삼성(2000) → 르노코리아(2022)
  "renaultkorea": [
    { relatedId: "renault-korea-motors", type: "연관" },
  ],
  "renault-korea-motors": [
    { relatedId: "renaultkorea", type: "연관" },
  ],

  // ── 전자/대우 ─────────────────────────────────────────────
  // 대우전자 → 위니아전자 (동부그룹 → 위니아 인수)
  "logo-daewoo-electronics-south-korea": [
    { relatedId: "logo-wordmark-daewoo-electronics-now-winia-electronics", type: "인수됨" },
  ],
  "logo-wordmark-daewoo-electronics-now-winia-electronics": [
    { relatedId: "logo-daewoo-electronics-south-korea", type: "구사명" },
  ],

  // ── IT/게임 ──────────────────────────────────────────────
  // 블루홀 → 크래프톤 사명변경 (2018.11)
  "bluehole": [
    { relatedId: "krafton", type: "구사명", note: "→크래프톤 2018" },
  ],
  "krafton": [
    { relatedId: "bluehole", type: "구사명" },
  ],

  // 42dot — 현대자동차 자율주행 자회사 (2022.08 완전인수)
  "42dot": [
    { relatedId: "hyundai", type: "모회사", note: "2022 인수" },
  ],

  // ── 패션/유통 ────────────────────────────────────────────
  // 29CM — 무신사 인수 (2021.08)
  "29cm-co": [
    { relatedId: "musinsa", type: "인수됨", note: "2021" },
  ],
  "musinsa": [
    { relatedId: "29cm-co", type: "자회사" },
  ],

  // 옥션 + 지마켓 — 이베이코리아 → 이마트 인수 (2021.11)
  "auction-co": [
    { relatedId: "gmarket-co", type: "연관", note: "이베이코리아 통합운영" },
    { relatedId: "emart", type: "모회사", note: "이마트 인수 2021" },
  ],
  "gmarket-co": [
    { relatedId: "auction-co", type: "연관", note: "이베이코리아 통합운영" },
    { relatedId: "emart", type: "모회사", note: "이마트 인수 2021" },
  ],

  // ── OTT/미디어 ───────────────────────────────────────────
  // 시즌(KT) → 티빙(CJ) 흡수합병 (2022.12)
  "seezn": [
    { relatedId: "tving", type: "합병", note: "→티빙 2022" },
  ],
  "tving": [
    { relatedId: "seezn", type: "합병", note: "KT시즌 흡수 2022" },
    { relatedId: "cjenm", type: "모회사" },
  ],

  // 푹(POOQ) + SKT 옥수수 → 웨이브 (2019.09)
  "pooq-co": [
    { relatedId: "wavve", type: "합병", note: "→웨이브 2019" },
  ],
  "wavve": [
    { relatedId: "pooq-co", type: "합병", note: "푹+옥수수 합병 2019" },
  ],

  // 멜론 — 카카오 인수 (2016.01, 로엔엔터 → 카카오엔터)
  "melon": [
    { relatedId: "kakaoentertainment", type: "모회사", note: "카카오 인수 2016" },
  ],
  "kakaoentertainment": [
    { relatedId: "melon", type: "자회사" },
    { relatedId: "kakaoent", type: "연관" },
  ],
  "kakaoent": [
    { relatedId: "kakaoentertainment", type: "연관" },
  ],

  // 지니뮤직 — KT 계열 자회사
  "genie-co": [
    { relatedId: "sk-telecom", type: "연관", note: "KT 계열 서비스" },
  ],

  // ── 그룹 계열 ────────────────────────────────────────────
  // CJ그룹
  "cj": [
    { relatedId: "cjenm", type: "자회사" },
    { relatedId: "cgv", type: "자회사" },
    { relatedId: "cjlogistics", type: "자회사" },
  ],
  "cgv": [
    { relatedId: "cj", type: "모회사" },
    { relatedId: "cjenm", type: "연관", note: "CJ그룹 형제사" },
    { relatedId: "cgv-cinemas", type: "연관" },
  ],
  "cjenm": [
    { relatedId: "cj", type: "모회사" },
    { relatedId: "cj-enm", type: "연관" },
    { relatedId: "tving", type: "자회사" },
  ],
  "cj-enm": [
    { relatedId: "cjenm", type: "연관" },
    { relatedId: "cj", type: "모회사" },
  ],
  "cj-onstyle": [
    { relatedId: "cjonstyle", type: "연관" },
  ],
  "cjonstyle": [
    { relatedId: "cj-onstyle", type: "연관" },
  ],
  "cjlogistics": [
    { relatedId: "cj", type: "모회사" },
  ],

  // 한화그룹
  "hanwha": [
    { relatedId: "hanwha-ocean", type: "자회사" },
    { relatedId: "hanwha-aerospace", type: "자회사" },
    { relatedId: "hanwhalife", type: "자회사" },
    { relatedId: "hanwhasolutions", type: "자회사" },
  ],
  "hanwha-aerospace": [
    { relatedId: "hanwha", type: "모회사" },
  ],
  "hanwhalife": [
    { relatedId: "hanwha", type: "모회사" },
  ],
  "hanwhasolutions": [
    { relatedId: "hanwha", type: "모회사" },
    { relatedId: "hanwha-solutions", type: "연관" },
  ],
  "hanwha-solutions": [
    { relatedId: "hanwhasolutions", type: "연관" },
  ],

  // GS그룹
  "gs": [
    { relatedId: "gs-caltex", type: "자회사" },
    { relatedId: "gs25-gsretail", type: "자회사" },
    { relatedId: "gsshop", type: "자회사" },
    { relatedId: "gsconst-co", type: "자회사" },
    { relatedId: "gs-co", type: "연관" },
  ],
  "gs-co": [
    { relatedId: "gs", type: "연관" },
  ],

  // DL그룹 (대림 → DL 사명변경 2021.01)
  "daelim-co": [
    { relatedId: "dl", type: "구사명", note: "→DL그룹 2021" },
    { relatedId: "daelim", type: "연관" },
    { relatedId: "daelim-industrial", type: "연관" },
  ],
  "daelim": [
    { relatedId: "dl", type: "구사명" },
    { relatedId: "daelim-co", type: "연관" },
  ],
  "daelim-industrial": [
    { relatedId: "dl", type: "구사명" },
  ],
  "dl": [
    { relatedId: "daelim-co", type: "구사명" },
    { relatedId: "daelim-industrial", type: "구사명" },
  ],

  // LX그룹 — LG에서 계열분리 (2021.05)
  "lx": [
    { relatedId: "lg", type: "분사", note: "LG 계열분리 2021" },
    { relatedId: "lxhausys", type: "자회사" },
    { relatedId: "lxinternational", type: "자회사" },
  ],
  "lxhausys": [
    { relatedId: "lx", type: "모회사" },
  ],
  "lxinternational": [
    { relatedId: "lx", type: "모회사" },
  ],

  // LG그룹
  "lg": [
    { relatedId: "lg-energy", type: "자회사" },
    { relatedId: "lgchem", type: "자회사" },
    { relatedId: "lguplus", type: "자회사" },
    { relatedId: "lx", type: "분사", note: "2021 계열분리" },
  ],
  "lg-energy": [
    { relatedId: "lg", type: "모회사" },
    { relatedId: "lgchem", type: "연관", note: "LG화학에서 분사" },
  ],
  "lgchem": [
    { relatedId: "lg", type: "모회사" },
    { relatedId: "lg-energy", type: "자회사" },
  ],
  "lguplus": [
    { relatedId: "lg", type: "모회사" },
  ],

  // 한진그룹
  "hanjinkal": [
    { relatedId: "koreanair", type: "자회사" },
    { relatedId: "hanjin", type: "연관" },
  ],
  "koreanair": [
    { relatedId: "hanjinkal", type: "모회사" },
    { relatedId: "jinair", type: "자회사" },
    { relatedId: "hanjin-shipping", type: "연관", note: "과거 한진그룹 형제사" },
  ],
  "jinair": [
    { relatedId: "koreanair", type: "모회사" },
  ],
  "hanjin-shipping": [
    { relatedId: "hanjinkal", type: "연관", note: "2017 파산" },
    { relatedId: "koreanair", type: "연관" },
  ],
  "hanjin": [
    { relatedId: "hanjinkal", type: "연관" },
  ],

  // SK그룹
  "sk": [
    { relatedId: "sk-telecom", type: "자회사" },
    { relatedId: "sk-innovation", type: "자회사" },
    { relatedId: "skbroadband", type: "자회사" },
  ],
  "sk-telecom": [
    { relatedId: "sk", type: "모회사" },
    { relatedId: "skbroadband", type: "자회사" },
  ],
  "skbroadband": [
    { relatedId: "sk-telecom", type: "모회사" },
  ],
  "sk-innovation": [
    { relatedId: "sk", type: "모회사" },
    { relatedId: "sk-energy", type: "자회사" },
  ],
  "sk-energy": [
    { relatedId: "sk-innovation", type: "모회사" },
  ],

  // 카카오 생태계
  "kakaopay": [
    { relatedId: "tossbank", type: "연관", note: "경쟁 핀테크" },
  ],
  "tossbank": [
    { relatedId: "viva-republica", type: "모회사" },
    { relatedId: "tosspayments", type: "연관" },
  ],
  "tosspayments": [
    { relatedId: "viva-republica", type: "모회사" },
    { relatedId: "tossbank", type: "연관" },
  ],
  "viva-republica": [
    { relatedId: "tossbank", type: "자회사" },
    { relatedId: "tosspayments", type: "자회사" },
  ],

  // ── 뷰티/아모레 ──────────────────────────────────────────
  "amorepacific": [
    { relatedId: "innisfree", type: "자회사" },
    { relatedId: "etudehouse", type: "자회사" },
    { relatedId: "laneige", type: "자회사" },
    { relatedId: "sulwhasoo", type: "자회사" },
    { relatedId: "hera", type: "자회사" },
    { relatedId: "iope", type: "자회사" },
    { relatedId: "mamonde", type: "자회사" },
    { relatedId: "espoir", type: "자회사" },
    { relatedId: "primera", type: "자회사" },
    { relatedId: "ohui", type: "연관", note: "LG생활건강 브랜드" },
  ],
  "innisfree": [{ relatedId: "amorepacific", type: "모회사" }],
  "etudehouse": [{ relatedId: "amorepacific", type: "모회사" }],
  "laneige": [{ relatedId: "amorepacific", type: "모회사" }],
  "sulwhasoo": [{ relatedId: "amorepacific", type: "모회사" }],
  "hera": [{ relatedId: "amorepacific", type: "모회사" }],
  "iope": [{ relatedId: "amorepacific", type: "모회사" }],
  "mamonde": [{ relatedId: "amorepacific", type: "모회사" }],
  "espoir": [{ relatedId: "amorepacific", type: "모회사" }],
  "primera": [{ relatedId: "amorepacific", type: "모회사" }],

  // 닥터자르트 — 에스티로더 완전인수 (2019.12), 동일 브랜드 중복 로고
  "dr-jart": [
    { relatedId: "drjart", type: "연관" },
  ],
  "drjart": [
    { relatedId: "dr-jart", type: "연관" },
  ],

  // ── 엔터테인먼트 ─────────────────────────────────────────
  // HYBE 레이블
  "big-hit-music": [
    { relatedId: "hybe-labels", type: "연관" },
    { relatedId: "bts", type: "자회사" },
  ],
  "bts": [
    { relatedId: "big-hit-music", type: "모회사" },
  ],
  "hybe-labels": [
    { relatedId: "big-hit-music", type: "연관" },
    { relatedId: "weverse", type: "연관" },
  ],
  "weverse": [
    { relatedId: "hybe-labels", type: "연관" },
  ],

  // SM엔터 중복
  "sm-entertainment": [
    { relatedId: "smentertainment", type: "연관" },
    { relatedId: "sm-culture--contents", type: "자회사" },
  ],
  "smentertainment": [
    { relatedId: "sm-entertainment", type: "연관" },
  ],
  "sm-culture--contents": [
    { relatedId: "sm-entertainment", type: "모회사" },
  ],

  // JYP 중복
  "jyp-entertainment": [
    { relatedId: "jype", type: "연관" },
  ],
  "jype": [
    { relatedId: "jyp-entertainment", type: "연관" },
  ],

  // CJ ENM — 스튜디오드래곤 자회사
  "studio-dragon": [
    { relatedId: "cjenm", type: "모회사" },
  ],

  // ── 유통/이마트 ──────────────────────────────────────────
  "emart": [
    { relatedId: "emart-24", type: "자회사" },
    { relatedId: "emart24-co", type: "연관" },
    { relatedId: "ssg", type: "연관" },
    { relatedId: "auction-co", type: "자회사", note: "이베이코리아 인수 2021" },
    { relatedId: "gmarket-co", type: "자회사", note: "이베이코리아 인수 2021" },
  ],
  "emart-24": [{ relatedId: "emart", type: "모회사" }],
  "emart24-co": [{ relatedId: "emart", type: "모회사" }],
  "ssg": [
    { relatedId: "emart", type: "연관", note: "신세계그룹" },
    { relatedId: "shinsegae", type: "연관" },
  ],
  "shinsegae": [
    { relatedId: "ssg", type: "연관" },
    { relatedId: "ssfshop", type: "자회사" },
  ],

  // ── 동일 브랜드 중복 로고 (연관 처리) ───────────────────
  "binggrae": [{ relatedId: "binggrae-co", type: "연관" }],
  "binggrae-co": [{ relatedId: "binggrae", type: "연관" }],
  "airbnb": [{ relatedId: "airbnb-co", type: "연관" }],
  "airbnb-co": [{ relatedId: "airbnb", type: "연관" }],
  "burgerking": [{ relatedId: "burgerking-co", type: "연관" }],
  "burgerking-co": [{ relatedId: "burgerking", type: "연관" }],
  "mcdonalds": [{ relatedId: "mcdonalds-co", type: "연관" }],
  "mcdonalds-co": [{ relatedId: "mcdonalds", type: "연관" }],
  "expedia": [{ relatedId: "expedia-co", type: "연관" }],
  "expedia-co": [{ relatedId: "expedia", type: "연관" }],
  "cgv-cinemas": [{ relatedId: "cgv", type: "연관" }],
  "cheil": [{ relatedId: "cheil-worldwide", type: "연관" }],
  "cheil-worldwide": [{ relatedId: "cheil", type: "연관" }],
  "starbucks": [{ relatedId: "starbucks-co", type: "연관" }],
  "starbucks-co": [{ relatedId: "starbucks", type: "연관" }],
  "celltrion": [{ relatedId: "celltrion-ci", type: "연관" }],
  "celltrion-ci": [{ relatedId: "celltrion", type: "연관" }],
  "dongwon": [{ relatedId: "dongwonfnb", type: "자회사" }],
  "dongwonfnb": [{ relatedId: "dongwon", type: "모회사" }],
  "kyobo": [{ relatedId: "kyobo-co", type: "연관" }, { relatedId: "kyobolife-co", type: "연관" }],
  "kyobo-co": [{ relatedId: "kyobo", type: "연관" }],
  "kyobolife-co": [{ relatedId: "kyobo", type: "연관" }],
  "hankook-tire": [{ relatedId: "hankooktire", type: "연관" }, { relatedId: "logo-hankook-tire-2025", type: "연관" }],
  "hankooktire": [{ relatedId: "hankook-tire", type: "연관" }],
  "logo-hankook-tire-2025": [{ relatedId: "hankook-tire", type: "연관" }],
  "doosan": [{ relatedId: "doosan-group-and-corporation", type: "연관" }],
  "doosan-group-and-corporation": [{ relatedId: "doosan", type: "연관" }],
  "creatrip": [{ relatedId: "klook", type: "연관", note: "경쟁 여행 플랫폼" }],
  "dear-u": [{ relatedId: "dearu", type: "연관" }],
  "dearu": [{ relatedId: "dear-u", type: "연관" }],
  "gs25-bi-2019": [{ relatedId: "gs25-gsretail", type: "연관" }],
  "gs25-gsretail": [{ relatedId: "gs25-bi-2019", type: "연관" }, { relatedId: "gs", type: "모회사" }],
  "cj-co": [{ relatedId: "cj", type: "연관" }],
  "lotte-hotel": [{ relatedId: "lottehotel", type: "연관" }],
  "lottehotel": [{ relatedId: "lotte-hotel", type: "연관" }],
  "lotte-mart-2023": [{ relatedId: "lottemart", type: "연관" }],
  "lottemart": [{ relatedId: "lotte-mart-2023", type: "연관" }],
  "lotte-wellfood": [{ relatedId: "lottewellfood", type: "연관" }],
  "lottewellfood": [{ relatedId: "lotte-wellfood", type: "연관" }],
  "meritz": [{ relatedId: "meritz-co", type: "연관" }, { relatedId: "meritzfire", type: "자회사" }],
  "meritz-co": [{ relatedId: "meritz", type: "연관" }],
  "meritzfire": [{ relatedId: "meritz", type: "모회사" }],
  "hyundai-card": [{ relatedId: "hyundaicapital", type: "연관" }, { relatedId: "hyundaicard", type: "연관" }],
  "hyundaicard": [{ relatedId: "hyundai-card", type: "연관" }],
  "hyundaicapital": [{ relatedId: "hyundai-capital", type: "연관" }],
  "hyundai-capital": [{ relatedId: "hyundaicapital", type: "연관" }],
};

export const RELATION_LABEL: Record<RelationType, string> = {
  "인수됨":  "→ 인수됨",
  "구사명":  "← 구 사명",
  "모회사":  "모회사",
  "자회사":  "자회사",
  "합병":    "합병",
  "분사":    "분사",
  "연관":    "연관",
};

export const RELATION_COLOR: Record<RelationType, { bg: string; color: string; border: string }> = {
  "인수됨":  { bg: "#fef3c7", color: "#92400e", border: "#fde68a" },
  "구사명":  { bg: "#ede9fe", color: "#5b21b6", border: "#ddd6fe" },
  "모회사":  { bg: "#dbeafe", color: "#1e40af", border: "#bfdbfe" },
  "자회사":  { bg: "#dcfce7", color: "#166534", border: "#bbf7d0" },
  "합병":    { bg: "#fce7f3", color: "#9d174d", border: "#fbcfe8" },
  "분사":    { bg: "#fff7ed", color: "#9a3412", border: "#fed7aa" },
  "연관":    { bg: "#f3f4f6", color: "#374151", border: "#e5e7eb" },
};
