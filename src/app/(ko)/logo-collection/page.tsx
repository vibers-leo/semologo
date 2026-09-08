import LogoGuide from "@/components/LogoGuide";
import { languageAlternates } from "@/lib/locales";
export const metadata = {title: "브랜드 로고 모음 · SVG·PNG 무료 다운로드 | 세모로고", description: "기업·IT·패션 브랜드 로고 모음. SVG 벡터와 PNG 파일을 검색하고 자주 쓰는 로고를 저장해 보세요.", alternates: {canonical: "/logo-collection", languages: languageAlternates("/logo-collection")}};
export default function Page() {return <LogoGuide locale="ko" illustrator={false}/>;}
