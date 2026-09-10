export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  tags: string[];
  author: string;
  readingMinutes: number;
  sources?: { label: string; url: string }[];
  videoScript?: string[];
  sections: { heading: string; paragraphs: string[] }[];
};

export const BLOG_POSTS: BlogPost[] = [
  { slug: "semologo-keyenai-companion", title: "세모로고 로고를 고를 때 SVG와 PNG를 확인하는 방법", description: "키엔AI 매거진을 바탕으로, 세모로고에서 로고 형식과 미리보기를 확인하고 안전하게 내려받는 흐름을 정리했어요.", date: "2026-09-10", category: "로고 이야기", tags: ["세모로고", "SVG", "PNG", "로고 다운로드"], author: "세모로고 편집팀", readingMinutes: 4, sources: [{ label: "키엔AI 원문 매거진", url: "https://keyenai.com/articles/vbs-semologo-intro" }], sections: [
    { heading: "키엔AI 원문에서 다룬 세모로고", paragraphs: ["키엔AI는 세모로고를 브랜드 로고를 SVG·PNG로 찾아 내려받는 서비스로 소개했어요. 이 글은 원문을 그대로 옮기지 않고, 실제 세모로고 화면에서 파일을 고르는 방법과 검수 기준을 덧붙인 동반 해설판이에요.", "세모로고에는 IT·테크, 금융·결제, 식음료, 공공·기관, 뷰티·패션 등 여러 분야의 브랜드가 있어요. 브랜드 이름을 한글과 영문으로 검색하고, 상세 페이지에서 준비된 파일 형식을 확인하면 돼요."] },
    { heading: "SVG와 PNG 중 어떤 파일을 받을까요?", paragraphs: ["현수막·간판·인쇄물처럼 크기를 크게 바꿀 작업에는 SVG가 잘 맞아요. 벡터 형식이라 확대해도 가장자리가 흐려지지 않고 Illustrator에서도 열 수 있어요.", "카카오톡 프로필이나 블로그 본문처럼 화면에 바로 배치할 때는 PNG가 편해요. 투명 배경, 고해상도, 다크 배경용 변형이 있는지 미리보기에서 확인한 뒤 필요한 파일을 선택해 주세요."] },
    { heading: "다운로드 전에 미리보기로 확인해요", paragraphs: ["가로로 긴 워드마크를 정사각형 자리에 넣으면 글자가 눌려 보일 수 있어요. 세모로고의 OG 이미지·파비콘·앱 아이콘 미리보기에서 실제 사용 모습을 확인하고, 필요하면 심볼형 파일을 고르는 편이 안전해요.", "파일을 무료로 받는 것과 상표 사용 권한은 별개예요. 제휴를 암시하거나 로고를 굿즈에 넣어 판매하는 등 상업적 사용은 브랜드 가이드와 허가 범위를 먼저 확인해 주세요."] },
    { heading: "원하는 로고가 없다면", paragraphs: ["브랜드 페이지의 로고 요청으로 필요한 브랜드와 형식을 알려 주세요. 더 좋은 공식 파일을 가지고 있다면 로고 제보로 공유할 수 있고, 잘못되거나 오래된 파일은 교체 필요로 알려 주세요.", "키엔AI 원문은 서비스 소개와 배경을, 세모로고는 실제 검색·미리보기·다운로드를 담당하도록 나누면 두 글자가 서로 보완돼요."] },
  ]},
  { slug: "svg-vs-png-logo-guide", title: "로고 다운로드, SVG와 PNG 중 무엇을 써야 할까요?", description: "인쇄·웹·앱 아이콘 상황별로 SVG와 PNG 로고를 고르는 기준을 정리했어요.", date: "2026-09-09", category: "사용법", tags: ["SVG", "PNG", "로고 다운로드"], author: "세모로고 편집팀", readingMinutes: 3, sections: [
    { heading: "크기를 바꿔야 한다면 SVG예요", paragraphs: ["SVG는 선과 도형을 코드로 저장하는 벡터 파일이라 크게 확대해도 선명해요.", "웹사이트 헤더, 인쇄물, 발표 자료처럼 다양한 크기로 써야 할 때 먼저 SVG를 확인해 보세요."] },
    { heading: "바로 붙여 넣을 이미지는 PNG예요", paragraphs: ["PNG는 투명 배경을 지원하는 이미지 파일이라 디자인 툴과 문서에 빠르게 넣기 좋아요.", "원본 SVG가 없는 브랜드는 고해상도 PNG를 제공할 수 있으니 상세 페이지의 파일 형식을 확인해 주세요."] },
  ]},
  { slug: "illustrator-open-svg", title: "Illustrator에서 SVG 로고를 여는 방법", description: "AI 원본이 없어도 SVG를 Illustrator에서 편집하고 저장하는 기본 흐름을 안내해요.", date: "2026-09-08", category: "Illustrator", tags: ["Adobe Illustrator", "AI 파일", "SVG 편집"], author: "세모로고 편집팀", readingMinutes: 3, sections: [
    { heading: "SVG 파일 열기", paragraphs: ["Illustrator에서 파일 열기를 선택하고 내려받은 SVG를 지정하면 돼요.", "글자가 패스로 변환된 로고는 설치된 폰트와 관계없이 같은 모양으로 열려요."] },
    { heading: "AI 파일과 다른 점", paragraphs: ["SVG를 Illustrator에서 열 수 있어도 원본 .ai 파일과 동일한 편집 정보가 보존되는 것은 아니에요.", "레이어와 효과가 필요한 작업이라면 브랜드가 배포한 AI 원본이나 사용 가이드를 확인해 주세요."] },
  ]},
  { slug: "fashion-brand-logo-search", title: "패션 브랜드 로고를 빠르게 찾는 검색 방법", description: "명품·의류·뷰티 브랜드 로고를 이름과 파일 형식으로 좁혀 찾는 방법을 소개해요.", date: "2026-09-07", category: "검색 팁", tags: ["패션 브랜드", "명품 로고", "브랜드 검색"], author: "세모로고 편집팀", readingMinutes: 2, sections: [
    { heading: "영문명과 한글명을 함께 검색해요", paragraphs: ["세모로고는 한글명·영문명·별칭을 함께 검색해요. 예를 들어 ‘나이키’와 ‘Nike’ 모두 같은 브랜드를 찾을 수 있어요.", "검색 결과에서 뷰티·패션 카테고리를 선택하면 관련 브랜드만 빠르게 볼 수 있어요."] },
    { heading: "SVG 배지부터 확인해요", paragraphs: ["확대·편집이 목적이면 카드의 SVG 배지를 확인하세요. PNG만 있는 경우에는 투명 배경과 해상도를 상세 페이지에서 확인하면 돼요."] },
  ]},
  { slug: "nike-swoosh-story", title: "나이키 스우시 로고에 숨겨진 이야기", description: "1971년 한 디자인 학생의 작업에서 시작된 스우시가 어떻게 나이키의 상징이 되었는지 살펴봐요.", date: "2026-09-06", category: "로고 이야기", tags: ["나이키", "스우시", "로고 역사"], author: "세모로고 편집팀", readingMinutes: 4, sources: [{ label: "NIKE, Inc. 공식 역사", url: "https://about.nike.com/en/magazine/nike-swoosh-logo-history" }], videoScript: ["1971년, 나이키의 전신 회사는 새로운 로고가 필요했어요.", "포틀랜드 주립대 디자인 학생 캐럴린 데이비슨이 여러 시안을 만들었고, 그중 하나가 지금의 스우시예요.", "나이키 공식 기록에 따르면 1972년 보스턴 마라톤에서 스우시가 붙은 신발이 처음 큰 무대에 등장했어요.", "작은 러닝화 로고가 세계적인 움직임의 상징이 된 이야기예요."], sections: [
    { heading: "1971년, 빠르게 결정된 로고", paragraphs: ["나이키 공식 기록에 따르면 당시 회사는 새 신발에 붙일 로고가 필요했고, 포틀랜드 주립대에서 디자인을 공부하던 캐럴린 데이비슨에게 작업을 맡겼어요.", "스우시는 처음부터 완벽하다는 평가를 받은 건 아니지만, 움직임과 속도를 떠올리게 하는 간결한 형태로 선택됐어요."] },
    { heading: "스우시가 남긴 것", paragraphs: ["1972년 보스턴 마라톤에서 스우시가 붙은 나이키 신발이 등장하면서 로고는 제품을 넘어 선수와 스포츠 문화의 상징으로 확장됐어요.", "이 이야기는 좋은 로고가 복잡한 설명보다 반복되는 사용 경험 속에서 의미를 얻는다는 점을 보여줘요."] },
  ]},
];

export function getBlogPost(slug: string) { return BLOG_POSTS.find(post => post.slug === slug); }
