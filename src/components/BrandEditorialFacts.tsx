import type { Brand } from "@/lib/brands";

type Editorial = {
  checked: string;
  sourceLabel: string;
  sourceUrl: string;
  guideUrl?: string;
  guideLabel?: string;
  guideline?: string;
  files: string[];
  forms: string[];
  note: string;
};

// Curated, file-specific facts only. Unknown versions and permissions are stated as unknown.
const EDITORIAL: Record<string, Editorial> = {
  bucketplace: {
    checked: "2026-10-19",
    sourceLabel: "오늘의집 운영사 공식 사이트",
    sourceUrl: "https://www.bucketplace.com/index.html",
    guideline: "별도 CI 사용 매뉴얼은 이번 확인에서 찾지 못했습니다.",
    files: ["SVG 원본 · 2,260 bytes", "PNG · 1,600 × 452 px · 투명 배경"],
    forms: ["가로 조합형 확인", "세로 조합형·단독 워드마크는 현재 표본에 없음"],
    note: "공식 홈페이지에서 확인한 가로형과 기존 수집 심볼을 함께 제공합니다. 심볼의 도입 시기와 과거 버전 여부, 상업적 사용 허용 범위는 확인되지 않았습니다.",
  },
  "ediya-coffee": {
    checked: "2026-10-19",
    sourceLabel: "이디야 2025 CI 자료",
    sourceUrl: "https://www.ediya.com/images/main/kor_brochure_2025.pdf",
    guideUrl: "https://ediyastore.com/sub/brand01.html",
    guideLabel: "이디야 공식 CI 안내",
    guideline: "이디야 공식 CI 안내는 매뉴얼 준수, 지정 색상 사용, 무단 변형 금지를 명시합니다.",
    files: ["기본 워드마크: SVG·PNG", "공식 2025 CI: PNG · 가로형 2,400 × 306 px, 심볼 PNG · 해당 CI의 SVG는 없음"],
    forms: ["워드마크·심볼·가로 조합형 파일 제공", "기본 워드마크와 2025 CI 자료의 버전 관계는 확인 중"],
    note: "2025 CI 파일은 공식 회사소개서에서 확인했습니다. 버전 관계와 별도 사용 허가 범위는 확인되지 않았습니다.",
  },
};

export default function BrandEditorialFacts({ brand }: { brand: Brand }) {
  const editorial = EDITORIAL[brand.id];
  if (!editorial) return null;

  return (
    <section aria-labelledby="brand-asset-facts" className="brand-asset-facts">
      <div className="brand-asset-facts__inner">
        <p className="brand-asset-facts__eyebrow">파일·출처 확인</p>
        <h2 id="brand-asset-facts">{brand.name_ko} 로고 파일 안내</h2>
        <p className="brand-asset-facts__meta">확인일 {editorial.checked} · {editorial.sourceLabel}</p>
        <div className="brand-asset-facts__grid">
          <div><h3>현재 제공 파일</h3><ul>{editorial.files.map(x => <li key={x}>{x}</li>)}</ul></div>
          <div><h3>형태</h3><ul>{editorial.forms.map(x => <li key={x}>{x}</li>)}</ul></div>
        </div>
        <p className="brand-asset-facts__note">{editorial.note} {editorial.guideline} 배경이 투명한 PNG는 밝은 배경에서 먼저 확인하고, 흰색 로고는 어두운 배경에서 확인하세요. 다운로드 가능하거나 상표가 등록되어 있다는 사실만으로 사용 허가가 확인되는 것은 아닙니다.</p>
        <div className="brand-asset-facts__links">
          <a href={editorial.sourceUrl} target="_blank" rel="noopener noreferrer">공식 출처 확인 ↗</a>
          {editorial.guideUrl && <a href={editorial.guideUrl} target="_blank" rel="noopener noreferrer">{editorial.guideLabel} ↗</a>}
          <a href="https://www.kipris.or.kr/khome/main.do" target="_blank" rel="noopener noreferrer">상표 등록정보 검색 (KIPRIS) ↗</a>
        </div>
      </div>
    </section>
  );
}
