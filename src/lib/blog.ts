export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  sections: { heading: string; paragraphs: string[] }[];
};

export const BLOG_POSTS: BlogPost[] = [
  { slug: "svg-vs-png-logo-guide", title: "로고 다운로드, SVG와 PNG 중 무엇을 써야 할까요?", description: "인쇄·웹·앱 아이콘 상황별로 SVG와 PNG 로고를 고르는 기준을 정리했어요.", date: "2026-09-09", category: "사용법", sections: [
    { heading: "크기를 바꿔야 한다면 SVG예요", paragraphs: ["SVG는 선과 도형을 코드로 저장하는 벡터 파일이라 크게 확대해도 선명해요.", "웹사이트 헤더, 인쇄물, 발표 자료처럼 다양한 크기로 써야 할 때 먼저 SVG를 확인해 보세요."] },
    { heading: "바로 붙여 넣을 이미지는 PNG예요", paragraphs: ["PNG는 투명 배경을 지원하는 이미지 파일이라 디자인 툴과 문서에 빠르게 넣기 좋아요.", "원본 SVG가 없는 브랜드는 고해상도 PNG를 제공할 수 있으니 상세 페이지의 파일 형식을 확인해 주세요."] },
  ]},
  { slug: "illustrator-open-svg", title: "Illustrator에서 SVG 로고를 여는 방법", description: "AI 원본이 없어도 SVG를 Illustrator에서 편집하고 저장하는 기본 흐름을 안내해요.", date: "2026-09-08", category: "Illustrator", sections: [
    { heading: "SVG 파일 열기", paragraphs: ["Illustrator에서 파일 열기를 선택하고 내려받은 SVG를 지정하면 돼요.", "글자가 패스로 변환된 로고는 설치된 폰트와 관계없이 같은 모양으로 열려요."] },
    { heading: "AI 파일과 다른 점", paragraphs: ["SVG를 Illustrator에서 열 수 있어도 원본 .ai 파일과 동일한 편집 정보가 보존되는 것은 아니에요.", "레이어와 효과가 필요한 작업이라면 브랜드가 배포한 AI 원본이나 사용 가이드를 확인해 주세요."] },
  ]},
  { slug: "fashion-brand-logo-search", title: "패션 브랜드 로고를 빠르게 찾는 검색 방법", description: "명품·의류·뷰티 브랜드 로고를 이름과 파일 형식으로 좁혀 찾는 방법을 소개해요.", date: "2026-09-07", category: "검색 팁", sections: [
    { heading: "영문명과 한글명을 함께 검색해요", paragraphs: ["세모로고는 한글명·영문명·별칭을 함께 검색해요. 예를 들어 ‘나이키’와 ‘Nike’ 모두 같은 브랜드를 찾을 수 있어요.", "검색 결과에서 뷰티·패션 카테고리를 선택하면 관련 브랜드만 빠르게 볼 수 있어요."] },
    { heading: "SVG 배지부터 확인해요", paragraphs: ["확대·편집이 목적이면 카드의 SVG 배지를 확인하세요. PNG만 있는 경우에는 투명 배경과 해상도를 상세 페이지에서 확인하면 돼요."] },
  ]},
];

export function getBlogPost(slug: string) { return BLOG_POSTS.find(post => post.slug === slug); }
